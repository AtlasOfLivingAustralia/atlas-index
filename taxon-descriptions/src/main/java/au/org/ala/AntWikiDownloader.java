package au.org.ala;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class AntWikiDownloader {

    private static final int TIMEOUT_MS = 60000;
    private static final int MAX_RETRIES = 3;
    private static final double DEFAULT_REQUESTS_PER_SECOND = 3.0;
    private static final int DEFAULT_THREADS = 2;

    public static Map<String, Object> downloadAntWiki(String antwikiUrl, String userAgent, String tmpDir, String headerName, String headerValue) throws IOException {
        if (StringUtils.isBlank(antwikiUrl)) {
            throw new IllegalArgumentException("antwikiUrl must be configured for antwiki source");
        }
        String baseUrl = antwikiUrl.endsWith("/") ? antwikiUrl : antwikiUrl + "/";
        Map<String, String> effectiveHeaders = resolveHeaders(headerName, headerValue);

        Map<String, Object> data = new ConcurrentHashMap<>();
        File cacheFile = new File(tmpDir + "/antwiki-tmp.json");
        if (cacheFile.exists()) {
            try (FileReader reader = new FileReader(cacheFile)) {
                Map cache = new ObjectMapper().readValue(reader, Map.class);
                if (cache != null) {
                    System.out.println("Resuming AntWiki from cache: " + cache.size());
                    data.putAll(cache);
                }
            } catch (IOException e) {
                System.out.println("WARN failed to read AntWiki cache: " + e.getMessage());
            }
        }

        RateLimiter rateLimiter = new RateLimiter(DEFAULT_REQUESTS_PER_SECOND, DEFAULT_REQUESTS_PER_SECOND);

        String australiaUrl = baseUrl + "Australia?action=render";
        System.out.println(timestamp() + " Fetching AntWiki Australian species list from " + australiaUrl);
        Document australiaDoc = fetchDocument(australiaUrl, userAgent, effectiveHeaders, rateLimiter);
        Map<String, String> speciesTitles = parseAustraliaSpeciesList(australiaDoc);
        System.out.println(timestamp() + " Found " + speciesTitles.size() + " species links on AntWiki Australia page");

        Map<String, String> titleToTaxonId = matchSpeciesNames(speciesTitles);
        System.out.println(timestamp() + " Matched " + titleToTaxonId.size() + " AntWiki species to ALA taxon IDs");

        AtomicInteger counter = new AtomicInteger(0);
        AtomicInteger withData = new AtomicInteger(0);
        int total = titleToTaxonId.size();

        ExecutorService executorService = Executors.newFixedThreadPool(DEFAULT_THREADS);
        for (Map.Entry<String, String> entry : titleToTaxonId.entrySet()) {
            String title = entry.getKey();
            String taxonId = entry.getValue();
            executorService.submit(() -> {
                try {
                    int current = counter.incrementAndGet();
                    if (current % 100 == 0) {
                        System.out.println(timestamp() + " AntWiki processed: " + current + " of " + total + ", withData: " + withData.get());
                        writeCache(cacheFile, data);
                    }

                    if (data.containsKey(taxonId)) {
                        Map existing = (Map) data.get(taxonId);
                        if (hasContent(existing)) {
                            withData.incrementAndGet();
                        }
                        return;
                    }

                    String renderUrl = baseUrl + title + "?action=render";
                    String canonicalUrl = baseUrl + title;
                    Document speciesDoc = fetchDocument(renderUrl, userAgent, effectiveHeaders, rateLimiter);
                    Map<String, String> content = extractContent(speciesDoc, canonicalUrl);
                    if (content != null && hasContent(content)) {
                        data.put(taxonId, content);
                        withData.incrementAndGet();
                    } else {
                        // Cache empty marker so interrupted runs do not re-fetch pages with no content
                        Map<String, String> emptyMarker = new ConcurrentHashMap<>();
                        emptyMarker.put("url", canonicalUrl);
                        data.put(taxonId, emptyMarker);
                    }
                } catch (Exception e) {
                    System.out.println("ERROR fetching AntWiki page for " + title + ": " + e.getMessage());
                }
            });
        }

        executorService.shutdown();
        try {
            executorService.awaitTermination(100, TimeUnit.DAYS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.out.println("Interrupted waiting for AntWiki downloads: " + e.getMessage());
        }

        writeCache(cacheFile, data);

        // Remove empty entries before returning final output
        List<String> keys = new ArrayList<>(data.keySet());
        for (String key : keys) {
            Map taxonData = (Map) data.get(key);
            if (!hasContent(taxonData)) {
                data.remove(key);
            }
        }

        System.out.println(timestamp() + " Finished AntWiki: processed " + counter.get() + " of " + total + ", withData: " + withData.get());
        return data;
    }

    static Map<String, String> resolveHeaders(String headerName, String headerValue) {
        Map<String, String> resolved = new LinkedHashMap<>();
        String effectiveName = StringUtils.isNotBlank(headerName) ? headerName.trim() : "x-ala-harvester";
        String effectiveValue = StringUtils.isNotBlank(headerValue) ? headerValue.trim() : System.getenv("ANTWIKI_HEADER_VALUE");
        if (StringUtils.isNotBlank(effectiveValue)) {
            resolved.put(effectiveName, effectiveValue.trim());
        }
        return resolved;
    }

    static Map<String, String> parseAustraliaSpeciesList(Document doc) {
        Map<String, String> species = new LinkedHashMap<>();
        if (doc == null) {
            return species;
        }
        Elements links = doc.select("ul li i a[href]");
        for (Element link : links) {
            String href = link.attr("href");
            String name = link.text().trim();
            if (StringUtils.isBlank(href) || StringUtils.isBlank(name)) {
                continue;
            }
            int wikiIdx = href.indexOf("/wiki/");
            if (wikiIdx < 0) {
                continue;
            }
            String title = href.substring(wikiIdx + "/wiki/".length());
            int queryIdx = title.indexOf('?');
            if (queryIdx >= 0) {
                title = title.substring(0, queryIdx);
            }
            int hashIdx = title.indexOf('#');
            if (hashIdx >= 0) {
                title = title.substring(0, hashIdx);
            }
            if (StringUtils.isNotBlank(title) && !title.contains(":")) {
                species.putIfAbsent(title, name);
            }
        }
        return species;
    }

    private static Map<String, String> matchSpeciesNames(Map<String, String> speciesTitles) {
        Map<String, String> titleToTaxonId = new LinkedHashMap<>();
        AtomicInteger found = new AtomicInteger(0);
        AtomicInteger notFound = new AtomicInteger(0);

        List<Map<String, String>> batch = new ArrayList<>();
        List<String> batchTitles = new ArrayList<>();
        int batchSize = 1000;

        for (Map.Entry<String, String> entry : speciesTitles.entrySet()) {
            String title = entry.getKey();
            String scientificName = entry.getValue();

            Map<String, String> taxon = new HashMap<>();
            taxon.put("scientificName", scientificName);
            String[] parts = scientificName.split("\\s+");
            if (parts.length > 0 && StringUtils.isNotBlank(parts[0])) {
                taxon.put("genus", parts[0]);
            }
            taxon.put("family", "Formicidae");
            taxon.put("order", "Hymenoptera");
            taxon.put("clazz", "Insecta");
            taxon.put("phylum", "Arthropoda");
            taxon.put("kingdom", "Animalia");

            batch.add(taxon);
            batchTitles.add(title);

            if (batch.size() == batchSize) {
                NamematchingUtil.namematchingService(batch, batchTitles, titleToTaxonId, found, notFound);
                batch.clear();
                batchTitles.clear();
            }
        }

        if (!batch.isEmpty()) {
            NamematchingUtil.namematchingService(batch, batchTitles, titleToTaxonId, found, notFound);
        }

        System.out.println(timestamp() + " AntWiki namematching found: " + found.get() + ", notFound: " + notFound.get());
        return titleToTaxonId;
    }

    static Map<String, String> extractContent(Document doc, String pageUrl) {
        if (doc == null) {
            return null;
        }
        Document working = doc.clone();
        working.select(".infobox, .infobox.biota, table, #BackToTop, .mw-editsection, script, style, noscript").remove();

        Element root = working.selectFirst(".mw-parser-output");
        if (root == null) {
            root = working.body();
        }
        if (root == null) {
            return null;
        }

        String summary = extractSummary(root);
        String identification = extractIdentification(root);

        if (StringUtils.isBlank(summary) && StringUtils.isBlank(identification)) {
            return null;
        }

        Map<String, String> result = new LinkedHashMap<>();
        result.put("url", pageUrl);
        if (StringUtils.isNotBlank(summary)) {
            result.put("Summary", summary);
        }
        if (StringUtils.isNotBlank(identification)) {
            result.put("Identification", identification);
        }
        return result;
    }

    private static String extractSummary(Element root) {
        for (Element child : root.children()) {
            String tag = child.tagName();
            if ("h2".equalsIgnoreCase(tag) || "h1".equalsIgnoreCase(tag)) {
                break;
            }
            if ("p".equalsIgnoreCase(tag) && isProseParagraph(child)) {
                return "<p>" + child.html().trim() + "</p>";
            }
        }
        return null;
    }

    private static String extractIdentification(Element root) {
        Element idHeading = null;
        for (Element h2 : root.select("h2")) {
            Element headline = h2.selectFirst(".mw-headline#Identification");
            if (headline != null || "Identification".equalsIgnoreCase(h2.text().trim())) {
                idHeading = h2;
                break;
            }
        }
        if (idHeading == null) {
            return null;
        }

        StringBuilder sb = new StringBuilder();
        Element sibling = idHeading.nextElementSibling();
        while (sibling != null) {
            String tag = sibling.tagName();
            if ("h2".equalsIgnoreCase(tag) || "h3".equalsIgnoreCase(tag)) {
                break;
            }
            if ("p".equalsIgnoreCase(tag) && isProseParagraph(sibling)) {
                sb.append("<p>").append(sibling.html().trim()).append("</p>");
            }
            sibling = sibling.nextElementSibling();
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private static boolean isProseParagraph(Element p) {
        Element clone = p.clone();
        clone.select("img, span[typeof=mw:File], small").remove();
        return StringUtils.isNotBlank(clone.text());
    }

    private static Document fetchDocument(String url, String userAgent, Map<String, String> headers, RateLimiter rateLimiter) throws IOException {
        IOException lastException = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (rateLimiter != null) {
                    rateLimiter.acquire();
                }
                var connection = Jsoup.connect(url)
                        .timeout(TIMEOUT_MS)
                        .followRedirects(true);
                if (StringUtils.isNotBlank(userAgent)) {
                    connection.userAgent(userAgent);
                }
                for (Map.Entry<String, String> header : headers.entrySet()) {
                    connection.header(header.getKey(), header.getValue());
                }
                return connection.get();
            } catch (HttpStatusException e) {
                int status = e.getStatusCode();
                if (status == 403 || status == 404) {
                    throw e;
                }
                lastException = e;
                System.out.println("WARN HTTP " + status + " fetching " + url + " (attempt " + attempt + "/" + MAX_RETRIES + ")");
            } catch (SocketTimeoutException e) {
                lastException = e;
                System.out.println("WARN timeout fetching " + url + " (attempt " + attempt + "/" + MAX_RETRIES + ")");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("Interrupted while rate-limiting request to " + url, e);
            }

            try {
                Thread.sleep(2000L * attempt);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("Interrupted during retry backoff for " + url, e);
            }
        }
        throw lastException != null ? lastException : new IOException("Failed to fetch " + url);
    }

    private static boolean hasContent(Map taxonData) {
        if (taxonData == null || taxonData.isEmpty()) {
            return false;
        }
        return StringUtils.isNotBlank((String) taxonData.get("Summary"))
                || StringUtils.isNotBlank((String) taxonData.get("Identification"));
    }

    private static synchronized void writeCache(File cacheFile, Map<String, Object> data) {
        try (FileWriter writer = new FileWriter(cacheFile)) {
            new ObjectMapper().writeValue(writer, data);
        } catch (IOException e) {
            System.out.println("WARN failed to write AntWiki cache: " + e.getMessage());
        }
    }

    private static String timestamp() {
        return new SimpleDateFormat("HH:mm:ss:SSS").format(new Date());
    }
}
