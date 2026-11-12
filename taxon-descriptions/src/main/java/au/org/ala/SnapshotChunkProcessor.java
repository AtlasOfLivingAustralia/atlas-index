package au.org.ala;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.lang3.StringUtils;

import java.io.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.GZIPInputStream;

/**
 * Processes Wikimedia Enterprise snapshot chunks (.tar.gz containing NDJSON).
 *
 * Downloads one chunk at a time, decompresses it on-the-fly, matches articles
 * against accepted taxa, writes matched HTML files into cache directories,
 * and deletes the chunk archive immediately to keep peak disk usage under 1 GB.
 */
public class SnapshotChunkProcessor {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static class TaxonTarget {
        private final String guid;
        private final String wikiTitle;
        private final String genus;
        private final String family;
        private final String order;
        private final String clazz;
        private final String phylum;
        private final String kingdom;
        private final File outputFile;

        public TaxonTarget(String guid, String wikiTitle, String genus, String family, String order, String clazz, String phylum, String kingdom, File outputFile) {
            this.guid = guid;
            this.wikiTitle = wikiTitle;
            this.genus = genus;
            this.family = family;
            this.order = order;
            this.clazz = clazz;
            this.phylum = phylum;
            this.kingdom = kingdom;
            this.outputFile = outputFile;
        }

        public String getGuid() {
            return guid;
        }

        public String getWikiTitle() {
            return wikiTitle;
        }

        public File getOutputFile() {
            return outputFile;
        }
    }

    /**
     * Normalizes a title for case-insensitive matching by trimming, replacing spaces with underscores,
     * and converting to lower case.
     */
    public static String normalizeTitle(String title) {
        if (title == null) {
            return "";
        }
        return title.trim().replace(' ', '_').toLowerCase(Locale.ROOT);
    }

    /**
     * Quickly extracts the "name" field value from an NDJSON line without parsing the entire JSON tree.
     * Returns null if "name" is missing or unparseable.
     */
    public static String extractNameFast(String line) {
        if (line == null) {
            return null;
        }
        int idx = line.indexOf("\"name\"");
        if (idx == -1) {
            return null;
        }
        int colon = line.indexOf(':', idx + 6);
        if (colon == -1) {
            return null;
        }
        int firstQuote = line.indexOf('"', colon + 1);
        if (firstQuote == -1) {
            return null;
        }
        int endQuote = firstQuote + 1;
        while (endQuote < line.length()) {
            char c = line.charAt(endQuote);
            if (c == '\\') {
                endQuote += 2;
                continue;
            }
            if (c == '"') {
                break;
            }
            endQuote++;
        }
        if (endQuote >= line.length()) {
            return null;
        }
        return line.substring(firstQuote + 1, endQuote);
    }

    /**
     * Reads matched.csv and builds an in-memory lookup map of normalized wikiTitle to target taxons.
     */
    public static Map<String, List<TaxonTarget>> loadTargets(File matchedFile, String descriptionsTmp) throws IOException, CsvValidationException {
        Map<String, List<TaxonTarget>> targets = new HashMap<>();
        if (!matchedFile.exists()) {
            return targets;
        }

        try (CSVReader reader = new CSVReader(new FileReader(matchedFile, StandardCharsets.UTF_8))) {
            String[] nextLine;
            int row = 0;
            int caseVariation = 0;
            String lastGuid = "";

            while ((nextLine = reader.readNext()) != null) {
                row++;
                if (nextLine.length < 2) {
                    continue;
                }
                String guid = nextLine[0].trim();
                String wikiTitle = nextLine[1].trim();
                String genus = nextLine.length > 2 ? nextLine[2] : "";
                String family = nextLine.length > 3 ? nextLine[3] : "";
                String order = nextLine.length > 4 ? nextLine[4] : "";
                String clazz = nextLine.length > 5 ? nextLine[5] : "";
                String phylum = nextLine.length > 6 ? nextLine[6] : "";
                String kingdom = nextLine.length > 7 ? nextLine[7] : "";

                if (guid.equalsIgnoreCase(lastGuid)) {
                    caseVariation++;
                } else {
                    caseVariation = 0;
                }
                lastGuid = guid;

                String filename = URLEncoder.encode(guid, StandardCharsets.UTF_8) + (caseVariation > 0 ? ("_" + caseVariation) : "") + ".html";
                String dir = "cache_" + (row / 1000);
                File outputFile = new File(descriptionsTmp + "/wikipedia/" + dir + "/" + filename);

                TaxonTarget target = new TaxonTarget(guid, wikiTitle, genus, family, order, clazz, phylum, kingdom, outputFile);
                String normalized = normalizeTitle(wikiTitle);
                targets.computeIfAbsent(normalized, k -> new ArrayList<>()).add(target);
            }
        }

        return targets;
    }

