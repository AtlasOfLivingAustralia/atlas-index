package au.org.ala;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

public class AntWikiDownloaderTest {

    @TempDir
    Path tempDir;

    @Test
    void testParseAustraliaSpeciesList() {
        String html = """
                <div class="mw-content-ltr mw-parser-output">
                  <p>If you are interested in other information, visit <a href="https://antwiki.org/wiki/Australian_Ants">Australian Ants</a>.</p>
                  <h2><span class="mw-headline" id="Aenictus"><i><a href="https://antwiki.org/wiki/Aenictus">Aenictus</a></i></span></h2>
                  <dl><dd><a href="https://antwiki.org/wiki/Key_to_Australian_Aenictus_Species">Key to species</a></dd></dl>
                  <ul>
                    <li><i><a href="https://antwiki.org/wiki/Aenictus_hilli" title="Aenictus hilli">Aenictus hilli</a></i> Clark, 1928</li>
                    <li><i><a href="https://antwiki.org/wiki/Aenictus_aratus#section" title="Aenictus aratus">Aenictus aratus</a></i> Forel, 1900</li>
                    <li><i><a href="https://antwiki.org/wiki/Category:Endemic">Category:Endemic</a></i></li>
                  </ul>
                </div>
                """;
        Document doc = Jsoup.parse(html);
        Map<String, String> species = AntWikiDownloader.parseAustraliaSpeciesList(doc);

        assertEquals(2, species.size());
        assertEquals("Aenictus hilli", species.get("Aenictus_hilli"));
        assertEquals("Aenictus aratus", species.get("Aenictus_aratus"));
    }

    @Test
    void testExtractContentExtractsFirstSummaryParagraphAndIdentification() {
        String html = """
                <div class="mw-content-ltr mw-parser-output">
                  <table class="infobox biota">
                    <tr><td><p>Infobox text that should be ignored</p></td></tr>
                  </table>
                  <p><span typeof="mw:File"><a href="/wiki/File:example.jpg"><img src="/w/images/example.jpg"/></a></span></p>
                  <p><i>Aenictus aratus</i> is a small army ant found in northern Australia.</p>
                  <p>Second summary paragraph that should not be included.</p>
                  <meta property="mw:PageProp/toc">
                  <h2><span class="mw-headline" id="Photo_Gallery">Photo Gallery</span></h2>
                  <h2><span class="mw-headline" id="Identification">Identification</span></h2>
                  <p>A member of the pachycerus group. Head capsule completely punctate.</p>
                  <p><span typeof="mw:File"><a href="/wiki/File:plot.jpg"><img src="/w/images/plot.jpg"/></a></span></p>
                  <h3><span class="mw-headline" id="Keys_including_this_Species">Keys including this Species</span></h3>
                  <ul><li><a href="/wiki/Key_to_Australian_Aenictus_Species">Key</a></li></ul>
                  <h2><span class="mw-headline" id="Distribution">Distribution</span></h2>
                  <p>Latitudinal Range: 12.3 to -21.6.</p>
                </div>
                """;
        Document doc = Jsoup.parse(html);
        Map<String, String> content = AntWikiDownloader.extractContent(doc, "https://www.antwiki.org/wiki/Aenictus_aratus");

        assertNotNull(content);
        assertEquals("https://www.antwiki.org/wiki/Aenictus_aratus", content.get("url"));
        assertEquals("<p><i>Aenictus aratus</i> is a small army ant found in northern Australia.</p>", content.get("Summary"));
        assertEquals("<p>A member of the pachycerus group. Head capsule completely punctate.</p>", content.get("Identification"));
    }

