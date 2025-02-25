package au.org.ala.search.service.update;

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
import org.springframework.data.elasticsearch.BulkFailureException;
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

    @Value("${data.file.descriptions.name}")
    private String descriptionsFileName;

    private final ElasticService elasticService;
    private final LogService logService;
    private final DataFileStoreService dataFileStoreService;

    public DescriptionsUpdateService(ElasticService elasticService, LogService logService, DataFileStoreService dataFileStoreService) {
        this.elasticService = elasticService;
        this.logService = logService;
        this.dataFileStoreService = dataFileStoreService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        try {
            File descriptionsFile = dataFileStoreService.retrieveFile(descriptionsFileName);
            ObjectMapper objectMapper = new ObjectMapper();
            Map<String, String> heroDescriptions = objectMapper.readValue(descriptionsFile, new TypeReference<>() {});
            heroDescriptions = heroDescriptions.entrySet().stream()
                    .collect(Collectors.toMap(
                            entry -> URLDecoder.decode(entry.getKey(), StandardCharsets.UTF_8),
                            Map.Entry::getValue
                    ));

            List<Hit<SearchItemIndex>> hits = fetchCurrentDocuments();
            updateHeroDescriptions(hits, heroDescriptions);

            logService.log(taskType, "Hero descriptions updated successfully.");
            return CompletableFuture.completedFuture(true);
        } catch (IOException e) {
            logService.log(taskType, "Error updating hero descriptions: " + e.getMessage());
            return CompletableFuture.completedFuture(false);
        }
    }

    private List<Hit<SearchItemIndex>> fetchCurrentDocuments() {
        List<Hit<SearchItemIndex>> allHits = new ArrayList<>();
        String pit = null;

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
                    allHits.addAll(hits);
                }
                hasMore = hits.size() == pageSize;
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

        return allHits;
    }

    private void updateHeroDescriptions(List<Hit<SearchItemIndex>> hits, Map<String, String> heroDescriptions) {
        List<UpdateQuery> updates = new ArrayList<>();
        int batchSize = 10000;

        for (Hit<SearchItemIndex> hit : hits) {
            String guid = null;
            String currentDescription = null;

            Map<String, JsonData> fields = hit.fields();
            if (fields == null || fields.isEmpty() || !fields.containsKey("guid")) {
                continue;
            }
            guid = fields.get("guid").toJson().asJsonArray().getJsonString(0).getString();
            currentDescription = fields.get("heroDescription").toJson().asJsonArray().getJsonString(0).getString();

            String newDescription = heroDescriptions.remove(guid);
            if (newDescription != null && !Objects.equals(newDescription, currentDescription)) {
                buildUpdateQuery(updates, guid, newDescription);
            }
        }

        for (Map.Entry<String, String> entry : heroDescriptions.entrySet()) {
            String guid = entry.getKey();
            String newDescription = entry.getValue();
            buildUpdateQuery(updates, guid, newDescription);
        }

        if (!updates.isEmpty()) {
            try {
                for (int i = 0; i < updates.size(); i += batchSize) {
                    int end = Math.min(i + batchSize, updates.size());
                    List<UpdateQuery> batch = updates.subList(i, end);
                    elasticService.update(batch);
                }
            } catch (BulkFailureException e) {
                logger.error("Bulk update failed", e);
            }
        }
    }

    private void buildUpdateQuery(List<UpdateQuery> updates, String guid, String newDescription) {
        String documentId = elasticService.queryTaxonId(guid);
        if (documentId != null) {
            Document doc = Document.create();
            doc.put("heroDescription", newDescription);
            UpdateQuery updateQuery = UpdateQuery.builder(documentId)
                    .withDocument(doc)
                    .build();
            updates.add(updateQuery);
        }
    }
}