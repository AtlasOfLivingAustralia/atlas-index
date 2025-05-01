package au.org.ala;

import com.opencsv.CSVParser;
import com.opencsv.CSVParserBuilder;
import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import com.opencsv.exceptions.CsvException;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.io.*;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class AntsDownloader {

    static AtomicInteger found = new AtomicInteger(0);
    static AtomicInteger notFound = new AtomicInteger(0);
    static AtomicInteger error = new AtomicInteger(0);
    static AtomicInteger noInformation = new AtomicInteger(0);

    // To speed up the process, first do a names check against the following files.
    // These URLs are found here:  https://www.antwiki.org/wiki/Downloadable_Data
    // The current format of these files is tab separated, with the first column being the taxon name and the 4th column being the genus
    static String validGeneraUrl = "https://www.antwiki.org/wiki/images/a/ad/AntWiki_Valid_Genera.txt";
    static String validSpeciesUrl = "https://www.antwiki.org/wiki/images/9/9e/AntWiki_Valid_Species.txt";
    static String validFilesEncoding = "UTF-16LE";

    // Also check the Australia page https://www.antwiki.org/wiki/Australia for additional names
    static String australiaHtmlUrl = "https://www.antwiki.org/wiki/Australia";

    public static Map<String, Object> downloadAnts(String url, String tmpDir) throws IOException, CsvException {
        File tmpDirFile = new File(tmpDir);
        if (!tmpDirFile.exists()) {
            tmpDirFile.mkdirs();
        }

        // Fetch data for valid lists
        List<String[]> names = fetchValidNames(validGeneraUrl, tmpDir, "genera");
        names.addAll(fetchValidNames(validSpeciesUrl, tmpDir, "species"));

        // Fetch data for Australia
        names.addAll(fetchHtmlNames(australiaHtmlUrl, tmpDir, "australia"));

        AtomicInteger foundMatching = new AtomicInteger(0);
        AtomicInteger notFoundMatching = new AtomicInteger(0);
        List<Map<String, String>> batch = new ArrayList<>();
        List<String> batchIds = new ArrayList<>();
        Map<String, String> matchedNames = new HashMap<>();
        for (String[] row : names) {
            // skip header and invalid rows
            if (row.length < 4 || "TaxonName".equals(row[0])) {
                continue;
            }

            // add to batch
            Map<String, String> map = new HashMap<>();
            map.put("scientificName", row[0]);
            map.put("genus", row[3]);
            batch.add(map);
            batchIds.add(row[0]);
            if (batch.size() > 1000) {
                NamematchingUtil.namematchingService(batch, batchIds, matchedNames, foundMatching, notFoundMatching);
                batch.clear();
                batchIds.clear();
            }
        }

        if (!batch.isEmpty()) {
            NamematchingUtil.namematchingService(batch, batchIds, matchedNames, foundMatching, notFoundMatching);
        }

        // invert matchedNames to remove duplicates
        Map<String, String> invertedMatchedNames = new HashMap<>();
        for (Map.Entry<String, String> entry : matchedNames.entrySet()) {
            invertedMatchedNames.put(entry.getValue(), entry.getKey());
        }

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Total matches: " + matchedNames.size() + " out of " + names.size() + ". Number unique: " + invertedMatchedNames.size());

        Map<String, Object> data = new ConcurrentHashMap<>();
        ExecutorService executorService = Executors.newFixedThreadPool(2); // Adjust the thread pool size as needed

        for (Map.Entry<String, String> entry : invertedMatchedNames.entrySet()) {
            String guid = entry.getKey();
            String scientificName = entry.getValue();

            executorService.submit(() -> fetchAndStoreData(scientificName, guid, data, url, tmpDir));
        }

        executorService.shutdown();
        try {
            executorService.awaitTermination(100, TimeUnit.DAYS);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        System.out.println("Ants, Found: " + found.get() + ", Not Found: " + notFound.get() + ", Error: " + error.get());

        return data;
    }

    // extracts scientificName and genus from html and converts the html into the same format as fetchValidNames.
    private static List<String[]> fetchHtmlNames(String url, String tmpDir, String type) throws IOException, CsvException {
        File file = new File(tmpDir + "/" + type + ".csv");
        if (!file.exists()) {
            // Download the file
            Files.copy(new URL(url).openStream(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }

        Document doc = Jsoup.parse(file);

        List<String[]> names = new ArrayList<>();

        // iterate over the div with class "mw-parser-output"
        Element mwParserOutput = doc.selectFirst("div.mw-parser-output");
        String currentGenus = null;
        for (Element child : mwParserOutput.children()) {
            // when we find the <h2>, this is the genus name
            if (child.tagName().equals("h2")) {
                // get the first a tag
                Element aTag = child.selectFirst("a");
                Element uncertainTag = child.selectFirst("#Uncertain_species");
                if (aTag != null) {
                    currentGenus = aTag.text();
                    names.add(new String[]{currentGenus, null, null, currentGenus});
                } else if (uncertainTag != null) {
                    currentGenus = null;
                }
            }
            if (child.tagName().equals("ul")) {
                for (Element li : child.children()) {
                    String name = li.selectFirst("a").text();
                    names.add(new String[]{name, null, null, currentGenus});
                }
            }
        }

        return names;
    }

    private static List<String[]> fetchValidNames(String url, String tmpDir, String type) throws IOException, CsvException {
        File file = new File(tmpDir + "/" + type + ".csv");
        if (!file.exists()) {
            // Download the file
            Files.copy(new URL(url).openStream(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }

        CSVReader reader = new CSVReaderBuilder(new FileReader(file, Charset.forName(validFilesEncoding))).withCSVParser(
                new CSVParserBuilder().withSeparator('\t').build()).build();
        return reader.readAll();
    }

    private static void fetchAndStoreData(String scientificName, String guid, Map<String, Object> data, String antsUrl, String tmpDir) {
        try {
            File cacheFile = new File(tmpDir + "/html-cache/" + URLEncoder.encode(scientificName.replace(" ", "_"), "UTF-8") + ".html");

            if (!cacheFile.getParentFile().exists()) {
                cacheFile.getParentFile().mkdirs();
            }

            Document doc;
            if (!cacheFile.exists()) {
                String url = antsUrl + scientificName.replace(" ", "_");
                doc = Jsoup.connect(url).userAgent(FetchData.wikipediaUserAgent).get();

                // write to a file for debugging
                Files.write(cacheFile.toPath(), doc.outerHtml().getBytes());
            } else {
                doc = Jsoup.parse(cacheFile, "UTF-8");
            }

            String identification = extractIdentification(doc);
            String summary = extractSummary(doc);

            Map<String, String> taxonData = new ConcurrentHashMap<>();
            if (StringUtils.isNotEmpty(summary)) taxonData.put("Summary", summary);
            if (StringUtils.isNotEmpty(identification)) taxonData.put("Identification", identification);

            if (taxonData.isEmpty()) {
                noInformation.incrementAndGet();
            } else {
                data.put(guid, taxonData);
                found.incrementAndGet();
            }
        } catch (HttpStatusException e) {
            notFound.incrementAndGet();
        } catch (Exception e) {
            error.incrementAndGet();
            System.out.println("error: " + scientificName + ", " + e.getMessage());

            // always retry
            fetchAndStoreData(scientificName, guid, data, antsUrl, tmpDir);
        }

        if ((found.get() + notFound.get() + noInformation.get()) % 100 == 0) {
            System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Ants, Found: " + found.get() + ", Not Found: " + notFound.get() + ", Error: " + error.get() + ", No Information: " + noInformation.get());
        }
    }

    private static String extractIdentification(Document doc) {
        Element identificationElement = doc.select("h2:contains(Identification) + p").first();
        return identificationElement != null ? identificationElement.text() : "";
    }

    private static String extractSummary(Document doc) {
        Element identificationElement = doc.select("h2:contains(Identification) + p").first();
        Element summaryElement = identificationElement != null ? identificationElement.previousElementSibling() : null;
        while (summaryElement != null && !summaryElement.tagName().equals("p")) {
            summaryElement = summaryElement.previousElementSibling();
        }
        return summaryElement != null ? summaryElement.text() : "";
    }
}
