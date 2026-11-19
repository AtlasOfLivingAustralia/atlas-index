package au.org.ala;

import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class AntWikiDownloaderTest {

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
}
