/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.cache;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.query.Op;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.util.QueryParserUtil;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.query_dsl.FieldAndFormat;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * This service provides a cache for collectory information
 * - dataResourceUid -> name
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
        cacheRefresh();
    }

    @Scheduled(cron = "${collectory.cache.cron}")
    public void cacheRefresh() {
        String pit = null;

        try {
            pit = elasticService.openPointInTime();

            List<FieldAndFormat> fieldList = new ArrayList<>(2);
            fieldList.add(new FieldAndFormat.Builder().field("id").build());
            fieldList.add(new FieldAndFormat.Builder().field("name").build());

            Op op = QueryParserUtil.parse("idxtype:DATARESOURCE", null, elasticService::isValidField);
            Query queryOp = elasticService.opToQuery(op);

            List<FieldValue> searchAfter = null;
            int pageSize = 1000;

            boolean hasMore = true;
            while (hasMore) {
                SearchResponse<SearchItemIndex> result =
                        elasticService.queryPointInTimeAfter(
                                pit, searchAfter, pageSize, queryOp, fieldList, null, false);
                List<Hit<SearchItemIndex>> hits = result.hits().hits();
                searchAfter = hits.isEmpty() ? null : hits.getLast().sort();

                for (Hit<SearchItemIndex> hit : hits) {
                    JsonData idField = hit.fields().get("id");
                    String id = idField == null ? null : idField.toJson().asJsonArray().getJsonString(0).getString();

                    JsonData nameField = hit.fields().get("name");
                    String name = nameField == null ? null : nameField.toJson().asJsonArray().getJsonString(0).getString();

                    dataResourceNames.put(name, id);
                }

                hasMore = hits.size() == pageSize;
            }
        } catch (Exception e) {
            // Note: this error is always logged when the index has not yet been initialized with idxtype:DATARESOURCE
            logger.error("Failed to cache data resource names", e.getMessage());
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


}
