package au.org.ala;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.zip.GZIPOutputStream;

import static org.junit.jupiter.api.Assertions.*;

public class SnapshotChunkProcessorTest {

    @Test
    void testNormalizeTitle() {
        assertEquals("acacia_dealbata", SnapshotChunkProcessor.normalizeTitle("Acacia dealbata"));
        assertEquals("acacia_dealbata", SnapshotChunkProcessor.normalizeTitle("  Acacia_dealbata  "));
        assertEquals("emu", SnapshotChunkProcessor.normalizeTitle("Emu"));
        assertEquals("", SnapshotChunkProcessor.normalizeTitle(null));
    }

    @Test
    void testExtractNameFast() {
        String line1 = "{\"name\":\"Squirrel\",\"identifier\":28492,\"abstract\":\"Squirrels are rodents...\"}";
        assertEquals("Squirrel", SnapshotChunkProcessor.extractNameFast(line1));

        String line2 = "{\"identifier\":123, \"name\": \"Acacia dealbata\", \"url\": \"https://en.wikipedia.org/wiki/Acacia_dealbata\"}";
        assertEquals("Acacia dealbata", SnapshotChunkProcessor.extractNameFast(line2));

        String lineWithEscapedQuote = "{\"name\":\"Taxon \\\"subspecies\\\" name\",\"id\":1}";
        assertEquals("Taxon \"subspecies\" name", SnapshotChunkProcessor.extractNameFast(lineWithEscapedQuote));

        String lineWithUnicode = "{\"name\":\"Eucalyptus \\u00d7 kalangadooensis\"}";
        assertEquals("Eucalyptus × kalangadooensis", SnapshotChunkProcessor.extractNameFast(lineWithUnicode));

        assertNull(SnapshotChunkProcessor.extractNameFast("{\"other_field\":\"value\"}"));
        assertNull(SnapshotChunkProcessor.extractNameFast(null));
        assertNull(SnapshotChunkProcessor.extractNameFast(""));
    }

    @Test
    void testInjectVersionLink() {
        String htmlWithHead = "<!DOCTYPE html><html><head><title>Test</title></head><body><p>Content</p></body></html>";
        String injected = SnapshotChunkProcessor.injectVersionLink(htmlWithHead, "https://en.wikipedia.org/wiki/Test");
        assertTrue(injected.contains("<link rel=\"dc:isVersionOf\" href=\"https://en.wikipedia.org/wiki/Test\"/>"));
        assertTrue(injected.contains("<head><link rel=\"dc:isVersionOf\""));

        String htmlWithoutHead = "<html><body><p>No head</p></body></html>";
        String injectedNoHead = SnapshotChunkProcessor.injectVersionLink(htmlWithoutHead, "https://en.wikipedia.org/wiki/No_Head");
        assertTrue(injectedNoHead.contains("<link rel=\"dc:isVersionOf\" href=\"https://en.wikipedia.org/wiki/No_Head\"/>"));
    }

    @Test
    void testLoadTargets(@TempDir Path tempDir) throws Exception {
        File matchedFile = tempDir.resolve("matched.csv").toFile();
        try (FileWriter fw = new FileWriter(matchedFile, StandardCharsets.UTF_8)) {
            fw.write("urn:lsid:biodiversity.org.au:apni.taxon:245451,Acacia_dealbata,Acacia,Fabaceae,Fabales,Magnoliopsida,Charophyta,Plantae\n");
            fw.write("urn:lsid:biodiversity.org.au:apni.taxon:245451,Acacia_Dealbata,Acacia,Fabaceae,Fabales,Magnoliopsida,Charophyta,Plantae\n");
            fw.write("urn:lsid:biodiversity.org.au:afd.taxon:12345,Dromaius_novaehollandiae,Dromaius,Casuariidae,Casuariiformes,Aves,Chordata,Animalia\n");
        }

        Map<String, List<SnapshotChunkProcessor.TaxonTarget>> targets = SnapshotChunkProcessor.loadTargets(matchedFile, tempDir.toString());
        assertEquals(2, targets.size());

        List<SnapshotChunkProcessor.TaxonTarget> acaciaTargets = targets.get("acacia_dealbata");
        assertNotNull(acaciaTargets);
        assertEquals(2, acaciaTargets.size());

        // First variation: no suffix
        assertTrue(acaciaTargets.get(0).getOutputFile().getName().endsWith(".html"));
        assertFalse(acaciaTargets.get(0).getOutputFile().getName().contains("_1"));

        // Second variation: _1 suffix
        assertTrue(acaciaTargets.get(1).getOutputFile().getName().contains("_1.html"));
    }

