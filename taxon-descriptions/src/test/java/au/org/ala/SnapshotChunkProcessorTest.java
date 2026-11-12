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
        assertEquals("Taxon \\\"subspecies\\\" name", SnapshotChunkProcessor.extractNameFast(lineWithEscapedQuote));

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
}
