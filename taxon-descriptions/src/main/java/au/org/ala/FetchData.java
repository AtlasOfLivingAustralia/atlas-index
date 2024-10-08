package au.org.ala;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVReader;
import com.opencsv.CSVWriter;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Attribute;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.xml.sax.SAXException;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.file.Paths;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static java.nio.file.Files.readString;

public class FetchData {

    static String alaToken;
    static String profilesUrl;
    static int profilesThreads;
    static String wikipediaUrl;
    static String wikipediaTitles;
    static String wikipediaTmp;
    static String acceptedCsv;
    static String wikipediaUserAgent;
    static String listsUrl;
    static String mergeDir;
    static String overrideFile;

    static Map<String, Map<String, String>> properties = new ConcurrentHashMap<>();

    public static void main(final String[] args) throws Exception {

        String configFile = "/data/src/ansible-inventories/atlas-index/local/taxon-descriptions/config.json"; //args[0];
        String filename = "merge"; //args[1];

        Map config = new ObjectMapper().readValue(new File(configFile), Map.class);

        String tokenFile = config.get("alaToken").toString();
        alaToken = readString(Paths.get(tokenFile)).strip().trim();

        profilesUrl = config.get("profilesUrl").toString();
        profilesThreads = Integer.parseInt(config.get("profilesThreads").toString());

        wikipediaUrl = config.get("wikipediaUrl").toString();
        wikipediaTitles = config.get("wikipediaTitles").toString();
        wikipediaTmp = config.get("wikipediaTmp").toString();
        wikipediaUserAgent = config.get("wikipediaUserAgent").toString().trim();

        listsUrl = config.get("listsUrl").toString();

        overrideFile = config.get("overrideFile").toString();

        if (StringUtils.isEmpty(wikipediaUserAgent)) {
            System.out.println("wikipediaUserAgent is not set in config.json, see https://www.mediawiki.org/wiki/Wikimedia_REST_API#Terms_and_conditions");
        }

        acceptedCsv = config.get("acceptedCsv").toString();

        mergeDir = config.get("mergeDir").toString();

        List sources = (List) config.get("sources");

        if (filename.equalsIgnoreCase("merge")) {
            Merge merge = new Merge(wikipediaUrl, wikipediaTmp, acceptedCsv, mergeDir, overrideFile);
            merge.mergeSources(sources);
            System.out.println("finished merge");
            return;
        }

        Map<String, Object> item = null;

        int orderIdx = 0;
        for (; orderIdx < sources.size(); orderIdx++) {
            Map source = (Map) sources.get(orderIdx);
            String srcFilename = source.get("filename").toString();

            if (srcFilename.equalsIgnoreCase(filename)) {
                item = source;
                break;
            }
        }

        if (item == null) {
            System.out.println("No source found for " + filename);
            return;
        }

        String type = item.get("type").toString();
        List<String> fields = (List<String>) item.get("fields");
        String name = item.get("name").toString();
        String attribution = item.get("attribution").toString();
        String id = (String) item.get("id");

        Map output = new HashMap();
        output.put("name", name);
        output.put("attribution", attribution);
        output.put("created", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").format(new Date()));
        output.put("filename", filename + ".json");
        output.put("order", orderIdx);

        if (type.equalsIgnoreCase("profiles")) {
            output.put("taxa", downloadProfiles(id, fields, name, attribution));
        } else if (type.equalsIgnoreCase("species-list")) {
            output.put("taxa", downloadSpeciesList(id, fields, name, attribution));
        } else if (type.equalsIgnoreCase("wikipedia")) {
            downloadWikipedia(fields, name, attribution);

            // wikipedia data does not get aggregated into a single .json file
            return;
        }

        // write the output to a file
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Writing output to " + filename + ".json");
        try (FileWriter file = new FileWriter(wikipediaTmp + "/" + filename + ".json")) {
            file.write(new ObjectMapper().writeValueAsString(output));
        }
    }

    private static Map<String, Object> downloadProfiles(String id, List<String> fields, String name, String attribution) throws IOException {
        Map taxa = new HashMap();

        List<AtomicInteger> fieldCounts = new ArrayList<>(fields.size());
        for (int i = 0; i < fields.size(); i++) {
            fieldCounts.add(new AtomicInteger(0));
        }

        int max = 500; // maximum number of profiles to fetch in one go, this is at or below the internal profiles limit
        int offset = 0;
        boolean hasMore = true;
        int speciesCount = 0;
        Set<String> alreadySeen = new HashSet<>();
        int seenCount = 0;

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Get list of taxa in opus: " + id);

        List list = new ArrayList();
        while (hasMore) {
            String response = alaGet(profilesUrl + "/api/opus/" + id + "/profile?pageSize=" + max + "&startIndex=" + offset);
            List thisList = (List) new ObjectMapper().createParser(response).readValueAs(List.class);
            list.addAll(thisList);

            hasMore = thisList.size() == max;
            offset += max;
        }

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Start fetching each profile for " + id + " (" + list.size() + " taxa): " + name);

        long start = System.nanoTime();
        ExecutorService executorService = Executors.newFixedThreadPool(profilesThreads);

        for (Object item : list) {
            String guid = (String) ((Map) item).get("guid");
            if (StringUtils.isEmpty(guid)) {
                continue;
            }

            if (alreadySeen.contains(guid)) {
                seenCount++;
                continue;
            }

            speciesCount++;

            executorService.submit(new GetProfileRunnable(id, (Map) item, fields, fieldCounts, properties));
        }

        executorService.shutdown();
        try {
            executorService.awaitTermination(100, TimeUnit.DAYS);
        } catch (InterruptedException e) {
            System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Error waiting for description import service to finish: " + e.getMessage());
        }

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " total time " + id + " (" + speciesCount + "): " + (System.nanoTime() - start) / 1000000 + "ms");

        // log the field counts, for debugging the config
        String fieldCountStr = "";
        for (int i = 0; i < fields.size(); i++) {
            fieldCountStr += fields.get(i) + "=" + fieldCounts.get(i).get() + ", ";
        }
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " profiles: " + list.size() + ", guids: " + speciesCount + ", duplicates skipped: " + seenCount + ", field counts: " + fieldCountStr);

