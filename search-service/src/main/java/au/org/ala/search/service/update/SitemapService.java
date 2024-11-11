package au.org.ala.search.service.update;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.query.Op;
import au.org.ala.search.names.TaxonomicType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.service.remote.SitemapFileStoreService;
import au.org.ala.search.util.QueryParserUtil;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.query_dsl.FieldAndFormat;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileOutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import java.util.zip.GZIPOutputStream;

@Service
public class SitemapService {
    private static final TaskType taskType = TaskType.SITEMAP;

    private static final Logger logger = LoggerFactory.getLogger(SitemapService.class);
    static String URLSET_HEADER = "<?xml version='1.0' encoding='UTF-8'?><urlset xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd\" xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">";
    static String URLSET_FOOTER = "</urlset>";
    static int MAX_URLS = 50000; // maximum number of URLs in a sitemap file
    static int MAX_SIZE = 9 * 1024 * 1024; // use 9MB to keep the actual file size below 10MB (a gateway limit)
    protected final ElasticService elasticService;
    protected final LogService logService;
    protected final SitemapFileStoreService sitemapFileStoreService;
    List<Date> lastMod = new ArrayList<>();
    Date currentLastMod;
    SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd");
    @Value("${sitemap.url}")
    private String uiUrl;
    @Value("${speciesUrlPrefix}")
    private String speciesUrl;

    public SitemapService(ElasticService elasticService, LogService logService, SitemapFileStoreService sitemapFileStoreService) {
        this.elasticService = elasticService;
        this.logService = logService;
        this.sitemapFileStoreService = sitemapFileStoreService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        logService.log(taskType, "Start");
        lastMod = new ArrayList<>();
        currentLastMod = null;

        buildSitemapPages();
        buildSitemapIndex();

        removeObsoleteFiles();

        logService.log(taskType, "Finished");

        return CompletableFuture.completedFuture(true);
    }

    // write parent sitemap file
    void buildSitemapIndex() {
        StringBuilder sb = new StringBuilder();

        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?><sitemapindex xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");

        for (int i = 0; i < lastMod.size(); i++) {
            sb.append("<sitemap><loc>").append(uiUrl).append("/sitemap").append(i).append(".xml.gz").append("</loc>");
            sb.append("<lastmod>").append(simpleDateFormat.format(lastMod.get(i))).append("</lastmod></sitemap>");
        }

        sb.append("</sitemapindex>");

        write("sitemap.xml", sb.toString(), null, false);
    }

    void write(String filename, String content, Date date, boolean gzip) {
        if (lastMod != null) {
            // child xml
            lastMod.add(date);
        }

        File tmpFile = null;

        try {
            tmpFile = File.createTempFile("sitemap", ".xml" + (gzip ? ".gz" : ""));

            if (gzip) {
                try (FileOutputStream fos = new FileOutputStream(tmpFile);
                     GZIPOutputStream gos = new GZIPOutputStream(fos)) {
                    gos.write(content.getBytes(StandardCharsets.UTF_8));
                }
            } else {
                FileUtils.write(tmpFile, content, StandardCharsets.UTF_8);
            }

            sitemapFileStoreService.copyToFileStore(tmpFile, filename + (gzip ? ".gz" : ""), true);
        } catch (Exception e) {
            logService.log(taskType, "Error failed to write sitemap file: " + filename + (gzip ? ".gz" : ""));
            logger.error("failed to write sitemap file: " + filename + (gzip ? ".gz" : ""));
        } finally {
            if (tmpFile != null && tmpFile.exists()) {
                tmpFile.delete();
            }
        }
    }

