/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.commons.lang3.StringUtils;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * taxon-map: generates cached map images for all accepted taxa.
 * <p>
 * Reads accepted.csv (guid, ...) and for each taxon:
 * - Fetches the occurrence count from biocache-ws
 * - Exits early if --skip-existing or occurrence count has not changed
 * - Fetches expert distribution ids from search-service
 * - Renders and saves a base OSM tile PNG per zoom (shared, not per-taxon)
 * - Renders and saves an occurrence WMS PNG per zoom
 * - Renders and saves a distribution WMS PNG per zoom/distribution (always skipped if exists)
 * - Writes a consolidated manifest JSON per taxon
 * <p>
 * Output layout (under outputDir):
 * {zoomId}_base.png                             – shared base map tile (one per zoom)
 * {shard}/{encodedGuid}_map.json                – consolidated manifest
 * {shard}/{encodedGuid}_{zoomId}_occurrences.png – occurrence WMS layer (always regenerated)
 * {shard}/{encodedGuid}_{zoomId}_dist_{N}.png    – expert distribution layer (skipped if exists)
 * <p>
 * where shard = last 2 chars of encodedGuid.
 * <p>
 * Config keys (config.json):
 * biocacheUrl         - Biocache WS base URL
 * bieUrl              - BIE service base URL (for distributions lookup)
 * spatialUrl          - Spatial portal base URL (for distribution WMS)
 * osmZxyUrl           - OSM tile URL template ({z}/{x}/{y})
 * globalFq            - Global filter query appended to biocache requests
 * outputDir           - Root output directory
 * userAgent           - HTTP User-Agent header
 * imageWidth          - Output image width in pixels
 * imageHeight         - Output image height in pixels
 * mapLayerOpacity     - Opacity for the occurrence layer 0-1
 * mapCentreLat        - Default map centre latitude
 * mapCentreLng        - Default map centre longitude
 * mapDefaultZoom      - Default tile zoom level
 * hexBinColours       - Array of [hexColour, breakCount|null]
 * zooms               - Array of {id, label, zoom, bbox, centreLat?, centreLng?}
 * acceptedCsv         - Path to accepted.csv
 * threads             - Number of concurrent worker threads
 * skipExisting        - Skip taxa whose manifest + occurrence PNGs already exist
 */
public class MapFetcher {

    static String biocacheUrl;
    static String bieUrl;
    static String spatialUrl;
    static String osmZxyUrl;
    static String globalFq;
    static String outputDir;
    static String userAgent;
    static int imageWidth;
    static int imageHeight;
    static double mapLayerOpacity;
    static double mapCentreLat;
    static double mapCentreLng;
    static int mapDefaultZoom;
    static String acceptedCsv;
    static int threads = 2;
    static boolean skipExisting = false;
    static boolean verbose = false;
    static boolean usePreviousCounts = false;
    static boolean bieCounts = false;
    static boolean biocacheCounts = false;
    static String occurrenceCountsCsv = null; // path to persist/restore occurrence counts

    /**
     * Each entry: [hexColour, count|null]
     */
    static List<Object[]> hexBinColours = new ArrayList<>();

    /**
     * Each entry is a Map with keys: id, label, zoom, bbox, centreLat?, centreLng?
     */
    static List<Map<String, Object>> zooms = new ArrayList<>();

    /**
     * Pre-fetched distributions keyed by taxon lsid (guid).
     * Populated once before the guid processing loop via fetchAllDistributions().
     */
    static Map<String, List<Map<String, Object>>> distributionsByLsid = new HashMap<>();

    /**
     * Pre-fetched occurrence counts keyed by guid.
     * Populated in batches of 1000 via fetchAllOccurrenceCounts() before the processing loop.
     */
    static Map<String, Integer> occurrenceCountsByGuid = new HashMap<>();

    static final ObjectMapper mapper = new ObjectMapper();
    static final AtomicInteger processed = new AtomicInteger(0);
    static final AtomicInteger skipped = new AtomicInteger(0);
    static final AtomicInteger written = new AtomicInteger(0);
    static final AtomicInteger errors = new AtomicInteger(0);

    static final int TILE_SIZE = 256;

    public static void main(String[] args) throws Exception {

        if (args.length < 1) {
            System.err.println("Usage: MapFetcher <config.json> --biocache-counts|--bie-counts|--previous-counts [--skip-existing] [--verbose]");
            System.exit(1);
        }

        String configFile = args[0];
        for (String arg : args) {
            if ("--skip-existing".equals(arg)) skipExisting = true;
            if ("--verbose".equals(arg)) verbose = true;
            if ("--previous-counts".equals(arg)) usePreviousCounts = true;
            if ("--bie-counts".equals(arg)) bieCounts = true;
            if ("--biocache-counts".equals(arg)) biocacheCounts = true;
        }

        Map<String, Object> config = mapper.readValue(new File(configFile), Map.class);

        biocacheUrl = getString(config, "biocacheUrl", null);
        bieUrl = getString(config, "bieUrl", "");
        spatialUrl = getString(config, "spatialUrl", null);
        osmZxyUrl = getString(config, "osmZxyUrl", null);
        globalFq = getString(config, "globalFq", "");
        outputDir = getString(config, "outputDir", null);
        userAgent = getString(config, "userAgent", userAgent);
        imageWidth = getInt(config, "imageWidth", imageWidth);
        imageHeight = getInt(config, "imageHeight", imageHeight);
        mapLayerOpacity = getDouble(config, "mapLayerOpacity", mapLayerOpacity);
        mapCentreLat = getDouble(config, "mapCentreLat", mapCentreLat);
        mapCentreLng = getDouble(config, "mapCentreLng", mapCentreLng);
        mapDefaultZoom = getInt(config, "mapDefaultZoom", mapDefaultZoom);
        acceptedCsv = getString(config, "acceptedCsv", null);
        threads = getInt(config, "threads", threads);
        occurrenceCountsCsv = getString(config, "occurrenceCountsCsv", null);

        // hexBinColours: [[hex, count|null], ...]
        if (config.containsKey("hexBinColours")) {
            List<?> rawList = (List<?>) config.get("hexBinColours");
            for (Object entry : rawList) {
                List<?> pair = (List<?>) entry;
                String hex = pair.get(0).toString();
                Object count = pair.get(1); // may be null or Integer
                hexBinColours.add(new Object[]{hex, count});
            }
        } else {
            System.err.println("ERROR: config missing required 'hexBinColours' array");
            System.exit(1);
        }

        // zooms: [{id, label, zoom, bbox, centreLat?, centreLng?}, ...]
        if (config.containsKey("zooms")) {
            List<?> rawZooms = (List<?>) config.get("zooms");
            for (Object z : rawZooms) {
                zooms.add((Map<String, Object>) z);
            }
        } else {
            System.err.println("ERROR: config missing required 'zooms' array");
            System.exit(1);
        }

        if (biocacheUrl == null) {
            System.err.println("ERROR: biocacheUrl is required");
            System.exit(1);
        }
        if (spatialUrl == null) {
            System.err.println("ERROR: spatialUrl is required");
            System.exit(1);
        }
        if (osmZxyUrl == null) {
            System.err.println("ERROR: osmZxyUrl is required");
            System.exit(1);
        }
        if (outputDir == null) {
            System.err.println("ERROR: outputDir is required");
            System.exit(1);
        }
        if (acceptedCsv == null) {
            System.err.println("ERROR: acceptedCsv is required");
            System.exit(1);
        }

        if (!usePreviousCounts && !bieCounts && !biocacheCounts) {
            System.err.println("ERROR: one of --biocache-counts, --bie-counts, or --previous-counts must be specified");
            System.exit(1);
        }

        new File(outputDir).mkdirs();

        System.out.println(ts() + " Starting taxon-map");
        System.out.println(ts() + " biocacheUrl:  " + biocacheUrl);
        System.out.println(ts() + " bieUrl:       " + bieUrl);
        System.out.println(ts() + " spatialUrl:   " + spatialUrl);
        System.out.println(ts() + " outputDir:    " + outputDir);
        System.out.println(ts() + " acceptedCsv:  " + acceptedCsv);
        System.out.println(ts() + " threads:      " + threads);
        System.out.println(ts() + " skipExisting: " + skipExisting);
        System.out.println(ts() + " imageSize:    " + imageWidth + "×" + imageHeight);

        fetchAll();

        System.out.println(ts() + " Finished. processed=" + processed.get()
                + " skipped=" + skipped.get()
                + " written=" + written.get()
                + " errors=" + errors.get());
    }

