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
 * Fetches BHL (Biodiversity Heritage Library) publication results for all accepted taxa
 * and writes to a directory structure for use by the species-pages UI.
 *
 * Output layout:
 *   {bhlDir}/{last2LsidChars}/{urlEncodedLsid}.json
 *
 * Files are only written when the BHL API returns a non-empty result set.
 * Already-downloaded files are skipped so the run can be restarted safely.
 *
 * Config keys (config.json):
 *   bhlUrl      - base URL for the BHL website/API, e.g. "https://www.biodiversitylibrary.org"
 *   bhlApiKey   - BHL API key
 *   acceptedCsv - path to accepted.csv (guid,scientificName,...)
 *   bhlDir      - root output directory
 *   bhlThreads  - number of concurrent fetch threads (default 2)
 */
public class BhlFetcher {

    static String bhlUrl;
    static String bhlApiKey;
    static String acceptedCsv;
    static String bhlDir;
    static int bhlThreads;

    static final ObjectMapper mapper = new ObjectMapper();
    static final AtomicInteger processed = new AtomicInteger(0);
    static final AtomicInteger skipped = new AtomicInteger(0);
    static final AtomicInteger written = new AtomicInteger(0);
    static final AtomicInteger errors = new AtomicInteger(0);

    public static void main(String[] args) throws Exception {

        if (args.length < 1) {
            System.err.println("Usage: BhlFetcher <config.json>");
            System.exit(1);
        }

        String configFile = args[0];
        Map<String, Object> config = mapper.readValue(new File(configFile), Map.class);

        bhlUrl = config.get("bhlUrl").toString().replaceAll("/$", "");
        bhlApiKey = config.get("bhlApiKey").toString();
        acceptedCsv = config.get("acceptedCsv").toString();
        bhlDir = config.get("bhlDir").toString();
        bhlThreads = config.containsKey("bhlThreads") ? Integer.parseInt(config.get("bhlThreads").toString()) : 2;

        File bhlDirFile = new File(bhlDir);
        if (!bhlDirFile.exists()) {
            bhlDirFile.mkdirs();
        }

        System.out.println(ts() + " Starting taxon-bhl fetch");
        System.out.println(ts() + " bhlUrl: " + bhlUrl);
        System.out.println(ts() + " acceptedCsv: " + acceptedCsv);
        System.out.println(ts() + " bhlDir: " + bhlDir);
        System.out.println(ts() + " bhlThreads: " + bhlThreads);

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
        Thread[] workers = new Thread[bhlThreads];
        for (int i = 0; i < bhlThreads; i++) {
            workers[i] = new Thread(() -> {
                while (true) {
                    try {
                        String[] row = queue.take();
                        if (row == DONE) {
                            // re-enqueue so other workers also see it, then stop
                            queue.put(DONE);
                            break;
                        }
                        new FetchBhlRunnable(row[0], row[1]).run();
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

            String[] row;
            while ((row = reader.readNext()) != null) {
                if (row.length < 2) continue;
                String guid = row[0].trim();
                String scientificName = row[1].trim();
                if (StringUtils.isNotEmpty(guid) && StringUtils.isNotEmpty(scientificName)) {
                    queue.put(row); // blocks if queue is full — natural back-pressure
                    totalRead++;
                }
            }
        }

        System.out.println(ts() + " CSV read complete. Taxa enqueued: " + totalRead);

        // Signal workers to stop
        queue.put(DONE);

        // Wait for all workers to finish
        for (Thread worker : workers) {
            worker.join();
        }
    }

    /**
     * Returns the output directory for a given lsid, creating it if needed.
     * Layout: {bhlDir}/{last2LsidChars}/{urlEncodedLsid}.json
     */
    static File taxonDir(String lsid) throws IOException {
        String encoded = URLEncoder.encode(lsid, StandardCharsets.UTF_8);
        // use last 2 chars of the encoded lsid for directory sharding
        String shard = encoded.length() >= 2
                ? encoded.substring(encoded.length() - 2)
                : encoded;
        File dir = new File(bhlDir + "/" + shard);
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
            return null;
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

    static void writeFile(File file, String content) throws IOException {
        try (FileWriter fw = new FileWriter(file, StandardCharsets.UTF_8)) {
            fw.write(content);
        }
        written.incrementAndGet();
    }

    // -------------------------------------------------------------------------
    // Runnable
    // -------------------------------------------------------------------------

    static class FetchBhlRunnable implements Runnable {

        private final String guid;
        private final String scientificName;

        FetchBhlRunnable(String guid, String scientificName) {
            this.guid = guid;
            this.scientificName = scientificName;
        }

        @Override
        public void run() {
            try {
                String encodedGuid = URLEncoder.encode(guid, StandardCharsets.UTF_8);
                File dir = taxonDir(guid);
                File outputFile = new File(dir, encodedGuid + ".json");

                if (outputFile.exists()) {
                    skipped.incrementAndGet();
                    int done = processed.incrementAndGet();
                    logProgress(done);
                    return;
                }

                // Build BHL API search URL — same query logic as the search-ui uses
                // Searches by scientific name with searchtype=C (contains)
                String searchQuery = encodeURIComponent('"' + scientificName + '"');
                String url = bhlUrl + "/api3?op=PublicationSearch&searchterm=" + searchQuery
                        + "&searchtype=C&page=1&pageSize=5&apikey=" + URLEncoder.encode(bhlApiKey, StandardCharsets.UTF_8)
                        + "&format=json";

                String responseJson = httpGet(url);

                // always write, even if no items in the result to speed up re-runs
                if (isOk(responseJson)) {
                    // Extract just the Result array and write it
                    Map<?, ?> parsed = mapper.readValue(responseJson, Map.class);
                    Object result = parsed.get("Result");
                    if (result != null) {
                        writeFile(outputFile, mapper.writeValueAsString(result));
                    }
                }

                int done = processed.incrementAndGet();
                logProgress(done);

            } catch (Exception e) {
                errors.incrementAndGet();
                System.out.println(ts() + " ERROR for " + guid + " (" + scientificName + "): " + e.getMessage());
            }
        }

        /**
         * URL-encodes a string (helper for building query param values).
         */
        private String encodeURIComponent(String value) {
            return URLEncoder.encode(value, StandardCharsets.UTF_8);
        }

        /**
         * Returns true if the BHL API response contains at least one Result entry.
         */
        private boolean isOk(String json) {
            if (StringUtils.isBlank(json)) return false;
            try {
                Map<?, ?> parsed = mapper.readValue(json, Map.class);
                Object status = parsed.get("Status");
                if (!"ok".equalsIgnoreCase(String.valueOf(status))) return false;
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        private void logProgress(int done) {
            if (done % 500 == 0) {
                System.out.println(ts() + " processed=" + done
                        + " skipped=" + skipped.get()
                        + " written=" + written.get()
                        + " errors=" + errors.get());
            }
        }
    }
}