        taxa.putAll(properties);
        return taxa;
    }

    private static Map<String, Object> downloadSpeciesList(String id, List<String> fields, String name, String attribution) throws IOException {
        Map taxa = new HashMap();

        // page through a species list kvp
        int max = 500;
        int offset = 0;
        boolean hasMore = true;
        while (hasMore) {
            // get a list of all species lists from lists.ala.org.au/ws/speciesListItems
            String response = alaGet(listsUrl + "/ws/speciesListItems/" + id + "?includeKVP=true&max=" + max + "&offset=" + offset);
            offset += max;

            List list = (List) new ObjectMapper().createParser(response).readValueAs(List.class);

            hasMore = (list.size() == max);

            for (Object item : list) {
                String guid = (String) ((Map) item).get("lsid");
                if (StringUtils.isEmpty(guid)) {
                    continue;
                }

                Map<String, String> doc = new HashMap<>();

                List kvpValues = (List) ((Map) item).get("kvpValues");
                if (kvpValues != null) {
                    for (Object kvp : kvpValues) {
                        for (String field : fields) {
                            if (field.equalsIgnoreCase(((Map) kvp).get("key").toString())) {
                                Object value = ((Map) kvp).get("value");
                                if (value != null) {
                                    doc.put(field, value.toString());
                                }
                            }
                        }
                    }
                }

                doc.put("url", listsUrl + "/speciesListItem/list/" + id);

                for (String field : fields) {
                    Object value = ((Map) item).get(field);
                    if (value != null) {
                        doc.put(field, value.toString());
                    }
                }

                taxa.put(guid, doc);
            }
        }

        return taxa;
    }

    static List<String> getWikiTitles() throws IOException {

        List<String> titles = new ArrayList<>();

        BufferedReader br = new BufferedReader(new FileReader(wikipediaTitles));
        String line;
        while ((line = br.readLine()) != null) {
            titles.add(line.trim());
        }

        br.close();

        return titles;
    }

    private static Map<String, Object> downloadWikipedia(List<String> fields, String name, String attribution) throws IOException, SAXException, CsvValidationException {
        Map taxa = new HashMap();

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " matching wikipedia titles to accepted taxa");

        // create matchedFile
        File matchedFile = new File(wikipediaTmp + "/matched.csv");
        if (!matchedFile.exists()) {
            createWikipediaMatchedFile(matchedFile);
        }

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " finished creating matched file: " + matchedFile.getPath());

        // get a list of all previously downloaded files, recursively through directories, one level deep
        Map<String, File> existingFiles = new HashMap<>();
        File[] files = new File(wikipediaTmp).listFiles();
        for (File file : files) {
            if (file.getName().endsWith(".html")) {
                existingFiles.put(file.getName().replace(".html", ""), file);
            } else if (file.isDirectory()) {
                File[] subFiles = file.listFiles();
                for (File subFile : subFiles) {
                    if (subFile.getName().endsWith(".html")) {
                        existingFiles.put(subFile.getName().replace(".html", ""), subFile);
                    }
                }
            }
        }

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " existing html cached: " + existingFiles.size());

        // https://www.mediawiki.org/wiki/Wikimedia_REST_API#Terms_and_conditions says 200/s, but 10 concurrent should be sufficient
        ExecutorService executorService = Executors.newFixedThreadPool(profilesThreads);

        // cache matchedFiles
        CSVReader reader = new CSVReader(new FileReader(matchedFile));
        String[] nextLine;
        int row = 0;
        int alreadyCached = 0;
        while ((nextLine = reader.readNext()) != null) {
            row++;
            String guid = nextLine[0];
            String wikiTitle = nextLine[1];
            String genus = nextLine[2];
            String family = nextLine[3];
            String order = nextLine[4];
            String clazz = nextLine[5];
            String phylum = nextLine[6];
            String kingdom = nextLine[7];

            String filename = URLEncoder.encode(guid);

            // if the file already exists, skip
            if (existingFiles.containsKey(filename)) {
                alreadyCached++;
                continue;
            }

            // the initial limit of each cache dir is 1000 files
            String dir = "cache_" + (row / 1000);
            String outputFile = wikipediaTmp + "/" + dir + "/" + filename + ".html";

            File dirFile = new File(wikipediaTmp + "/" + dir);
            if (!dirFile.exists()) {
                dirFile.mkdir();
            }

            executorService.submit(new CacheWikipediaRunnable(wikiTitle, new File(outputFile)));

            existingFiles.put(filename, new File(outputFile));
        }
        reader.close();

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " number matched: " + row);
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " already cached: " + alreadyCached);

        executorService.shutdown();
        try {
            executorService.awaitTermination(100, TimeUnit.DAYS);
        } catch (InterruptedException e) {
            System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Error waiting for wikipedia html cache to finish: " + e.getMessage());
        }

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " finished caching html");

        return null;
    }

    private static void createWikipediaMatchedFile(File matchedFile) throws IOException, CsvValidationException {
        List<String> titles = getWikiTitles();
        // sort titles, case insensitive
        titles.sort(String.CASE_INSENSITIVE_ORDER);

        // iterate through all elasticsearch accepted TAXON
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Start paging for wikipedia summary");

        // page through acceptedCsv
        CSVReader reader = new CSVReader(new FileReader(acceptedCsv));
        // ignore header; guid,scientificName,genus_s,family_s,order_s,class_s,phylum_s,kingdom_s
        reader.readNext();

        // matched names file, for lookup later
        FileWriter writer = new FileWriter(matchedFile);

        int row = 0;
        String[] nextLine;
        while ((nextLine = reader.readNext()) != null) {
            row++;
            String guid = nextLine[0];
            String scientificName = nextLine[1];
            String genus = nextLine[2];
            String family = nextLine[3];
            String order = nextLine[4];
            String clazz = nextLine[5];
            String phylum = nextLine[6];
            String kingdom = nextLine[7];

            if (StringUtils.isNotEmpty(guid) && StringUtils.isNotEmpty(scientificName)) {
                // find scientific name in wikipedia titles
                String findName = scientificName.trim().replace(" ", "_");
                int idx = Collections.binarySearch(titles, findName, String.CASE_INSENSITIVE_ORDER);
                if (idx >= 0) {
                    writer.write(guid + "," + titles.get(idx) + "," + genus + "," + family + "," + order + "," + clazz + "," + phylum + "," + kingdom + "\n");
                }
            }
        }

        writer.flush();
        writer.close();
    }

    static void cacheWikipediaSummary(String title, File outputFile) {
        try {
            String url = wikipediaUrl + title;

            // this follows redirects
            Document doc = Jsoup.connect(url).userAgent(wikipediaUserAgent).get();

            // TODO: also implement a disk cache for "title.html" in addition to the existing "taxonId.html"
            //  The purpose of this is that when a taxonId changes, or there is a duplicate name, the html will still
            //  exist. <1% are duplicate names, before any redirect.

            // TODO: also implement a disk cache for redirects. If a title redirects to another title, the redirect
            //  will take place, but we have no record of this. Combined with the "title.html" this will reduce the
            //  pages requested when a taxonId changes. The number of redirects are not known.

            // write the file, for later use
            FileWriter writer = new FileWriter(outputFile);
            writer.write(doc.outerHtml());
            writer.flush();
            writer.close();
        } catch (Exception e) {
            System.out.println("Error fetching wikipedia html for: " + title + ", " + e.getMessage());
        }
    }

    public static String alaGet(String url) throws IOException {
        // fetch the content of a URL using a header and a GET request
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();

        // Set the request method to GET
        connection.setRequestMethod("GET");

        // Set the request header
        connection.setRequestProperty("accept", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + alaToken);

        // Get the response code
        int responseCode = connection.getResponseCode();

        // Read the response
        BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream()));
        String inputLine;
        StringBuilder response = new StringBuilder();

        while ((inputLine = in.readLine()) != null) {
            response.append(inputLine);
        }
        in.close();

        return response.toString();
    }
}
