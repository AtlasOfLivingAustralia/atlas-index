package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class LayerImportService {
    private static final TaskType taskType = TaskType.LAYER;

    private static final Logger logger = LoggerFactory.getLogger(LayerImportService.class);
    protected final ElasticService elasticService;
    protected final LogService logService;
    private final RestTemplate restTemplate = new RestTemplate();
    @Value("${spatial.url}")
    private String spatialUrl;

    @Value("${spatial.layerPath}")
    private String layerPath;

    public LayerImportService(ElasticService elasticService, LogService logService) {
        this.elasticService = elasticService;
        this.logService = logService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        logService.log(taskType, "Starting layer import");

        List<IndexQuery> buffer = new ArrayList<>();

        Map<String, Date> existingItems = elasticService.queryItems("idxtype", IndexDocType.LAYER.name());

        Map<String, SearchItemIndex> items = getLayers(existingItems);

        int counter = 0;

        for (Map.Entry<String, SearchItemIndex> item : items.entrySet()) {
            buffer.add(elasticService.buildIndexQuery(item.getValue()));

            if (buffer.size() > 1000) {
                counter += elasticService.flushImmediately(buffer);

                logService.log(taskType, "lists import progress: " + counter);
            }
        }

        counter += elasticService.flushImmediately(buffer);
        long deleted = elasticService.removeDeletedItems(existingItems);

        logService.log(taskType, "Finished updates: " + counter + ", deleted: " + deleted);
        return CompletableFuture.completedFuture(true);
    }

    // removes pages from existingPages as they are found
    private Map<String, SearchItemIndex> getLayers(Map<String, Date> existingLists) {
        Map<String, SearchItemIndex> updateList = new HashMap<>();

        try {
            ResponseEntity<List> response =
                    restTemplate.exchange(spatialUrl + "/layers", HttpMethod.GET, null, List.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                List<Map<String, Object>> layers = response.getBody();

                logService.log(taskType, "found " + layers.size() + " layers");

                for (Map<String, Object> layer : layers) {
                    String name = (String) layer.get("name");
                    String url = spatialUrl + layerPath + name;
                    String displayName = (String) layer.get("displayname");
                    Boolean enabled = (Boolean) layer.getOrDefault("enabled", false);

                    String notes = (String) layer.getOrDefault("notes", null);
                    String description = (String) layer.getOrDefault("description", null);
                    String body =
                            notes == null
                                    ? description
                                    : (description == null
                                    ? notes
                                    : (description.length() > notes.length() ? description : notes));

                    String classification1 = (String) layer.getOrDefault("classification1", null);
                    String classification2 = (String) layer.getOrDefault("classification2", null);
                    String keywords = (String) layer.getOrDefault("keywords", null);
                    String domain = (String) layer.getOrDefault("domain", null);
                    String type = (String) layer.getOrDefault("type", null);
                    String source = (String) layer.getOrDefault("source", null);

                    if (!enabled) {
                        continue;
                    }

                    // compare with the current indexed item because there is no last modified date property
                    SearchItemIndex stored = elasticService.getDocument(url);

                    if (stored == null
                            || !stored.getId().equals(url)
                            || !stored.getGuid().equals(url)
                            || !stored.getName().equals(displayName)
                            || !stringEquals(stored.getDescription(), body)
                            || !stringEquals(stored.getClassification1(), classification1)
                            || !stringEquals(stored.getClassification2(), classification2)
                            || !stringEquals(stored.getKeywords(), keywords)
                            || !stringEquals(stored.getDomain(), domain)
                            || !stringEquals(stored.getType(), type)
                            || !stringEquals(stored.getSource(), source)
                        ) {
                        updateList.put(
                                url,
                                SearchItemIndex.builder()
                                        .id(url)
                                        .guid(url)
                                        .idxtype(IndexDocType.LAYER.name())
                                        .name(displayName)
                                        .description(body)
                                        .modified(new Date())
                                        .classification1(classification1)
                                        .classification2(classification2)
                                        .keywords(keywords)
                                        .domain(domain)
                                        .type(type)
                                        .source(source)
                                        .image(spatialUrl + "/layer/img/" + name + ".jpg")
                                        .build());
                    }

                    // remove this list from existingLists so that existingLists will only contain lists deleted
                    existingLists.remove(url);
                }
            }
        } catch (Exception e) {
            logService.log(taskType, "Error failed to get layers: " + e.getMessage());
            logger.error(e.getMessage(), e);
        }
        return updateList;
    }

    private boolean stringEquals(String a, String b) {
        if (a == null || b == null) {
            return a == null && b == null;
        }
        return a.equals(b);
    }
}
