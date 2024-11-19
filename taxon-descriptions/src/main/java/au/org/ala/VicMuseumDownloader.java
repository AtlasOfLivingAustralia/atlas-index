package au.org.ala;

import com.opencsv.exceptions.CsvValidationException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;

import java.io.*;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class VicMuseumDownloader {

    static List allSpecies = new ArrayList();

    public static Map<String, Object> downloadVicMuseum(String apiUrl) throws IOException, CsvValidationException {
        Map<String, Object> data = new ConcurrentHashMap<>();

        fetchAllSpecies(apiUrl);

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " records of type species: " + allSpecies.size());

        matchAllNames(data);

        return data;
    }

    private static void fetchAllSpecies(String apiUrl) {
        try {
            int pageSize = 100;
            int page = 1;
            boolean hasMore = true;
            while (hasMore) {
                String urlStr = apiUrl + "?perpage=" + pageSize + "&page=" + page;
                URL url = new URL(urlStr);

                System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " page: " + page + ", reading: " + allSpecies.size());

                // read the JSON data from the URL
                List thisList = (List) new ObjectMapper().createParser(url).readValueAs(List.class);

                allSpecies.addAll(thisList);

                page++;
                hasMore = thisList.size() == pageSize;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static List<String> namematchingService(List<Map<String, String>> batch) {
        List<String> matches = new ArrayList<>();
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
                        matches.add(node.path("taxonConceptID").asText());
                    } else {
                        matches.add("");
                    }
                }
            } else {
                System.out.println("namematching failed: " + json);
            }
        } catch (Exception e) {
            System.out.println("failed to get call namematching service");
            e.printStackTrace();
        }

        return matches;
    }

    static void matchAllNames(Map<String, Object> data) {
        List<Map<String, String>> batch = new ArrayList<>();
        List<String> batchResult = new ArrayList<>();

        // loop through all species to get all guids
        int count = 0; // this is just to double check that the namesearch result remains in sync
        for (Object item : allSpecies) {
            Map<String, Object> record = (Map<String, Object>) item;
            Map taxonomy = (Map) record.get("taxonomy");
            if (taxonomy == null) {
                continue;
            }

            String taxonName = (String) taxonomy.get("taxonName");
            String kingdom = (String) taxonomy.get("kingdom");
            String phylum = (String) taxonomy.get("phylum");
            String clazz = (String) taxonomy.get("class");
            String order = (String) taxonomy.get("order");
            String family = (String) taxonomy.get("family");
            String genus = (String) taxonomy.get("genus");

            Map<String, String> taxon = new HashMap<>();
            if (StringUtils.isNotEmpty(taxonName)) taxon.put("scientificName", taxonName);
            if (StringUtils.isNotEmpty(family)) taxon.put("family", family);
            if (StringUtils.isNotEmpty(kingdom)) taxon.put("kingdom", kingdom);
            if (StringUtils.isNotEmpty(phylum)) taxon.put("phylum", phylum);
            if (StringUtils.isNotEmpty(clazz)) taxon.put("clazz", clazz);
            if (StringUtils.isNotEmpty(order)) taxon.put("order", order);
            if (StringUtils.isNotEmpty(genus)) taxon.put("genus", genus);

            batch.add(taxon);
            count++;

            if (batch.size() == 1000) {
                batchResult.addAll(namematchingService(batch));
                batch.clear();
            }
        }

        if (!batch.isEmpty()) {
            batchResult.addAll(namematchingService(batch));
        }

        if (batchResult.size() != count) {
            System.out.println("ERROR batchResult size does not match allSpecies size");
            return;
        }

        // loop again to add the data
        count = 0; // for sync
        for (int i = 0; i < allSpecies.size(); i++) {
            Map<String, Object> record = (Map<String, Object>) allSpecies.get(i);
            Map taxonomy = (Map) record.get("taxonomy");
            if (taxonomy == null) {
                continue;
            }

            String guid = batchResult.get(count);
            count++;

            String taxonName = (String) taxonomy.get("taxonName");

            String generalDescription = (String) record.get("generalDescription"); // from config
            String biology = (String) record.get("biology"); // from config
            String habitat = (String) record.get("habitat"); // from config

            String pagePath = (String) record.get("id"); // currently working

            if (guid != null) {
                Map<String, String> taxonData = new ConcurrentHashMap<>();
                if (StringUtils.isNotEmpty(generalDescription))
                    taxonData.put("General Description", generalDescription);
                if (StringUtils.isNotEmpty(biology)) taxonData.put("Biology", biology);
                if (StringUtils.isNotEmpty(habitat)) taxonData.put("Habitat", habitat);

                if (!taxonData.isEmpty()) {
                    taxonData.put("url", FetchData.vicMuseumPageUrl + pagePath);
                    data.put(guid, taxonData);
                } else {
                    System.out.println("No fields, " + FetchData.vicMuseumPageUrl + pagePath);
                }
            } else {
                System.out.println("Failed to find guid for: " + taxonName + ", " + FetchData.vicMuseumPageUrl + pagePath);
            }
        }
    }
}
