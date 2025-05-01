/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.query.Op;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.util.QueryParserUtil;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.query_dsl.FieldAndFormat;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class TaxonUpdateService {
    private static final TaskType taskType = TaskType.BIOCACHE;

    private static final Logger logger = LoggerFactory.getLogger(TaxonUpdateService.class);
    protected final ElasticService elasticService;
    protected final TaxonUpdateRunner taxonUpdateRunner;
    protected final LogService logService;
    Map<String, String> acceptedConceptName;

    public TaxonUpdateService(ElasticService elasticService, TaxonUpdateRunner taxonUpdateRunner, LogService logService) {
        this.elasticService = elasticService;
        this.taxonUpdateRunner = taxonUpdateRunner;
        this.logService = logService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        boolean result = updateAccepted() && updateNonAccepted();

        taxonUpdateRunner.clearCache();

        logService.log(taskType, "Finished, successful:" + result);

        return CompletableFuture.completedFuture(result);
    }

    private boolean updateAccepted() {
        logService.log(taskType, "Start paging for occurrences count");

        taxonUpdateRunner.buildImageCache();

        if (taxonUpdateRunner.getSpeciesImages() == null || taxonUpdateRunner.getSpeciesImages().isEmpty() ||
                taxonUpdateRunner.getImageCache() == null || taxonUpdateRunner.getImageCache().isEmpty()) {
            logService.log(taskType, "Failed occurrences counts. Image cache failed");
            return false;
        }

        acceptedConceptName = new HashMap<>();

        List<CompletableFuture<Integer>> futures = new ArrayList<>(1000);
        List<FieldAndFormat> fieldList = new ArrayList<>(2);
        fieldList.add(new FieldAndFormat.Builder().field("id").build());
        fieldList.add(new FieldAndFormat.Builder().field("occurrenceCount").build());
        fieldList.add(new FieldAndFormat.Builder().field("guid").build());
        fieldList.add(new FieldAndFormat.Builder().field("nameComplete").build());
        fieldList.add(new FieldAndFormat.Builder().field("scientificName").build());
        fieldList.add(new FieldAndFormat.Builder().field("image").build());

        String pit = null;

        int counter = 0;
        int pageSize = 1000;
        try {
            List<FieldValue> searchAfter = null;

            pit = elasticService.openPointInTime();

            Op op = QueryParserUtil.parse("idxtype:\"TAXON\" AND -acceptedConceptID:*", null, elasticService::isValidField);
            co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

            boolean hasMore = true;
            while (hasMore) {
                SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(
                        pit, searchAfter, pageSize, queryOp, fieldList, null, false);
                List<Hit<SearchItemIndex>> hits = result.hits().hits();

                if (hits.isEmpty()) {
                    hasMore = false;
                    continue;
                }

                searchAfter = hits.isEmpty() ? null : hits.getLast().sort();

                futures.add(taxonUpdateRunner.updateForList(hits));

                for (Hit<SearchItemIndex> item : hits) {
                    String guid = item.fields().get("guid").toJson().asJsonArray().getJsonString(0).getString();
                    String nameComplete = item.fields().get("nameComplete").toJson().asJsonArray().getJsonString(0).getString();
                    String scientificName = item.fields().get("scientificName").toJson().asJsonArray().getJsonString(0).getString();
                    acceptedConceptName.put(guid, StringUtils.isNotEmpty(nameComplete) ? nameComplete : scientificName);
                }

                counter += hits.size();

                if (counter % 20000 == 0) {
                    logService.log(taskType, "occurrence counts progress: " + counter);
                }

                hasMore = hits.size() == pageSize;
            }

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

            // summarize result
            int updateCount = 0;
            int skippedCount = 0;
            for (CompletableFuture<Integer> f : futures) {
                if (f.get() >= 0) {
                    updateCount += f.get();
                } else {
                    skippedCount += f.get() * -1;
                }
            }

            logService.log(taskType, "Finished found: " + counter + ", updates: " + updateCount + ", skipped (error): " + skippedCount);
        } catch (Exception ex) {
            logService.log(taskType, "Error there was problem with occurrences import: " + ex.getMessage());
            logger.error("There was problem with occurrences import: " + ex.getMessage(), ex);
            return false;
        } finally {
            try {
                if (pit != null) {
                    elasticService.closePointInTime(pit);
                }
            } catch (Exception e) {
                logger.error("Failed to close point in time", e);
            }
        }
        return true;
    }

    // Performance: this is not currently an issue, but when legacy components are deprecated also move this to
    // DwCADenormaliseImportService - take the accepted name cache along.
    private boolean updateNonAccepted() {
        logService.log(taskType, "Start paging for non-accepted taxon");

        List<UpdateQuery> updates = new ArrayList<>();

        List<FieldAndFormat> fieldList = new ArrayList<>(2);
        fieldList.add(new FieldAndFormat.Builder().field("acceptedConceptID").build());

        String pit = null;

        int counter = 0;
        int pageSize = 10000;
        try {
            pit = elasticService.openPointInTime();

            List<FieldValue> searchAfter = null;

            Op op = QueryParserUtil.parse("idxtype:\"TAXON\" AND acceptedConceptID:* AND -acceptedConceptName:*", null, elasticService::isValidField);
            co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

            boolean hasMore = true;
            while (hasMore) {
                SearchResponse<SearchItemIndex> result =
                        elasticService.queryPointInTimeAfter(
                                pit, searchAfter, pageSize, queryOp, fieldList, null, false);
                List<Hit<SearchItemIndex>> hits = result.hits().hits();

                if (hits.isEmpty()) {
                    hasMore = false;
                    continue;
                }

                searchAfter = hits.isEmpty() ? null : hits.getLast().sort();

                for (Hit<SearchItemIndex> item : hits) {
                    String acceptedConceptID = item.fields().get("acceptedConceptID").toJson().asJsonArray().getJsonString(0).getString();

                    String acceptedName = acceptedConceptName.get(acceptedConceptID);
                    if (StringUtils.isNotEmpty(acceptedName)) {
                        Document doc = Document.create();
                        doc.put("acceptedConceptName", acceptedName);
                        updates.add(UpdateQuery.builder(item.id()).withDocument(doc).build());
                    }
                }

                // do not wait for the future
                elasticService.update(new ArrayList<>(updates));
                updates.clear();

                counter += hits.size();

                if (counter % 20000 == 0) {
                    logService.log(taskType, "acceptedConceptName progress: " + counter);
                }

                hasMore = hits.size() == pageSize;
            }

            logService.log(taskType, "Finished acceptedConceptName: " + counter);
        } catch (Exception ex) {
            logService.log(taskType, "Error there was problem with acceptedConceptName import: " + ex.getMessage());
            logger.error("There was problem with acceptedConceptName import: " + ex.getMessage(), ex);
            return false;
        } finally {
            try {
                if (pit != null) {
                    elasticService.closePointInTime(pit);
                }
            } catch (Exception e) {
                logger.error("Failed to close point in time", e);
            }
        }
        return true;
    }
}
