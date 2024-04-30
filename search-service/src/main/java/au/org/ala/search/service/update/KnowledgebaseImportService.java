package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class KnowledgebaseImportService {
    private static final TaskType taskType = TaskType.KNOWLEDGEBASE;

    private static final Logger logger = LoggerFactory.getLogger(KnowledgebaseImportService.class);
    protected final ElasticService elasticService;
    protected final LogService logService;

    @Value("${knowledgebase.url}")
    private String knowledgebaseUrl;

    @Value("${knowledgebase.sitemap}")
    private String sitemap;

    @Value("${knowledgebase.timeout}")
    private Integer timeout;

    public KnowledgebaseImportService(ElasticService elasticService, LogService logService) {
        this.elasticService = elasticService;
        this.logService = logService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        logService.log(taskType, "Starting knowledgebase import");

        List<IndexQuery> buffer = new ArrayList<>();

        Map<String, Date> existingPages = elasticService.queryItems("idxtype", IndexDocType.KNOWLEDGEBASE.name());

        Map<String, Date> pages = listPages(existingPages);

        int counter = 0;

        for (Map.Entry<String, Date> page : pages.entrySet()) {
            SearchItemIndex searchItemIndex = getItemIndex(page.getKey(), page.getValue());

            if (searchItemIndex != null) {
                buffer.add(elasticService.buildIndexQuery(searchItemIndex));
            }

            if (buffer.size() > 1000) {
                counter += elasticService.flushImmediately(buffer);

                logService.log(taskType, "knowledgebase import progress: " + counter);
            }
        }

        counter += elasticService.flushImmediately(buffer);
        long deleted = elasticService.removeDeletedItems(existingPages);

        logService.log(taskType, "Finished updates: " + counter + ", deleted: " + deleted);
        return CompletableFuture.completedFuture(true);
    }

    // removes pages from existingPages as they are found
    private Map<String, Date> listPages(Map<String, Date> existingPages) {
        Map<String, Date> locations = new HashMap<>();

        try {
            Document doc = Jsoup.connect(knowledgebaseUrl + sitemap).timeout(timeout).get();

            Elements urlset = doc.select("urlset url");
            for (Element url : urlset) {
                String pageUrl = url.select("loc").text();
                String lastmod = url.select("lastmod").text();
                try {
                    Date current = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ssX").parse(lastmod);
                    Date stored = existingPages.get(pageUrl);
                    if (stored == null || stored.compareTo(current) < 0) {
                        locations.put(pageUrl, current);
                    }

                    // remove this page from existingPages so that existingPages will only contain pages
                    // deleted
                    if (stored != null) {
                        // assume no duplicates
                        existingPages.remove(pageUrl);
                    }
                } catch (ParseException ex) {
                    logService.log(taskType, "failed to parse lastmod " + pageUrl + ", ignoring, " + ex.getMessage());
                }
            }
        } catch (IOException ex) {
            logService.log(taskType,
                    "Unable to retrieve "
                            + knowledgebaseUrl
                            + sitemap
                            + ": "
                            + ex.getMessage()
                            + ", ignoring");
        }

        logService.log(taskType, "pages: " + locations.size());
        return locations;
    }

    private SearchItemIndex getItemIndex(String url, Date lastmod) {
        try {
            Document page = Jsoup.connect(url).timeout(timeout).get();

            String title = page.select(".content h2.heading").text();
            String body = page.select("article.article-body").text();

            return SearchItemIndex.builder()
                    .id(url)
                    .guid(url)
                    .idxtype(IndexDocType.KNOWLEDGEBASE.name())
                    .name(title)
                    .description(body)
                    .modified(lastmod)
                    .build();
        } catch (IOException e) {
            logService.log(taskType, "cannot index " + url + ", " + e.getMessage());
        }

        return null;
    }
}
