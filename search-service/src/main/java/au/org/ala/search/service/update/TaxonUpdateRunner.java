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
    private final Map<String, Integer> occurrenceCountCache = new ConcurrentHashMap<>();
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

            // construct update object
            for (Hit<SearchItemIndex> item : list) {
                String guid = item.fields().get("guid").toJson().asJsonArray().getJsonString(0).getString();
                Integer count = occurrenceCountCache.get(guid);
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
        Set<String> lftWithImage = new HashSet(biocacheApiService.getFacet("images:* AND " + requiredFq, null, "lft"));
        Set<String>[] preferredSets = new Set[preferred.length];
        for (int i = 0; i < preferred.length; i++) {
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
     * Get the images for a given entity based on its left/right values and the preferred filters and
     * writes to the lftImageCache with the entity key (guid).
     *
     * Fetches up to 3 images for unique occurrences.
     *
     * @param entity        the entity containing the left/right values in the value
     * @param preferred     the preferred filters to apply in order of priority
     * @param requiredFqs   the required filters to apply to the query
     * @param preferredSets the sets of valid left values for each preferred filter
     * @throws UnsupportedEncodingException
     */
    private void getImageFor(Map.Entry<String, String> entity, String[] preferred, String requiredFqs, Set<String>[] preferredSets) throws UnsupportedEncodingException {
        String leftRight = entity.getValue();
        String[] leftRightArray = leftRight.split(",");

        // get the first biocache-service record with an image for the left/right range that matches the first preferred filter
        List<String> imagesList = new ArrayList<>();
        for (int i = 0; i < preferred.length; i++) {
            if (!preferredSets[i].contains(leftRightArray[0])) {
                continue;
            }

            String[] images = biocacheApiService.queryImages("lft:[" + leftRightArray[0] + " TO " + leftRightArray[1] + "]",
                    new String[]{"images:*", preferred[i], requiredFqs});
            if (images != null) {
                for (int pos = 0;pos < images.length && imagesList.size() < 3; pos++) {
                    // need to check for duplicates should preferred queries return the same image
                    if (!imagesList.contains(images[pos])) {
                        imagesList.add(images[pos]);
                    }
                }
                if (imagesList.size() >= 3) {
                    break;
                }
            }
        }

        if (!imagesList.isEmpty()) {
            lftImageCache.put(entity.getKey(), StringUtils.join(imagesList, ","));
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

    /**
     * Populate {@link #occurrenceCountCache} by fetching {@code lft} facet counts from biocache-ws
     * and summing counts across each taxon's {@code [left, right]} interval from {@code leftRightCsvPath}.
     *
     * <p>Biocache expands {@code q=lsid:{guid}} into {@code lft:[left TO right]}, so summing the
     * {@code lft} facet across each taxon's interval produces the exact hierarchical count for every rank.
     *
     * @return {@code true} if counts were fetched and cached, {@code false} if fetching or reading failed
     */
    public boolean buildOccurrenceCountCache() {
        Map<Integer, Long> lftCounts = biocacheApiService.getLftCounts();
        if (lftCounts == null) {
            log.error("Failed to fetch biocache lft counts");
            return false;
        }

        List<Map.Entry<Integer, Long>> sorted = new ArrayList<>(lftCounts.entrySet());
        sorted.sort(Comparator.comparingInt(Map.Entry::getKey));

        int n = sorted.size();
        int[] lftValues = new int[n];
        long[] prefixSums = new long[n + 1];
        for (int i = 0; i < n; i++) {
            lftValues[i] = sorted.get(i).getKey();
            prefixSums[i + 1] = prefixSums[i] + sorted.get(i).getValue();
        }

        occurrenceCountCache.clear();
        try (CSVReader reader = new CSVReader(new File(leftRightCsvPath), "UTF-8", ",", '"', 0)) {
            while (reader.hasNext()) {
                String[] row = reader.next();
                if (row.length < 3 || StringUtils.isBlank(row[0]) || StringUtils.isBlank(row[1]) || StringUtils.isBlank(row[2])) {
                    continue;
                }
                try {
                    int left = Integer.parseInt(row[1].trim());
                    int right = Integer.parseInt(row[2].trim());
                    if (left > right) {
                        continue;
                    }
                    int startIdx = lowerBound(lftValues, left);
                    int endIdx = upperBound(lftValues, right);
                    long sum = prefixSums[endIdx] - prefixSums[startIdx];
                    if (sum > 0) {
                        occurrenceCountCache.put(row[0].trim(), (int) Math.min(sum, Integer.MAX_VALUE));
                    }
                } catch (NumberFormatException ignored) {
                }
            }
        } catch (Exception e) {
            log.error("Failed to import dwca.extract.leftRightCsvPath:{}, {}", leftRightCsvPath, e.getMessage(), e);
            return false;
        }

        logService.log(taskType, "Cached occurrence counts for " + occurrenceCountCache.size() + " taxa");
        return true;
    }

    /** First index where arr[idx] >= target, or arr.length if none. */
    private static int lowerBound(int[] arr, int target) {
        int lo = 0, hi = arr.length;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (arr[mid] < target) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    /** First index where arr[idx] > target, or arr.length if none. */
    private static int upperBound(int[] arr, int target) {
        int lo = 0, hi = arr.length;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (arr[mid] <= target) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    public void clearCache() {
        imageCache.clear();
        lftImageCache.clear();
        occurrenceCountCache.clear();
        overriddenHiddenImages.clear();
        overriddenImages.clear();
        updatingImageCounter.set(0);
    }
}
