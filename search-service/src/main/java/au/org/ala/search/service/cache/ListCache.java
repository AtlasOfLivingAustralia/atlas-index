/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.cache;

import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.ListApiService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * This service provides a cache for species list information that is injected into some API responses.
 * <p>
 * Use the {@link #listNames} ConcurrentHashMap to get the list id for a given list name.
 * <p>
 * This list is refreshed when ListImportService is finished.
 */
@Slf4j
@Service
public class ListCache {

    final ListApiService listApiService;

    // This is a map of species list names to their ids
    public Map<String, String> listNames = new ConcurrentHashMap<>();

    public ListCache(ListApiService listApiService) {
        this.listApiService = listApiService;
    }

    @PostConstruct
    void init() {
        cacheRefresh();
    }

    // TODO: finish moving to SchedulerService
    @Scheduled(cron = "${list.cache.cron}")
    public void cacheRefresh() {
        try {
            listApiService.authoritativeLists().forEach(list -> {
                String listId = (String) list.get("dataResourceUid");
                String listName = (String) list.get("listName");
                listNames.put(listId, listName);
            });
        } catch (Exception e) {
            log.error("Failed to cache species list: {}", e.getMessage(), e);
        }
    }
}
