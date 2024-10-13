package au.org.ala.search.service.cache;

import au.org.ala.search.service.remote.ElasticService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * This service provides a cache for collectory information
 * - dataResourceUid -> name
 *
 */
@Service
public class CollectoryCache {

    private static final Logger logger = LoggerFactory.getLogger(CollectoryCache.class);

    final ElasticService elasticService;

    // This is a map of species list names to their ids
    public Map<String, String> dataResourceNames = new ConcurrentHashMap<>();

    public CollectoryCache(ElasticService elasticService) {
        this.elasticService = elasticService;
    }

    @PostConstruct
    void init() {
        cacheDataResourceNames();
    }

    // TODO: this should be triggered via a RabbitMQ in a multi-instance deployment, and this will be triggered by
    //  running the CollectionsImportService
    @Scheduled(cron = "0 0 * * * ?")
    public void cacheDataResourceNames() {
        try {
            // TODO: to get 'all' results, the proper search function should be used instead of this pageSize=10000
            Map<String, Object> result = elasticService.search("idxtype:DATARESOURCE", null, 0, 10000, null, null, null, new String[] { "id", "name"});
            if (result != null && result.containsKey("searchResults")) {
                List dataResourceList = (List) result.get("searchResults");
                for (Object dataResource : dataResourceList) {
                    Map<String, Object> dataResourceMap = (Map<String, Object>) dataResource;
                    String id = (String) dataResourceMap.get("id");
                    String name = (String) dataResourceMap.get("name");
                    dataResourceNames.put(name, id);
                }
            }
        } catch (Exception e) {
            // Note: this error is always logged when the index has not yet been initialized with idxtype:DATARESOURCE
            logger.error("Failed to cache data resource names", e.getMessage());
        }
    }


}
