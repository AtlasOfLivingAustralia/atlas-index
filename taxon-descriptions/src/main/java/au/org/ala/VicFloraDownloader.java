package au.org.ala;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.TextNode;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.StringReader;
import java.net.SocketTimeoutException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class VicFloraDownloader {
    static AtomicInteger withData = new AtomicInteger(0);
    static AtomicInteger found = new AtomicInteger(0);
    static AtomicInteger notFound = new AtomicInteger(0);
    static AtomicInteger counter = new AtomicInteger(0);
    static Map<String, String> vicFloraData = new ConcurrentHashMap<>();

    static String userAgent;

    static String tmpDir;

    public static Map<String, Object> downloadVicFlora(String vicFloraGraphqlUrl, String vicFloraUrl, String userAgent, String tmpDir) throws IOException, CsvValidationException {
        VicFloraDownloader.userAgent = userAgent;
        VicFloraDownloader.tmpDir = tmpDir;

        Map<String, Object> data = new ConcurrentHashMap<>();

        // Because this is a long running process, we need to store the data in a temporary file in case of failure and restart
        try (FileReader reader = new FileReader(tmpDir + "/vicflora-tmp.json")) {
            Map cache = new ObjectMapper().readValue(reader, Map.class);
            if (cache != null) {
                // TODO: this is temporary and for testing, remove it
                List<String> keys = new ArrayList<>(cache.keySet());
                for (String key : keys) {
                    Map taxonData = (Map) cache.get(key);
                    if (taxonData == null || taxonData.isEmpty() || StringUtils.isEmpty((String) taxonData.get("Treatment"))) {
                        cache.remove(key);
                    }
                }

                System.out.println("Resuming from cache: " + cache.size());
                data.putAll(cache);
            }
        } catch (IOException e) {
            // ignore
        }

        // Adjust the thread pool size as needed. Getting lots of timeouts so lowering expectations and implementing backoff.
        ExecutorService executorService = Executors.newFixedThreadPool(2);

        // download all accepted names from VicFlora
        try {
            getTaxonList(vicFloraGraphqlUrl);
        } catch (Exception e) {
            System.out.println("failed to download accepted names from VicFlora");
            e.printStackTrace();
        }

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " found: " + found.get() + ", not found: " + notFound.get() + ", unique: " + vicFloraData.size());

        for (Map.Entry<String, String> entry : vicFloraData.entrySet()) {
            String vicFloraID = entry.getKey();
            String taxonConceptID = entry.getValue();
            executorService.submit(() -> fetchAndStoreData(vicFloraID, taxonConceptID, data, vicFloraUrl));
        }

        executorService.shutdown();
        try {
            executorService.awaitTermination(100, TimeUnit.DAYS);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        // write to cache file, including items that have no data
        try (FileWriter writer = new FileWriter(tmpDir + "/vicflora-tmp.json")) {
            new ObjectMapper().writeValue(writer, data);
        } catch (IOException e) {
            e.printStackTrace();
        }

        // remove empty entries
        List<String> keys = new ArrayList<>(data.keySet());
        for (String key : keys) {
            Map taxonData = (Map) data.get(key);
            if (taxonData == null || taxonData.isEmpty() || StringUtils.isEmpty((String) taxonData.get("Treatment"))) {
                data.remove(key);
            }
        }

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + "finished processed: " + counter.get() + " of " + vicFloraData.size() + ", withData: " + withData.get());

        return data;
    }

    private static void fetchAndStoreData(String vicFloraID, String taxonID, Map<String, Object> data, String taxonUrl) {
        try {
            if (counter.incrementAndGet() % 100 == 0) {
                System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " processed: " + counter.get() + " of " + vicFloraData.size() + ", withData: " + withData.get());

                // flush to temporary file every 100 records
                try (FileWriter writer = new FileWriter(tmpDir + "/vicflora-tmp.json")) {
                    new ObjectMapper().writeValue(writer, data);
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }

            // check cache
            if (data.containsKey(taxonID)) {
                withData.incrementAndGet();
                return;
            }

            String description = fetchDescriptionFromTaxon(vicFloraID, taxonUrl);
            if (StringUtils.isNotEmpty(description)) {
                Map<String, String> taxonData = new ConcurrentHashMap<>();
                taxonData.put("Treatment", description); // "Treatment" is from config
                data.put(taxonID, taxonData);
                withData.incrementAndGet();
            } else {
                // only needed for the caching thing, they are removed later
                Map<String, String> taxonData = new ConcurrentHashMap<>();
                taxonData.put("Treatment", ""); // "Treatment" is from config
                data.put(taxonID, taxonData);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // This is the first tab labeled "Treatment", as required in the config
    // Needed aggressive retry logic due to frequent timeouts
    private static String fetchDescriptionFromTaxon(String id, String taxonUrl) throws IOException {
        String url = taxonUrl + id;
        try {
            Document doc = Jsoup.connect(url).timeout(60000).get(); // 60s timeout

            // TODO: Write to a file for caching, that it takes so long to retrieve the information
            //  and because what we retrieve may change.
            //  Currently getting only the first paragraph of the description div as text, but there
            //  are other elements that may be useful such as "notes",
            //  e.g. https://vicflora.rbg.vic.gov.au/flora/taxon/c7a3dfe9-ec14-4a51-923d-b93162b32a27
            //  and there may be other descriptions that have html formatting making .text() unsuitable.

            Element descriptionElement = doc.select("div.description p").first();

            return descriptionElement != null ? descriptionElement.text() : null;
        } catch (SocketTimeoutException e) {
            System.out.println("WARN timeout (when many repeats for the same URL something is wrong) " + url);
            // sleep for a bit and retry
            try {
                Thread.sleep(5000);
                return fetchDescriptionFromTaxon(id, taxonUrl);
            } catch (InterruptedException ex) {
                ex.printStackTrace();
            }
        } catch (HttpStatusException e) {
            System.out.println("WARN gateway timeout (when many repeats for the same URL something is wrong) " + url);
            // sleep for a bit and retry
            try {
                Thread.sleep(5000);
                return fetchDescriptionFromTaxon(id, taxonUrl);
            } catch (InterruptedException ex) {
                ex.printStackTrace();
            }
        } catch (Exception e) {
            System.out.println("ERROR other error fetching description from VicFlora: " + url + ", " + e.getMessage());
            throw e;
        }

        return null;
    }

    /*
     * Download all accepted names from VicFlora.
     *
     * There are currently 8739 names and while it appears the API will cap the result at 12000, this is fine for now.
     *
     * The result will include some hierarchy information so a name search can be done to the ALA taxonID.
     *
     */
    static void getTaxonList(String graphqlUrl) throws IOException, CsvValidationException {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPost request = new HttpPost(graphqlUrl);
            request.setHeader("Content-Type", "application/json");
            request.setHeader("User-Agent", userAgent);

            String query = "{\"operationName\":\"DownloadSearchResult\",\"variables\":{\"input\":{\"q\":\"*\",\"fl\":[\"id\",\"scientific_name\",\"scientific_name_authorship\",\"taxon_rank\",\"family\",\"kingdom\",\"phylum\",\"class\",\"order\",\"genus\"],\"fq\":[\"taxonomic_status:accepted\"]}},\"query\":\"query DownloadSearchResult($input: DownloadInput) {\\n  download(input: $input) {\\n    data\\n    __typename\\n  }\\n}\\n\"}";
            request.setEntity(new StringEntity(query));

            HttpResponse response = httpClient.execute(request);
            String responseBody = EntityUtils.toString(response.getEntity());

            ObjectMapper mapper = new ObjectMapper();
            JsonNode rootNode = mapper.readTree(responseBody);
            JsonNode dataNode = rootNode.path("data").path("download").path("data");

            if (dataNode instanceof TextNode) {
                // this is CSV content
                String csv = ((TextNode) dataNode).asText();

                try (CSVReader reader = new CSVReader(new StringReader(csv))) {
                    reader.readNext(); // Skip header

                    // column order is
                    // id, scientific_name, scientific_name_authorship, taxon_rank, family, kingdom, phylum, class, order, genus

                    // build batches of 1000 names for lookup with namematching service
                    int batchSize = 1000;
                    List<Map<String, String>> batch = new ArrayList<>();
                    List<String> batchIds = new ArrayList<>();

                    String[] nextLine;
                    while ((nextLine = reader.readNext()) != null) {
                        String id = nextLine[0];
                        String scientificName = nextLine[1];
                        String author = nextLine[2];
                        String rank = nextLine[3];
                        String family = nextLine[4];
                        String kingdom = nextLine[5];
                        String phylum = nextLine[6];
                        String classs = nextLine[7];
                        String order = nextLine[8];
                        String genus = nextLine[9];

                        Map<String, String> taxon = new HashMap<>();
                        if (StringUtils.isNotEmpty(scientificName)) taxon.put("scientificName", scientificName);
                        if (StringUtils.isNotEmpty(rank)) taxon.put("rank", rank);
                        if (StringUtils.isNotEmpty(family)) taxon.put("family", family);
                        if (StringUtils.isNotEmpty(kingdom)) taxon.put("kingdom", kingdom);
                        if (StringUtils.isNotEmpty(phylum)) taxon.put("phylum", phylum);
                        if (StringUtils.isNotEmpty(classs)) taxon.put("clazz", classs);
                        if (StringUtils.isNotEmpty(order)) taxon.put("order", order);
                        if (StringUtils.isNotEmpty(genus)) taxon.put("genus", genus);

                        batch.add(taxon);
                        batchIds.add(id);

                        if (batch.size() == batchSize) {
                            namematchingService(batch, batchIds);
                            batch.clear();
                            batchIds.clear();
                        }
                    }

                    if (!batch.isEmpty()) {
                        namematchingService(batch, batchIds);
                        batch.clear();
                        batchIds.clear();
                    }
                } catch (IOException e) {
                    System.out.println("ERROR failed to download accepted names from VicFlora");
                    e.printStackTrace();
                }
            } else {
                System.out.println("ERROR failed to download accepted names from VicFlora");
            }
        } catch (IOException e) {
            System.out.println("ERROR ailed to get call namematching service");
            e.printStackTrace();
        }
    }

    private static void namematchingService(List<Map<String, String>> batch, List<String> batchIds) {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            // TODO: this really should be in the external config
            HttpPost request = new HttpPost("https://namematching-ws.ala.org.au/api/searchAllByClassification");
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
                            vicFloraData.put(batchIds.get(i), taxonConceptID);
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