    /**
     * Pre-generate all shared base layer PNGs (one per zoom) before processing taxa.
     * These are stored as {outputDir}/{zoomId}_base.png and are reused by every taxon.
     */
    static void ensureBaseLayers() {
        for (Map<String, Object> zoom : zooms) {
            String zoomId = zoom.get("id").toString();
            File baseFile = new File(outputDir, zoomId + "_base.png");
            if (baseFile.exists()) continue;
            double cLat = getZoomDouble(zoom, "centreLat", mapCentreLat);
            double cLng = getZoomDouble(zoom, "centreLng", mapCentreLng);
            int tileZoom = getZoomInt(zoom, "zoom", mapDefaultZoom);
            try {
                System.out.println(ts() + " Generating base layer for zoom " + zoomId);
                BufferedImage base = renderBaseLayer(cLat, cLng, tileZoom);
                savePng(base, baseFile, false);
            } catch (Exception e) {
                System.out.println(ts() + "  WARN base layer failed for zoom " + zoomId + ": " + e.getMessage());
            }
        }
    }

    static void fetchAll() throws IOException, CsvValidationException, InterruptedException {

        ensureBaseLayers();

        // Read all guids upfront so we can pre-fetch distributions filtered to this set
        List<String> guids = new ArrayList<>();
        try (CSVReader reader = new CSVReader(new FileReader(acceptedCsv))) {
            reader.readNext(); // skip header
            String[] row;
            while ((row = reader.readNext()) != null) {
                if (row.length < 1) continue;
                String guid = row[0].trim();
                if (StringUtils.isNotEmpty(guid)) guids.add(guid);
            }
        }
        System.out.println(ts() + " CSV read complete. Taxa loaded: " + guids.size());

        fetchAllDistributions(new HashSet<>(guids));
        fetchAllOccurrenceCounts(guids);

        BlockingQueue<String> queue = new ArrayBlockingQueue<>(200);
        String DONE = "__DONE__";

        Thread[] workers = new Thread[threads];
        for (int i = 0; i < threads; i++) {
            workers[i] = new Thread(() -> {
                while (true) {
                    try {
                        String guid = queue.take();
                        if (guid == DONE) {
                            queue.put(DONE);
                            break;
                        }
                        new ProcessTaxonRunnable(guid).run();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            });
            workers[i].start();
        }

        for (String guid : guids) {
            queue.put(guid);
        }

        System.out.println(ts() + " All taxa enqueued: " + guids.size());
        queue.put(DONE);

        for (Thread worker : workers) {
            worker.join();
        }
    }

    static class ProcessTaxonRunnable implements Runnable {

        private final String guid;

        ProcessTaxonRunnable(String guid) {
            this.guid = guid;
        }

        @Override
        public void run() {
            try {
                process();
            } catch (Exception e) {
                errors.incrementAndGet();
                System.out.println(ts() + " ERROR for " + guid + ": " + e.getMessage());
            }
            int done = processed.incrementAndGet();
            logProgress(done);
        }

        void process() throws Exception {
            String encodedGuid = URLEncoder.encode(guid, StandardCharsets.UTF_8);
            String shard = encodedGuid.length() >= 2 ? encodedGuid.substring(encodedGuid.length() - 2) : encodedGuid;

            File taxonDir = new File(outputDir + "/" + shard);
            taxonDir.mkdirs();

            File metadataFile = new File(taxonDir, encodedGuid + "_map.json");
            Integer metadataOccurrenceCount = null;
            Set<String> metadataDistGeomIdxSet = new HashSet<>();

            // read metadata occurrence count and distribution geomIdx set for change detection
            if (metadataFile.exists()) {
                try {
                    Map<?, ?> existing = mapper.readValue(metadataFile, Map.class);
                    Object occCount = existing.get("occurrenceCount");
                    if (occCount != null) metadataOccurrenceCount = ((Number) occCount).intValue();
                    // extract geomIdx values from any zoom's distribution layers
                    Map<?, ?> zooms = (Map<?, ?>) existing.get("zooms");
                    if (zooms != null && !zooms.isEmpty()) {
                        Map<?, ?> firstZoom = (Map<?, ?>) zooms.values().iterator().next();
                        List<?> layers = (List<?>) firstZoom.get("layers");
                        if (layers != null) {
                            for (Object l : layers) {
                                Map<?, ?> layer = (Map<?, ?>) l;
                                if ("distribution".equals(layer.get("type")) && layer.get("geomIdx") != null) {
                                    metadataDistGeomIdxSet.add(layer.get("geomIdx").toString());
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {
                }
            }

            // --skip-existing: skip if metadata exists and either occurrenceCount==0 or all occ PNGs present
            if (skipExisting && metadataFile.exists()) {
                if (metadataOccurrenceCount == null || metadataOccurrenceCount == 0) {
                    skipped.incrementAndGet();
                    return;
                }
                boolean allOccPresent = true;
                for (Map<String, Object> zoom : zooms) {
                    String zoomId = zoom.get("id").toString();
                    File occFile = new File(taxonDir, encodedGuid + "_" + zoomId + "_occurrences.png");
                    if (!occFile.exists()) {
                        allOccPresent = false;
                        break;
                    }
                }
                if (allOccPresent) {
                    skipped.incrementAndGet();
                    return;
                }
            }

            // 1. Occurrence count (pre-fetched in bulk)
            int occurrenceCount = occurrenceCountsByGuid.getOrDefault(guid, 0);

            // if occurrence count is unchanged and distributions are unchanged, skip
            List<Map<String, Object>> distributions = getDistributions(guid);
            if (metadataOccurrenceCount != null && metadataFile.exists()) {
                Set<String> currentDistGeomIdxSet = new HashSet<>();
                for (Map<String, Object> d : distributions) {
                    if (d.get("geomIdx") != null) currentDistGeomIdxSet.add(d.get("geomIdx").toString());
                }

                boolean occUnchanged = metadataOccurrenceCount == occurrenceCount;
                boolean distUnchanged = currentDistGeomIdxSet.equals(metadataDistGeomIdxSet);

                if (occUnchanged && distUnchanged) {
                    boolean allOccPresent = occurrenceCount == 0;
                    if (!allOccPresent) {
                        allOccPresent = true;
                        for (Map<String, Object> zoom : zooms) {
                            if (!new File(taxonDir, encodedGuid + "_" + zoom.get("id") + "_occurrences.png").exists()) {
                                allOccPresent = false;
                                break;
                            }
                        }
                    }
                    if (allOccPresent) {
                        skipped.incrementAndGet();
                        return;
                    }
                } else {
                    // log what changed
                    if (verbose) {
                        StringBuilder diffMsg = new StringBuilder(ts() + " update " + guid + ";");
                        if (!occUnchanged) {
                            diffMsg.append(" occCount ").append(metadataOccurrenceCount).append(" -> ").append(occurrenceCount).append(";");
                        }
                        if (!distUnchanged) {
                            Set<String> added = new HashSet<>(currentDistGeomIdxSet);
                            added.removeAll(metadataDistGeomIdxSet);
                            Set<String> removed = new HashSet<>(metadataDistGeomIdxSet);
                            removed.removeAll(currentDistGeomIdxSet);
                            if (!added.isEmpty()) diffMsg.append(" dist +").append(added).append(";");
                            if (!removed.isEmpty()) diffMsg.append(" dist -").append(removed).append(";");
                        }
                        System.out.println(diffMsg);
                    }
                }
            } else {
                // no pre-existing metadata — new taxon
                if (verbose) {
                    System.out.println(ts() + " new " + guid + "; occCount " + occurrenceCount + "; dist " + distributions.size());
                }
            }

            // Zero occurrences — remove taxon files and write base-only metadata, write distributions
            if (occurrenceCount == 0) {
                deleteTaxonFiles(taxonDir, encodedGuid);

                Map<String, Object> zeroZooms = new LinkedHashMap<>();
                for (Map<String, Object> zoom : zooms) {
                    String zoomId = zoom.get("id").toString();
                    double cLat = getZoomDouble(zoom, "centreLat", mapCentreLat);
                    double cLng = getZoomDouble(zoom, "centreLng", mapCentreLng);
                    int tileZoom = getZoomInt(zoom, "zoom", mapDefaultZoom);
                    List<?> targetBbox = (List<?>) zoom.get("bbox");


                    TileGrid grid = tileGridForCentre(cLat, cLng, tileZoom);
                    double[] canvasBbox = canvasBboxMetres(grid);

                    Map<String, Object> zoomEntry = new LinkedHashMap<>();
                    zoomEntry.put("label", zoom.getOrDefault("label", zoomId));
                    zoomEntry.put("targetBbox", targetBbox);
                    zoomEntry.put("canvasBbox", canvasBbox);

                    List<Map<String, Object>> layers = new ArrayList<>();
                    Map<String, Object> baseLayer = new LinkedHashMap<>();
                    baseLayer.put("id", "base");
                    baseLayer.put("type", "base");
                    baseLayer.put("label", "Base map");
                    baseLayer.put("sharedFile", zoomId + "_base.png");
                    layers.add(baseLayer);
                    Map<String, Object> occLayer = new LinkedHashMap<>();
                    occLayer.put("id", "occurrences");
                    occLayer.put("type", "occurrences");
                    occLayer.put("label", "Occurrence records");
                    layers.add(occLayer);
                    zoomEntry.put("layers", layers);

                    Map<String, Object> attr = new LinkedHashMap<>();
                    String osmAttr = "&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\">OpenStreetMap</a> contributors";
                    attr.put("base", osmAttr);
                    List<Map<String, Object>> zeroBaseLayerAttrs = new ArrayList<>();
                    Map<String, Object> zeroBaseLayerAttr = new LinkedHashMap<>();
                    zeroBaseLayerAttr.put("id", "base");
                    zeroBaseLayerAttr.put("attribution", osmAttr);
                    zeroBaseLayerAttrs.add(zeroBaseLayerAttr);
                    attr.put("baseLayers", zeroBaseLayerAttrs);
                    attr.put("occurrences", "Atlas of Living Australia");
                    attr.put("distributions", buildDistAttrs(distributions));
                    zoomEntry.put("attributions", attr);

                    zeroZooms.put(zoomId, zoomEntry);
                }

                Map<String, Object> zeroMetadata = new LinkedHashMap<>();
                zeroMetadata.put("guid", guid);
                zeroMetadata.put("imageWidth", imageWidth);
                zeroMetadata.put("imageHeight", imageHeight);
                zeroMetadata.put("occurrenceCount", 0);
                zeroMetadata.put("hexBinValues", new ArrayList<>());
                zeroMetadata.put("mapLayerOpacity", mapLayerOpacity);
                zeroMetadata.put("zooms", zeroZooms);
                zeroMetadata.put("generated", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").format(new Date()));
                writeJson(metadataFile, zeroMetadata);
                return;
            }

            List<Object[]> scaledHex = scaledHexBinValues(occurrenceCount);

            // 3. Per-zoom processing with retry on biocache WMS failures
            final int MAX_RETRIES = 3;
            final int RETRY_DELAY_MS = 60_000;

            for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                BiocacheWmsException biocacheFailure = null;
                Map<String, Object> allZooms = new LinkedHashMap<>();

                for (Map<String, Object> zoom : zooms) {
                    if (biocacheFailure != null) break;

                    String zoomId = zoom.get("id").toString();
                    double cLat = getZoomDouble(zoom, "centreLat", mapCentreLat);
                    double cLng = getZoomDouble(zoom, "centreLng", mapCentreLng);
                    int tileZoom = getZoomInt(zoom, "zoom", mapDefaultZoom);
                    List targetBbox = (List) zoom.get("bbox");

                    TileGrid grid = tileGridForCentre(cLat, cLng, tileZoom);
                    double[] canvasBbox = canvasBboxMetres(grid);

                    List<Map<String, Object>> layerIds = new ArrayList<>();
                    Map<String, Object> attributions = new LinkedHashMap<>();
                    String osmAttribution = "&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\">OpenStreetMap</a> contributors";
                    attributions.put("base", osmAttribution);
                    List<Map<String, Object>> baseLayerAttrs = new ArrayList<>();
                    Map<String, Object> baseLayerAttr = new LinkedHashMap<>();
                    baseLayerAttr.put("id", "base");
                    baseLayerAttr.put("attribution", osmAttribution);
                    baseLayerAttrs.add(baseLayerAttr);
                    attributions.put("baseLayers", baseLayerAttrs);
                    attributions.put("occurrences", "Atlas of Living Australia");
                    // base layer metadata
                    File baseFile = new File(outputDir, zoomId + "_base.png");
                    if (baseFile.exists()) {
                        Map<String, Object> l = new LinkedHashMap<>();
                        l.put("id", "base");
                        l.put("type", "base");
                        l.put("label", "Base map");
                        l.put("sharedFile", zoomId + "_base.png");
                        layerIds.add(l);
                    } else {
                        System.out.println(ts() + "  WARN base layer missing for zoom " + zoomId + " (should have been pre-generated)");
                    }

                    // occurrence layer metadata and image
                    File occFile = new File(taxonDir, encodedGuid + "_" + zoomId + "_occurrences.png");
                    try {
                        BufferedImage occCanvas = renderOccurrenceWmsTiled(cLat, cLng, tileZoom, mapLayerOpacity, guid, scaledHex);
                        savePng(occCanvas, occFile, true);
                        Map<String, Object> l = new LinkedHashMap<>();
                        l.put("id", "occurrences");
                        l.put("type", "occurrences");
                        l.put("label", "Occurrence records");
                        layerIds.add(l);
                    } catch (BiocacheWmsException e) {
                        biocacheFailure = e;
                        break;
                    } catch (Exception e) {
                        System.out.println(ts() + "  WARN occurrences layer failed for zoom " + zoomId + ": " + e.getMessage());
                    }

                    // expert distribution layers
                    layerIds.addAll(distributions);

                    // expert distribution attributions
                    attributions.put("distributions", buildDistAttrs(distributions));

                    Map<String, Object> zoomEntry = new LinkedHashMap<>();
                    zoomEntry.put("label", zoom.getOrDefault("label", zoomId));
                    zoomEntry.put("targetBbox", targetBbox);
                    zoomEntry.put("canvasBbox", canvasBbox);
                    zoomEntry.put("layers", layerIds);
                    zoomEntry.put("attributions", attributions);
                    allZooms.put(zoomId, zoomEntry);
                }

                if (biocacheFailure != null) {
                    System.out.println(ts() + "  WARN biocache WMS error (attempt " + attempt + "/" + MAX_RETRIES + "): " + biocacheFailure.getMessage());
                    deleteTaxonFiles(taxonDir, encodedGuid);
                    if (attempt < MAX_RETRIES) {
                        System.out.println(ts() + "  retrying in " + (RETRY_DELAY_MS / 1000) + "s...");
                        Thread.sleep(RETRY_DELAY_MS);
                        continue;
                    } else {
                        throw new RuntimeException("All " + MAX_RETRIES + " biocache WMS attempts failed for " + guid);
                    }
                }

                // Write consolidated metadata
                Map<String, Object> metadata = new LinkedHashMap<>();
                metadata.put("guid", guid);
                metadata.put("imageWidth", imageWidth);
                metadata.put("imageHeight", imageHeight);
                metadata.put("occurrenceCount", occurrenceCount);
                metadata.put("hexBinValues", scaledHex);
                metadata.put("mapLayerOpacity", mapLayerOpacity);
                metadata.put("zooms", allZooms);
                metadata.put("generated", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").format(new Date()));
                writeJson(metadataFile, metadata);
                break; // success
            }
        }

        private void logProgress(int done) {
            if (done % 100 == 0) {
                System.out.println(ts() + " processed=" + done
                        + " skipped=" + skipped.get()
                        + " written=" + written.get()
                        + " errors=" + errors.get());
            }
        }
    }

    /**
     * Tile grid parameters for a canvas centred on (centreLat, centreLng) at tile zoom level.
     */
    static class TileGrid {
        int z, x0, y0, x1, y1;
        double offsetX, offsetY;
        double topLeftPixX, topLeftPixY;

        TileGrid(int z, int x0, int y0, int x1, int y1,
                 double offsetX, double offsetY,
                 double topLeftPixX, double topLeftPixY) {
            this.z = z;
            this.x0 = x0;
            this.y0 = y0;
            this.x1 = x1;
            this.y1 = y1;
            this.offsetX = offsetX;
            this.offsetY = offsetY;
            this.topLeftPixX = topLeftPixX;
            this.topLeftPixY = topLeftPixY;
        }
    }

    static TileGrid tileGridForCentre(double centreLat, double centreLng, int zoom) {
        int z = zoom;
        double pow2z = Math.pow(2, z);
        double cTileX = ((centreLng + 180.0) / 360.0) * pow2z;
        double cRad = Math.toRadians(centreLat);
        double cTileY = ((1.0 - Math.log(Math.tan(cRad) + 1.0 / Math.cos(cRad)) / Math.PI) / 2.0) * pow2z;

        double cPixX = cTileX * TILE_SIZE;
        double cPixY = cTileY * TILE_SIZE;

        double topLeftPixX = cPixX - imageWidth / 2.0;
        double topLeftPixY = cPixY - imageHeight / 2.0;

        int x0 = (int) Math.floor(topLeftPixX / TILE_SIZE);
        int y0 = (int) Math.floor(topLeftPixY / TILE_SIZE);
        int x1 = (int) Math.ceil((topLeftPixX + imageWidth) / TILE_SIZE) - 1;
        int y1 = (int) Math.ceil((topLeftPixY + imageHeight) / TILE_SIZE) - 1;

        double offsetX = x0 * TILE_SIZE - topLeftPixX;
        double offsetY = y0 * TILE_SIZE - topLeftPixY;

        return new TileGrid(z, x0, y0, x1, y1, offsetX, offsetY, topLeftPixX, topLeftPixY);
    }

    /**
     * Returns [west, south, east, north] in EPSG:3857 metres.
     */
    static double[] canvasBboxMetres(TileGrid grid) {
        int z = grid.z;
        double totalPixels = Math.pow(2, z) * TILE_SIZE;
        double merc = 20037508.342789244;
        double west = (grid.topLeftPixX / totalPixels) * 2 * merc - merc;
        double east = ((grid.topLeftPixX + imageWidth) / totalPixels) * 2 * merc - merc;
        double north = merc - (grid.topLeftPixY / totalPixels) * 2 * merc;
        double south = merc - ((grid.topLeftPixY + imageHeight) / totalPixels) * 2 * merc;
        return new double[]{west, south, east, north};
    }

    /**
     * Stitch OSM tiles into a base map canvas.
     */
    static BufferedImage renderBaseLayer(double centreLat, double centreLng, int zoom) throws Exception {
        TileGrid grid = tileGridForCentre(centreLat, centreLng, zoom);
        BufferedImage canvas = new BufferedImage(imageWidth, imageHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = canvas.createGraphics();
        int pow2z = (int) Math.pow(2, grid.z);

        List<Thread> threads = new ArrayList<>();
        // Use a simple array to allow lambda capture
        Object lock = new Object();

        for (int tx = grid.x0; tx <= grid.x1; tx++) {
            for (int ty = grid.y0; ty <= grid.y1; ty++) {
                final int ftx = tx;
                final int fty = ty;
                final int wrappedTx = ((tx % pow2z) + pow2z) % pow2z;
                final int drawX = (int) Math.round(grid.offsetX + (tx - grid.x0) * TILE_SIZE);
                final int drawY = (int) Math.round(grid.offsetY + (ty - grid.y0) * TILE_SIZE);
                String url = osmZxyUrl
                        .replace("{z}", String.valueOf(grid.z))
                        .replace("{x}", String.valueOf(wrappedTx))
                        .replace("{y}", String.valueOf(fty));
                Thread t = new Thread(() -> {
                    try {
                        byte[] buf = fetchImageBytes(url, true);
                        BufferedImage tile = ImageIO.read(new ByteArrayInputStream(buf));
                        if (tile != null) {
                            synchronized (lock) {
                                g.drawImage(tile, drawX, drawY, TILE_SIZE, TILE_SIZE, null);
                            }
                        }
                    } catch (Exception e) {
                        System.out.println(ts() + "  WARN tile " + grid.z + "/" + wrappedTx + "/" + fty + " failed: " + e.getMessage());
                    }
                });
                t.start();
                threads.add(t);
            }
        }
        for (Thread t : threads) t.join();
        g.dispose();
        return canvas;
    }

    /**
     * Render the occurrence WMS layer tiled on the Leaflet-aligned global tile grid
     * (one WMS GetMap request per tile cell, identical to how Leaflet issues WMS requests).
     *
     * @throws BiocacheWmsException on any WMS tile fetch failure
     */
    static BufferedImage renderOccurrenceWmsTiled(double centreLat, double centreLng, int tileZoom,
                                                  double opacity, String guid, List<Object[]> scaledHex) throws Exception {
        TileGrid grid = tileGridForCentre(centreLat, centreLng, tileZoom);
        int pow2z = (int) Math.pow(2, grid.z);
        double totalPixels = Math.pow(2, grid.z) * TILE_SIZE;
        double merc = 20037508.342789244;

        String hexBinParam = buildHexBinParam(scaledHex);

        BufferedImage canvas = new BufferedImage(imageWidth, imageHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = canvas.createGraphics();
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, (float) opacity));

        List<BiocacheWmsException> failures = Collections.synchronizedList(new ArrayList<>());
        Object lock = new Object();
        List<Thread> threadList = new ArrayList<>();

        for (int tx = grid.x0; tx <= grid.x1; tx++) {
            for (int ty = grid.y0; ty <= grid.y1; ty++) {
                final int ftx = tx;
                final int fty = ty;
                final int wrappedTx = ((tx % pow2z) + pow2z) % pow2z;

                double tilePixX = (double) tx * TILE_SIZE;
                double tilePixY = (double) ty * TILE_SIZE;
                double bboxWest = (tilePixX / totalPixels) * 2 * merc - merc;
                double bboxEast = ((tilePixX + TILE_SIZE) / totalPixels) * 2 * merc - merc;
                double bboxNorth = merc - (tilePixY / totalPixels) * 2 * merc;
                double bboxSouth = merc - ((tilePixY + TILE_SIZE) / totalPixels) * 2 * merc;
                String bboxStr = bboxWest + "," + bboxSouth + "," + bboxEast + "," + bboxNorth;

                final int drawX = (int) Math.round(grid.offsetX + (tx - grid.x0) * TILE_SIZE);
                final int drawY = (int) Math.round(grid.offsetY + (ty - grid.y0) * TILE_SIZE);

                // globalFq starts with "&" from the JS original — keep as-is for the URL
                String url = biocacheUrl + "/ogc/wms/reflect"
                        + "?q=lsid:" + URLEncoder.encode(guid, StandardCharsets.UTF_8)
                        + "&OUTLINE=false"
                        + "&ENV=size:3;colormode:hexbin;color:" + URLEncoder.encode(hexBinParam, StandardCharsets.UTF_8)
                        + globalFq
                        + "&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap"
                        + "&LAYERS=ALA:occurrences"
                        + "&FORMAT=image/png&TRANSPARENT=true"
                        + "&WIDTH=" + TILE_SIZE + "&HEIGHT=" + TILE_SIZE
                        + "&SRS=EPSG:3857&BBOX=" + bboxStr;

                Thread t = new Thread(() -> {
                    try {
                        byte[] buf = fetchImageBytes(url, true);
                        BufferedImage tile = ImageIO.read(new ByteArrayInputStream(buf));
                        if (tile != null) {
                            synchronized (lock) {
                                g.drawImage(tile, drawX, drawY, TILE_SIZE, TILE_SIZE, null);
                            }
                        }
                    } catch (Exception e) {
                        failures.add(new BiocacheWmsException("tile " + grid.z + "/" + wrappedTx + "/" + fty + " failed: " + e.getMessage()));
                    }
                });
                t.start();
                threadList.add(t);
            }
        }
        for (Thread t : threadList) t.join();
        g.dispose();

        if (!failures.isEmpty()) throw failures.get(0);
        return canvas;
    }

    static BufferedImage renderWmsLayer(String wmsUrl, double opacity) throws Exception {
        byte[] buf = fetchImageBytes(wmsUrl, true);
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(buf));
        if (img == null) throw new IOException("ImageIO could not decode response from: " + wmsUrl);

        BufferedImage canvas = new BufferedImage(imageWidth, imageHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = canvas.createGraphics();
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, (float) opacity));
        g.drawImage(img, 0, 0, imageWidth, imageHeight, null);
        g.dispose();
        return canvas;
    }

    static String buildDistributionWmsUrl(Object geomIdx, double[] canvasBbox) {
        String bboxStr = canvasBbox[0] + "," + canvasBbox[1] + "," + canvasBbox[2] + "," + canvasBbox[3];
        return spatialUrl + "/geoserver/wms"
                + "?styles=polygon&viewparams=s:" + geomIdx
                + "&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap"
                + "&LAYERS=ALA:Distributions"
                + "&FORMAT=image/png&TRANSPARENT=true"
                + "&WIDTH=" + imageWidth + "&HEIGHT=" + imageHeight
                + "&SRS=EPSG:3857&BBOX=" + bboxStr;
    }

    // scaledHexBinValues is aligned with mapView.tsx
    static List<Object[]> scaledHexBinValues(int occurrenceCount) {
        int binFactor = 20;
        if (occurrenceCount < 25000) binFactor = 1;
        else if (occurrenceCount < 50000) binFactor = 2;
        else if (occurrenceCount < 200000) binFactor = 5;
        else if (occurrenceCount < 500000) binFactor = 10;

        final int factor = binFactor;
        List<Object[]> result = new ArrayList<>();
        for (Object[] entry : hexBinColours) {
            String hex = entry[0].toString();
            Object count = entry[1];
            Object scaled = (count == null) ? null : ((Number) count).intValue() * factor;
            result.add(new Object[]{hex, scaled});
        }
        return result;
    }

    static String buildHexBinParam(List<Object[]> scaledValues) {
        StringBuilder sb = new StringBuilder();
        for (Object[] entry : scaledValues) {
            if (sb.length() > 0) sb.append(',');
            sb.append(entry[0]);
            if (entry[1] != null) sb.append(',').append(entry[1]);
        }
        return sb.toString();
    }

    static void savePng(BufferedImage image, File file, boolean overwrite) throws IOException {
        if (!overwrite && file.exists()) {
            return;
        }
        file.getParentFile().mkdirs();
        ImageIO.write(image, "png", file);
        written.incrementAndGet();
        //System.out.println(ts() + "  wrote " + file);
    }

    static void writeJson(File file, Object obj) throws IOException {
        file.getParentFile().mkdirs();
        mapper.writerWithDefaultPrettyPrinter().writeValue(file, obj);
        written.incrementAndGet();
        //System.out.println(ts() + "  wrote " + file);
    }

    /**
     * Delete all per-taxon files (PNGs, excluding distributions) for this guid.
     */
    static void deleteTaxonFiles(File taxonDir, String encodedGuid) {
        String prefix = encodedGuid + "_";
        File[] entries = taxonDir.listFiles();
        if (entries == null) return;
        for (File f : entries) {
            if (f.getName().startsWith(prefix) && !f.getName().contains("_dist_") && !f.getName().endsWith(".png")) {
                f.delete();
            }
        }
    }

    static byte[] fetchImageBytes(String urlStr, boolean expectImage) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        try {
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", userAgent);
            conn.setConnectTimeout(30_000);
            conn.setReadTimeout(120_000);
            conn.setInstanceFollowRedirects(true);

            int status = conn.getResponseCode();
            if (status != 200) throw new IOException("HTTP " + status + " for " + urlStr);

            if (expectImage) {
                String ct = conn.getContentType();
                if (ct != null && !ct.startsWith("image/")) {
                    // read body for diagnostics
                    byte[] body = conn.getInputStream().readAllBytes();
                    throw new IOException("Expected image, got " + ct + " for " + urlStr + "\n"
                            + new String(body, 0, Math.min(body.length, 500), StandardCharsets.UTF_8));
                }
            }

            return conn.getInputStream().readAllBytes();
        } finally {
            conn.disconnect();
        }
    }

    static String fetchJson(String urlStr) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        try {
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("User-Agent", userAgent);
            conn.setConnectTimeout(30_000);
            conn.setReadTimeout(60_000);
            conn.setInstanceFollowRedirects(true);

            int status = conn.getResponseCode();
            if (status != 200) throw new IOException("HTTP " + status + " for " + urlStr);

            try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line).append('\n');
                }
                return sb.toString().trim();
            }
        } finally {
            conn.disconnect();
        }
    }

    static int fetchOccurrenceCount(String guid) throws IOException {
        String url = biocacheUrl + "/occurrences/search" + "?q=lsid:" + URLEncoder.encode(guid, StandardCharsets.UTF_8)
                + globalFq + "&pageSize=0";
        String json = fetchJson(url);
        Map<?, ?> data = mapper.readValue(json, Map.class);
        Object total = data.get("totalRecords");
        return total != null ? ((Number) total).intValue() : 0;
    }

    static String getString(Map<String, Object> map, String key, String def) {
        return map.containsKey(key) ? map.get(key).toString() : def;
    }

    static int getInt(Map<String, Object> map, String key, int def) {
        if (!map.containsKey(key)) return def;
        return ((Number) map.get(key)).intValue();
    }

    static double getDouble(Map<String, Object> map, String key, double def) {
        if (!map.containsKey(key)) return def;
        return ((Number) map.get(key)).doubleValue();
    }

    static double getZoomDouble(Map<String, Object> zoom, String key, double def) {
        if (!zoom.containsKey(key) || zoom.get(key) == null) return def;
        return ((Number) zoom.get(key)).doubleValue();
    }

    static int getZoomInt(Map<String, Object> zoom, String key, int def) {
        if (!zoom.containsKey(key) || zoom.get(key) == null) return def;
        return ((Number) zoom.get(key)).intValue();
    }

    static String ts() {
        return new SimpleDateFormat("HH:mm:ss:SSS").format(new Date());
    }

    static class BiocacheWmsException extends RuntimeException {
        BiocacheWmsException(String message) {
            super(message);
        }
    }

    /**
     * Pre-fetches occurrence counts for all guids in batches of 1000 using the biocache
     * facets API. Results are stored in {@link #occurrenceCountsByGuid}.
     * Any guid not returned by biocache (zero records) remains absent from the map (defaults to 0).
     * <p>
     * If {@code occurrenceCountsCsv} is configured, results are written to that file after fetching.
     * If {@code --use-previous-counts} is set and the CSV exists, it is loaded instead of fetching.
     */
    static void fetchAllOccurrenceCounts(List<String> guids) throws IOException {
        // Load from CSV if requested and file exists
        if (usePreviousCounts && occurrenceCountsCsv != null) {
            File csvFile = new File(occurrenceCountsCsv);
            if (csvFile.exists()) {
                System.out.println(ts() + " Loading occurrence counts from " + occurrenceCountsCsv);
                int loaded = 0;
                try (BufferedReader br = new BufferedReader(new FileReader(csvFile, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        int comma = line.lastIndexOf(',');
                        if (comma > 0) {
                            String g = line.substring(0, comma);
                            String c = line.substring(comma + 1).trim();
                            try { occurrenceCountsByGuid.put(g, Integer.parseInt(c)); loaded++; } catch (NumberFormatException ignored) {}
                        }
                    }
                }
                System.out.println(ts() + " Occurrence counts loaded from CSV: " + loaded);
                return;
            } else {
                System.out.println(ts() + " WARN --previous-counts set but " + occurrenceCountsCsv + " not found; fetching from biocache");
            }
        }

        if (bieCounts) {
            fetchOccurrenceCountsFromBie();
        } else if (biocacheCounts) {
            fetchOccurrenceCountsFromBiocache(guids);
        }

        // Write to CSV for future --use-previous-counts runs
        if (occurrenceCountsCsv != null) {
            try (PrintWriter pw = new PrintWriter(new FileWriter(occurrenceCountsCsv, StandardCharsets.UTF_8))) {
                for (Map.Entry<String, Integer> e : occurrenceCountsByGuid.entrySet()) {
                    pw.println(e.getKey() + "," + e.getValue());
                }
                System.out.println(ts() + " Occurrence counts written to " + occurrenceCountsCsv);
            } catch (IOException e) {
                System.out.println(ts() + "  WARN could not write occurrence counts CSV: " + e.getMessage());
            }
        }
    }

    /**
     * Fetches occurrence counts for all accepted taxa from the BIE v1 download API.
     * <p>
     * GETs {bieUrl}/v1/bie/download?q=-acceptedConceptID:*&fq=idxtype:TAXON&fq=occurrenceCount:*&fields=guid,occurrenceCount
     * The response is a CSV streamed directly (no polling required).
     */
    static void fetchOccurrenceCountsFromBie() throws IOException {
        if (StringUtils.isEmpty(bieUrl)) {
            System.out.println(ts() + " WARN --bie-counts requested but bieUrl is not configured; skipping");
            return;
        }
        String base = bieUrl.replaceAll("/$", "");
        String downloadUrl = base + "/v1/bie/download"
                + "?q=" + URLEncoder.encode("-acceptedConceptID:*", StandardCharsets.UTF_8)
                + "&fq=" + URLEncoder.encode("idxtype:TAXON", StandardCharsets.UTF_8)
                + "&fq=" + URLEncoder.encode("occurrenceCount:[1 TO *]", StandardCharsets.UTF_8)
                + "&fields=guid,occurrenceCount"
                + "&file=occurrence-counts.csv";

        System.out.println(ts() + " Downloading BIE occurrence counts from: " + downloadUrl);
        byte[] csvBytes = fetchImageBytes(downloadUrl, false);
        int loaded = 0;
        try (BufferedReader br = new BufferedReader(new InputStreamReader(new ByteArrayInputStream(csvBytes), StandardCharsets.UTF_8))) {
            br.readLine(); // skip header
            String line;
            while ((line = br.readLine()) != null) {
                // CSV: guid,occurrenceCount
                int comma = line.indexOf(',');
                if (comma > 0) {
                    String guid = line.substring(0, comma).trim();
                    String countStr = line.substring(comma + 1).trim();
                    if (guid.startsWith("\"")) guid = guid.substring(1, guid.length() - 1);
                    if (countStr.startsWith("\"")) countStr = countStr.substring(1, countStr.length() - 1);
                    try {
                        int count = Integer.parseInt(countStr);
                        if (count > 0) { occurrenceCountsByGuid.put(guid, count); loaded++; }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }
        System.out.println(ts() + " BIE occurrence counts loaded: " + loaded + " non-zero entries");
    }

    /**
     * Fetches occurrence counts for all guids in batches of 1000 using the biocache facets API.
     * Results are stored in {@link #occurrenceCountsByGuid}.
     */
    static void fetchOccurrenceCountsFromBiocache(List<String> guids) throws IOException {
        int batchSize = 1000;
        int total = guids.size();
        int fetched = 0;
        System.out.println(ts() + " Fetching occurrence counts for " + total + " taxa from biocache...");
        for (int i = 0; i < total; i += batchSize) {
            List<String> batch = guids.subList(i, Math.min(i + batchSize, total));

            // Build lsid:(guid1 OR guid2 ...) query
            StringBuilder qBuilder = new StringBuilder("q=lsid:(");
            for (int j = 0; j < batch.size(); j++) {
                if (j > 0) qBuilder.append("+OR+");
                qBuilder.append(URLEncoder.encode("\"" + batch.get(j) + "\"", StandardCharsets.UTF_8));
            }
            qBuilder.append(")");
            if (StringUtils.isNotEmpty(globalFq)) qBuilder.append(globalFq);
            qBuilder.append("&facets=lsid&pageSize=0&flimit=-1");

            String url = biocacheUrl + "/occurrences/search";
            try {
                System.out.println(ts() + " Fetching occurrence counts batch " + (i / batchSize + 1) + "/" + ((total + batchSize - 1) / batchSize) + " (" + batch.size() + " guids)...");
                String json = fetchJsonPost(url, qBuilder.toString());
                Map<?, ?> data = mapper.readValue(json, Map.class);
                List<?> facetResults = (List<?>) data.get("facetResults");
                if (facetResults != null && !facetResults.isEmpty()) {
                    Map<?, ?> lsidFacet = (Map<?, ?>) facetResults.get(0);
                    List<?> fieldResult = (List<?>) lsidFacet.get("fieldResult");
                    if (fieldResult != null) {
                        int batchFetched = 0;
                        for (Object fr : fieldResult) {
                            Map<?, ?> entry = (Map<?, ?>) fr;
                            Object label = entry.get("label");
                            Object count = entry.get("count");
                            if (label != null && count != null) {
                                occurrenceCountsByGuid.put(label.toString(), ((Number) count).intValue());
                                fetched++;
                                batchFetched++;
                            }
                        }
                        System.out.println(ts() + "  -> " + batchFetched + " non-zero of " + batch.size() + " (total so far: " + fetched + ")");
                    }
                }
            } catch (Exception e) {
                System.out.println(ts() + "  WARN occurrence count batch " + i + "-" + (i + batch.size()) + " failed: " + e.getMessage());
            }
        }
        System.out.println(ts() + " Occurrence counts fetched: " + fetched + " non-zero of " + total);
    }


    /**
     * POST request returning the response body as a String.
     * Body should be URL-encoded form data (application/x-www-form-urlencoded).
     */
    static String fetchJsonPost(String urlStr, String body) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setRequestProperty("User-Agent", userAgent);
            conn.setConnectTimeout(30_000);
            conn.setReadTimeout(120_000);
            conn.setInstanceFollowRedirects(true);
            conn.setDoOutput(true);
            byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
            conn.setRequestProperty("Content-Length", String.valueOf(bodyBytes.length));
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bodyBytes);
            }
            int status = conn.getResponseCode();
            if (status != 200) throw new IOException("HTTP " + status + " for POST " + urlStr);
            try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line).append('\n');
                return sb.toString().trim();
            }
        } finally {
            conn.disconnect();
        }
    }

    /**
     * Fetches all expert distributions from the spatial service in a single request,
     * renders per-zoom WMS images for each distribution, and stores fully-formatted
     * layer descriptors in {@link #distributionsByLsid} keyed by taxon lsid.
     * Only distributions whose {@code lsid} matches a guid in {@code guidSet} are retained.
     * <p>
     * Each stored entry is a ready-to-use layer descriptor:
     * {id, type, label, dataResourceUid, dataResourceName, geomIdx}
     */
    static void fetchAllDistributions(Set<String> guidSet) {
        if (StringUtils.isEmpty(spatialUrl)) return;
        try {
            System.out.println(ts() + " Fetching all distributions from spatial service...");
            String url = spatialUrl.replaceAll("/$", "") + "/ws/distributions";
            String json = fetchJson(url);
            List<?> distributions = mapper.readValue(json, List.class);
            System.out.println(ts() + " Found " + distributions.size() + " distributions");

            Map<String, String> dataResourceNameCache = new HashMap<>();

            int count = 0;
            for (Object entry : distributions) {
                Map raw = (Map) entry;
                String lsid = raw.get("lsid") != null ? raw.get("lsid").toString() : null;
                Object geomIdxObj = raw.get("geom_idx");
                String uid = (String) raw.get("data_resource_uid");
                if (lsid == null || !guidSet.contains(lsid) || geomIdxObj == null || uid == null) {
                    continue;
                }

                if (count % 100 == 0 && count > 0) {
                    System.out.println(ts() + " Distributions processed: " + count);
                }

                String distLayerId = "dist_" + geomIdxObj;
                String encodedGuid = URLEncoder.encode(lsid, StandardCharsets.UTF_8);
                String shard = encodedGuid.length() >= 2 ? encodedGuid.substring(encodedGuid.length() - 2) : encodedGuid;
                File taxonDir = new File(outputDir + "/" + shard);
                taxonDir.mkdirs();

                // Render image for each zoom (skip if already exists)
                for (Map<String, Object> zoom : zooms) {
                    String zoomId = zoom.get("id").toString();
                    File distFile = new File(taxonDir, encodedGuid + "_" + zoomId + "_" + distLayerId + ".png");
                    if (distFile.exists()) {
                        continue;
                    }
                    double cLat = getZoomDouble(zoom, "centreLat", mapCentreLat);
                    double cLng = getZoomDouble(zoom, "centreLng", mapCentreLng);
                    int tileZoom = getZoomInt(zoom, "zoom", mapDefaultZoom);
                    TileGrid grid = tileGridForCentre(cLat, cLng, tileZoom);
                    double[] canvasBbox = canvasBboxMetres(grid);
                    try {
                        String wmsUrl = buildDistributionWmsUrl(geomIdxObj, canvasBbox);
                        BufferedImage distCanvas = renderWmsLayer(wmsUrl, 0.6);
                        savePng(distCanvas, distFile, false);
                        if (verbose) {
                            System.out.println(ts() + "  dist fetch geomIdx=" + geomIdxObj + " zoom=" + zoomId + " lsid=" + lsid);
                        }
                    } catch (Exception ex) {
                        System.out.println(ts() + "  WARN distribution " + geomIdxObj + " failed for zoom " + zoomId + " lsid=" + lsid + ": " + ex.getMessage());
                    }
                }

                // Resolve data resource name (cached per uid)
                String dataResourceName = dataResourceNameCache.computeIfAbsent(uid, MapFetcher::fetchDataResourceName);

                // Build the formatted layer descriptor and store it
                Map<String, Object> layer = new LinkedHashMap<>();
                layer.put("id", distLayerId);
                layer.put("type", "distribution");
                layer.put("label", raw.get("area_name") != null ? raw.get("area_name").toString() : distLayerId);
                layer.put("dataResourceUid", uid);
                layer.put("dataResourceName", dataResourceName != null ? dataResourceName : uid);
                layer.put("geomIdx", geomIdxObj);
                distributionsByLsid.computeIfAbsent(lsid, k -> new ArrayList<>()).add(layer);
                count++;
            }
            System.out.println(ts() + " Distributions loaded: " + count + " entries for " + distributionsByLsid.size() + " taxa");
        } catch (Exception e) {
            System.out.println(ts() + " WARN could not fetch distributions from spatial service: " + e.getMessage());
        }
    }

   static String fetchDataResourceName(String dataResourceUid) {
        String base = bieUrl.replaceAll("/$", "");
        try {
            String url = base + "/v2/search?q=idxtype:DATARESOURCE&fl=name&fq=id:" + URLEncoder.encode(dataResourceUid, StandardCharsets.UTF_8);
            String json = fetchJson(url);
            Map data = mapper.readValue(json, Map.class);
            List<?> searchResults = (List<?>) data.get("searchResults");
            if (searchResults != null && !searchResults.isEmpty()) {
                Map first = (Map) searchResults.get(0);
                Object name = first.get("name");
                if (name != null && StringUtils.isNotEmpty(name.toString())) {
                    return name.toString();
                }
            }
        } catch (Exception e) {
            System.out.println(ts() + "  WARN could not fetch name for dataResource " + dataResourceUid + ": " + e.getMessage());
        }
        return dataResourceUid;
    }

    static List<Map<String, Object>> getDistributions(String guid) {
        return distributionsByLsid.getOrDefault(guid, Collections.emptyList());
    }

    /**
     * Builds the attribution list for distributions: [{geomIdx, text}, ...]
     * Used consistently in both the zero-occurrence and non-zero-occurrence manifest paths.
     */
    static List<Map<String, Object>> buildDistAttrs(List<Map<String, Object>> distributions) {
        List<Map<String, Object>> distAttrs = new ArrayList<>();
        for (Map<String, Object> dist : distributions) {
            Object geomIdxObj = dist.get("geomIdx");
            Object dataResourceName = dist.get("dataResourceName");
            if (geomIdxObj != null && dataResourceName != null && StringUtils.isNotEmpty(dataResourceName.toString())) {
                Map<String, Object> da = new LinkedHashMap<>();
                da.put("geomIdx", geomIdxObj);
                da.put("text", dataResourceName.toString());
                distAttrs.add(da);
            }
        }
        return distAttrs;
    }
}

