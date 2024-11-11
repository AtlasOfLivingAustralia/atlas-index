package au.org.ala;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class QldMuseumDownloader {


    public static Map<String, Object> downloadQldMuseum(String acceptedCsv, String apiUrl, String apiKey) throws IOException, CsvValidationException {
        Map<String, Object> data = new ConcurrentHashMap<>();
        ExecutorService executorService = Executors.newFixedThreadPool(10); // Adjust the thread pool size as needed

        try (CSVReader reader = new CSVReader(new FileReader(acceptedCsv))) {
            reader.readNext(); // Skip header

            String[] nextLine;
            while ((nextLine = reader.readNext()) != null) {
                String guid = nextLine[0];
                String scientificName = nextLine[1];

                executorService.submit(() -> fetchAndStoreData(scientificName, guid, data, apiUrl, apiKey));
            }
        } catch (CsvValidationException e) {
            throw new RuntimeException(e);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        executorService.shutdown();
        try {
            executorService.awaitTermination(100, TimeUnit.DAYS);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        return data;
    }

    private static void fetchAndStoreData(String scientificName, String guid, Map<String, Object> data, String apiUrl, String apiKey) {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            String urlStr = apiUrl + "opactopics?query=" + URLEncoder.encode(scientificName, StandardCharsets.UTF_8);
            HttpGet request = new HttpGet(urlStr);
            request.setHeader("Authorization", "Basic " + apiKey);

            HttpResponse response = httpClient.execute(request);
            int responseCode = response.getStatusLine().getStatusCode();
            if (responseCode == 200) {
                String responseBody = EntityUtils.toString(response.getEntity());
                ObjectMapper mapper = new ObjectMapper();
                JsonNode rootNode = mapper.readTree(responseBody);
                if (rootNode.has("opacTopics") && !rootNode.get("opacTopics").isEmpty()) {
                    String opacTopicId = rootNode.get("opacTopics").get(0).path("opacTopicId").asText();
                    fetchOpacTopicDetails(opacTopicId, guid, data, apiUrl, apiKey);
                }
                else {
                    System.out.println("No opacTopics found for: " + scientificName);
                }
            } else {
                System.out.println("Failed to fetch data for: " + scientificName);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static void fetchOpacTopicDetails(String opacTopicId, String guid, Map<String, Object> data, String apiUrl, String apiKey) {
        try {
            String urlStr = apiUrl + "opactopics/" + opacTopicId;
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Basic " + apiKey);

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
                String identification = "";
                String habitat = "";

                for (JsonNode fieldSet : rootNode.path("opacTopicFieldSets")) {
                    if (fieldSet.path("identifier").asText().equals("description")) {
                        for (JsonNode field : fieldSet.path("opacTopicFields")) {
                            String value = field.path("value").asText();
                            if (value.contains("Identification:")) {
                                identification = value;
                            } else if (value.contains("Habitat and Range:")) {
                                habitat = value;
                            }
                        }
                    }
                }

                Map<String, String> taxonData = new ConcurrentHashMap<>();
                taxonData.put("Identification", identification);
                taxonData.put("Habitat", habitat);
                data.put(guid, taxonData);

                System.out.println("Found descriptions for: " + guid);
            } else {
                System.out.println("Failed to fetch details for opacTopicId: " + opacTopicId);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}