    @Test
    void testExtractContentIncludesH3SubsectionsAndListsUnderIdentificationButSkipsKeys() {
        String html = """
                <div class="mw-content-ltr mw-parser-output">
                  <p><i>Example ant</i> summary.</p>
                  <h2><span class="mw-headline" id="Identification">Identification</span></h2>
                  <h3><span class="mw-headline" id="Keys_including_this_Species">Keys including this Species</span></h3>
                  <p>Key intro text that should be skipped.</p>
                  <ul><li><a href="/wiki/Key">Key item</a></li></ul>
                  <h3><span class="mw-headline" id="Worker">Worker</span></h3>
                  <p>Worker diagnosis text.</p>
                  <ul><li>Antennae 12-segmented.</li><li>Eyes large.</li></ul>
                  <h3><span class="mw-headline" id="Queen">Queen &lt;script&gt;alert(1)&lt;/script&gt;</span></h3>
                  <p>Queen diagnosis text.</p>
                  <h2><span class="mw-headline" id="Distribution">Distribution</span></h2>
                  <p>Distribution text.</p>
                </div>
                """;
        Document doc = Jsoup.parse(html);
        Map<String, String> content = AntWikiDownloader.extractContent(doc, "https://www.antwiki.org/wiki/Example_ant");

        assertNotNull(content);
        assertEquals(
                "<h3>Worker</h3><p>Worker diagnosis text.</p><ul><li>Antennae 12-segmented.</li>\n<li>Eyes large.</li></ul><h3>Queen &lt;script&gt;alert(1)&lt;/script&gt;</h3><p>Queen diagnosis text.</p>",
                content.get("Identification")
        );
    }

    @Test
    void testExtractContentSkipsIdentificationWhenOnlyKeysPresent() {
        String html = """
                <div class="mw-content-ltr mw-parser-output">
                  <table class="infobox biota"><tr><td>Ant</td></tr></table>
                  <p><i>Amblyopone australis</i> is the best-known species of the genus.</p>
                  <h2><span class="mw-headline" id="Identification">Identification</span></h2>
                  <h3><span class="mw-headline" id="Keys_including_this_Species">Keys including this Species</span></h3>
                  <ul><li><a href="/wiki/Key">Key to Amblyopone</a></li></ul>
                  <h2><span class="mw-headline" id="Distribution">Distribution</span></h2>
                  <p>Broad distribution.</p>
                </div>
                """;
        Document doc = Jsoup.parse(html);
        Map<String, String> content = AntWikiDownloader.extractContent(doc, "https://www.antwiki.org/wiki/Amblyopone_australis");

        assertNotNull(content);
        assertEquals("<p><i>Amblyopone australis</i> is the best-known species of the genus.</p>", content.get("Summary"));
        assertFalse(content.containsKey("Identification"));
    }

    @Test
    void testExtractContentReturnsNullWhenNoProsePresent() {
        String html = """
                <div class="mw-content-ltr mw-parser-output">
                  <table class="infobox biota"><tr><td>Ant</td></tr></table>
                  <h2><span class="mw-headline" id="Distribution">Distribution</span></h2>
                  <p>Only distribution text.</p>
                </div>
                """;
        Document doc = Jsoup.parse(html);
        assertNull(AntWikiDownloader.extractContent(doc, "https://www.antwiki.org/wiki/Example"));
    }

    @Test
    void testResolveHeadersFiltersBlankValuesAndDefaultsName() {
        Map<String, String> resolved = AntWikiDownloader.resolveHeaders("x-ala-harvester", "secret-token");
        assertEquals("secret-token", resolved.get("x-ala-harvester"));

        Map<String, String> defaultedName = AntWikiDownloader.resolveHeaders(" ", "secret-token");
        assertEquals("secret-token", defaultedName.get("x-ala-harvester"));

        Map<String, String> empty = AntWikiDownloader.resolveHeaders("x-ala-harvester", "   ");
        assertTrue(empty.isEmpty() || StringUtils.isNotBlank(System.getenv("ANTWIKI_HEADER_VALUE")));
    }

    @Test
    void testParseMatchBatchResponseRejectsHigherRankMatches() throws Exception {
        String responseJson = """
                [
                  {"success": true, "taxonConceptID": "urn:species:1", "rank": "species", "rankID": 7000, "matchType": "exactMatch"},
                  {"success": true, "taxonConceptID": "urn:subspecies:2", "rank": "subspecies", "rankID": 8000, "matchType": "exactMatch"},
                  {"success": true, "taxonConceptID": "urn:genus:3", "rank": "genus", "rankID": 6000, "matchType": "exactMatch"},
                  {"success": true, "taxonConceptID": "urn:species:4", "rank": "species", "rankID": 7000, "matchType": "higherMatch"},
                  {"success": false}
                ]
                """;
        JsonNode rootNode = new ObjectMapper().readTree(responseJson);
        List<String> titles = List.of("Sp_one", "Subsp_two", "Unmatched_in_genus", "Unmatched_subsp_fallback", "Missing_five");
        List<Integer> minRanks = List.of(7000, 8000, 7000, 8000, 7000);
        Map<String, String> output = new LinkedHashMap<>();
        AtomicInteger found = new AtomicInteger(0);
        AtomicInteger notFound = new AtomicInteger(0);
        AtomicInteger higherRankRejected = new AtomicInteger(0);

        AntWikiDownloader.parseMatchBatchResponse(rootNode, titles, minRanks, output, found, notFound, higherRankRejected);

        assertEquals(2, found.get());
        assertEquals(1, notFound.get());
        assertEquals(2, higherRankRejected.get());
        assertEquals("urn:species:1", output.get("Sp_one"));
        assertEquals("urn:subspecies:2", output.get("Subsp_two"));
        assertFalse(output.containsKey("Unmatched_in_genus"));
        assertFalse(output.containsKey("Unmatched_subsp_fallback"));
    }

