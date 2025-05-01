package au.org.ala;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class NamematchingUtil {

    static public String lookupGuidForScientificName(String scientificName, String genus) {
        if (StringUtils.isEmpty(scientificName)) {
            return null;
        }

        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            String genusTerm = StringUtils.isNotEmpty(genus) ? "&genus=" + URLEncoder.encode(genus, StandardCharsets.UTF_8) : "";
            HttpGet request = new HttpGet(FetchData.namematchingUrl + "/api/searchByClassification?scientificName=" + URLEncoder.encode(scientificName, StandardCharsets.UTF_8) + genusTerm);

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

    public static void namematchingService(List<Map<String, String>> batch, List<String> batchIds,
                                           Map<String, String> output, AtomicInteger found, AtomicInteger notFound) {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPost request = new HttpPost(FetchData.namematchingUrl + "/api/searchAllByClassification");
            request.setHeader("Content-Type", "application/json");

            ObjectMapper mapper = new ObjectMapper();
            String json = mapper.writeValueAsString(batch);
            request.setEntity(new StringEntity(json, "UTF-8"));

            HttpResponse response = httpClient.execute(request);
            String responseBody = EntityUtils.toString(response.getEntity());

            ObjectMapper responseMapper = new ObjectMapper();
            JsonNode rootNode = responseMapper.readTree(responseBody);

            if (rootNode.isArray() && !rootNode.isEmpty()) {
                for (int i = 0; i < rootNode.size(); i++) {
                    JsonNode node = rootNode.get(i);
                    String success = node.path("success").asText();
                    if ("true".equals(success)) {
                        String taxonConceptID = node.path("taxonConceptID").asText();
                        if (StringUtils.isNotEmpty(taxonConceptID)) {
                            output.put(batchIds.get(i), taxonConceptID);
                            found.incrementAndGet();
                        } else {
                            notFound.incrementAndGet();
                        }
                    } else {
                        notFound.incrementAndGet();
                    }
                }
            } else {
                System.out.println("namematching failed: " + json);
            }
        } catch (Exception e) {
            System.out.println("failed to get call namematching service");
            e.printStackTrace();
        }
    }
}
