package au.org.ala;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
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

        private long latestVersionIdentifier = 0L;

        public long getLatestVersionIdentifier() {
            return latestVersionIdentifier;
        }

        public void setLatestVersionIdentifier(long latestVersionIdentifier) {
            this.latestVersionIdentifier = latestVersionIdentifier;
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
     * Extracts only the root article "name" from an NDJSON line using a streaming parser.
     * Ignores any nested "name" fields (such as is_part_of.name or editor.name) that may precede it.
     * Returns null if root "name" is missing or unparseable.
     */
    public static String extractNameFast(String line) {
        if (line == null || line.isEmpty()) {
            return null;
        }
        try (JsonParser parser = OBJECT_MAPPER.createParser(line)) {
            int depth = 0;
            while (parser.nextToken() != null) {
                JsonToken token = parser.currentToken();
                if (token == JsonToken.START_OBJECT || token == JsonToken.START_ARRAY) {
                    depth++;
                } else if (token == JsonToken.END_OBJECT || token == JsonToken.END_ARRAY) {
                    depth--;
                } else if (depth == 1 && token == JsonToken.FIELD_NAME && "name".equals(parser.currentName())) {
                    parser.nextToken();
                    return parser.getText();
                }
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    /**
     * Extracts redirect names from the root "redirects" array of an NDJSON line using a streaming parser.
     * Returns an empty list if "redirects" is missing or empty.
     */
    public static List<String> extractRedirectNamesFast(String line) {
        if (line == null || !line.contains("\"redirects\"")) {
            return Collections.emptyList();
        }
        List<String> redirectNames = new ArrayList<>();
        try (JsonParser parser = OBJECT_MAPPER.createParser(line)) {
            int depth = 0;
            boolean inRedirects = false;
            while (parser.nextToken() != null) {
                JsonToken token = parser.currentToken();
                if (token == JsonToken.START_OBJECT || token == JsonToken.START_ARRAY) {
                    depth++;
                } else if (token == JsonToken.END_OBJECT || token == JsonToken.END_ARRAY) {
                    depth--;
                    if (depth <= 1 && inRedirects) {
                        break;
                    }
                } else if (depth == 1 && token == JsonToken.FIELD_NAME && "redirects".equals(parser.currentName())) {
                    inRedirects = true;
                } else if (inRedirects && depth == 3 && token == JsonToken.FIELD_NAME && "name".equals(parser.currentName())) {
                    parser.nextToken();
                    String rName = parser.getText();
                    if (rName != null) {
                        redirectNames.add(rName);
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return redirectNames;
    }

    /**
     * Reads matched.csv and builds an in-memory lookup map of normalized wikiTitle to target taxons.
     * Reuses existing HTML file paths if already present across cache directories to avoid duplicate copies.
     */
    public static Map<String, List<TaxonTarget>> loadTargets(File matchedFile, String descriptionsTmp) throws IOException, CsvValidationException {
        Map<String, List<TaxonTarget>> targets = new HashMap<>();
        if (!matchedFile.exists()) {
            return targets;
        }

        // Map existing cached HTML files by basename (without .html) to reuse their location
        Map<String, File> existingFiles = new HashMap<>();
        File wikiDir = new File(descriptionsTmp + "/wikipedia");
        File[] files = wikiDir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.getName().endsWith(".html")) {
                    existingFiles.put(file.getName().replace(".html", ""), file);
                } else if (file.isDirectory()) {
                    File[] subFiles = file.listFiles();
                    if (subFiles != null) {
                        for (File subFile : subFiles) {
                            if (subFile.getName().endsWith(".html")) {
                                existingFiles.put(subFile.getName().replace(".html", ""), subFile);
                            }
                        }
                    }
                }
            }
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

                String baseFilename = URLEncoder.encode(guid, StandardCharsets.UTF_8) + (caseVariation > 0 ? ("_" + caseVariation) : "");
                File outputFile = existingFiles.get(baseFilename);
                if (outputFile == null) {
                    String dir = "cache_" + (row / 1000);
                    outputFile = new File(descriptionsTmp + "/wikipedia/" + dir + "/" + baseFilename + ".html");
                }

                TaxonTarget target = new TaxonTarget(guid, wikiTitle, genus, family, order, clazz, phylum, kingdom, outputFile);
                String normalized = normalizeTitle(wikiTitle);
                targets.computeIfAbsent(normalized, k -> new ArrayList<>()).add(target);
            }
        }

        return targets;
    }

    private static void collectTargetsToWrite(List<TaxonTarget> matchedTargets, String articleTitle, Map<File, TaxonTarget> targetsToWrite) {
        if (matchedTargets == null || matchedTargets.isEmpty()) {
            return;
        }
        if (matchedTargets.size() > 1 && articleTitle != null) {
            String exactTitle = articleTitle.trim().replace(' ', '_');
            boolean hasExactMatch = false;
            for (TaxonTarget t : matchedTargets) {
                if (t.getWikiTitle() != null && t.getWikiTitle().trim().replace(' ', '_').equals(exactTitle)) {
                    hasExactMatch = true;
                    break;
                }
            }
            if (hasExactMatch) {
                for (TaxonTarget t : matchedTargets) {
                    if (t.getWikiTitle() != null && t.getWikiTitle().trim().replace(' ', '_').equals(exactTitle)) {
                        targetsToWrite.put(t.getOutputFile(), t);
                    }
                }
                return;
            }
        }
        for (TaxonTarget t : matchedTargets) {
            targetsToWrite.put(t.getOutputFile(), t);
        }
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

            Map<File, TaxonTarget> targetsToWrite = new LinkedHashMap<>();
            List<TaxonTarget> canonicalTargets = targets.get(normalizeTitle(name));
            if (canonicalTargets != null && !canonicalTargets.isEmpty()) {
                collectTargetsToWrite(canonicalTargets, name, targetsToWrite);
            }

            List<String> redirectNames = extractRedirectNamesFast(line);
            for (String rName : redirectNames) {
                List<TaxonTarget> rTargets = targets.get(normalizeTitle(rName));
                if (rTargets != null && !rTargets.isEmpty()) {
                    collectTargetsToWrite(rTargets, rName, targetsToWrite);
                }
            }

            if (targetsToWrite.isEmpty()) {
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

                long versionId = root.path("version").path("identifier").asLong(0L);

                for (TaxonTarget target : targetsToWrite.values()) {
                    if (versionId > 0 && target.getLatestVersionIdentifier() > 0 && versionId < target.getLatestVersionIdentifier()) {
                        // Skip older duplicate revision
                        continue;
                    }
                    File outFile = target.getOutputFile();
                    File parent = outFile.getParentFile();
                    if (parent != null && !parent.exists()) {
                        parent.mkdirs();
                    }
                    try (FileWriter writer = new FileWriter(outFile, StandardCharsets.UTF_8)) {
                        writer.write(html);
                    }
                    if (versionId > 0) {
                        target.setLatestVersionIdentifier(versionId);
                    }
                    matchedInChunk++;
                }
            } catch (IOException e) {
                throw e;
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

            boolean isTar = false;
            TarArchiveInputStream tis = new TarArchiveInputStream(gzis);
            TarArchiveEntry entry = null;
            try {
                entry = tis.getNextTarEntry();
                if (entry != null) {
                    isTar = true;
                }
            } catch (Exception ignored) {
                // Not a tar archive or empty
            }

            if (isTar) {
                while (entry != null) {
                    if (!entry.isDirectory()) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(tis, StandardCharsets.UTF_8), 65536);
                        count += processNdjsonReader(reader, targets);
                    }
                    entry = tis.getNextTarEntry();
                }
            } else {
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
     * Checks whether any cached HTML files exist under the wikipedia directory (including cache_* subdirectories).
     */
    public static boolean hasCachedHtmlFiles(File wikipediaDir) {
        if (!wikipediaDir.exists() || !wikipediaDir.isDirectory()) {
            return false;
        }
        File[] files = wikipediaDir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.getName().endsWith(".html")) {
                    return true;
                }
                if (file.isDirectory() && file.getName().startsWith("cache_")) {
                    File[] sub = file.listFiles();
                    if (sub != null) {
                        for (File sf : sub) {
                            if (sf.getName().endsWith(".html")) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
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
        if (chunkIdentifiers == null || chunkIdentifiers.isEmpty()) {
            throw new IOException("No chunks found or failed to fetch chunk list for snapshot identifier: " + snapshotIdentifier);
        }
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Found " + chunkIdentifiers.size() + " total chunks for " + snapshotIdentifier);

        File checkpointFile = new File(descriptionsTmp + "/wikipedia/processed_chunks.txt");
        if (checkpointFile.exists()) {
            if (matchedFile.exists() && matchedFile.lastModified() > checkpointFile.lastModified()) {
                System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " matched.csv is newer than checkpoint file. Invalidating previous checkpoint.");
                checkpointFile.delete();
            } else if (!hasCachedHtmlFiles(new File(descriptionsTmp + "/wikipedia"))) {
                System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " No cached HTML files found in cache directories. Invalidating previous checkpoint.");
                checkpointFile.delete();
            }
        }

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
                if (tempChunkFile.exists()) {
                    tempChunkFile.delete();
                }
                throw new IOException("Failed to download chunk " + chunkId + " after " + client.getMaxRetries() + " attempts. Halting chunk processing.");
            }

            System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " [" + chunkNum + "/" + chunkIdentifiers.size() + "] Processing chunk (" + (tempChunkFile.length() / (1024 * 1024)) + " MB)...");
            int matches = 0;
            try {
                matches = processChunkFile(tempChunkFile, targets);
            } finally {
                if (tempChunkFile.exists()) {
                    tempChunkFile.delete();
                }
            }
            totalMatchesWritten += matches;

            recordCompletedChunk(checkpointFile, chunkId);
            processedThisRun++;

            System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " [" + chunkNum + "/" + chunkIdentifiers.size() + "] Completed " + chunkId + ": " + matches + " matches written (total matches: " + totalMatchesWritten + ")");
        }

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Finished snapshot chunk processing. Chunks processed this run: " + processedThisRun + ", Total matches: " + totalMatchesWritten);
        return totalMatchesWritten;
    }
}
