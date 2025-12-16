package au.org.ala;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVReader;
import com.opencsv.CSVWriter;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.*;

public class Merge {

    String wikipediaUrl;
    String wikipediaTmp;
    String acceptedCsv;
    String mergeDir;
    String overrideFile;

    public Merge(String wikipediaUrl, String wikipediaTmp, String acceptedCsv, String mergeDir, String overrideFile) {
        this.wikipediaUrl = wikipediaUrl;
        this.wikipediaTmp = wikipediaTmp;
        this.acceptedCsv = acceptedCsv;
        this.mergeDir = mergeDir;
        this.overrideFile = overrideFile;
    }

    public void mergeSources(List sources) throws IOException, CsvValidationException {
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

        //  aggregating the html files for a summary, 500 per file should be sufficient.
        int htmlFilesWritten = 0;
        int htmlSize = 0;
        StringBuilder sb = new StringBuilder();

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
                    if (url == null) { // no url in the data is not something that should happen
                        mergedItem.put("attribution", attribution);
                    } else {
                        mergedItem.put("attribution", attribution.replace("*URL*", url));
                    }

                    // remove those without content
                    List<String> keys = new ArrayList<>(mergedItem.keySet());
                    for (String key : keys) {
                        if (StringUtils.isEmpty(mergedItem.get(key))) {
                            mergedItem.remove(key);
                        } else if (key.equals("url") || key.equals("name") || key.equals("attribution") || key.equals("summary")) {
                            // no not change these as they are either not HTML or already sanitized (wikipedia summary)
                        } else {
                            // actual values that need to be wrapped in <p> tags, if not already html
                            try {
                                Document doc = Jsoup.parse(mergedItem.get(key));
                                Element body = doc.body();

                                // when the content is not html (e.g. from species lists), then wrap it in <p> tag
                                if (body.children().isEmpty()) {
                                    doc = Jsoup.parse("<p>" + mergedItem.get(key) + "</p>");
                                    body = doc.body();
                                }

                                sanitizeHtml(body);

                                mergedItem.put(key, body.html());
                            } catch (Exception e) {
                                System.out.println("Error parsing html for: " + key + ", " + guid + ", " + metadata.get("name") + ", " + e.getMessage());
                            }
                        }
                    }

                    // Do not add the merged item if it is empty.
                    // It is empty when it has only "url", "name" and "attribution".
                    if (mergedItem.size() > 3) {
                        merged.add(mergedItem);
                    }
                }
            }

            if (sourceCount > 2) {
                System.out.println("merged " + guid + " from " + sourceCount + " sources");
            }

            if (!merged.isEmpty()) {
                // Making a note here that should the guid be in a format where the end characters are not unique
                // enough, then this will need to be adjusted. Maybe first 2 characters of a hash of guid instead of
                // the guid?

                String encodedGuid = URLEncoder.encode(guid);
                String rightChar = encodedGuid.substring(encodedGuid.length() - 2);

                File file = new File(mergeDir + "/" + rightChar + "/" + encodedGuid + ".json");
                file.getParentFile().mkdirs();
                try (FileWriter writer = new FileWriter(file)) {
                    writer.write(new ObjectMapper().writeValueAsString(merged));
                }

                // Write a html snippet that can be used to preview the content. This is suitable for concatenation.
                // Group by 500 entries.
                sb.append("<div>");
                sb.append("<b>{taxon: " + scientificName + ", " + guid + "}</b>");

                for (Map<String, String> item : merged) {

                    sb.append("<br><br>");
                    sb.append("<b><i>[source: " + item.get("name") + "]</i></b>");
                    sb.append("<br><br>");

                    String content = "";
                    for (String key : item.keySet()) {
                        if (!key.equals("name") && !key.equals("attribution") && !key.equals("url")) {
                            content += "<b>" + key + "</b><br>" + item.get(key) + "<br>";
                        }
                    }
                    sb.append(content);

                    sb.append("</div>");
                }
                sb.append("<hr>\r\n");

                htmlSize++;

                if (htmlSize == 500) {
                    File htmlFile = new File(mergeDir + "/review" + htmlFilesWritten + ".html");
                    htmlFilesWritten++;

                    try (FileWriter writer = new FileWriter(htmlFile)) {
                        writer.write(sb.toString());
                    }

                    htmlSize = 0;
                    sb = new StringBuilder();
                }

                written++;
            }
        }

        // write any remaining html aggregation
        if (htmlSize > 0) {
            File htmlFile = new File(mergeDir + "/review" + htmlFilesWritten + ".html");
            try (FileWriter writer = new FileWriter(htmlFile)) {
                writer.write(sb.toString());
            }
        }

        System.out.println("number of files merged: " + written);
    }

    private Map<String, Map<String, String>> loadWikipedia() throws IOException, CsvValidationException {
        Map<String, Map<String, String>> taxa = new HashMap<>();

        // get a list of all previously downloaded files, recursively through directories, one level deep
        Map<String, File> existingFiles = new HashMap<>();
        File[] files = new File(wikipediaTmp + "/wikipedia").listFiles();
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

        CSVWriter errorWriter = new CSVWriter(new FileWriter(mergeDir + "/errors.csv"));
        errorWriter.writeNext(new String[]{"error message", "guid", "genus", "family", "order", "class", "phylum", "kingdom", "cached html file"});
        File matchedFile = new File(wikipediaTmp + "/wikipedia/matched.csv");
        CSVReader reader = new CSVReader(new FileReader(matchedFile));
        String[] nextLine;
        int row = 0;
        int failedToReadCachedHtml = 0;
        int fileNotFound = 0;
        int caseVariation = 0;
        String lastGuid = "";
        while ((nextLine = reader.readNext()) != null) {
            row++;

            // print progress for every 1000 rows
            if (row % 10000 == 0) {
                System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " wikipedia row: " + row);
            } else if (row % 1000 == 0) {
                System.out.print(".");
            }

            String guid = nextLine[0];
            String wikiTitle = nextLine[1];
            String genus = nextLine[2];
            String family = nextLine[3];
            String order = nextLine[4];
            String clazz = nextLine[5];
            String phylum = nextLine[6];
            String kingdom = nextLine[7];

            if (guid.equalsIgnoreCase(lastGuid)) {
                caseVariation++;
                //System.out.println("case variation for " + guid + ": " + caseVariation + ", " + wikiTitle);
            } else {
                caseVariation = 0;
            }
            lastGuid = guid;

            // alter the filename with the case variation if needed
            String filename = URLEncoder.encode(guid) + (caseVariation > 0 ? ("_" + caseVariation) : "");

            File file = existingFiles.get(filename);

            if (file != null && file.exists()) {
                Map item = getWikipediaSummary(wikiTitle, guid, genus, family, order, clazz, phylum, kingdom, file, errorWriter);
                if (item != null) {
                    taxa.put(guid, item);
                } else {
                    failedToReadCachedHtml++; // includes case variations
                }
            } else {
                System.out.println("file not found: " + filename);
                fileNotFound++;
            }
        }

        errorWriter.flush();
        errorWriter.close();

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " read errors: " + failedToReadCachedHtml + ", see " + mergeDir + "/errors.csv");
        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " file not found: " + fileNotFound);

        return taxa;
    }

    Map getWikipediaSummary(String title, String guid, String genus, String family, String order, String clazz, String phylum, String kingdom, File outputFile, CSVWriter errorLog) throws IOException {
        try {
            Document doc = Jsoup.parse(outputFile);

            // build the link url
            String link = "https://en.wikipedia.org/wiki/" + doc.selectFirst("link[rel=dc:isVersionOf]").attributes().get("href").replaceAll("^.*/", "");

            // check what data is available for any checking. Makes wild assumptions about data quality, but better than nothing.
            int firstRank = -1; // smallest rank found
            if (StringUtils.isNotEmpty(genus)) {
                firstRank = 1;
            } else if (StringUtils.isNotEmpty(family)) {
                firstRank = 2;
            } else if (StringUtils.isNotEmpty(order)) {
                firstRank = 3;
            } else if (StringUtils.isNotEmpty(clazz)) {
                firstRank = 4;
            } else if (StringUtils.isNotEmpty(phylum)) {
                firstRank = 5;
            } else if (StringUtils.isNotEmpty(kingdom)) {
                firstRank = 6;
            }

            // test for higher taxa
            String text = doc.text().toLowerCase();
            int found = 0;
            int firstMatch = -1; // Used to adjust the 'found' parameter. For phylum and kingdom the required matches must be smaller.
            if (StringUtils.isNotEmpty(kingdom) && text.contains(kingdom.toLowerCase())) {
                found++;
                firstMatch = 6;
            }
            if (StringUtils.isNotEmpty(phylum) && text.contains(phylum.toLowerCase())) {
                found++;
                firstMatch = 5;
            }
            if (StringUtils.isNotEmpty(clazz) && text.contains(clazz.toLowerCase())) {
                found++;
                firstMatch = 4;
            }
            if (StringUtils.isNotEmpty(order) && text.contains(order.toLowerCase())) {
                found++;
                firstMatch = 3;
            }
            if (StringUtils.isNotEmpty(family) && text.contains(family.toLowerCase())) {
                found++;
                firstMatch = 2;
            }
            if (StringUtils.isNotEmpty(genus) && text.contains(genus.toLowerCase())) {
                found++;
                firstMatch = 1;
            }

            boolean kingdomKeywordFound = text.contains("kingdom");

            // A minimum of 2 higher taxa matches are required. This means specific checks are required for kingdom, phylum

            // kingdom will be firstRank == -1 and found == 0 and kingdomKeywordFound == true.
            // The definition of "kingdom" is "no accepted taxon id and no parent taxon id" so it is a given it will match more than expected
            boolean isKingdom = firstRank == -1 && found == 0 && kingdomKeywordFound;
            // phylum will be firstRank == 6 and found == 1 and it is also a given it will match more than expected
            boolean isPhylum = firstRank == 6 && firstMatch == 6 && found == 1;

            if (found < 2 && !(isKingdom || isPhylum)) {
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
                sb.append(processSectionElement(sectionElement));
            }

            // fallback, next try the 2nd section
            if (sb.length() == 0) {
                sectionElement = doc.select("section").size() > 1 ? doc.select("section").get(1) : null;
                if (sectionElement != null) {
                    sb.append(processSectionElement(sectionElement));
                }
            }

            // log if no content found
            if (sb.length() == 0) {
                if (errorLog != null) {
                    errorLog.writeNext(new String[]{"no content found", guid, wikipediaUrl + title, genus, family, order, clazz, phylum, kingdom, outputFile.getPath()});
                }
                return null; // no content found in the expected structure
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

    private void sanitizeHtml(Element item) {
        // Doing a recursive sanitize was too deep. Use a loop instead.
        List<Element> list = new ArrayList<>();
        list.add(item);
        while (!list.isEmpty()) {
            Element element = list.remove(0);

            // remove all attribute from all elements
            element.clearAttributes();

            // remove images
            element.select("img").remove();

            for (Element child : element.children()) {
                if (child.tag().getName().equals("a")) {
                    // convert to span?
                    child.tagName("span");
                }
                list.add(child);
            }
        }
    }

    String processSectionElement(Element sectionElement) {
        StringBuilder sb = new StringBuilder();

        List<Element> paragraphs = sectionElement.select("p");
        for (Element paragraph : paragraphs) {
            sanitizeHtml(paragraph);

            if (!paragraph.text().trim().isEmpty()) {
                sb.append(paragraph.html());
            }
        }

        return sb.toString();
    }
}