    @Test
    void testProcessChunkTarGzFileExtractsMatchedTaxa(@TempDir Path tempDir) throws Exception {
        File chunkFile = tempDir.resolve("chunk.tar.gz").toFile();

        // Prepare sample NDJSON articles: 1 matching Acacia dealbata, 1 matching Emu, 1 non-matching (Eiffel Tower)
        String line1 = "{\"name\":\"Acacia dealbata\",\"url\":\"https://en.wikipedia.org/wiki/Acacia_dealbata\",\"article_body\":{\"html\":\"<!DOCTYPE html><html><head></head><body><section><h2>Acacia dealbata</h2><p>Silver wattle description</p></section></body></html>\"}}";
        String line2 = "{\"name\":\"Eiffel Tower\",\"url\":\"https://en.wikipedia.org/wiki/Eiffel_Tower\",\"article_body\":{\"html\":\"<p>Paris landmark</p>\"}}";
        String line3 = "{\"name\":\"Emu\",\"url\":\"https://en.wikipedia.org/wiki/Emu\",\"article_body\":{\"html\":\"<!DOCTYPE html><html><head><link rel=\\\"dc:isVersionOf\\\" href=\\\"https://en.wikipedia.org/wiki/Emu\\\"/></head><body><section><h2>Emu</h2><p>Large flightless bird</p></section></body></html>\"}}";
        String ndjsonContent = line1 + "\n" + line2 + "\n" + line3 + "\n";

        // Create .tar.gz archive containing chunk.ndjson
        try (FileOutputStream fos = new FileOutputStream(chunkFile);
             GZIPOutputStream gzos = new GZIPOutputStream(fos);
             TarArchiveOutputStream tos = new TarArchiveOutputStream(gzos)) {

            byte[] bytes = ndjsonContent.getBytes(StandardCharsets.UTF_8);
            TarArchiveEntry entry = new TarArchiveEntry("chunk.ndjson");
            entry.setSize(bytes.length);
            tos.putArchiveEntry(entry);
            tos.write(bytes);
            tos.closeArchiveEntry();
        }

        File matchedFile = tempDir.resolve("matched.csv").toFile();
        try (FileWriter fw = new FileWriter(matchedFile, StandardCharsets.UTF_8)) {
            fw.write("urn:taxon:1,Acacia_dealbata,Acacia,Fabaceae,Fabales,Magnoliopsida,Charophyta,Plantae\n");
            fw.write("urn:taxon:2,Emu,Dromaius,Casuariidae,Casuariiformes,Aves,Chordata,Animalia\n");
        }

        Map<String, List<SnapshotChunkProcessor.TaxonTarget>> targets = SnapshotChunkProcessor.loadTargets(matchedFile, tempDir.toString());
        int matched = SnapshotChunkProcessor.processChunkFile(chunkFile, targets);

        assertEquals(2, matched);

        File acaciaFile = targets.get("acacia_dealbata").get(0).getOutputFile();
        assertTrue(acaciaFile.exists());
        String acaciaHtml = Files.readString(acaciaFile.toPath());
        assertTrue(acaciaHtml.contains("Silver wattle description"));
        assertTrue(acaciaHtml.contains("rel=\"dc:isVersionOf\""));

        File emuFile = targets.get("emu").get(0).getOutputFile();
        assertTrue(emuFile.exists());
        String emuHtml = Files.readString(emuFile.toPath());
        assertTrue(emuHtml.contains("Large flightless bird"));
    }

    @Test
    void testCheckpointingRecordsAndResumes(@TempDir Path tempDir) {
        File checkpointFile = tempDir.resolve("processed_chunks.txt").toFile();

        Set<String> initial = SnapshotChunkProcessor.loadCompletedChunks(checkpointFile);
        assertTrue(initial.isEmpty());

        SnapshotChunkProcessor.recordCompletedChunk(checkpointFile, "enwiki_namespace_0_chunk_0");
        SnapshotChunkProcessor.recordCompletedChunk(checkpointFile, "enwiki_namespace_0_chunk_1");

        Set<String> loaded = SnapshotChunkProcessor.loadCompletedChunks(checkpointFile);
        assertEquals(2, loaded.size());
        assertTrue(loaded.contains("enwiki_namespace_0_chunk_0"));
        assertTrue(loaded.contains("enwiki_namespace_0_chunk_1"));
        assertFalse(loaded.contains("enwiki_namespace_0_chunk_2"));
    }

