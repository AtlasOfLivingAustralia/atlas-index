package au.org.ala;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVReader;
import com.opencsv.CSVWriter;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
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

        String configFile = args[0];
        String filename = args[1];

        System.out.println(filename);

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
            mergeSources(sources);
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
            output.put("taxa", downloadWikipedia(fields, name, attribution));
        }

        // write the output to a file
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " Writing output to " + filename + ".json");
        try (FileWriter file = new FileWriter(wikipediaTmp + "/" + filename + ".json")) {
            file.write(new ObjectMapper().writeValueAsString(output));
        }
    }

    private static void mergeSources(List sources) throws IOException, CsvValidationException {
        List<Map> allData = new ArrayList<>();
        List<Map<String, String>> allMetadata = new ArrayList<>();

        // read overrides
        System.out.println("loading overrides");
        Map<String, Map<String, Map<String, String>>> overrides = new ObjectMapper().readValue(new File(overrideFile), Map.class);

        for (int i = 0; i < sources.size(); i++) {
            Map source = (Map) sources.get(i);
            String attribution = source.get("attribution").toString();
            String name = source.get("name").toString();
            String json = source.get("filename").toString();

            Map metadataItem = Map.of("name", name, "attribution", attribution, "filename", json);

            String filename = wikipediaTmp + "/" + json + ".json";
            File file = new File(filename);
            if (file.exists()) {
                System.out.println("loading: " + json);
                Map data = new ObjectMapper().readValue(file, Map.class);
                allData.add(data);
                allMetadata.add(metadataItem);
            } else if ("wikipedia".equalsIgnoreCase(json)) {
                System.out.println("loading from cached html: " + json);

                // This will build the wikipedia.json file, if it is not already built.
                // For including the latest wikipedia page parsing.
                Map wikipedia = loadWikipedia();
                Map wrapper = new HashMap();
                wrapper.put("taxa", wikipedia);
                allData.add(wrapper);
                allMetadata.add(metadataItem);
            } else {
                System.out.println("cannot find file:" + filename);
            }
        }

        // writing
        System.out.println("writing merged data");

        CSVReader reader = new CSVReader(new FileReader(acceptedCsv));
        // ignore header; guid,scientificName,genus_s,family_s,order_s,class_s,phylum_s,kingdom_s
        reader.readNext();

        int row = 0;
        int written = 0;
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

            List<Map<String, String>> merged = new ArrayList<>();

            Map<String, Map<String, String>> override = overrides.get(guid);

            int sourceCount = 0;

            for (int i = 0; i < allData.size(); i++) {
                Map<String, Map<String, String>> taxa = (Map<String, Map<String, String>>) allData.get(i).get("taxa");
                if (taxa == null) {
                    continue;
                }

                // "item" is a map with "url", "name", "attribution", and the optional fields
                Map<String, String> item = taxa.get(guid);
                if (item != null) {
                    sourceCount++;

                    Map<String, String> metadata = allMetadata.get(i);
                    String url = item.get("url");

                    Map<String, String> mergedItem = new HashMap<>();
                    Map<String, String> overrideItem = override != null ? override.get(allMetadata.get(i).get("filename")) : null;
                    if (overrideItem != null) {
                        if (overrideItem.isEmpty()) {
                            // do not merge when removing content
                            continue;
                        }
                        url = overrideItem.get("url");
                        mergedItem.putAll(overrideItem);
                    } else {
                        mergedItem.putAll(item);
                    }

                    mergedItem.put("name", metadata.get("name"));

                    String attribution = metadata.get("attribution");
                    mergedItem.put("attribution", attribution.replace("*URL*", url));

                    // Do not add the merged item if it is empty.
                    // It is empty when when it has only "url", "name" and "attribution".
                    if (mergedItem.size() > 3) {
                        merged.add(mergedItem);
                    }
                }
            }

            if (sourceCount > 1) {
                System.out.println("merged " + guid + " from " + sourceCount + " sources");
            }

            if (!merged.isEmpty()) {
                // TODO: use something more robust to limit the number of files in a directory, and coordinate
                //  with the UI so it can be found

                String encodedGuid = URLEncoder.encode(guid);
                String rightChar = encodedGuid.substring(encodedGuid.length() - 2);

                File file = new File(mergeDir + "/" + rightChar + "/" + encodedGuid + ".json");
                file.getParentFile().mkdirs();
                try (FileWriter writer = new FileWriter(file)) {
                    writer.write(new ObjectMapper().writeValueAsString(merged));
                }

                written++;
            }
        }

        System.out.println("number of files merged: " + written);
    }

    private static Map<String, Map<String, String>> loadWikipedia() throws IOException, CsvValidationException {
        Map<String, Map<String, String>> taxa = new HashMap<>();

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

        CSVWriter errorWriter = new CSVWriter(new FileWriter(wikipediaTmp + "/errors.csv"));
        errorWriter.writeNext(new String[]{"error message", "guid", "wikiUrl", "genus", "family", "order", "class", "phylum", "kingdom", "cached html file"});
        File matchedFile = new File(wikipediaTmp + "/matched.csv");
        CSVReader reader = new CSVReader(new FileReader(matchedFile));
        String[] nextLine;
        int row = 0;
        int failedToReadCachedHtml = 0;
        int fileNotFound = 0;
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

            File file = existingFiles.get(filename);

            if (file != null && file.exists()) {
                Map item = getWikipediaSummary(wikiTitle, guid, genus, family, order, clazz, phylum, kingdom, file, errorWriter);
                if (item != null) {
                    taxa.put(guid, item);
                } else {
                    failedToReadCachedHtml++;
                }
            } else {
                System.out.println("file not found: " + filename);
                fileNotFound++;
            }
        }

        errorWriter.flush();
        errorWriter.close();

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " read errors: " + failedToReadCachedHtml + ", see " + wikipediaTmp + "/errors.csv");
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " file not found: " + fileNotFound);

        return taxa;
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

        CSVWriter errorWriter = new CSVWriter(new FileWriter(wikipediaTmp + "/errors.csv"));
        errorWriter.writeNext(new String[]{"error message", "guid", "wikiUrl", "genus", "family", "order", "class", "phylum", "kingdom", "cached html file"});
        reader = new CSVReader(new FileReader(matchedFile));
        row = 0;
        int failedToReadCachedHtml = 0;
        int fileNotFound = 0;
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

            File file = existingFiles.get(filename);

            if (file.exists()) {
                Map item = getWikipediaSummary(wikiTitle, guid, genus, family, order, clazz, phylum, kingdom, file, errorWriter);
                if (item != null) {
                    taxa.put(guid, item);
                } else {
                    failedToReadCachedHtml++;
                    System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " failed to read cached html: " + guid + ", " + wikiTitle + ", " + file.getPath());
                }
            } else {
                fileNotFound++;
            }
        }

        errorWriter.flush();
        errorWriter.close();

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " failed to read cached html: " + failedToReadCachedHtml);
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " file not found: " + fileNotFound);

        return taxa;
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

    static Map getWikipediaSummary(String title, String guid, String genus, String family, String order, String clazz, String phylum, String kingdom, File outputFile, CSVWriter errorLog) throws IOException {
        try {
            Document doc = Jsoup.parse(outputFile);

            // build the link url
            String link = "https://en.wikipedia.org/wiki/" + doc.selectFirst("link[rel=dc:isVersionOf]").attributes().get("href").replaceAll("^.*/", "");

            // test for higher taxa
            String text = doc.text().toLowerCase();
            int found = 0;
            if (StringUtils.isNotEmpty(genus) && text.contains(genus.toLowerCase())) found++;
            if (StringUtils.isNotEmpty(family) && text.contains(family.toLowerCase())) found++;
            if (StringUtils.isNotEmpty(order) && text.contains(order.toLowerCase())) found++;
            if (StringUtils.isNotEmpty(clazz) && text.contains(clazz.toLowerCase())) found++;
            if (StringUtils.isNotEmpty(phylum) && text.contains(phylum.toLowerCase())) found++;
            if (StringUtils.isNotEmpty(kingdom) && text.contains(kingdom.toLowerCase())) found++;

            if (found == 0) {
                // TODO: implement a detection mechanism for these, as a subset will be disambiguation pages containing
                //  the actual link. These will need to be appended to /data/wikipedia-tmp/matched.csv, for a 2nd run.

                // TODO: implement a mechanism to take these !found pages to a human for review and manual entry

                if (errorLog != null) {
                    errorLog.writeNext(new String[]{"ambiguous page", guid, wikipediaUrl + title, genus, family, order, clazz, phylum, kingdom, outputFile.getPath()});
                }
                return null;
            }

            // remove some content
            doc.select(".infobox").remove();
            doc.select(".infobox.biota").remove();
            doc.select(".mw-editsection").remove();
            doc.select(".navbar").remove();
            doc.select(".reference").remove();
            doc.select(".error").remove();
            doc.select(".box-Unreferenced_section").remove();
            doc.select(".portalbox").remove();
            doc.select("[style=display:none]").remove();
            doc.select("[role=note]").remove();

            // find first tag named SECTION
            Element sectionElement = doc.selectFirst("section");
            StringBuilder sb = new StringBuilder();
            if (sectionElement != null) {
                List<Element> paragraphs = sectionElement.select("p");
                for (Element paragraph : paragraphs) {
                    if (!paragraph.text().trim().isEmpty()) {
                        sb.append(paragraph.html());
                    }
                }
            }

            if (sb.length() == 0) {
                return null;
            }

            Map item = new HashMap();
            item.put("url", link);
            item.put("summary", sb.toString());
            return item;
        } catch (Exception e) {
            System.out.println("Error fetching wikipedia html for: " + title + ", " + e.getMessage());
            return null;
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
