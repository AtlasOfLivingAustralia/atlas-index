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

import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

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
    private Map<String, String> overriddenImages = new ConcurrentHashMap<>();
    private Map<String, String> overriddenHiddenImages = new ConcurrentHashMap<>();
    @Getter
    private final Map<String, String> lftImageCache = new ConcurrentHashMap<>();
    @Getter
    private final AtomicInteger updatingImageCounter = new AtomicInteger(0);

    @Value("${images.preferred.fqs}")
    String[] preferred;

    @Value("${images.required.fq}")
    String requiredFq;

    @Value("${images.caching.threadpool.size}")
    int cachingThreadPoolSize;

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

        String image = StringUtils.isNotEmpty(overriddenImage) ? overriddenImage : getImage(guid);

        if (StringUtils.compare(image, storedImage) != 0) {
            updatingImageCounter.incrementAndGet();
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

    public void buildImageCache() throws UnsupportedEncodingException {
        updatingImageCounter.set(0);

        // Not much data for overriddenImages or overriddenHiddenImages so not yet worth optimizing
        overriddenImages = new ConcurrentHashMap();
        for (TaxonData td : taxonDataService.findAllByKey(ListBackedFields.IMAGE.field)) {
            if (StringUtils.isNotEmpty(td.getValue())) {
                overriddenImages.put(td.taxonConceptId, td.getValue());
            }
        }
        overriddenHiddenImages = new ConcurrentHashMap();
        for (TaxonData td : taxonDataService.findAllByKey(ListBackedFields.HIDDEN.field)) {
            if (StringUtils.isNotEmpty(td.getValue())) {
                overriddenHiddenImages.put(td.taxonConceptId, td.getValue());
            }
        }

        // get a list of lft values with an image
        Set<String> lftWithImage = new HashSet(biocacheApiService.getFacet("images:* AND " + requiredFq, null,"lft"));
        Set<String>[] preferredSets = new Set[preferred.length];
        for (int i=0;i<preferred.length;i++) {
            preferredSets[i] = new HashSet(biocacheApiService.getFacet("images:* AND " + requiredFq, preferred[i], "lft"));
        }

        // load left/right lookup
        try (CSVReader reader = new CSVReader(new File(leftRightCsvPath), "UTF-8", ",", '"', 0)) {
            imageCache.clear();
            while (reader.hasNext()) {
                String[] row = reader.next();
                if (StringUtils.isNotEmpty(row[1]) && lftWithImage.contains(row[1])) {
                    imageCache.put(row[0], row[1] + "," + row[2]);
                }
            }
        } catch (Exception e) {
            log.error("Failed to import dwca.extract.leftRightCsvPath:{}, {}", leftRightCsvPath, e.getMessage(), e);
        }

        // now that I have lft values, query biocache once for each lft value once for each preferred fq, using required fqs
        lftImageCache.clear();
        ExecutorService executor = Executors.newFixedThreadPool(cachingThreadPoolSize);

        AtomicInteger counter = new AtomicInteger();
        int logInterval = 10000;

        for (Map.Entry<String, String> entity : imageCache.entrySet()) {
            executor.submit(() -> {
                try {
                    getImageFor(entity, preferred, requiredFq, preferredSets);
                } catch (UnsupportedEncodingException e) {
                    throw new RuntimeException(e);
                }
                int current = counter.incrementAndGet();
                if (current % logInterval == 0) {
                    log.debug("Processed {} image requests out of {}", current, imageCache.size());
                    logService.log(taskType, "Cached " + current + " imageIds out of " + imageCache.size() + ", current: " + lftImageCache.size());
                }
            });
        }

        executor.shutdown();
        try {
            executor.awaitTermination(Long.MAX_VALUE, TimeUnit.NANOSECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Interrupted while waiting for executor to finish", e);
        }

        logService.log(taskType, "Cached " + imageCache.size() + " imageIds, current: " + lftImageCache.size());

        // write out lftImageCache to /data/lftImageCache.csv
        File filePath = new File("/data/search-service/lftImageCache.csv");
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(filePath))) {
            for (Map.Entry<String, String> entry : lftImageCache.entrySet()) {
                writer.write(entry.getKey() + "," + entry.getValue());
                writer.newLine();
            }
        } catch (IOException e) {
            log.error("Error writing lftImageCache to file: {}", e.getMessage(), e);
        }
    }

    /**
     * Get the image for a given entity based on its left/right values and the preferred filters and
     * writes to the lftImageCache with the entity key (guid).
     *
     * @param entity the entity containing the left/right values in the value
     * @param preferred the preferred filters to apply in order of priority
     * @param requiredFqs the required filters to apply to the query
     * @param preferredSets the sets of valid left values for each preferred filter
     * @throws UnsupportedEncodingException
     */
    private void getImageFor(Map.Entry<String, String> entity, String[] preferred, String requiredFqs, Set<String>[] preferredSets) throws UnsupportedEncodingException {
        String leftRight = entity.getValue();
        String[] leftRightArray = leftRight.split(",");

        // get the first biocache-service record with an image for the left/right range that matches the first preferred filter
        for (int i=0;i<preferred.length;i++) {
            if (!preferredSets[i].contains(leftRightArray[0])) {
                continue;
            }

            String images = biocacheApiService.queryOneValue("lft:[" + leftRightArray[0] + " TO " + leftRightArray[1] + "]",
                    new String[] {"images:*", preferred[i], requiredFqs}, "images");
            if (StringUtils.isNotEmpty(images)) {
                lftImageCache.put(entity.getKey(), images);
                return;
            }
        }
    }

    /**
     * Get the image for a given taxonConceptId from the cache.
     *
     * @param id
     * @return
     */
    String getImage(String id) {
        return lftImageCache.get(id);
    }

    public void clearCache() {
        imageCache.clear();
        lftImageCache.clear();
        overriddenHiddenImages.clear();
        overriddenImages.clear();
        updatingImageCounter.set(0);
    }
}
