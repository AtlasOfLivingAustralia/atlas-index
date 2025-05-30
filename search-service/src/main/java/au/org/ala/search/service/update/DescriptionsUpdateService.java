/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.AdminIndex;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.DataFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.query_dsl.FieldAndFormat;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

@Service
public class DescriptionsUpdateService {
    private static final TaskType taskType = TaskType.TAXON_DESCRIPTION;
    private static final Logger logger = LoggerFactory.getLogger(DescriptionsUpdateService.class);
    private static final int batchSize = 10000;
    private final ElasticService elasticService;
    private final LogService logService;
    private final DataFileStoreService dataFileStoreService;
    @Value("${data.file.descriptions.name}")
    private String descriptionsFileName;

    public DescriptionsUpdateService(ElasticService elasticService, LogService logService, DataFileStoreService dataFileStoreService) {
        this.elasticService = elasticService;
        this.logService = logService;
        this.dataFileStoreService = dataFileStoreService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        try {
            String startMsg = "Hero descriptions started";
            logService.log(taskType, startMsg);

            // do not update if the file has not been modified since the last update
            List<AdminIndex> taskLog = logService.getStatus(TaskType.TAXON_DESCRIPTION, 6);
            // find all logs that are the start message, and get the max lastModified
            Optional<Date> lastRunTime = taskLog.stream()
                    .filter(log -> log.getMessage().equals(startMsg))
                    .map(AdminIndex::getModified)
                    .max(Date::compareTo);
            long fileLastModified = dataFileStoreService.retrieveFileLastModified(descriptionsFileName);
            if (lastRunTime.isPresent() && lastRunTime.get().getTime() >= fileLastModified) {
                logService.log(taskType, "Hero descriptions finished. Skipped, source file was not modified.");
                return CompletableFuture.completedFuture(true);
            }

            File descriptionsFile = dataFileStoreService.retrieveFile(descriptionsFileName);

            ObjectMapper objectMapper = new ObjectMapper();
            Map<String, Object> heroDescriptions = objectMapper.readValue(descriptionsFile, new TypeReference<>() {
            });
            dataFileStoreService.cleanupFile(descriptionsFile); // removes temporary file from s3 after use
            heroDescriptions = heroDescriptions.entrySet().stream()
                    .filter(entry -> entry.getValue() != null)
                    .collect(Collectors.toMap(
                            entry -> URLDecoder.decode(entry.getKey(), StandardCharsets.UTF_8),
                            Map.Entry::getValue
                    ));
            logService.log(taskType, "Total hero descriptions: " + heroDescriptions.size());

            updateCurrentDocuments(heroDescriptions);

            addDescriptions(heroDescriptions);

            logService.log(taskType, "Hero descriptions finished.");
            return CompletableFuture.completedFuture(true);
        } catch (IOException e) {
            logService.log(taskType, "Error updating hero descriptions: " + e.getMessage());
            return CompletableFuture.completedFuture(false);
        }
    }

    private void updateCurrentDocuments(Map<String, Object> newHeroDescriptions) {
        List<UpdateQuery> updates = new ArrayList<>();

        String pit = null;
        int updatedRecords = 0;
        int deletedRecords = 0;
        try {
            pit = elasticService.openPointInTime();
            co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = co.elastic.clients.elasticsearch._types.query_dsl.Query.of(q -> q
                    .exists(e -> e.field("heroDescription"))
            );
            int pageSize = 1000;
            List<FieldValue> searchAfter = null;
            boolean hasMore = true;

            List<FieldAndFormat> fieldList = Arrays.asList(
                    new FieldAndFormat.Builder().field("id").build(),
                    new FieldAndFormat.Builder().field("guid").build(),
                    new FieldAndFormat.Builder().field("heroDescription").build()
            );

            while (hasMore) {
                SearchResponse<SearchItemIndex> response = elasticService.queryPointInTimeAfter(
                        pit, searchAfter, pageSize, queryOp, fieldList, null, false
                );

                List<Hit<SearchItemIndex>> hits = response.hits().hits();
                if (!hits.isEmpty()) {
                    searchAfter = hits.get(hits.size() - 1).sort();

                    for (Hit<SearchItemIndex> hit : hits) {
                        String documentId = hit.id();

                        Map<String, JsonData> fields = hit.fields();
                        String guid = fields.get("guid").toJson().asJsonArray().getJsonString(0).getString();
                        String currentDescription = fields.get("heroDescription").toJson().asJsonArray().getJsonString(0).getString();

                        Object newDescription = newHeroDescriptions.remove(guid);
                        if (!Objects.equals(newDescription, currentDescription)) {
                            if (newDescription != null) {
                                updatedRecords++;
                            } else {
                                deletedRecords++;
                            }
                            buildUpdateQuery(updates, documentId, newDescription);
                        }
                    }
                }
                hasMore = hits.size() == pageSize;
            }

            if (!updates.isEmpty()) {
                elasticService.update(updates);
            }
        } catch (Exception e) {
            logger.error("Failed to fetch current documents from Elasticsearch", e);
        } finally {
            if (pit != null) {
                try {
                    elasticService.closePointInTime(pit);
                } catch (Exception e) {
                    logger.error("Failed to close point in time", e);
                }
            }
        }

        logService.log(taskType, "Updated hero descriptions: " + updatedRecords);
        logService.log(taskType, "Deleted hero descriptions: " + deletedRecords);
    }

    private void addDescriptions(Map<String, Object> heroDescriptions) {
        List<UpdateQuery> updates = new ArrayList<>();

        int guidsNotFound = 0;
        for (Map.Entry<String, Object> entry : heroDescriptions.entrySet()) {
            String guid = entry.getKey();
            Object newDescription = entry.getValue();
            String documentId = elasticService.queryTaxonId(guid);

            if (documentId != null) {
                buildUpdateQuery(updates, documentId, newDescription);
            } else {
                guidsNotFound++;
            }
        }

        if (!updates.isEmpty()) {
            elasticService.update(updates);
        }

        logService.log(taskType, "New hero descriptions: " + (heroDescriptions.size() - guidsNotFound));

        if (guidsNotFound > 0) {
            logService.log(taskType, "Failed to find " + guidsNotFound + " guids in Elasticsearch.");
        }
    }

    private void buildUpdateQuery(List<UpdateQuery> updates, String documentId, Object newDescription) {
        Document doc = Document.create();
        doc.put("heroDescription", newDescription);
        UpdateQuery updateQuery = UpdateQuery.builder(documentId)
                .withDocument(doc)
                .build();

        updates.add(updateQuery);

        if (updates.size() == batchSize) {
            elasticService.update(updates);
            updates.clear();
        }
    }
}