    void buildSitemapPages() {
        List<FieldAndFormat> fieldList = new ArrayList<>(6);
        fieldList.add(new FieldAndFormat.Builder().field("id").build());
        fieldList.add(new FieldAndFormat.Builder().field("guid").build());
        fieldList.add(new FieldAndFormat.Builder().field("modified").build());
        fieldList.add(new FieldAndFormat.Builder().field("scientificName").build());
        fieldList.add(new FieldAndFormat.Builder().field("commonNameSingle").build());
        fieldList.add(new FieldAndFormat.Builder().field("nameComplete").build());

        StringBuilder buffer = new StringBuilder();
        buffer.append(URLSET_HEADER);

        String pit = null;

        int counter = 0;
        int pageSize = 1000;
        try {
            logService.log(taskType, "Start paging for sitemap");

            pit = elasticService.openPointInTime();

            List<FieldValue> searchAfter = null;

            Map<String, Object> query = new HashMap<>();
            query.put("idxtype", "TAXON");
            query.put(
                    "taxonomicStatus",
                    Arrays.stream(TaxonomicType.values())
                            .filter(TaxonomicType::isAccepted)
                            .map(TaxonomicType::getTerm)
                            .collect(Collectors.toList()));

            String queryString = "idxtype:\"TAXON\" AND (";
            String taxonomicStatusTerm = "";
            for(String value : Arrays.stream(TaxonomicType.values())
                    .filter(TaxonomicType::isAccepted)
                    .map(TaxonomicType::getTerm)
                    .collect(Collectors.toList())) {
                if (!taxonomicStatusTerm.isEmpty()) {
                    taxonomicStatusTerm += " OR ";
                }
                taxonomicStatusTerm += "taxonomicStatus:\"" + value + "\"";
            }
            queryString += taxonomicStatusTerm + ")";
            Op op = QueryParserUtil.parse(queryString, null, elasticService::isValidField);
            co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

            boolean hasMore = true;
            while (hasMore) {
                SearchResponse<SearchItemIndex> result =
                        elasticService.queryPointInTimeAfter(
                                pit, searchAfter, pageSize, queryOp, fieldList, null, false);
                List<Hit<SearchItemIndex>> hits = result.hits().hits();
                searchAfter = hits.getLast().sort();

                for (Hit<SearchItemIndex> hit : hits) {
                    SearchItemIndex item = hitToItem(hit);

                    String nameString = item.getScientificName();
                    if (StringUtils.isEmpty(nameString)) nameString = item.getNameComplete();
                    if (StringUtils.isEmpty(nameString)) nameString = item.getCommonNameSingle();

                    if (nameString != null) {
                        buffer = writeUrl(buffer, "monthly", speciesUrl + URLEncoder.encode(nameString, StandardCharsets.UTF_8), item.modified, true);
                        counter++;
                    }
                }

                hasMore = hits.size() == pageSize;
            }

            // the buffer will never be empty because it will always contain at least URLSET_HEADER, this
            // is acceptable
            if (!buffer.isEmpty()) {
                buffer.append(URLSET_FOOTER);
                write("sitemap" + lastMod.size() + ".xml", buffer.toString(), currentLastMod, true);
            }

            logService.log(taskType, "Finished urls: " + counter);
        } catch (Exception ex) {
            logService.log(taskType, "Error failed sitemap: " + ex.getMessage());
            logger.error("failed sitemap: " + ex.getMessage(), ex);
        } finally {
            try {
                if (pit != null) {
                    elasticService.closePointInTime(pit);
                }
            } catch (Exception e) {
                logger.error("Failed to close point in time", e);
            }
        }
    }

    private SearchItemIndex hitToItem(Hit<SearchItemIndex> hit) {
        JsonData id = hit.fields().get("id");
        JsonData guid = hit.fields().get("guid");
        JsonData modified = hit.fields().get("modified");
        JsonData scientificName = hit.fields().get("scientificName");
        JsonData commonNameSingle = hit.fields().get("commonNameSingle");
        JsonData nameComplete = hit.fields().get("nameComplete");

        return SearchItemIndex.builder()
                .id(id == null ? null : id.toJson().asJsonArray().getJsonString(0).getString())
                .guid(guid == null ? null : guid.toJson().asJsonArray().getJsonString(0).getString())
                .modified(modified == null ? null : new Date(modified.toJson().asJsonArray().getJsonNumber(0).bigIntegerValue().longValue()))
                .scientificName(scientificName == null ? null : scientificName.toJson().asJsonArray().getJsonString(0).getString())
                .commonNameSingle(commonNameSingle == null ? null : commonNameSingle.toJson().asJsonArray().getJsonString(0).getString())
                .nameComplete(nameComplete == null ? null : nameComplete.toJson().asJsonArray().getJsonString(0).getString())
                .build();
    }

    StringBuilder writeUrl(StringBuilder sb, String changefreq, String encodedUrl, Date date, boolean gzip) {
        if (currentLastMod == null || date.compareTo(currentLastMod) > 0) {
            currentLastMod = date;
        }
        if (lastMod.size() >= MAX_URLS || sb.length() >= MAX_SIZE) {
            sb.append(URLSET_FOOTER);
            write("sitemap" + lastMod.size() + ".xml", sb.toString(), currentLastMod, gzip);
            currentLastMod = null;
            sb = new StringBuilder();
            sb.append(URLSET_HEADER);
        }

        sb.append("<url>")
                .append("<loc>")
                .append(encodedUrl)
                .append("</loc>")
                .append("<lastmod>")
                .append(simpleDateFormat.format(date))
                .append("</lastmod>")
                .append("<changefreq>")
                .append(changefreq)
                .append("</changefreq>")
                .append("</url>");

        return sb;
    }

    void removeObsoleteFiles() {
        boolean hasMore = true;
        for (int i = lastMod.size() - 1; hasMore; i++) {
            hasMore = sitemapFileStoreService.deleteFile("sitemap" + i + ".xml");
        }
    }
}
