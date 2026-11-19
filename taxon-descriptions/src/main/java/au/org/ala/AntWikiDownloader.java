package au.org.ala;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.jsoup.Connection;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Entities;
import org.jsoup.select.Elements;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Downloads Australian ant species descriptions (Summary and Identification sections) from AntWiki.
 * <p>
 * Discovers species from the AntWiki {@code Australia} page, resolves ALA taxon GUIDs via the
 * namematching service, and fetches rendered species pages using a configurable custom HTTP header
 * to pass Cloudflare bot protection. Progress is cached per page in {@code antwiki-tmp.json} so
 * interrupted runs can resume.
 */
public class AntWikiDownloader {

    private static final int TIMEOUT_MS = 60000;
    private static final int MAX_RETRIES = 3;
    private static final double DEFAULT_REQUESTS_PER_SECOND = 3.0;
    private static final int DEFAULT_THREADS = 2;
    private static final int SPECIES_RANK_ID = 7000;
    private static final int SUBSPECIES_RANK_ID = 8000;

    /**
     * Downloads and extracts AntWiki species descriptions for Australian ant taxa.
     *
     * @param antwikiUrl  base wiki URL (e.g. {@code https://www.antwiki.org/wiki/})
     * @param userAgent   HTTP User-Agent header value to send with requests
     * @param tmpDir      directory used to store the incremental cache file ({@code antwiki-tmp.json})
     * @param headerName  optional custom HTTP header name (defaults to {@code x-ala-harvester})
     * @param headerValue optional custom HTTP header value (falls back to {@code ANTWIKI_HEADER_VALUE} env var if blank)
     * @return map of ALA taxon concept IDs to extracted content maps containing {@code url}, {@code Summary}, and/or {@code Identification}
     * @throws IOException              if fetching, name matching, or page downloading fails or is interrupted
     * @throws IllegalArgumentException if {@code antwikiUrl} is blank
     */
    public static Map<String, Object> downloadAntWiki(String antwikiUrl, String userAgent, String tmpDir, String headerName, String headerValue) throws IOException {
        if (StringUtils.isBlank(antwikiUrl)) {
            throw new IllegalArgumentException("antwikiUrl must be configured for antwiki source");
        }
        String baseUrl = antwikiUrl.endsWith("/") ? antwikiUrl : antwikiUrl + "/";
        Map<String, String> effectiveHeaders = resolveHeaders(headerName, headerValue);

        Map<String, Map<String, String>> pageCache = new ConcurrentHashMap<>();
        File cacheFile = new File(tmpDir + "/antwiki-tmp.json");
        if (cacheFile.exists()) {
            try (FileReader reader = new FileReader(cacheFile)) {
                Map<String, Map<String, String>> cache = new ObjectMapper().readValue(reader, Map.class);
                if (cache != null) {
                    System.out.println("Resuming AntWiki from cache: " + cache.size());
                    pageCache.putAll(cache);
                }
            } catch (IOException e) {
                System.out.println("WARN failed to read AntWiki cache: " + e.getMessage());
            }
        }

        RateLimiter rateLimiter = new RateLimiter(DEFAULT_REQUESTS_PER_SECOND, DEFAULT_REQUESTS_PER_SECOND);
        AtomicLong pauseUntilTimestamp = new AtomicLong(0);

        String australiaUrl = baseUrl + "Australia?action=render";
        System.out.println(timestamp() + " Fetching AntWiki Australian species list from " + australiaUrl);
        Document australiaDoc = fetchDocument(australiaUrl, userAgent, effectiveHeaders, rateLimiter, pauseUntilTimestamp);
        Map<String, String> speciesTitles = parseAustraliaSpeciesList(australiaDoc);
        if (speciesTitles.isEmpty()) {
            throw new IOException("No species links found on AntWiki Australia page: " + australiaUrl);
        }
        System.out.println(timestamp() + " Found " + speciesTitles.size() + " species links on AntWiki Australia page");

        Map<String, String> titleToTaxonId = matchSpeciesNames(speciesTitles);
        if (titleToTaxonId.isEmpty()) {
            throw new IOException("No AntWiki species matched any ALA taxa");
        }
        System.out.println(timestamp() + " Matched " + titleToTaxonId.size() + " AntWiki species to ALA taxon IDs");

        AtomicInteger counter = new AtomicInteger(0);
        AtomicInteger withData = new AtomicInteger(0);
        AtomicInteger failedCount = new AtomicInteger(0);
        int total = titleToTaxonId.size();

        ExecutorService executorService = Executors.newFixedThreadPool(DEFAULT_THREADS);
        for (String title : titleToTaxonId.keySet()) {
            executorService.submit(() -> {
                try {
                    int current = counter.incrementAndGet();
                    if (current % 100 == 0) {
                        System.out.println(timestamp() + " AntWiki processed: " + current + " of " + total + ", withData: " + withData.get());
                        writeCache(cacheFile, pageCache);
                    }

                    if (pageCache.containsKey(title)) {
                        Map<String, String> existing = pageCache.get(title);
                        if (hasContent(existing)) {
                            withData.incrementAndGet();
                        }
                        return;
                    }

                    String renderUrl = baseUrl + title + "?action=render";
                    String canonicalUrl = baseUrl + title;
                    Document speciesDoc = fetchDocument(renderUrl, userAgent, effectiveHeaders, rateLimiter, pauseUntilTimestamp);
                    Map<String, String> content = extractContent(speciesDoc, canonicalUrl);
                    if (content != null && hasContent(content)) {
                        pageCache.put(title, content);
                        withData.incrementAndGet();
                    } else {
                        // Cache empty marker per page so interrupted runs do not re-fetch pages with no content
                        Map<String, String> emptyMarker = new LinkedHashMap<>();
                        emptyMarker.put("url", canonicalUrl);
                        pageCache.put(title, emptyMarker);
                    }
                } catch (Exception e) {
                    failedCount.incrementAndGet();
                    System.out.println("ERROR fetching AntWiki page for " + title + ": " + e.getMessage());
                }
            });
        }

        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(100, TimeUnit.DAYS)) {
                executorService.shutdownNow();
                writeCache(cacheFile, pageCache);
                throw new IOException("Timed out waiting for AntWiki downloads to complete");
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            try {
                executorService.awaitTermination(30, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
                // Already interrupted
            }
            writeCache(cacheFile, pageCache);
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted waiting for AntWiki downloads", e);
        }

        writeCache(cacheFile, pageCache);

        if (failedCount.get() > 0) {
            throw new IOException("AntWiki harvest incomplete: " + failedCount.get() + " page(s) failed to download");
        }

        Map<String, Object> result = assembleTaxonResults(titleToTaxonId, pageCache);
        if (result.isEmpty()) {
            if (cacheFile.exists() && !cacheFile.delete()) {
                System.out.println("WARN failed to delete empty AntWiki checkpoint: " + cacheFile.getPath());
            }
            throw new IOException("AntWiki harvest produced no extractable descriptions");
        }
        System.out.println(timestamp() + " Finished AntWiki: processed " + counter.get() + " of " + total + ", withData: " + result.size());
        return result;
    }

