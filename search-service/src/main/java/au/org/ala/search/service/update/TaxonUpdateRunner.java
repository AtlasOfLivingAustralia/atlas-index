/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.ListBackedFields;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.taxon.TaxonData;
import au.org.ala.search.service.remote.BiocacheApiService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.service.remote.TaxonDataService;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.gbif.utils.file.csv.CSVReader;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class TaxonUpdateRunner {
    private static final TaskType taskType = TaskType.BIOCACHE;

    protected final ElasticService elasticService;
    protected final BiocacheApiService biocacheApiService;
    protected final LogService logService;
    protected final TaxonDataService taxonDataService;

    @Getter
    private final Map<String, String> imageCache = new ConcurrentHashMap<>();
    @Value("${dwca.extract.leftRightCsvPath}")
    String leftRightCsvPath;
    @Getter
    private Map speciesImages;
    private Map<String, String> overriddenImages;
    private Map<String, String> overriddenHiddenImages;

    public TaxonUpdateRunner(ElasticService elasticService, BiocacheApiService biocacheApiService, LogService logService, TaxonDataService taxonDataService) {
        this.elasticService = elasticService;
        this.biocacheApiService = biocacheApiService;
        this.logService = logService;
        this.taxonDataService = taxonDataService;
    }

    @Async("blockingExecutor")
    public CompletableFuture<Integer> updateForList(List<Hit<SearchItemIndex>> list) {
        try {
            List<UpdateQuery> updates = new ArrayList<>();

            // Not much data for overriddenImages or overriddenHiddenImages so not yet worth optimizing
            overriddenImages = new HashMap();
            for (TaxonData td : taxonDataService.findAllByKey(ListBackedFields.IMAGE.field)) {
                if (StringUtils.isNotEmpty(td.getValue())) {
                    overriddenImages.put(td.taxonConceptId, td.getValue());
                }
            }
            overriddenHiddenImages = new HashMap();
            for (TaxonData td : taxonDataService.findAllByKey(ListBackedFields.HIDDEN.field)) {
                if (StringUtils.isNotEmpty(td.getValue())) {
                    overriddenHiddenImages.put(td.taxonConceptId, td.getValue());
                }
            }

            // get counts
            List<String> buffer = new ArrayList<>();
            for (Hit<SearchItemIndex> item : list) {
                buffer.add((item.fields().get("guid").toJson().asJsonArray().getJsonString(0).getString()));
            }
            Map<String, Integer> counts = new HashMap<>(biocacheApiService.counts(buffer));

            // construct update object
            for (Hit<SearchItemIndex> item : list) {
                String guid = item.fields().get("guid").toJson().asJsonArray().getJsonString(0).getString();
                Integer count = counts.get(guid);
                Integer storedValue = toInt(item.fields().getOrDefault("occurrenceCount", null));
                String storedImage = toString(item.fields().getOrDefault("image", null));

                Document doc = Document.create();

                if ((count == null && storedValue != 0) /* test for delete */
                        || (count != null && !count.equals(storedValue))) { /* test for update */
                    doc.put("occurrenceCount", count);
                }

                updateImage(guid, storedImage, doc);

                if (!doc.isEmpty()) {
                    updates.add(UpdateQuery.builder(item.id()).withDocument(doc).build());
                }
            }

            elasticService.update(new ArrayList<>(updates));
            int updatesSize = updates.size();
            updates.clear();

            return CompletableFuture.completedFuture(updatesSize);
        } catch (Exception e) {
            logService.log(taskType, "Error updating counts: " + e.getMessage());
            log.error(e.getMessage(), e);
            return CompletableFuture.completedFuture(-1 * list.size());
        }
    }

    private void updateImage(String guid, String storedImage, Document doc) {
        String overriddenImage = overriddenImages.get(guid);
        String overriddenHiddenImage = overriddenHiddenImages.get(guid);

        String image = overriddenImage != null ? overriddenImage : getImage(guid);

        if (StringUtils.compare(image, storedImage) != 0) {
            doc.put(ListBackedFields.IMAGE.field, image);
        }

        // Removals are performed by the admin API that updates the taxon data for hidden images, no need to check for
        // removals every time we update the taxon data.
        if (StringUtils.isNotEmpty(overriddenHiddenImage)) {
            doc.put(ListBackedFields.HIDDEN.field, overriddenHiddenImage);
        }
    }

    private Integer toInt(JsonData occurrenceCount) {
        return occurrenceCount == null ? 0 : occurrenceCount.toJson().asJsonArray().getInt(0);
    }

    private String toString(JsonData string) {
        return string == null ? null : string.toJson().asJsonArray().getString(0);
    }

    public void buildImageCache() {
        // load left/right lookup
        try (CSVReader reader = new CSVReader(new File(leftRightCsvPath), "UTF-8", ",", '"', 0)) {
            imageCache.clear();
            while (reader.hasNext()) {
                String[] row = reader.next();
                imageCache.put(row[0], row[1] + "," + row[2]);
            }
        } catch (Exception e) {
            log.error("Failed to import dwca.extract.leftRightCsvPath:{}, {}", leftRightCsvPath, e.getMessage(), e);
        }

        // load biocache speciesImages
        speciesImages = biocacheApiService.getSpeciesImages();
    }

    String getImage(String id) {
        // get left/right
        String leftRight = imageCache.get(id);
        if (leftRight != null) {
            String[] leftRightArray = leftRight.split(",");
            int left = Integer.parseInt(leftRightArray[0]);
            int right = Integer.parseInt(leftRightArray[1]);

            ArrayList<Integer> leftIndex = (ArrayList<Integer>) speciesImages.get("lft");

            // get image
            int pos = Collections.binarySearch(leftIndex, left);
            if (pos >= 0) {
                // exact match on left
                return (String) ((ArrayList<Map>) speciesImages.get("speciesImage")).get(pos).get("image");
            }

            // find first item before right
            pos = pos * -1;
            while (pos < leftIndex.size()) {
                int v = leftIndex.get(pos);
                if (v <= right) {
                    return (String) ((ArrayList<Map>) speciesImages.get("speciesImage")).get(pos).get("image");
                }
                pos++;
            }

            return null;
        }

        return null;
    }

    public void clearCache() {
        imageCache.clear();
        speciesImages = null;
    }
}
