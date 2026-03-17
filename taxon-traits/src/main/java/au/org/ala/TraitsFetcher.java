package au.org.ala;

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.commons.lang3.StringUtils;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Fetches AusTraits data for all accepted Plantae taxa and writes to a directory structure.
 *
 * Output layout:
 *   {traitsDir}/austraits/{last2LsidChars}/{urlEncodedLsid}_count.json
 *   {traitsDir}/austraits/{last2LsidChars}/{urlEncodedLsid}_summary.json
 *   {traitsDir}/austraits/{last2LsidChars}/{urlEncodedLsid}_data.csv
 *
 * Files are only written when the API returns a non-empty / non-zero response.
 * Already-downloaded files are skipped so the run can be restarted safely.
 *
 * Config keys (config.json):
 *   austraitsUrl        - base URL for the AusTraits API, e.g. "https://api.austraits.org.au"
 *   acceptedCsv         - path to accepted.csv (guid,scientificName,genus,family,order,class,phylum,kingdom)
 *   traitsDir           - root output directory
 *   traitsThreads       - number of concurrent fetch threads (default 5)
 *   kingdomFilter       - comma-separated list of kingdoms to include, e.g. "Plantae" (default "Plantae")
 */
public class TraitsFetcher {

    static String austraitsUrl;
    static String acceptedCsv;
    static String traitsDir;
    static int traitsThreads;
    static Set<String> kingdomFilter;

    static final ObjectMapper mapper = new ObjectMapper();
    static final AtomicInteger processed = new AtomicInteger(0);
    static final AtomicInteger skipped = new AtomicInteger(0);
    static final AtomicInteger written = new AtomicInteger(0);
    static final AtomicInteger errors = new AtomicInteger(0);

    public static void main(String[] args) throws Exception {

        if (args.length < 1) {
            System.err.println("Usage: TraitsFetcher <config.json>");
            System.exit(1);
        }

        String configFile = args[0];
        Map<String, Object> config = mapper.readValue(new File(configFile), Map.class);

        austraitsUrl = config.get("austraitsUrl").toString().replaceAll("/$", "");
        acceptedCsv = config.get("acceptedCsv").toString();
        traitsDir = config.get("traitsDir").toString();
        traitsThreads = config.containsKey("traitsThreads") ? Integer.parseInt(config.get("traitsThreads").toString()) : 5;

        String kingdomFilterStr = config.containsKey("kingdomFilter") ? config.get("kingdomFilter").toString() : "Plantae";
        kingdomFilter = new HashSet<>(Arrays.asList(kingdomFilterStr.split("\\s*,\\s*")));

        File traitsDirFile = new File(traitsDir + "/austraits");
        if (!traitsDirFile.exists()) {
            traitsDirFile.mkdirs();
        }

        System.out.println(ts() + " Starting taxon-traits fetch");
        System.out.println(ts() + " austraitsUrl: " + austraitsUrl);
        System.out.println(ts() + " acceptedCsv: " + acceptedCsv);
        System.out.println(ts() + " traitsDir: " + traitsDir);
        System.out.println(ts() + " traitsThreads: " + traitsThreads);
        System.out.println(ts() + " kingdomFilter: " + kingdomFilter);

        fetchAll();

        System.out.println(ts() + " Finished. processed=" + processed.get()
                + " skipped=" + skipped.get()
                + " written=" + written.get()
                + " errors=" + errors.get());
    }