    static Map<String, Object> assembleTaxonResults(Map<String, String> titleToTaxonId, Map<String, Map<String, String>> pageCache) {
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Integer> bestScores = new HashMap<>();
        for (Map.Entry<String, String> entry : titleToTaxonId.entrySet()) {
            String title = entry.getKey();
            String taxonId = entry.getValue();
            Map<String, String> pageData = pageCache.get(title);
            int score = completenessScore(pageData);
            if (score == 0) {
                continue;
            }
            Integer currentBest = bestScores.get(taxonId);
            if (currentBest == null || score > currentBest) {
                result.put(taxonId, new LinkedHashMap<>(pageData));
                bestScores.put(taxonId, score);
            }
        }
        return result;
    }

    private static int completenessScore(Map<String, String> pageData) {
        if (pageData == null || pageData.isEmpty()) {
            return 0;
        }
        int score = 0;
        if (StringUtils.isNotBlank(pageData.get("Summary"))) {
            score++;
        }
        if (StringUtils.isNotBlank(pageData.get("Identification"))) {
            score++;
        }
        return score;
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

    private static Map<String, String> matchSpeciesNames(Map<String, String> speciesTitles) throws IOException {
        Map<String, String> titleToTaxonId = new LinkedHashMap<>();
        AtomicInteger found = new AtomicInteger(0);
        AtomicInteger notFound = new AtomicInteger(0);
        AtomicInteger higherRankRejected = new AtomicInteger(0);

        List<Map<String, String>> batch = new ArrayList<>();
        List<String> batchTitles = new ArrayList<>();
        List<Integer> batchMinRanks = new ArrayList<>();
        int batchSize = 1000;

        for (Map.Entry<String, String> entry : speciesTitles.entrySet()) {
            String title = entry.getKey();
            String scientificName = entry.getValue();

            Map<String, String> taxon = new HashMap<>();
            taxon.put("scientificName", scientificName);
            String[] parts = scientificName.trim().split("\\s+");
            if (parts.length > 0 && StringUtils.isNotBlank(parts[0])) {
                taxon.put("genus", parts[0]);
            }
            taxon.put("family", "Formicidae");
            taxon.put("order", "Hymenoptera");
            taxon.put("clazz", "Insecta");
            taxon.put("phylum", "Arthropoda");
            taxon.put("kingdom", "Animalia");

            int minRankId = parts.length >= 3 ? SUBSPECIES_RANK_ID : SPECIES_RANK_ID;

            batch.add(taxon);
            batchTitles.add(title);
            batchMinRanks.add(minRankId);

            if (batch.size() == batchSize) {
                matchBatch(batch, batchTitles, batchMinRanks, titleToTaxonId, found, notFound, higherRankRejected);
                batch.clear();
                batchTitles.clear();
                batchMinRanks.clear();
            }
        }

        if (!batch.isEmpty()) {
            matchBatch(batch, batchTitles, batchMinRanks, titleToTaxonId, found, notFound, higherRankRejected);
        }

        if (found.get() + notFound.get() + higherRankRejected.get() != speciesTitles.size()) {
            throw new IOException("AntWiki name matching accounted for "
                    + (found.get() + notFound.get() + higherRankRejected.get())
                    + " of " + speciesTitles.size() + " species");
        }

        System.out.println(timestamp() + " AntWiki namematching found: " + found.get()
                + ", notFound: " + notFound.get()
                + ", higherRankRejected: " + higherRankRejected.get());
        return titleToTaxonId;
    }

    private static void matchBatch(List<Map<String, String>> batch, List<String> batchTitles,
                                   List<Integer> batchMinRanks,
                                   Map<String, String> output, AtomicInteger found,
                                   AtomicInteger notFound, AtomicInteger higherRankRejected) throws IOException {
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(TIMEOUT_MS)
                .setSocketTimeout(TIMEOUT_MS)
                .build();
        try (CloseableHttpClient httpClient = HttpClients.custom().setDefaultRequestConfig(requestConfig).build()) {
            HttpPost request = new HttpPost(FetchData.namematchingUrl + "/api/searchAllByClassification");
            request.setHeader("Content-Type", "application/json");

            ObjectMapper mapper = new ObjectMapper();
            String json = mapper.writeValueAsString(batch);
            request.setEntity(new StringEntity(json, StandardCharsets.UTF_8));

            HttpResponse response = httpClient.execute(request);
            int statusCode = response.getStatusLine().getStatusCode();
            String responseBody = EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8);
            if (statusCode < 200 || statusCode >= 300) {
                throw new IOException("Namematching service returned HTTP " + statusCode + ": " + responseBody);
            }

            JsonNode rootNode = mapper.readTree(responseBody);
            if (!rootNode.isArray() || rootNode.size() != batch.size()) {
                throw new IOException("Unexpected namematching response size: expected " + batch.size()
                        + ", got " + (rootNode.isArray() ? rootNode.size() : "non-array"));
            }

            parseMatchBatchResponse(rootNode, batchTitles, batchMinRanks, output, found, notFound, higherRankRejected);
        }
    }

