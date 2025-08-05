/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.AdminIndex;
import au.org.ala.search.model.ListBackedFields;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.taxon.TaxonData;
import au.org.ala.search.service.remote.DataFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.service.remote.TaxonDataService;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.query_dsl.FieldAndFormat;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Syncs the postgres data for hidden images, hero images and wiki URL with the Elasticsearch index.
 *
 * It only writes, it will not delete any data from ES. Use the Admin UI for individual edits, or perform a full ingestion.
 *
 * Future: consolidate the duplication of updates of hidden and hero images with the TaxonUpdateService that does the same.
 */
@Slf4j
@Service
public class PostgresSyncService {
    private static final TaskType taskType = TaskType.POSTGRES_SYNC;

    private static final int batchSize = 10000;
    private final ElasticService elasticService;
    private final LogService logService;
    private final TaxonDataService taxonDataService;

    public PostgresSyncService(ElasticService elasticService, LogService logService,TaxonDataService taxonDataService) {
        this.elasticService = elasticService;
        this.logService = logService;
        this.taxonDataService = taxonDataService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        try {
            String startMsg = "Postgres sync started";
            String endMsg = "Postgres sync finished.";
            logService.log(taskType, startMsg);

            List<UpdateQuery> updates = new ArrayList<>();

            // not alot of records, just do them one by one
            for (String field : new String[] {
                    ListBackedFields.HIDDEN.field,
                    ListBackedFields.IMAGE.field,
                    ListBackedFields.WIKI.field }) {
                int count = 0;
                List<TaxonData> toWrite = taxonDataService.findAllByKey(field);
                for (TaxonData td : toWrite) {
                    if (StringUtils.isNotEmpty(td.getValue())) {
                        // skip, no value to write
                        continue;
                    }

                    if (StringUtils.isEmpty(td.getTaxonConceptId())) {
                        log.debug("TaxonData with key {} has no taxonConceptId, skipping.", td.getKey());
                        continue;
                    }

                    String documentId = elasticService.queryTaxonId(td.getTaxonConceptId());
                    if (StringUtils.isEmpty(documentId)) {
                        log.debug("TaxonData with taxonConceptId {} has no matching document in Elasticsearch, skipping.", td.getTaxonConceptId());
                        continue;
                    }

                    Document doc = Document.create();
                    doc.put(field, td.getValue());
                    UpdateQuery updateQuery = UpdateQuery.builder(documentId)
                            .withDocument(doc)
                            .build();

                    updates.add(updateQuery);
                    count++;

                    if (updates.size() == batchSize) {
                        elasticService.update(updates);
                        updates.clear();
                    }
                }
                logService.log(taskType, "Updated " + count + " records for field: " + field);
            }

            if (!updates.isEmpty()) {
                elasticService.update(updates);
            }

            logService.log(taskType, endMsg);
            return CompletableFuture.completedFuture(true);
        } catch (Exception e) {
            logService.log(taskType, "Error syncing postgres with elasticsearch: " + e.getMessage());
            return CompletableFuture.completedFuture(false);
        }
    }
}
