/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.util.FormatUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URL;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Service to import data from the Digivol API.
 */
@Service
public class DigivolImportService {
    private static final TaskType taskType = TaskType.DIGIVOL;
    private static final Logger logger = LoggerFactory.getLogger(DigivolImportService.class);

    protected final ElasticService elasticService;
    protected final LogService logService;

    @Value("${digivol.url}")
    private String digivolUrl;

    @Value("${digivol.expeditionUrl}")
    private String digivolExpeditionUrl;

    public DigivolImportService(ElasticService elasticService, LogService logService) {
        this.elasticService = elasticService;
        this.logService = logService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        logService.log(taskType, "Starting");

        Map<String, Date> existingItems = elasticService.queryItems("idxtype", IndexDocType.DIGIVOL.name());

        List<IndexQuery> buffer = new ArrayList<>();
        Map<String, SearchItemIndex> items = getList(existingItems);

        int counter = 0;

        for (Map.Entry<String, SearchItemIndex> item : items.entrySet()) {
            buffer.add(elasticService.buildIndexQuery(item.getValue()));

            if (buffer.size() >= 1000) {
                counter += elasticService.flushImmediately(buffer);
                buffer.clear();
                logService.log(taskType, "digivol import progress: " + counter);
            }
        }

        counter += elasticService.flushImmediately(buffer);

        logService.log(taskType, "Finished updates: " + counter);
        return CompletableFuture.completedFuture(true);
    }

    /**
     * Get a list of expeditions from the Digivol API.
     *
     * @return a map of expeditions to update
     */
    private Map<String, SearchItemIndex> getList(Map<String, Date> existingItems) {
        Map<String, SearchItemIndex> updateList = new HashMap<>();
        ObjectMapper objectMapper = new ObjectMapper();

        try {
            String url = digivolUrl + digivolExpeditionUrl;
            URL apiUrl = URI.create(url).toURL();

            List<Map<String, Object>> expeditions = objectMapper.readValue(apiUrl, new TypeReference<>() {
            });

            int conversionErrors = 0;

            for (Map<String, Object> expedition : expeditions) {
                SearchItemIndex newItem = convertExpeditionToItemIndex(expedition);

                if (newItem == null) {
                    conversionErrors++;
                    continue;
                }

                SearchItemIndex existingItem = elasticService.getDocument(newItem.getId());
                if (hasChanges(newItem, existingItem)) {
                    updateList.put(newItem.getId(), newItem);
                }

                // exclude from deletion list
                existingItems.remove(newItem.getId());
            }

            // delete removed items
            elasticService.removeDeletedItems(existingItems);

            logService.log(taskType, "total: " + expeditions.size() + ", conversion errors: " + conversionErrors + ", deleted " + existingItems.size());
        } catch (Exception e) {
            logService.log(taskType, "Error getting expedition");
            logger.error("Error fetching expedition data", e);
        }
        return updateList;
    }

    /**
     * Convert a Digivol expedition to a search item index.
     *
     * @param expedition the expedition data
     * @return the search item index
     */
    private SearchItemIndex convertExpeditionToItemIndex(Map<String, Object> expedition) {
        try {
            String id = (String) expedition.get("expeditionPageURL");
            String name = (String) expedition.get("name");

            String description = (String) expedition.get("description");
            if (description != null) {
                description = FormatUtil.htmlToText(description);
            }

            Date created = new Date();

            return SearchItemIndex.builder()
                    .id(id)
                    .guid(id)
                    .idxtype(IndexDocType.DIGIVOL.name())
                    .name(name)
                    .description(description)
                    .modified(created)
                    .created(created)
                    .build();
        } catch (Exception e) {
            logService.log(taskType, "Failed to parse expedition data: " + expedition);
            logger.error("Error parsing expedition data", e);
            return null;
        }
    }

    /**
     * Check if two search item indexes are equal.
     *
     * @param newItem      the new item
     * @param existingItem the existing item
     * @return true if the items are equal
     */
    private boolean hasChanges(SearchItemIndex newItem, SearchItemIndex existingItem) {
        if (existingItem == null) {
            return true;
        }
        return !Objects.equals(newItem.getId(), existingItem.getId()) ||
                !Objects.equals(newItem.getGuid(), existingItem.getGuid()) ||
                !Objects.equals(newItem.getIdxtype(), existingItem.getIdxtype()) ||
                !Objects.equals(newItem.getName(), existingItem.getName()) ||
                !Objects.equals(newItem.getDescription(), existingItem.getDescription());
    }
}
