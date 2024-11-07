package au.org.ala;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class VicMuseumDownloader {

    public static Map<String, Object> downloadVicMuseum(String acceptedCsv, String apiUrl) throws IOException, CsvValidationException {
        Map<String, Object> data = new ConcurrentHashMap<>();
        ExecutorService executorService = Executors.newFixedThreadPool(10); // Adjust the thread pool size as needed

        try (CSVReader reader = new CSVReader(new FileReader(acceptedCsv))) {
            reader.readNext(); // Skip header

            String[] nextLine;
            while ((nextLine = reader.readNext()) != null) {
                String guid = nextLine[0];
                String scientificName = nextLine[1];

                executorService.submit(() -> fetchAndStoreData(scientificName, guid, data, apiUrl));
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

    private static void fetchAndStoreData(String scientificName, String guid, Map<String, Object> data, String apiUrl) {
        try {
            String urlStr = apiUrl + "?taxon=" + scientificName + "&recordType=species";
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "");

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                String inputLine;
                StringBuilder response = new StringBuilder();
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();

                ObjectMapper mapper = new ObjectMapper();
                JsonNode rootNode = mapper.readTree(response.toString());
                if (rootNode.isArray() && rootNode.size() > 0) {
                    JsonNode firstRecord = rootNode.get(0);
                    String biology = firstRecord.path("biology").asText();
                    String generalDescription = firstRecord.path("generalDescription").asText();
                    String habitat = firstRecord.path("habitat").asText();

                    Map<String, String> taxonData = new ConcurrentHashMap<>();
                    taxonData.put("Biology", biology);
                    taxonData.put("General Description", generalDescription);
                    taxonData.put("Habitat", habitat);
                    data.put(guid, taxonData);

                    System.out.println("Found descriptions for: " + scientificName);
                }
            } else {
                System.out.println("Failed to fetch data for: " + scientificName);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}