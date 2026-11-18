/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.cache;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.query.Op;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.util.QueryParseException;
import au.org.ala.search.util.QueryParserUtil;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.query_dsl.FieldAndFormat;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * This service provides a cache for collectory information
 * - dataResourceUid -> name
 */
@Slf4j
@Service
public class CollectoryCache {

    final ElasticService elasticService;

    // This is a map of species list names to their ids
    final public Map<String, String> dataResourceNames = new ConcurrentHashMap<>();

    // All data resource uids in the configured Collectory, including species lists (which are not indexed)
    private volatile Set<String> dataResourceUids = Set.of();

    private final RestTemplate restTemplate;

    @Value("${collections.url}")
    private String collectionsUrl;

    public CollectoryCache(ElasticService elasticService,
                           @Value("${webservice.connect.timeout}") int connectTimeout,
                           @Value("${webservice.read.timeout}") int readTimeout) {
        this.elasticService = elasticService;

        // finite timeouts so a stalled Collectory cannot block startup or cache refreshes
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public boolean hasDataResource(String uid) {
        return dataResourceUids.contains(uid);
    }

    @PostConstruct
    void init() {
        cacheRefresh();
    }

    // TODO: scheduling move to SchedulerService
    @Scheduled(cron = "${collectory.cache.cron}")
    public void cacheRefresh() {
        try {
            List<Map<String, Object>> resources = restTemplate.getForObject(collectionsUrl + "/ws/dataResource", List.class);
            if (resources != null) {
                dataResourceUids = resources.stream().map(it -> (String) it.get("uid")).collect(Collectors.toUnmodifiableSet());
            }
        } catch (Exception e) {
            // keep the previous uids; links are only omitted until the next successful refresh
            log.warn("Failed to cache data resource uids from {}: {}", collectionsUrl, e.getMessage());
        }

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
        } catch (QueryParseException e) {
            // Expected when the Elasticsearch index is empty/not yet initialised
            log.warn("Skipped caching data resource names: index does not yet have an 'idxtype' field ({})", e.getMessage());
        } catch (Exception e) {
            log.error("Failed to cache data resource names", e);
        } finally {
            try {
                if (pit != null) {
                    elasticService.closePointInTime(pit);
                }
            } catch (Exception e) {
                log.error("Failed to close point in time", e);
            }
        }
    }


}
