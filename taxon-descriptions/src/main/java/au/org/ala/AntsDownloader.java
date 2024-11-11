package au.org.ala;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.io.FileReader;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class AntsDownloader {

    public static Map<String, Object> downloadAnts(String acceptedCsv, String url) throws IOException, CsvValidationException {
        Map<String, Object> data = new ConcurrentHashMap<>();
        ExecutorService executorService = Executors.newFixedThreadPool(10); // Adjust the thread pool size as needed

        try (CSVReader reader = new CSVReader(new FileReader(acceptedCsv))) {
            reader.readNext(); // Skip header

            String[] nextLine;
            int count = 0;
            while ((nextLine = reader.readNext()) != null) {
                String guid = nextLine[0];
                String scientificName = nextLine[1];
                String order = nextLine[4];

                // Only fetch data for hymenoptera order ~ ants
                if (!"hymenoptera".equalsIgnoreCase(order)) {
                    continue;
                }

                executorService.submit(() -> fetchAndStoreData(scientificName, guid, data, url));
                count++;
            }
        }

        executorService.shutdown();
        try {
            executorService.awaitTermination(100, TimeUnit.DAYS);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        return data;
    }

    private static void fetchAndStoreData(String scientificName, String guid, Map<String, Object> data, String antsUrl) {
        try {
            String url = antsUrl + scientificName.replace(" ", "_");
            Document doc = Jsoup.connect(url).get();

            String identification = extractIdentification(doc);
            String summary = extractSummary(doc);

            Map<String, String> taxonData = new ConcurrentHashMap<>();
            taxonData.put("Summary", summary);
            taxonData.put("Identification", identification);
            data.put(guid, taxonData);

            System.out.println("Found descriptions for: " + scientificName);
        } catch (HttpStatusException e) {
            System.out.println("URL not found for scientific name: " + scientificName);
        } catch (Exception e) {
            e.printStackTrace();
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