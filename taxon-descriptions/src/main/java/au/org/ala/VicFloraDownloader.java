package au.org.ala;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.io.FileReader;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class VicFloraDownloader {

    public static Map<String, Object> downloadVicFlora(String acceptedCsv, String vicFloraGraphqlUrl, String vicFloraUrl) throws IOException, CsvValidationException {
        Map<String, Object> data = new ConcurrentHashMap<>();
        ExecutorService executorService = Executors.newFixedThreadPool(10); // Adjust the thread pool size as needed

        try (CSVReader reader = new CSVReader(new FileReader(acceptedCsv))) {
            reader.readNext(); // Skip header

            String[] nextLine;
            while ((nextLine = reader.readNext()) != null) {
                String guid = nextLine[0];
                String scientificName = nextLine[1];

                executorService.submit(() -> fetchAndStoreData(scientificName, guid, data, vicFloraGraphqlUrl, vicFloraUrl));
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

    private static void fetchAndStoreData(String scientificName, String guid, Map<String, Object> data, String graphqlUrl, String taxonUrl) {
        try {
            String id = fetchIdFromGraphQL(scientificName, graphqlUrl);
            if (id != null) {
                String description = fetchDescriptionFromTaxon(id, taxonUrl);
                Map<String, String> taxonData = new ConcurrentHashMap<>();
                taxonData.put("Description", description);
                data.put(guid, taxonData);
                System.out.println("Found descriptions for: " + scientificName);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static String fetchIdFromGraphQL(String scientificName, String graphqlUrl) throws IOException {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPost request = new HttpPost(graphqlUrl);
            request.setHeader("Content-Type", "application/json");

            String query = "{ \"query\": \"query search($input: SearchInput) { search(input: $input) { docs { id } } }\", \"variables\": { \"input\": { \"q\": \"" + scientificName + "\" } } }";
            request.setEntity(new StringEntity(query));

            HttpResponse response = httpClient.execute(request);
            String responseBody = EntityUtils.toString(response.getEntity());

            ObjectMapper mapper = new ObjectMapper();
            JsonNode rootNode = mapper.readTree(responseBody);
            JsonNode docsNode = rootNode.path("data").path("search").path("docs");

            if (docsNode.isArray() && !docsNode.isEmpty()) {
                return docsNode.get(0).path("id").asText();
            } else {
                System.out.println("No ID found for: " + scientificName);
                return null; // No ID found
            }
        }
    }

    private static String fetchDescriptionFromTaxon(String id, String taxonUrl) throws IOException {
        String url = taxonUrl + id;
        Document doc = Jsoup.connect(url).get();
        Element descriptionElement = doc.select("div.description p").first();
        return descriptionElement != null ? descriptionElement.text() : "";
    }
}