    @Test
    void testAssembleTaxonResultsExcludesStaleAndPrefersMostCompletePage() {
        Map<String, String> titleToTaxonId = new LinkedHashMap<>();
        titleToTaxonId.put("Empty_synonym", "taxon:1");
        titleToTaxonId.put("Summary_only", "taxon:1");
        titleToTaxonId.put("Complete_page", "taxon:1");
        titleToTaxonId.put("Second_complete", "taxon:1");

        Map<String, Map<String, String>> pageCache = new LinkedHashMap<>();
        pageCache.put("Empty_synonym", Map.of("url", "https://www.antwiki.org/wiki/Empty_synonym"));
        pageCache.put("Summary_only", Map.of("url", "https://www.antwiki.org/wiki/Summary_only", "Summary", "<p>Summary only</p>"));
        pageCache.put("Complete_page", Map.of(
                "url", "https://www.antwiki.org/wiki/Complete_page",
                "Summary", "<p>Complete summary</p>",
                "Identification", "<p>Complete id</p>"
        ));
        pageCache.put("Second_complete", Map.of(
                "url", "https://www.antwiki.org/wiki/Second_complete",
                "Summary", "<p>Second summary</p>",
                "Identification", "<p>Second id</p>"
        ));
        pageCache.put("Stale_removed_page", Map.of("url", "https://www.antwiki.org/wiki/Stale", "Summary", "<p>Stale</p>"));

        Map<String, Object> result = AntWikiDownloader.assembleTaxonResults(titleToTaxonId, pageCache);

        assertEquals(1, result.size());
        Map<String, String> selected = (Map<String, String>) result.get("taxon:1");
        assertEquals("https://www.antwiki.org/wiki/Complete_page", selected.get("url"));
        assertEquals("<p>Complete summary</p>", selected.get("Summary"));
        assertEquals("<p>Complete id</p>", selected.get("Identification"));
    }

    @Test
    void testFetchDocumentHonorsRetryAfter() throws Exception {
        AtomicInteger attempts = new AtomicInteger(0);
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/wiki/Test_ant", exchange -> {
            int attempt = attempts.incrementAndGet();
            if (attempt == 1) {
                exchange.getResponseHeaders().add("Retry-After", "1");
                byte[] body = "Too Many Requests".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(429, body.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(body);
                }
            } else {
                byte[] body = "<html><body><p>OK</p></body></html>".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, body.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(body);
                }
            }
        });
        server.start();
        try {
            String url = "http://localhost:" + server.getAddress().getPort() + "/wiki/Test_ant";
            AtomicLong pauseUntil = new AtomicLong(0);
            Document doc = AntWikiDownloader.fetchDocument(url, "test-agent", Map.of("x-ala-harvester", "tok"), null, pauseUntil);

            assertEquals(2, attempts.get());
            assertTrue(pauseUntil.get() > 0);
            assertEquals("OK", doc.selectFirst("p").text());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void testWriteCacheWritesAtomicallyWithoutLeavingTempFile() throws Exception {
        File cacheFile = tempDir.resolve("antwiki-tmp.json").toFile();
        Map<String, Map<String, String>> cache = new LinkedHashMap<>();
        cache.put("Aenictus_hilli", Map.of("url", "https://www.antwiki.org/wiki/Aenictus_hilli", "Summary", "<p>Test</p>"));

        AntWikiDownloader.writeCache(cacheFile, cache);

        assertTrue(cacheFile.exists());
        assertFalse(tempDir.resolve("antwiki-tmp.json.tmp").toFile().exists());
        Map readBack = new ObjectMapper().readValue(cacheFile, Map.class);
        assertTrue(readBack.containsKey("Aenictus_hilli"));
    }
}
