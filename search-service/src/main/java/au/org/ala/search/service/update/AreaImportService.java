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
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.common.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
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
            logService.log(taskType, "Deleted layer: " + layerId);
        }

        loadDistributions();

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

                // get the recency of the last import
                Map fieldObj = objectMapper.readValue(URI.create(spatialUrl + "/field/" + fieldId + "?pageSize=0").toURL(), Map.class);
                String lastUpdate = (String) fieldObj.get("last_update");
                Date created = lastUpdate != null ? Date.from(ZonedDateTime.parse(lastUpdate, DateTimeFormatter.ISO_ZONED_DATE_TIME).toInstant()) : null;

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
                        if ("null".equals(description)) description = null; // some descriptions are "null" strings

                        String bbox = (String) item.getOrDefault("bbox", null);
                        String featureType = (String) item.get("featureType");
                        String centroid = (String) item.get("centroid");
                        String fieldName = (String) item.get("fieldname");
                        String type =
                                "POINT".equals(featureType)
                                        ? IndexDocType.LOCALITY.name()
                                        : IndexDocType.REGION.name();

                        String[] coords = centroid.replaceAll("[^0-9.\\- ]", "").split(" ");

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
                                        .created(created)
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
                logService.log(taskType, "failed to get fields " + spatialUrl + "/fields; " + e.getMessage());
                logger.error("failed to get fields " + spatialUrl + "/fields; " + e.getMessage());
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

    private void loadDistributions() {
        List<IndexQuery> buffer = new ArrayList<>();

        Map<String, String[]> existingItems = elasticService.queryItems("idxtype:" + IndexDocType.DISTRIBUTION.name(), "id", new String[]{"id", "datasetID", "guid", "datasetName"}, -1);

        // get dataResourceID -> dataResourceName mapping
        Map<String, String> datasets = new HashMap<>();
        Map<String, String[]> currentDatasets = elasticService.queryItems("idxtype:" + IndexDocType.DATARESOURCE.name(), "id", new String[]{"id", "name"}, -1);
        if (currentDatasets != null && !currentDatasets.isEmpty()) {
            for (Map.Entry<String, String[]> entry : currentDatasets.entrySet()) {
                datasets.put(entry.getValue()[0], entry.getValue()[1]);
            }
        }

        int counter = 0;

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            // TODO: Use paging, depends on https://github.com/AtlasOfLivingAustralia/spatial-service/issues/252
            List currentDistributions = objectMapper.readValue(URI.create(spatialUrl + "/distributions").toURL(), List.class);

            Set<String> updatedLsids = new HashSet<>();

            for (Object distribution : currentDistributions) {
                // distributions are designed with SPCODE as the unique identifier. This is no longer suitable.
                Object o = ((Map<String, Object>) distribution).get("spcode");
                String spcode = o != null ? o.toString() : null;

                o = ((Map<String, Object>) distribution).get("area_name");
                String areaName = o != null ? o.toString() : null;

                o = ((Map<String, Object>) distribution).get("data_resource_uid");
                String drUid = o != null ? o.toString() : null;

                o = ((Map<String, Object>) distribution).get("geom_idx");
                String geomIdx = o != null ? o.toString() : null;

                o = ((Map<String, Object>) distribution).get("area_km");
                String areaKm = o != null ? o.toString() : null;

                o = ((Map<String, Object>) distribution).get("lsid");
                String lsid = o != null ? o.toString() : null;

                o = ((Map<String, Object>) distribution).get("imageUrl");
                String imageUrl = o != null ? o.toString() : null;

                Double areaKmDbl = null;
                try {
                    areaKmDbl = Double.parseDouble(areaKm);
                } catch (Exception ignored) {
                }

                // When the item exists and the data resource name is the same, do not update the item.
                if (existingItems.containsKey("dist-" + spcode)) { // 'id' of DISTRIBUTION is 'dist-{spcode}'
                    String[] existing = existingItems.remove("dist-" + spcode);
                    if (existing[3] != null && existing[3].equals(datasets.get(drUid))) { // [3] is datasetName
                        continue;
                    }
                }

                SearchItemIndex searchItemIndex =
                        SearchItemIndex.builder()
                                .id("dist-" + spcode) // 'id' of DISTRIBUTION is 'dist-{spcode}'
                                .guid(lsid)
                                .idxtype(IndexDocType.DISTRIBUTION.name())
                                .name(areaName)
                                .modified(new Date())
                                .datasetID(drUid)
                                .areaKm(areaKmDbl)
                                .image(imageUrl)
                                .geomIdx(geomIdx)
                                .build();

                buffer.add(elasticService.buildIndexQuery(searchItemIndex));
                updatedLsids.add(lsid);

                if (buffer.size() > 1000) {
                    counter += elasticService.flushImmediately(buffer);

                    logService.log(taskType, "distributions import progress: " + counter);
                }
            }

            counter += elasticService.flushImmediately(buffer);
            long deleted = elasticService.removeDeletedItems(existingItems.keySet().stream().toList());

            // get all distributions for updated lsids
            Map<String, List<Map<String, String>>> distributions = new HashMap<>();
            for (Object distribution : currentDistributions) {
                Object o = ((Map<String, Object>) distribution).get("area_name");
                String areaName = o != null ? o.toString() : null;

                o = ((Map<String, Object>) distribution).get("data_resource_uid");
                String drUid = o != null ? o.toString() : null;

                o = ((Map<String, Object>) distribution).get("geom_idx");
                String geomIdx = o != null ? o.toString() : null;

                o = ((Map<String, Object>) distribution).get("lsid");
                String lsid = o != null ? o.toString() : null;

                String datasetName = datasets.get(drUid);
                if (StringUtils.isEmpty(datasetName)) {
                    datasetName = drUid;
                }

                if (StringUtils.isNotEmpty(lsid) && updatedLsids.contains(lsid) &&
                        areaName != null && drUid != null && geomIdx != null && datasetName != null) {
                    List<Map<String, String>> current = distributions.get(lsid);

                    if (current == null) {
                        current = new ArrayList<>();
                        current.add(Map.of("areaName", areaName, "dataResourceUid", drUid, "geomIdx", geomIdx, "dataResourceName", datasetName));
                        distributions.put(lsid, current);
                    } else {
                        current.add(Map.of("areaName", areaName, "dataResourceUid", drUid, "geomIdx", geomIdx, "dataResourceName", datasetName));
                    }
                }
            }

            // update TAXON documents
            int taxonInfoUpdated = 0;
            List<UpdateQuery> updateBuffer = new ArrayList<>();
            for (Map.Entry<String, List<Map<String, String>>> entry : distributions.entrySet()) {
                // get document id so we can update the document
                String id = elasticService.queryTaxonId(entry.getKey());
                if (id != null) {
                    Document doc = Document.create();
                    doc.put("distributions", new ObjectMapper().writeValueAsString(entry.getValue()));
                    updateBuffer.add(UpdateQuery.builder(id).withDocument(doc).build());
                    taxonInfoUpdated++;
                }
            }

            // removed existing distributions from TAXON documents that were not updated (because they are removed)
            int taxonInfoRemoved = 0;
            for (Map.Entry<String, String[]> entry : existingItems.entrySet()) {
                String guid = entry.getValue()[2]; // [2] is guid
                if (updatedLsids.contains(guid)) {
                    String id = elasticService.queryTaxonId(guid);
                    if (id != null) {
                        Document doc = Document.create();
                        doc.put("distributions", null);
                        updateBuffer.add(UpdateQuery.builder(id).withDocument(doc).build());
                        taxonInfoRemoved++;
                    }
                }
            }

            elasticService.update(updateBuffer);

            logService.log(taskType, "Finished distributions updates: " + counter + ", deleted: " + deleted + ", taxonInfoUpdated: " + taxonInfoUpdated + ", taxonInfoRemoved: " + taxonInfoRemoved);

        } catch (Exception e) {
            logService.log(taskType, "failed to get distributions " + spatialUrl + "/distributions");
            logger.error("failed to get distributions " + spatialUrl + "/distributions");
        }
    }
}