    /**
     * Reads an NDJSON stream line by line, matching article titles against targets and writing HTML files.
     */
    public static int processNdjsonReader(BufferedReader reader, Map<String, List<TaxonTarget>> targets) throws IOException {
        int matchedInChunk = 0;
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.isEmpty()) {
                continue;
            }

            String name = extractNameFast(line);
            if (name == null) {
                continue;
            }

            String normalized = normalizeTitle(name);
            List<TaxonTarget> matchedTargets = targets.get(normalized);
            if (matchedTargets == null || matchedTargets.isEmpty()) {
                continue;
            }

            try {
                JsonNode root = OBJECT_MAPPER.readTree(line);
                JsonNode articleBody = root.path("article_body");
                String html = articleBody.path("html").asText(null);
                if (StringUtils.isBlank(html)) {
                    continue;
                }

                String url = root.path("url").asText("");
                // Ensure dc:isVersionOf link element exists for Merge.java compatibility
                if (StringUtils.isNotBlank(url) && !html.contains("rel=\"dc:isVersionOf\"") && !html.contains("rel=dc:isVersionOf")) {
                    html = injectVersionLink(html, url);
                }

                for (TaxonTarget target : matchedTargets) {
                    File outFile = target.getOutputFile();
                    File parent = outFile.getParentFile();
                    if (parent != null && !parent.exists()) {
                        parent.mkdirs();
                    }
                    try (FileWriter writer = new FileWriter(outFile, StandardCharsets.UTF_8)) {
                        writer.write(html);
                    }
                    matchedInChunk++;
                }
            } catch (Exception e) {
                System.err.println("Failed to process matched article line for " + name + ": " + e.getMessage());
            }
        }
        return matchedInChunk;
    }

    /**
     * Injects <link rel="dc:isVersionOf" href="{url}"> into the HTML <head> if not already present.
     */
    public static String injectVersionLink(String html, String url) {
        String linkTag = "<link rel=\"dc:isVersionOf\" href=\"" + url + "\"/>";
        int headIdx = html.indexOf("<head>");
        if (headIdx != -1) {
            return html.substring(0, headIdx + 6) + linkTag + html.substring(headIdx + 6);
        }
        int htmlIdx = html.indexOf("<html>");
        if (htmlIdx != -1) {
            return html.substring(0, htmlIdx + 6) + "<head>" + linkTag + "</head>" + html.substring(htmlIdx + 6);
        }
        return "<head>" + linkTag + "</head>" + html;
    }

    /**
     * Processes a single chunk file (.tar.gz or .gz).
     * Decompresses on-the-fly and writes matched HTML files.
     */
    public static int processChunkFile(File chunkFile, Map<String, List<TaxonTarget>> targets) throws IOException {
        int count = 0;
        try (InputStream fis = new BufferedInputStream(new FileInputStream(chunkFile), 65536);
             InputStream gzis = new GZIPInputStream(fis)) {

            boolean processedAsTar = false;
            try {
                TarArchiveInputStream tis = new TarArchiveInputStream(gzis);
                TarArchiveEntry entry;
                while ((entry = tis.getNextTarEntry()) != null) {
                    if (!entry.isDirectory()) {
                        processedAsTar = true;
                        BufferedReader reader = new BufferedReader(new InputStreamReader(tis, StandardCharsets.UTF_8), 65536);
                        count += processNdjsonReader(reader, targets);
                    }
                }
            } catch (Exception ignored) {
            }

            if (!processedAsTar) {
                // If not packaged as tar, process directly as gzipped NDJSON
                try (InputStream fis2 = new BufferedInputStream(new FileInputStream(chunkFile), 65536);
                     InputStream gzis2 = new GZIPInputStream(fis2);
                     BufferedReader reader = new BufferedReader(new InputStreamReader(gzis2, StandardCharsets.UTF_8), 65536)) {
                    count += processNdjsonReader(reader, targets);
                }
            }
        }
        return count;
    }

    /**
     * Loads the set of already completed chunk identifiers from the checkpoint file.
     */
    public static Set<String> loadCompletedChunks(File checkpointFile) {
        Set<String> completed = new LinkedHashSet<>();
        if (!checkpointFile.exists()) {
            return completed;
        }
        try (BufferedReader br = new BufferedReader(new FileReader(checkpointFile, StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                String trimmed = line.trim();
                if (StringUtils.isNotBlank(trimmed)) {
                    completed.add(trimmed);
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to read checkpoint file: " + e.getMessage());
        }
        return completed;
    }

    /**
     * Appends a completed chunk identifier to the checkpoint file.
     */
    public static void recordCompletedChunk(File checkpointFile, String chunkIdentifier) {
        try {
            File parent = checkpointFile.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            try (FileWriter fw = new FileWriter(checkpointFile, StandardCharsets.UTF_8, true)) {
                fw.write(chunkIdentifier.trim() + "\n");
            }
        } catch (Exception e) {
            System.err.println("Failed to write to checkpoint file: " + e.getMessage());
        }
    }

    /**
     * Main coordinator for processing all chunks of a snapshot.
     * Iterates through chunks, downloads each, extracts matched taxa HTML, and deletes the chunk file immediately.
     */
    public static int processAllChunks(WikimediaClient client, String snapshotIdentifier, String descriptionsTmp, File matchedFile) throws IOException, CsvValidationException {
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Loading matched taxa targets from " + matchedFile.getPath());
        Map<String, List<TaxonTarget>> targets = loadTargets(matchedFile, descriptionsTmp);
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Loaded " + targets.size() + " unique Wikipedia titles to match");

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Fetching chunk list for snapshot: " + snapshotIdentifier);
        List<String> chunkIdentifiers = client.getSnapshotChunks(snapshotIdentifier);
        if (chunkIdentifiers.isEmpty()) {
            System.err.println("No chunks found for snapshot identifier: " + snapshotIdentifier);
            return 0;
        }
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Found " + chunkIdentifiers.size() + " total chunks for " + snapshotIdentifier);

        File checkpointFile = new File(descriptionsTmp + "/wikipedia/processed_chunks.txt");
        Set<String> completedChunks = loadCompletedChunks(checkpointFile);
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Already processed chunks: " + completedChunks.size() + " / " + chunkIdentifiers.size());

        File tempChunkFile = new File(descriptionsTmp + "/wikipedia/temp_chunk.tar.gz");
        int totalMatchesWritten = 0;
        int processedThisRun = 0;

        for (int i = 0; i < chunkIdentifiers.size(); i++) {
            String chunkId = chunkIdentifiers.get(i);
            if (completedChunks.contains(chunkId)) {
                continue;
            }

            int chunkNum = i + 1;
            System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " [" + chunkNum + "/" + chunkIdentifiers.size() + "] Downloading chunk: " + chunkId);

            boolean downloadSuccess = client.downloadSnapshotChunk(snapshotIdentifier, chunkId, tempChunkFile);
            if (!downloadSuccess || !tempChunkFile.exists() || tempChunkFile.length() == 0) {
                System.err.println("Failed to download chunk " + chunkId + ". Halting chunk processing.");
                break;
            }

            System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " [" + chunkNum + "/" + chunkIdentifiers.size() + "] Processing chunk (" + (tempChunkFile.length() / (1024 * 1024)) + " MB)...");
            int matches = processChunkFile(tempChunkFile, targets);
            totalMatchesWritten += matches;

            // Immediately reclaim disk space
            tempChunkFile.delete();

            recordCompletedChunk(checkpointFile, chunkId);
            processedThisRun++;

            System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " [" + chunkNum + "/" + chunkIdentifiers.size() + "] Completed " + chunkId + ": " + matches + " matches written (total matches: " + totalMatchesWritten + ")");
        }

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Finished snapshot chunk processing. Chunks processed this run: " + processedThisRun + ", Total matches: " + totalMatchesWritten);
        return totalMatchesWritten;
    }
}
