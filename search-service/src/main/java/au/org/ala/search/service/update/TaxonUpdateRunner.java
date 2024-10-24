package au.org.ala.search.service.update;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.BiocacheService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import lombok.Getter;
import org.gbif.utils.file.csv.CSVReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TaxonUpdateRunner {
    private static final TaskType taskType = TaskType.BIOCACHE;

    private static final Logger logger = LoggerFactory.getLogger(TaxonUpdateRunner.class);
    protected final ElasticService elasticService;
    protected final BiocacheService biocacheService;
    protected final LogService logService;

    @Getter
    private Map<String, String> imageCache = new ConcurrentHashMap<>();

    @Getter
    private Map speciesImages;

    @Value("${dwca.extract.leftRightCsvPath}")
    String leftRightCsvPath;

    public TaxonUpdateRunner(ElasticService elasticService, BiocacheService biocacheService, LogService logService) {
        this.elasticService = elasticService;
        this.biocacheService = biocacheService;
        this.logService = logService;
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
            Map<String, Integer> counts = new HashMap<>(biocacheService.counts(buffer));

            // construct update object
            for (Hit<SearchItemIndex> item : list) {
                String guid = item.fields().get("guid").toJson().asJsonArray().getJsonString(0).getString();
                Integer count = counts.get(guid);
                Integer storedValue = toInt(item.fields().getOrDefault("occurrenceCount", null));
                String storedImage = toString(item.fields().getOrDefault("image", null));

                Document doc = Document.create();

                if ((count == null && storedValue != 0) /* test for delete */
                        || (count != null && !count.equals(storedValue))) { /* test for update */
                    // TODO: the search page also displays this information for idxtype:COMMON record, so keep track
                    //  of the guid and new count and new image. Maybe we can use update by query guid:guid count=new Image and
                    //  Occurrence count
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
            logger.error(e.getMessage(), e);
            return CompletableFuture.completedFuture(-1 * list.size());
        }
    }

    private void updateImage(String guid, String storedImage, Document doc) {
        String image = getImage(guid);

        if (image != null && !image.equals(storedImage)) {
            doc.put("image", image);
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
            logger.error("Failed to import dwca.extract.leftRightCsvPath:" + leftRightCsvPath + ", " + e.getMessage(), e);
        }

        // load biocache speciesImages
        speciesImages = biocacheService.getSpeciesImages();
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