    static void fetchAll() throws IOException, CsvValidationException, InterruptedException {

        // Bounded queue — caps memory usage regardless of CSV size
        BlockingQueue<String[]> queue = new ArrayBlockingQueue<>(200);

        // Poison pill sentinel — one per worker thread
        String[] DONE = new String[0];

        // Start worker threads — they drain the queue until they see the poison pill
        Thread[] workers = new Thread[traitsThreads];
        for (int i = 0; i < traitsThreads; i++) {
            workers[i] = new Thread(() -> {
                while (true) {
                    try {
                        String[] row = queue.take();
                        if (row == DONE) {
                            // re-enqueue so other workers also see it, then stop
                            queue.put(DONE);
                            break;
                        }
                        new FetchTraitsRunnable(row[0], row[1]).run();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            });
            workers[i].start();
        }

        // Producer: stream the CSV directly into the queue — never holds all rows in memory
        long totalRead = 0;
        try (CSVReader reader = new CSVReader(new FileReader(acceptedCsv))) {
            String[] header = reader.readNext();

            int kingdomIdx = 7;
            if (header != null) {
                for (int i = 0; i < header.length; i++) {
                    String col = header[i].toLowerCase().replaceAll("[_s]+$", "");
                    if (col.equals("kingdom") || col.equals("rk_kingdom")) {
                        kingdomIdx = i;
                        break;
                    }
                }
            }

            String[] row;
            while ((row = reader.readNext()) != null) {
                if (row.length <= kingdomIdx) continue;
                String guid = row[0].trim();
                String kingdom = row[kingdomIdx].trim();
                if (StringUtils.isNotEmpty(guid) && kingdomFilter.contains(kingdom)) {
                    queue.put(row); // blocks if queue is full — natural back-pressure
                    totalRead++;
                }
            }
        }

        System.out.println(ts() + " CSV read complete. Taxa enqueued matching kingdom filter: " + totalRead);

        // Signal workers to stop
        queue.put(DONE);

        // Wait for all workers to finish
        for (Thread worker : workers) {
            worker.join();
        }
    }

    /**
     * Returns the output directory for a given lsid, creating it if needed.
     * Layout: {traitsDir}/austraits/{last2LsidChars}/{urlEncodedLsid}*
     */
    static File taxonDir(String lsid) throws IOException {
        String encoded = URLEncoder.encode(lsid, StandardCharsets.UTF_8);
        // use last 2 chars of the encoded lsid for directory sharding
        String shard = encoded.length() >= 2
                ? encoded.substring(encoded.length() - 2)
                : encoded;
        File dir = new File(traitsDir + "/austraits/" + shard);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    static String ts() {
        return new SimpleDateFormat("HH:mm:ss:SSS").format(new Date());
    }

    // -------------------------------------------------------------------------
    // HTTP helpers
    // -------------------------------------------------------------------------

    static String httpGet(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(30_000);
        conn.setReadTimeout(60_000);

        int status = conn.getResponseCode();
        if (status == 404) {
            return null; // taxon not found in AusTraits — normal
        }
        if (status != 200) {
            throw new IOException("HTTP " + status + " for " + url);
        }

        try (BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = in.readLine()) != null) sb.append(line).append('\n');
            return sb.toString().trim();
        }
    }

    static String httpGetCsv(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Accept", "text/plain,text/csv,*/*");
        conn.setConnectTimeout(30_000);
        conn.setReadTimeout(60_000);

        int status = conn.getResponseCode();
        if (status == 404) return null;
        if (status != 200) throw new IOException("HTTP " + status + " for " + url);

        try (BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = in.readLine()) != null) sb.append(line).append('\n');
            return sb.toString().trim();
        }
    }

    static void writeFile(File file, String content) throws IOException {
        try (FileWriter fw = new FileWriter(file, StandardCharsets.UTF_8)) {
            fw.write(content);
        }
        written.incrementAndGet();
    }

    // -------------------------------------------------------------------------
    // Runnable
    // -------------------------------------------------------------------------

    static class FetchTraitsRunnable implements Runnable {

        private final String guid;
        private final String scientificName;

        FetchTraitsRunnable(String guid, String scientificName) {
            this.guid = guid;
            this.scientificName = scientificName;
        }

        @Override
        public void run() {
            try {
                File dir = taxonDir(guid);

                // AusTraits uses the APNI_ID param to match by LSID when available
                String encodedName = URLEncoder.encode(scientificName, StandardCharsets.UTF_8);
                String encodedGuid = URLEncoder.encode(guid, StandardCharsets.UTF_8);

                // Base query params — taxon name is required; APNI_ID is the lsid
                String params = "taxon=" + encodedName + "&APNI_ID=" + encodedGuid;

                // --- count.json ---
                boolean hasCount = false;
                File countFile = new File(dir, encodedGuid + "_count.json");
                if (!countFile.exists()) {
                    String countJson = httpGet(austraitsUrl + "/trait-count?" + params);
                    if (isNonEmptyJson(countJson) && isNonZeroCount(countJson)) {
                        writeFile(countFile, countJson);
                        hasCount = true;
                    }
                } else {
                    skipped.incrementAndGet();
                }

                // --- summary.json ---
                File summaryFile = new File(dir, encodedGuid + "_summary.json");
                if (hasCount && !summaryFile.exists()) {
                    String summaryJson = httpGet(austraitsUrl + "/trait-summary?" + params);
                    if (isNonEmptyJson(summaryJson)) {
                        writeFile(summaryFile, summaryJson);
                    }
                } else {
                    skipped.incrementAndGet();
                }

                // --- data.csv ---
                File dataFile = new File(dir, encodedGuid + "_data.csv");
                if (hasCount && !dataFile.exists()) {
                    String csv = httpGetCsv(austraitsUrl + "/download-taxon-data?" + params);
                    if (isNonEmptyCsv(csv)) {
                        writeFile(dataFile, csv);
                    }
                } else {
                    skipped.incrementAndGet();
                }

                int done = processed.incrementAndGet();
                if (done % 500 == 0) {
                    System.out.println(ts() + " processed=" + done
                            + " skipped=" + skipped.get()
                            + " written=" + written.get()
                            + " errors=" + errors.get());
                }

            } catch (Exception e) {
                errors.incrementAndGet();
                System.out.println(ts() + " ERROR for " + guid + " (" + scientificName + "): " + e.getMessage());
            }
        }

        /** Returns true if content is a non-null, non-empty JSON object/array */
        private boolean isNonEmptyJson(String content) {
            if (StringUtils.isBlank(content)) return false;
            String trimmed = content.trim();
            if (trimmed.equals("{}") || trimmed.equals("[]") || trimmed.equals("null")) return false;
            return trimmed.startsWith("{") || trimmed.startsWith("[");
        }

        /** Returns true if the trait-count response has count == 0 */
        private boolean isNonZeroCount(String json) {
            try {
                List list = mapper.readValue(json, List.class);
                if (list.isEmpty()) return false;
                Map map = (Map) list.get(0);
                Object count = map.get("summary");
                Object countAus = map.get("AusTraits");
                if (count == null && countAus == null) return false;
                return Integer.parseInt(count.toString()) != 0 || Integer.parseInt(countAus.toString()) != 0;
            } catch (Exception e) {
                return false;
            }
        }

        /** Returns true if CSV has at least a header + 1 data row */
        private boolean isNonEmptyCsv(String content) {
            if (StringUtils.isBlank(content)) return false;
            String[] lines = content.split("\n");
            return lines.length >= 2 && StringUtils.isNotBlank(lines[1]);
        }
    }
}

