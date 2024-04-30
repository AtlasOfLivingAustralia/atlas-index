package au.org.ala;

import au.org.ala.names.ws.ALANameMatchingServiceConfiguration;
import au.org.ala.names.ws.api.NameSearch;
import au.org.ala.names.ws.api.NameUsageMatch;
import au.org.ala.names.ws.core.NameSearchConfiguration;
import au.org.ala.names.ws.resources.NameSearchResource;
import com.opencsv.CSVWriter;
import io.dropwizard.Application;
import io.dropwizard.setup.Bootstrap;
import io.dropwizard.setup.Environment;
import org.apache.lucene.document.Document;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.store.FSDirectory;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.Set;

public class ExtractApplication extends Application<ALANameMatchingServiceConfiguration> {

    static String lucenePath = "/data/lucene/namematching-20230725-5/";

    /**
     * Parameters
     * - One of "server", "check" (dropwizard parameter)
     * - Path to extracted lucene names index. e.g. /data/lucene/namematching-20230725-5/
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


        System.out.println("FINISHED");

        throw new RuntimeException("FINISHED");
    }
}
