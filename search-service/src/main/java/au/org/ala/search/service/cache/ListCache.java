package au.org.ala.search.service.cache;

import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.ListService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * This service provides a cache for species list information that is injected into some API responses.
 *
 * Use the {@link #listNames} ConcurrentHashMap to get the list id for a given list name.
 *
 * This list is refreshed when ListImportService is finished.
 *
 */
@Service
public class ListCache {

    private static final Logger logger = LoggerFactory.getLogger(ListCache.class);

    final ElasticService elasticService;
    final ListService listService;

    // This is a map of species list names to their ids
    public Map<String, String> listNames = new ConcurrentHashMap<>();

    public ListCache(ElasticService elasticService, ListService listService) {
        this.elasticService = elasticService;
        this.listService = listService;
    }

    @PostConstruct
    void init() {
        cacheRefresh();
    }

    @Scheduled(cron = "${list.cache.cron}")
    public void cacheRefresh() {
        try {
            listService.authoritativeLists().forEach(list -> {
                String listId = (String) list.get("dataResourceUid");
                String listName = (String) list.get("listName");
                listNames.put(listId, listName);
            });
        } catch (Exception e) {
            logger.error("Failed to cache species list names", e.getMessage());
        }
    }


}
