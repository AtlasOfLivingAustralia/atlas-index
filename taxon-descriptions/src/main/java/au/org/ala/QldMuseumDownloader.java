package au.org.ala;

import com.opencsv.exceptions.CsvValidationException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class QldMuseumDownloader {

    static Set<String> allTopics = new HashSet<>();
    static String topicUrl;

    public static Map<String, Object> downloadQldMuseum(String acceptedCsv, String apiUrl, String apiKey, String topicUrl) throws IOException, CsvValidationException {
        QldMuseumDownloader.topicUrl = topicUrl;

        Map<String, Object> data = new ConcurrentHashMap<>();
        ExecutorService executorService = Executors.newFixedThreadPool(5); // Adjust the thread pool size as needed

        fetchAllTopics(apiUrl, apiKey);

        for (String topic : allTopics) {
            executorService.submit(() -> fetchOpacTopicDetails(topic, data, apiUrl, apiKey));
        }

        executorService.shutdown();
        try {
            executorService.awaitTermination(100, TimeUnit.DAYS);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        return data;
    }

    private static void fetchAllTopics(String apiUrl, String apiKey) {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            boolean hasMore = true;
            int offset = 0;
            int pageSize = 100; // maximum page size
            while (hasMore) {
                String urlStr = apiUrl + "opactopics?limit=" + pageSize + "&offset=" + offset;
                HttpGet request = new HttpGet(urlStr);
                request.setHeader("Authorization", "Basic " + apiKey);

                offset += pageSize;
                hasMore = false;

                HttpResponse response = httpClient.execute(request);
                int responseCode = response.getStatusLine().getStatusCode();
                if (responseCode == 200) {
                    String responseBody = EntityUtils.toString(response.getEntity());
                    ObjectMapper mapper = new ObjectMapper();
                    JsonNode rootNode = mapper.readTree(responseBody);
                    if (rootNode.has("opacTopics") && !rootNode.get("opacTopics").isEmpty()) {
                        hasMore = rootNode.get("opacTopics").size() == pageSize;

                        for (int i = 0; i < rootNode.get("opacTopics").size(); i++) {
                            String opacTopicId = rootNode.get("opacTopics").get(i).path("opacTopicId").asText();

                            // do not add duplicates
                            if (!allTopics.contains(opacTopicId)) {
                                allTopics.add(opacTopicId);
                            } else {
                                // The code should never reach here, but it does, and I do not know why.
                                //  The services response says there are 433 topics but there were only 402 unique
                                //  topics observed when testing.
                            }
                        }
                    }
                } else {
                    System.out.println("Failed to fetch data for offset: " + offset);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static void fetchOpacTopicDetails(String opacTopicId, Map<String, Object> data, String apiUrl, String apiKey) {
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
                String habitatAndRange = "";
                String habitat = "";
                String description = "";
                String scientificName = "";
                String features = "";

                for (JsonNode fieldSet : rootNode.path("opacTopicFieldSets")) {
                    if (fieldSet.path("identifier").asText().equals("description")) {
                        for (JsonNode field : fieldSet.path("opacTopicFields")) {
                            //String markdown = field.path("value").asText();

                            // get html content
                            try {
                                for (JsonNode attr : field.path("opacTopicFieldAttributes")) {
                                    //"key": "markdown_to_html",
                                    if (attr.path("key").asText().equals("markdown_to_html")) {
                                        String htmlValue = attr.path("value").asText();

                                        // build dom
                                        Document doc = Jsoup.parse(htmlValue);

                                        // first h2 is the scientific name
                                        if (doc.select("h1").first() != null) {
                                            scientificName = doc.select("h1").first().text();
                                        } else if (doc.select("h2").first() != null) {
                                            scientificName = doc.select("h2").first().text();
                                        } else {
                                            break;
                                        }

                                        // iterate through the p tags
                                        for (int i = 0; i < doc.select("p").size(); i++) {
                                            Element p = doc.select("p").get(i);

                                            if (p.select("strong").isEmpty()) {
                                                // if no strong tag then this content has no title, continue
                                                continue;
                                            }

                                            String title = p.select("strong").first().text();

                                            // remove the title
                                            p.select("strong").first().remove();

                                            // fetch the contents as html
                                            if (title.toLowerCase().contains("identification:")) { // name is from config
                                                identification = p.html();
                                            } else if (title.toLowerCase().contains("habitat and range:")) { // name is from config
                                                habitatAndRange = p.html();
                                            } else if (title.toLowerCase().contains("habitat:")) { // name is from config
                                                habitat = p.html();
                                            } else if (title.toLowerCase().contains("features:")) { // name is from config
                                                features = p.html();
                                            } else {
                                                // track other titles, if needed
                                                //System.out.println("Found other title: " + title);
                                            }
                                        }

                                        // if nothing was found, then the first p tag is the description
                                        if (StringUtils.isEmpty(identification)
                                                && StringUtils.isEmpty(habitatAndRange)
                                                && StringUtils.isEmpty(habitat)
                                                && doc.select("p").first() != null) {
                                            // exclude the description when it has a strong element because it might be a title
                                            String strong = doc.select("p").first().select("strong").text();
                                            if (StringUtils.isEmpty(strong)) {
                                                description = doc.select("p").first().html();
                                            }
                                        }
                                    }
                                }
                            } catch (Exception e) {
                                System.out.println("Failed to parse html for opacTopicId: " + opacTopicId);
                                e.printStackTrace();
                            }
                        }
                    }
                }

                String guid = lookupGuidForScientificName(scientificName);

                if (StringUtils.isNotEmpty(guid)) {
                    Map<String, String> taxonData = new ConcurrentHashMap<>();
                    if (StringUtils.isNotEmpty(identification))
                        taxonData.put("Identification", identification);  // name is from config
                    if (StringUtils.isNotEmpty(habitatAndRange))
                        taxonData.put("Habitat and Range", habitatAndRange);  // name is from config
                    if (StringUtils.isNotEmpty(habitat)) taxonData.put("Habitat", habitat);  // name is from config
                    if (StringUtils.isNotEmpty(description))
                        taxonData.put("Description", description);  // name is from config
                    if (StringUtils.isNotEmpty(features)) taxonData.put("Features", features);  // name is from config

                    if (!taxonData.isEmpty()) {
                        taxonData.put("url", topicUrl + opacTopicId);

                        data.put(guid, taxonData);
                    } else {
                        System.out.println("No fields, " + topicUrl + opacTopicId);
                    }
                } else {
                    System.out.println("Failed to find guid for scientific name: " + scientificName + ", " + topicUrl + opacTopicId);
                }

            } else {
                System.out.println("Failed to fetch details for opacTopicId: " + opacTopicId);
            }
        } catch (Exception e) {
            System.out.println("Failed to fetch details for opacTopicId: " + opacTopicId);
            e.printStackTrace();
        }
    }

    static public String lookupGuidForScientificName(String scientificName) {
        if (StringUtils.isEmpty(scientificName)) {
            return null;
        }

        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpGet request = new HttpGet(FetchData.namematchingUrl + "/api/searchByClassification?scientificName=" + URLEncoder.encode(scientificName, StandardCharsets.UTF_8));

            HttpResponse response = httpClient.execute(request);
            String responseBody = EntityUtils.toString(response.getEntity());

            ObjectMapper responseMapper = new ObjectMapper();
            JsonNode rootNode = responseMapper.readTree(responseBody);

            if (!rootNode.isEmpty()) {
                String success = rootNode.path("success").asText();
                if ("true".equals(success)) {
                    return rootNode.path("taxonConceptID").asText();
                }
            } else {
                System.out.println("namematching failed: " + scientificName);
            }
        } catch (Exception e) {
            System.out.println("failed to get call namematching service");
            e.printStackTrace();
        }

        return null;
    }
}
