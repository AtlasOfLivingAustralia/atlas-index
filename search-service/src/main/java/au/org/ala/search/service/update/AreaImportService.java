package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class AreaImportService {
    private static final TaskType taskType = TaskType.AREA;

    private static final Logger logger = LoggerFactory.getLogger(AreaImportService.class);
    protected final ElasticService elasticService;
    protected final LogService logService;

    @Value("${spatial.url}")
    private String spatialUrl;

    @Value("${spatial.uiUrl}")
    private String spatialUiUrl;

    @Value("${spatial.layers}")
    private String spatialLayers;

    @Value("${exploreYourArea.url}")
    private String exploreYourAreaUrl;

    private List allFields = null;

    public AreaImportService(ElasticService elasticService, LogService logService) {
        this.elasticService = elasticService;
        this.logService = logService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        logService.log(taskType, "Starting");

        allFields = null;

        // facet query
        Set<String> existingLayerIds = new HashSet<>(elasticService.queryFacet("idxtype", IndexDocType.REGION.name(), "layerId"));
        existingLayerIds.addAll(elasticService.queryFacet("idxtype", IndexDocType.LOCALITY.name(), "layerId"));

        for (String layerId : spatialLayers.split(",")) {
            if (existingLayerIds.contains(layerId)) {
                logService.log(taskType, "Skipping already imported layer " + layerId);
            } else {
                importLayer(layerId);
            }
            existingLayerIds.remove(layerId);
        }

        // delete removed layers
        for (String layerId : existingLayerIds) {
            elasticService.queryDelete("layerId", layerId);
        }

        logService.log(taskType, "Finished");
        return CompletableFuture.completedFuture(true);
    }

    private void importLayer(String layerId) {
        logService.log(taskType, "layer " + layerId + " import starting");

        List<IndexQuery> buffer = new ArrayList<>();
        int counter = 0;

        ObjectMapper objectMapper = new ObjectMapper();

        for (String fieldId : listFieldIds(layerId)) {
            try {
                logService.log(taskType, "field " + fieldId + " import starting");

                int pageSize = 10000;
                int start = 0;
                boolean hasMore = true;
                while (hasMore) {
                    List fieldObjects = objectMapper.readValue(URI.create(spatialUrl + "/objects/" + fieldId + "?pageSize=" + pageSize + "&start=" + start).toURL(), List.class);

                    if (fieldObjects.size() < pageSize) {
                        hasMore = false;
                    }
                    start += pageSize;

                    int thisCounter = 0;
                    for (Object fieldObject : fieldObjects) {
                        Map<String, Object> item = (Map<String, Object>) fieldObject;

                        String fid = (String) item.get("fid");
                        String pid = (String) item.get("pid");
                        String id = fid + "-" + pid;
                        String name = (String) item.get("name");
                        String description = (String) item.getOrDefault("description", null);
                        String bbox = (String) item.getOrDefault("bbox", null);
                        String featureType = (String) item.get("featureType");
                        String centroid = (String) item.get("centroid");
                        String fieldName = (String) item.get("fieldname");
                        String type =
                                "POINT".equals(featureType)
                                        ? IndexDocType.LOCALITY.name()
                                        : IndexDocType.REGION.name();

                        String [] coords = centroid.replaceAll("[^0-9.\\- ]", "").split(" ");

                        String guid = "POINT".equals(featureType) ?
                                exploreYourAreaUrl.replaceAll("\\$latitude", coords[1]).replaceAll("\\$longitude", coords[0]) :
                                spatialUiUrl + "/?pid=" + pid;

                        Double areaKm = (Double) item.getOrDefault("area_km", null);
                        if (areaKm <= 0) areaKm = null;
                        // LOCALITY records are points and have no bbox
                        if ("POINT".equals(featureType)) bbox = null;

                        SearchItemIndex searchItemIndex =
                                SearchItemIndex.builder()
                                        .id(id)
                                        .guid(guid)
                                        .idxtype(type)
                                        .name(name)
                                        .description(description)
                                        .modified(new Date())
                                        .layerId(layerId)
                                        .fieldId(fieldId)
                                        .centroid(centroid)
                                        .fieldName(fieldName)
                                        .areaKm(areaKm)
                                        .bbox(bbox)
                                        .build();

                        buffer.add(elasticService.buildIndexQuery(searchItemIndex));

                        if (buffer.size() > 1000) {
                            thisCounter += 1000;
                            counter += elasticService.flushImmediately(buffer);

                            if (thisCounter % 50000 == 0) {
                                logService.log(taskType, "field " + fieldId + " import progress: " + counter);
                            }
                        }
                    }
                    counter += elasticService.flushImmediately(buffer);
                }
            } catch (Exception e) {
                logService.log(taskType, "failed to get fields " + spatialUrl + "/fields");
                logger.error("failed to get fields " + spatialUrl + "/fields");
            }

            logService.log(taskType, "field " + fieldId + " import finished");
        }

        counter += elasticService.flushImmediately(buffer);
        logService.log(taskType, "layer " + layerId + " import finished: " + counter);
    }

    private List<String> listFieldIds(String layerId) {
        List<String> fields = new ArrayList<>();

        if (allFields == null) {
            ObjectMapper objectMapper = new ObjectMapper();
            try {
                allFields = objectMapper.readValue(URI.create(spatialUrl + "/fields").toURL(), List.class);
            } catch (IOException e) {
                logService.log(taskType, "failed to get fields " + spatialUrl + "/fields");
                logger.error("failed to get fields " + spatialUrl + "/fields");
            }
        }

        for (Object field : allFields) {
            String pid = ((Map<String, Object>) field).get("spid").toString();
            if (pid.equals(layerId)) {
                fields.add(((Map<String, Object>) field).get("id").toString());
            }
        }

        return fields;
    }
}
