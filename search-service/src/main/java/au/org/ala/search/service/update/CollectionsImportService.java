package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.remote.BiocacheService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class CollectionsImportService {
    private static final TaskType taskType = TaskType.COLLECTIONS;

    private static final Logger logger = LoggerFactory.getLogger(CollectionsImportService.class);
    protected final ElasticService elasticService;
    protected final LogService logService;
    protected final BiocacheService biocacheService;
    protected final CollectoryCache collectoryCache;
    private final RestTemplate restTemplate = new RestTemplate();
    @Value("${collections.url}")
    private String collectionsUrl;

    public CollectionsImportService(ElasticService elasticService, LogService logService, BiocacheService biocacheService, CollectoryCache collectoryCache) {
        this.elasticService = elasticService;
        this.logService = logService;
        this.biocacheService = biocacheService;
        this.collectoryCache = collectoryCache;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        logService.log(taskType, "Starting");

        int counter = importEntity("dataResource", IndexDocType.DATARESOURCE, biocacheService.entityCounts("dataResourceUid"));

        // reset datasetMap cache
        if (elasticService.datasetMap != null) {
            elasticService.datasetMap.clear();
        }

        counter += importEntity("dataProvider", IndexDocType.DATAPROVIDER, biocacheService.entityCounts("dataProviderUid"));
        counter += importEntity("institution", IndexDocType.INSTITUTION, biocacheService.entityCounts("institutionUid"));
        counter += importEntity("collection", IndexDocType.COLLECTION, biocacheService.entityCounts("collectionUid"));
        logService.log(taskType, "Finished updates: " + counter);
        return CompletableFuture.completedFuture(true).thenApply(
                a -> {
                    collectoryCache.cacheDataResourceNames();
                    return a;
                }
        );
    }

    private int importEntity(String name, IndexDocType type, Map<String, Integer> entityCounts) {
        logService.log(taskType, "Starting " + name + " import");

        List<IndexQuery> buffer = new ArrayList<>();

        Map<String, Date> existingLists = elasticService.queryItems("idxtype", type.name());

        Map<String, SearchItemIndex> items = getEntityList(name, type, existingLists, entityCounts);

        int counter = 0;

        for (Map.Entry<String, SearchItemIndex> item : items.entrySet()) {
            buffer.add(elasticService.buildIndexQuery(item.getValue()));

            if (buffer.size() > 1000) {
                counter += elasticService.flushImmediately(buffer);

                logService.log(taskType, name + " import progress: " + counter);
            }
        }

        counter += elasticService.flushImmediately(buffer);
        long deleted = elasticService.removeDeletedItems(existingLists);

        logService.log(taskType, name + " indexing finished: " + counter + ", deleted: " + deleted);
        return counter;
    }

    // removes pages from existingPages as they are found
    private Map<String, SearchItemIndex> getEntityList(
            String entityName, IndexDocType type, Map<String, Date> existingLists, Map<String, Integer> entityCounts) {
        Map<String, SearchItemIndex> updateList = new HashMap<>();

        int batchSize = 100;
        List<String> batchIds = new ArrayList<>();

        try {
            ResponseEntity<List> response = restTemplate.exchange(collectionsUrl + "/ws/" + entityName, HttpMethod.GET, null, List.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                List<Map<String, String>> entities = (List<Map<String, String>>) response.getBody();

                for (Map<String, String> entity : entities) {
                    String uid = entity.get("uid");
                    batchIds.add(uid);

                    if (batchIds.size() == batchSize) {
                        getEntityBatch(updateList, existingLists, entityName, type, batchIds, entityCounts);
                        batchIds.clear();
                    }
                }
            }

            if (!batchIds.isEmpty()) {
                getEntityBatch(updateList, existingLists, entityName, type, batchIds, entityCounts);
                batchIds.clear();
            }
        } catch (Exception e) {
            logService.log(taskType, "Error getting entities: " + entityName);
            logger.error(e.getMessage(), e);
        }
        return updateList;
    }

    private void getEntityBatch(
            Map<String, SearchItemIndex> updateList,
            Map<String, Date> existingLists,
            String entityName,
            IndexDocType type,
            List<String> batchIds,
            Map<String, Integer> entityCounts) {
        List<SearchItemIndex> items = getItems(entityName, type, batchIds);

        for (SearchItemIndex item : items) {
            Date stored = existingLists.get(item.getId());
            if (stored == null || stored.compareTo(item.getModified()) < 0
                    || !entityCounts.getOrDefault(item.getId(), 0).equals(item.getOccurrenceCount())) {

                item.setOccurrenceCount(entityCounts.getOrDefault(item.getId(), 0));
                updateList.put(item.getId(), item);
            }

            // remove this list from existingLists so that existingLists will only contain collections deleted
            if (stored != null) {
                // assume no duplicates
                existingLists.remove(item.getId());
            }
        }
    }

    private List<SearchItemIndex> getItems(String entityName, IndexDocType type, List<String> uids) {
        List<SearchItemIndex> result = new ArrayList<>();

        List list = restTemplate.postForObject(collectionsUrl + "/ws/find/" + entityName, uids, List.class);

        ObjectMapper objectMapper = new ObjectMapper();

        for (Object item : list) {
            Map<String, Object> properties;
            try {
                properties = objectMapper.readValue((String) item, Map.class);
            } catch (JsonProcessingException e) {
                logService.log(taskType, "Error parsing collectory entities");
                logger.error("failed to parse collection entity");
                return result;
            }

            String resourceType = (String) properties.get("resourceType");

            // exclude species lists as these are retrieved through ListsImportService
            if ("species-list".equals(resourceType)) {
                continue;
            }

            String id = (String) properties.get("uid");
            String guid = (String) properties.get("alaPublicUrl");
            String name = (String) properties.get("name");
            String description = (String) properties.getOrDefault("pubDescription", null);
            String rights = (String) properties.getOrDefault("rights", null);
            String license = (String) properties.getOrDefault("licenseType", null);
            String acronym = (String) properties.getOrDefault("acronym", null);
            String state = (String) properties.getOrDefault("state", null);

            Map<String, Object> provider = (Map<String, Object>) properties.getOrDefault("provider", new HashMap<>());
            String dataProvider = (String) provider.getOrDefault("name", null);

            Map<String, Object> logoRef = (Map<String, Object>) properties.getOrDefault("logoRef", new HashMap<>());
            String image = (String) logoRef.getOrDefault("uri", null);

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");
            Date lastmod;
            try {
                lastmod = sdf.parse((String) properties.get("lastUpdated"));
            } catch (Exception e) {
                logService.log(taskType, "failed to parse lastUpdated date for " + id);
                continue;
            }

            Date created;
            try {
                created = sdf.parse((String) properties.get("dateCreated"));
            } catch (Exception e) {
                logService.log(taskType, "failed to parse dateCreated date for " + id);
                continue;
            }

            result.add(SearchItemIndex.builder()
                            .id(id)
                            .guid(guid)
                            .idxtype(type.name())
                            .name(name)
                            .description(description)
                            .modified(lastmod)
                            .datasetID(id)
                            .rights(rights)
                            .license(license)
                            .acronym(acronym)
                            .image(image)
                            .resourceType(resourceType)
                            .created(created)
                            .state(state)
                            .dataProvider(dataProvider)
                            .build());
        }
        return result;
    }
}