    static void parseMatchBatchResponse(JsonNode rootNode, List<String> batchTitles,
                                        List<Integer> batchMinRanks,
                                        Map<String, String> output, AtomicInteger found,
                                        AtomicInteger notFound, AtomicInteger higherRankRejected) {
        for (int i = 0; i < rootNode.size(); i++) {
            JsonNode node = rootNode.get(i);
            String success = node.path("success").asText();
            if ("true".equals(success)) {
                String taxonConceptID = node.path("taxonConceptID").asText();
                int rankId = node.path("rankID").asInt(0);
                String matchType = node.path("matchType").asText();
                int minRankId = batchMinRanks != null && i < batchMinRanks.size() ? batchMinRanks.get(i) : SPECIES_RANK_ID;
                boolean isHigherMatch = "higherMatch".equalsIgnoreCase(matchType);
                if (StringUtils.isNotBlank(taxonConceptID) && !isHigherMatch && rankId >= minRankId) {
                    output.put(batchTitles.get(i), taxonConceptID);
                    found.incrementAndGet();
                } else if (StringUtils.isNotBlank(taxonConceptID)) {
                    higherRankRejected.incrementAndGet();
                } else {
                    notFound.incrementAndGet();
                }
            } else {
                notFound.incrementAndGet();
            }
        }
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
        StringBuilder pendingHeading = new StringBuilder();
        boolean inKeysSubsection = false;
        Element sibling = idHeading.nextElementSibling();
        while (sibling != null) {
            String tag = sibling.tagName().toLowerCase(Locale.ROOT);
            if ("h2".equals(tag)) {
                break;
            }
            if ("h3".equals(tag)) {
                inKeysSubsection = sibling.selectFirst("#Keys_including_this_Species") != null
                        || sibling.text().trim().toLowerCase(Locale.ROOT).startsWith("keys including");
                pendingHeading.setLength(0);
                if (!inKeysSubsection && StringUtils.isNotBlank(sibling.text())) {
                    pendingHeading.append("<h3>").append(Entities.escape(sibling.text().trim())).append("</h3>");
                }
            } else if (!inKeysSubsection) {
                if ("h4".equals(tag) && StringUtils.isNotBlank(sibling.text())) {
                    pendingHeading.append("<h4>").append(Entities.escape(sibling.text().trim())).append("</h4>");
                } else if (("p".equals(tag) || "ul".equals(tag) || "ol".equals(tag)) && hasProseText(sibling)) {
                    if (pendingHeading.length() > 0) {
                        sb.append(pendingHeading);
                        pendingHeading.setLength(0);
                    }
                    sb.append("<").append(tag).append(">").append(sibling.html().trim()).append("</").append(tag).append(">");
                }
            }
            sibling = sibling.nextElementSibling();
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private static boolean isProseParagraph(Element p) {
        return hasProseText(p);
    }

    private static boolean hasProseText(Element element) {
        Element clone = element.clone();
        clone.select("img, span[typeof=mw:File], small").remove();
        return StringUtils.isNotBlank(clone.text());
    }

    private static void waitForSharedPauseAndRateLimit(RateLimiter rateLimiter, AtomicLong pauseUntilTimestamp) throws InterruptedException {
        while (true) {
            if (pauseUntilTimestamp != null) {
                long pauseRemaining = pauseUntilTimestamp.get() - System.currentTimeMillis();
                if (pauseRemaining > 0) {
                    Thread.sleep(pauseRemaining);
                    continue;
                }
            }
            if (rateLimiter != null) {
                rateLimiter.acquire();
            }
            if (pauseUntilTimestamp == null || pauseUntilTimestamp.get() <= System.currentTimeMillis()) {
                return;
            }
        }
    }

    static Document fetchDocument(String url, String userAgent, Map<String, String> headers,
                                  RateLimiter rateLimiter, AtomicLong pauseUntilTimestamp) throws IOException {
        IOException lastException = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                waitForSharedPauseAndRateLimit(rateLimiter, pauseUntilTimestamp);
                Connection connection = Jsoup.connect(url)
                        .timeout(TIMEOUT_MS)
                        .followRedirects(true)
                        .ignoreHttpErrors(true);
                if (StringUtils.isNotBlank(userAgent)) {
                    connection.userAgent(userAgent);
                }
                for (Map.Entry<String, String> header : headers.entrySet()) {
                    connection.header(header.getKey(), header.getValue());
                }
                Connection.Response response = connection.execute();
                int status = response.statusCode();
                if (status >= 200 && status < 300) {
                    return response.parse();
                }
                if (status == 403 || status == 404) {
                    throw new HttpStatusException("HTTP error fetching URL", status, url);
                }
                if (status == 429 || status == 503) {
                    long pauseMs = WikimediaClient.parseRetryAfter(response.header("Retry-After"));
                    if (pauseUntilTimestamp != null) {
                        pauseUntilTimestamp.accumulateAndGet(System.currentTimeMillis() + pauseMs, Math::max);
                    }
                    lastException = new HttpStatusException("Rate limited fetching URL", status, url);
                    System.out.println("WARN HTTP " + status + " fetching " + url + ", pausing for "
                            + (pauseMs / 1000) + "s (attempt " + attempt + "/" + MAX_RETRIES + ")");
                    if (attempt < MAX_RETRIES) {
                        Thread.sleep(pauseMs);
                    }
                    continue;
                }
                lastException = new HttpStatusException("HTTP error fetching URL", status, url);
                System.out.println("WARN HTTP " + status + " fetching " + url + " (attempt " + attempt + "/" + MAX_RETRIES + ")");
            } catch (HttpStatusException e) {
                if (e.getStatusCode() == 403 || e.getStatusCode() == 404) {
                    throw e;
                }
                lastException = e;
                System.out.println("WARN HTTP " + e.getStatusCode() + " fetching " + url + " (attempt " + attempt + "/" + MAX_RETRIES + ")");
            } catch (IOException e) {
                lastException = e;
                System.out.println("WARN I/O error fetching " + url + " (attempt " + attempt + "/" + MAX_RETRIES + "): " + e.getMessage());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("Interrupted while fetching " + url, e);
            }

            if (attempt < MAX_RETRIES) {
                try {
                    Thread.sleep(2000L * attempt);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Interrupted during retry backoff for " + url, e);
                }
            }
        }
        throw lastException != null ? lastException : new IOException("Failed to fetch " + url);
    }

    private static boolean hasContent(Map<String, String> taxonData) {
        if (taxonData == null || taxonData.isEmpty()) {
            return false;
        }
        return StringUtils.isNotBlank(taxonData.get("Summary"))
                || StringUtils.isNotBlank(taxonData.get("Identification"));
    }

    static synchronized void writeCache(File cacheFile, Map<String, Map<String, String>> data) {
        File parentDir = cacheFile.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }
        File tempFile = new File(parentDir, cacheFile.getName() + ".tmp");
        try {
            try (FileWriter writer = new FileWriter(tempFile, StandardCharsets.UTF_8)) {
                new ObjectMapper().writeValue(writer, data);
            }
            try {
                Files.move(tempFile.toPath(), cacheFile.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(tempFile.toPath(), cacheFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            System.out.println("WARN failed to write AntWiki cache: " + e.getMessage());
            tempFile.delete();
        }
    }

    private static String timestamp() {
        return new SimpleDateFormat("HH:mm:ss:SSS").format(new Date());
    }
}
