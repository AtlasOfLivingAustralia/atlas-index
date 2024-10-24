package au.org.ala;

import au.org.ala.names.ws.ALANameMatchingServiceConfiguration;
import au.org.ala.names.ws.api.NameSearch;
import au.org.ala.names.ws.api.NameUsageMatch;
import au.org.ala.names.ws.core.NameSearchConfiguration;
import au.org.ala.names.ws.resources.NameSearchResource;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVWriter;
import io.dropwizard.Application;
import io.dropwizard.setup.Bootstrap;
import io.dropwizard.setup.Environment;
import org.apache.commons.lang3.StringUtils;
import org.apache.lucene.document.Document;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.store.FSDirectory;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class ExtractApplication extends Application<ALANameMatchingServiceConfiguration> {

    static String lucenePath = "/data/lucene/namematching-20230725-5/";

    /**
     * Parameters
     * - One of "server", "check" (dropwizard parameter) as a command line argument.
     * - Path to extracted lucene names index "lucene.dir" as a property. e.g. /data/lucene/namematching-20230725-5/
     *
     * @param args
     * @throws IOException
     */
    public static void main(final String[] args) throws Exception {
        lucenePath = System.getProperties().getProperty("lucene.dir");
        System.out.println("lucene.dir:" + lucenePath);
        new ExtractApplication().run(args);
    }

    @Override
    public String getName() {
        return "Extract";
    }

    @Override
    public void initialize(final Bootstrap<ALANameMatchingServiceConfiguration> bootstrap) {
    }

    @Override
    public void run(final ALANameMatchingServiceConfiguration configuration,
                    final Environment environment) {
        NameSearchConfiguration config = configuration.getSearch();

        config.setIndex(lucenePath);

        final NameSearchResource resource = new NameSearchResource(configuration.getSearch());

        // left right export; lsid, left, right
        System.out.println("START LEFT-RIGHT CSV");
        try {
            // get a set of ids
            IndexReader reader = DirectoryReader.open(FSDirectory.open(Paths.get(lucenePath + File.separator + "cb")));
            CSVWriter writer = new CSVWriter(new FileWriter("lsid-left-right.csv"));
            for (int i = 0; i < reader.numDocs(); i++) {
                Document doc = reader.document(i);
                writer.writeNext(new String[] { doc.get("lsid"), doc.get("left"), doc.get("right")});
            }

            writer.flush();
            writer.close();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        // preferred common name export; lsid, common name
        System.out.println("START VERNACULAR CSV");
        try {
            // get a set of ids
            IndexReader reader = DirectoryReader.open(FSDirectory.open(Paths.get(lucenePath + File.separator + "vernacular")));
            Set<String> vernacularLsids = new HashSet<>(reader.numDocs());
            for (int i = 0; i < reader.numDocs(); i++) {
                Document doc = reader.document(i);
                vernacularLsids.add(doc.get("lsid"));
            }

            CSVWriter writer = new CSVWriter(new FileWriter("lsid-vernacularName.csv"));

            // get the common name for each id
            for (String lsid : vernacularLsids) {
                NameUsageMatch result = resource.match(NameSearch.builder().taxonConceptID(lsid).build());

                if (!result.getTaxonConceptID().equals(lsid)) {
                    // there were only 2 records where this was the case, include them
                    writer.writeNext(new String[] { result.getTaxonConceptID(), result.getVernacularName() });
                }

                writer.writeNext(new String[] { lsid, result.getVernacularName() });
            }

            writer.flush();
            writer.close();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        // speciesGroup export; lsid, list of species groups
        System.out.println("START SPECIES GROUP CSV");
        ObjectMapper om = new ObjectMapper();
        try {
            // get a set of ids
            IndexReader reader = DirectoryReader.open(FSDirectory.open(Paths.get(lucenePath + File.separator + "cb")));
            Set<String> taxonLsids = new HashSet<>(reader.numDocs());
            for (int i = 0; i < reader.numDocs(); i++) {
                Document doc = reader.document(i);
                taxonLsids.add(doc.get("lsid"));
            }

            CSVWriter writer = new CSVWriter(new FileWriter("lsid-speciesGroups.csv"));

            // get the common name for each id
            for (String lsid : taxonLsids) {
                NameUsageMatch result = resource.match(NameSearch.builder().taxonConceptID(lsid).build());

                if (!result.getTaxonConceptID().equals(lsid)) {
                    // there were only 2 records where this was the case, include them
                    List<String> speciesGroup = result.getSpeciesGroup();
                    if (speciesGroup != null && !speciesGroup.isEmpty()) {
                        writer.writeNext(new String[] { result.getTaxonConceptID(), om.writeValueAsString(speciesGroup) });

                        // TODO: uncomment when testing elasticsearch vs namematching service
                        //compare(result.getTaxonConceptID(), speciesGroup);
                    }
                }

                List<String> speciesGroup = result.getSpeciesGroup();
                if (speciesGroup != null && !speciesGroup.isEmpty()) {
                    writer.writeNext(new String[] { lsid, om.writeValueAsString(speciesGroup) });

                    // TODO: uncomment when testing elasticsearch vs namematching service
                    //compare(result.getTaxonConceptID(), speciesGroup);
                }
            }

            writer.flush();
            writer.close();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        System.out.println("FINISHED");

        throw new RuntimeException("FINISHED");
    }

    /**
     * This function serves as a comparison between namematching-ws output and search-service (Elasticsearch) output.
     *
     * The contents should be the same.
     *
     * Differences noted:
     * - namematching-ws will do an additional name search, e.g. "Protozoa" is not the actual kingdom name, it is
     *   "PROTISTA"
     * - namematching-ws does an undocumented search to match "class:Agnatha" with Fishes, because the names index
     *   actually contains "informal:Agnatha". One workaround would be to have a 2nd Fishes group in the
     *   speciesGroups.json where the rank is "informal" and the "include" has "Agnatha".
     *
     * @param lsid
     * @param speciesGroup
     */
    private void compare(String lsid, List<String> speciesGroup) {
        try {
            // TODO: when testing speciesGroups, use the correct URL for elasticsearch
            URL url = new URL("http://localhost:9200/search-20241014/_search");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();

            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            connection.setDoOutput(true);

            // JSON payload
            String jsonInputString = "{"
                    + "\"_source\": [\"speciesGroup\"],"
                    + "\"query\": {"
                        + "\"bool\": {"
                            + "\"must\": ["
                                + "{ \"match\": { \"idxtype\": \"TAXON\" } },"
                                + "{ \"match\": { \"guid\": \"" + lsid + "\" } }"
                            + "]"
                        + "}"
                    + "}"
                + "}";

            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = jsonInputString.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = connection.getResponseCode();

            // write response to a string
            StringBuilder response = new StringBuilder();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                String responseLine = null;
                while ((responseLine = br.readLine()) != null) {
//                    System.out.println(responseLine);
                    response.append(responseLine.trim());
                }
            }

            // compare the speciesGroup
            ObjectMapper om = new ObjectMapper();
            Map result = om.readValue(response.toString(), Map.class);

            List hits = (List) ((Map) result.get("hits")).get("hits");
            if (hits.size() == 1) {
                Map hit = (Map) hits.get(0);
                Map source = (Map) hit.get("_source");
                List<String> sourceSpeciesGroup = (List<String>) source.get("speciesGroup");

                if (sourceSpeciesGroup == null) {
                    System.out.println("No speciesGroup: " + lsid + ", expected: " + StringUtils.join(speciesGroup, ", "));
                    return;
                }

                int found = 0;
                for (String sg : speciesGroup) {
                    if (sourceSpeciesGroup.contains(sg)) {
                        found++;
                    }
                }

                if (found != speciesGroup.size()) {
                    System.out.println("Mismatch: " + lsid + " expected:" + StringUtils.join(speciesGroup, ", ") + " elastic:" + StringUtils.join(sourceSpeciesGroup, ", "));
                }
            } else if (hits.size() > 1) {
                System.out.println("Multiple hits: " + lsid);
            } else {
                System.out.println("No hits: " + lsid + ", expected: " + StringUtils.join(speciesGroup, ", "));
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

    }
}
