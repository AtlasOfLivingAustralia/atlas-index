package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import io.micrometer.common.util.StringUtils;
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
public class WordpressImportService {
    private static final TaskType taskType = TaskType.WORDPRESS;

    private static final Logger logger = LoggerFactory.getLogger(WordpressImportService.class);
    protected final ElasticService elasticService;
    protected final LogService logService;

    @Value("${wordpress.url}")
    private String wordpressUrl;

    @Value("${wordpress.contentOnlyParams}")
    private String contentOnlyParams;

    @Value("${wordpress.sitemap}")
    private String sitemap;

    @Value("${wordpress.timeout}")
    private Integer timeout;

    @Value("${wordpress.titleSelector}")
    private String titleSelector;

    @Value("${wordpress.contentSelector}")
    private String contentSelector;

    public WordpressImportService(ElasticService elasticService, LogService logService) {
        this.elasticService = elasticService;
        this.logService = logService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        logService.log(taskType, "Starting");

        List<IndexQuery> buffer = new ArrayList<>();

        Map<String, Date> existingPages = elasticService.queryItems("idxtype", IndexDocType.WORDPRESS.name());

        Map<String, Date> pages = listPages(existingPages);

        int counter = 0;

        for (Map.Entry<String, Date> page : pages.entrySet()) {
            SearchItemIndex searchItemIndex = getItemIndex(page.getKey(), page.getValue());

            if (searchItemIndex != null) {
                buffer.add(elasticService.buildIndexQuery(searchItemIndex));
            }

            if (buffer.size() > 1000) {
                counter += elasticService.flushImmediately(buffer);

                logService.log(taskType, "wordpress import progress: " + counter);
            }
        }

        counter += elasticService.flushImmediately(buffer);
        long deleted = elasticService.removeDeletedItems(existingPages);

        logService.log(taskType, "Finished updates: " + counter + ", deleted: " + deleted);
        return CompletableFuture.completedFuture(true);
    }

    // removes pages from existingPages as they are found
    private Map<String, Date> listPages(Map<String, Date> existingPages) {
        Queue<String> queue = new ArrayDeque<>();
        queue.add(wordpressUrl + sitemap);

        Set<String> seen = new HashSet<>();
        Map<String, Date> locations = new HashMap<>();

        while (!queue.isEmpty()) {
            String url = queue.remove();
            if (seen.contains(url)) {
                continue;
            } else {
                seen.add(url);
            }

            try {
                Document doc = Jsoup.connect(url).timeout(timeout).get();

                Elements sitemaps = doc.select("sitemapindex sitemap loc");
                for (Element loc : sitemaps) {
                    String sitemap = loc.text();
                    queue.add(sitemap);
                }
                Elements pages = doc.select("urlset url");
                for (Element item : pages) {
                    String lastmod = item.select("lastmod").text();
                    String pageUrl = item.select("loc").text();
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
                    } catch (ParseException e) {
                        logService.log(taskType, "cannot parse lastmod " + lastmod + " for " + url + ", " + e.getMessage());
                    }
                }
            } catch (IOException ex) {
                logService.log(taskType, "Unable to retrieve " + url + ": " + ex.getMessage() + ", ignoring");
            }
        }
        logService.log(taskType, "pages: " + locations.size());
        return locations;
    }

    private SearchItemIndex getItemIndex(String url, Date lastmod) {
        try {
            String fullUrl = url + contentOnlyParams;
            Document document = Jsoup.connect(fullUrl).timeout(timeout).get();

            // some summary/landing pages do not work with `content-only=1`, so we don't want to index
            // them
            if (!document.select("body.ala-content").isEmpty()
                    || StringUtils.isEmpty(document.body().text())) {
                return null;
            }

            String title = document.select(titleSelector).text();
            String main = document.select(contentSelector).text();
            return SearchItemIndex.builder()
                    .id(url)
                    .guid(url)
                    .idxtype(IndexDocType.WORDPRESS.name())
                    .name(title)
                    .description(main)
                    .modified(lastmod)
                    .build();
        } catch (IOException e) {
            logService.log(taskType, "cannot index " + url + ", " + e.getMessage());
        }

        return null;
    }
}