    @Test
    void testLoadTargetsReusesExistingFile(@TempDir Path tempDir) throws Exception {
        // Pre-create an existing file in cache_0
        File wikiDir = tempDir.resolve("wikipedia").toFile();
        File cache0 = new File(wikiDir, "cache_0");
        cache0.mkdirs();
        String encodedGuid = java.net.URLEncoder.encode("urn:taxon:existing", StandardCharsets.UTF_8);
        File existingHtml = new File(cache0, encodedGuid + ".html");
        Files.writeString(existingHtml.toPath(), "existing content");

        File matchedFile = tempDir.resolve("matched.csv").toFile();
        try (FileWriter fw = new FileWriter(matchedFile, StandardCharsets.UTF_8)) {
            // Write 5000 dummy lines so row index > 5000 (which would place it in cache_5)
            for (int i = 0; i < 5001; i++) {
                fw.write("urn:dummy:" + i + ",Dummy_" + i + "\n");
            }
            fw.write("urn:taxon:existing,Existing_Taxon\n");
        }

        Map<String, List<SnapshotChunkProcessor.TaxonTarget>> targets = SnapshotChunkProcessor.loadTargets(matchedFile, tempDir.toString());
        List<SnapshotChunkProcessor.TaxonTarget> matched = targets.get("existing_taxon");
        assertNotNull(matched);
        assertEquals(1, matched.size());
        // Verify it reused existing file in cache_0 rather than creating cache_5
        assertEquals(existingHtml.getAbsolutePath(), matched.get(0).getOutputFile().getAbsolutePath());
    }

    @Test
    void testCaseVariantsPreserveDistinctFiles(@TempDir Path tempDir) throws Exception {
        File matchedFile = tempDir.resolve("matched.csv").toFile();
        try (FileWriter fw = new FileWriter(matchedFile, StandardCharsets.UTF_8)) {
            fw.write("urn:taxon:variant,Acacia_dealbata,Acacia,Fabaceae,Fabales,Magnoliopsida,Charophyta,Plantae\n");
            fw.write("urn:taxon:variant,Acacia_Dealbata,Acacia,Fabaceae,Fabales,Magnoliopsida,Charophyta,Plantae\n");
        }

        Map<String, List<SnapshotChunkProcessor.TaxonTarget>> targets = SnapshotChunkProcessor.loadTargets(matchedFile, tempDir.toString());
        assertEquals(1, targets.size());
        List<SnapshotChunkProcessor.TaxonTarget> variants = targets.get("acacia_dealbata");
        assertEquals(2, variants.size());

        File lowercaseFile = variants.get(0).getOutputFile();
        File uppercaseFile = variants.get(1).getOutputFile();

        // NDJSON stream with only the exact "Acacia_dealbata" article
        String ndjson = "{\"name\":\"Acacia_dealbata\",\"url\":\"https://en.wikipedia.org/wiki/Acacia_dealbata\",\"article_body\":{\"html\":\"<p>Exact lower case match</p>\"}}\n";
        BufferedReader reader = new BufferedReader(new StringReader(ndjson));

        int count = SnapshotChunkProcessor.processNdjsonReader(reader, targets);
        assertEquals(1, count);
        assertTrue(lowercaseFile.exists(), "Exact lowercase match file should be written");
        assertFalse(uppercaseFile.exists(), "Uppercase variant file should not be overwritten by lowercase article");
    }

    @Test
    void testHasCachedHtmlFiles(@TempDir Path tempDir) throws Exception {
        File wikiDir = tempDir.resolve("wikipedia").toFile();
        assertFalse(SnapshotChunkProcessor.hasCachedHtmlFiles(wikiDir));

        File cache0 = new File(wikiDir, "cache_0");
        cache0.mkdirs();
        assertFalse(SnapshotChunkProcessor.hasCachedHtmlFiles(wikiDir));

        File sampleFile = new File(cache0, "sample.html");
        Files.writeString(sampleFile.toPath(), "test");
        assertTrue(SnapshotChunkProcessor.hasCachedHtmlFiles(wikiDir));
    }
}
