package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.CompletableFuture;

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

        List<IndexQuery> buffer = new ArrayList<>();
        Map<String, Date> existingItems = elasticService.queryItems("idxtype", IndexDocType.DIGIVOL.name());
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
        long deleted = elasticService.removeDeletedItems(existingItems);

        logService.log(taskType, "Finished updates: " + counter + ", deleted: " + deleted);
        return CompletableFuture.completedFuture(true);
    }

    private Map<String, SearchItemIndex> getList(Map<String, Date> existingLists) {
        Map<String, SearchItemIndex> updateList = new HashMap<>();
        ObjectMapper objectMapper = new ObjectMapper();
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");

        try {
            String url = digivolUrl + digivolExpeditionUrl;
            URL apiUrl = URI.create(url).toURL();

            List<Map<String, Object>> expeditions = objectMapper.readValue(apiUrl, new TypeReference<>() {});

            for (Map<String, Object> expedition : expeditions) {
                SearchItemIndex searchItemIndex = convertExpeditionToItemIndex(expedition, sdf);

                if (searchItemIndex == null) continue;

                Date stored = existingLists.get(searchItemIndex.getId());
                if (stored == null || stored.before(searchItemIndex.getModified())) {
                    updateList.put(searchItemIndex.getId(), searchItemIndex);
                }

                existingLists.remove(searchItemIndex.getId());
            }
        } catch (Exception e) {
            logService.log(taskType, "Error getting expedition");
            logger.error("Error fetching expedition data", e);
        }
        return updateList;
    }

    private SearchItemIndex convertExpeditionToItemIndex(Map<String, Object> expedition, SimpleDateFormat sdf) {
        try {
            String id = (String) expedition.get("expeditionPageURL");
            String name = (String) expedition.get("name");

            String description = (String) expedition.get("description");
            if (description != null) {
                description = Jsoup.clean(description, Safelist.none());
            }

            Date created = expedition.get("dateCreated") != null ? sdf.parse((String) expedition.get("dateCreated")) : new Date();
            Date modified = expedition.get("lastUpdated") != null ? sdf.parse((String) expedition.get("lastUpdated")) : created;

            return SearchItemIndex.builder()
                    .id(id)
                    .guid(id)
                    .idxtype(IndexDocType.DIGIVOL.name())
                    .name(name)
                    .description(description)
                    .modified(modified)
                    .created(created)
                    .build();
        } catch (Exception e) {
            logService.log(taskType, "Failed to parse expedition data: " + expedition);
            logger.error("Error parsing expedition data", e);
            return null;
        }
    }
}
