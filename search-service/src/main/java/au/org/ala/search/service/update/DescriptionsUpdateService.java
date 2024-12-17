package au.org.ala.search.service.update;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.DataFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

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

            List<Hit<SearchItemIndex>> hits = fetchCurrentDocuments();
            updateHeroDescriptions(hits, heroDescriptions);

            logService.log(taskType, "Hero descriptions updated successfully.");
            return CompletableFuture.completedFuture(true);
        } catch (IOException e) {
            logService.log(taskType, "Error updating hero descriptions: " + e.getMessage());
            logger.error("Error updating hero descriptions", e);
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

            while (hasMore) {
                SearchResponse<SearchItemIndex> response = elasticService.queryPointInTimeAfter(
                        pit, searchAfter, pageSize, queryOp, null, null, false
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

        for (Hit<SearchItemIndex> hit : hits) {
            SearchItemIndex item = hit.source();
            if (item == null) continue;

            String docId = item.getId();
            String newDescription = heroDescriptions.getOrDefault(docId, null);

            if (!Objects.equals(newDescription, item.getHeroDescription())) {
                item.setHeroDescription(newDescription);
                Document doc = Document.create();
                doc.put("heroDescription", newDescription);
                UpdateQuery updateQuery = UpdateQuery.builder(docId)
                        .withDocument(doc)
                        .build();
                updates.add(updateQuery);
            }
        }

        if (!updates.isEmpty()) {
            elasticService.update(updates);
        }
    }
}