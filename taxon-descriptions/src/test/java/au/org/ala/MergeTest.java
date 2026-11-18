package au.org.ala;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.FileWriter;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class MergeTest {

    @TempDir
    Path tempDir;

    @Test
    void testMergePreservesFieldOrderFromConfig() throws Exception {
        Path inputDir = tempDir.resolve("input");
        Files.createDirectories(inputDir);
        Path mergeDir = tempDir.resolve("merge");
        Files.createDirectories(mergeDir);

        // 1. Create accepted.csv
        File acceptedCsv = tempDir.resolve("accepted.csv").toFile();
        try (FileWriter writer = new FileWriter(acceptedCsv)) {
            writer.write("guid,scientificName,genus_s,family_s,order_s,class_s,phylum_s,kingdom_s\n");
            writer.write("urn:lsid:biodiversity.org.au:afd.taxon:1234,Acacia dealbata,Acacia,Fabaceae,Fabales,Magnoliopsida,Tracheophyta,Plantae\n");
        }

        // 2. Create overrides.json (empty map)
        File overrideFile = tempDir.resolve("overrides.json").toFile();
        try (FileWriter writer = new FileWriter(overrideFile)) {
            writer.write("{}\n");
        }

        // 3. Create input JSON file for the source where fields were saved in the wrong order
        // e.g. "Identification", "habitat", "Introduction"
        Map<String, Object> sourceTaxa = new HashMap<>();
        Map<String, String> taxonRecord = new LinkedHashMap<>();
        taxonRecord.put("url", "https://example.com/species/1234");
        taxonRecord.put("Identification", "Yellow flowers and feathery bipinnate leaves.");
        taxonRecord.put("habitat", "High rainfall areas and dry sclerophyll forest.");
        taxonRecord.put("Introduction", "Acacia dealbata is commonly known as silver wattle.");
        sourceTaxa.put("urn:lsid:biodiversity.org.au:afd.taxon:1234", taxonRecord);

        Map<String, Object> sourceJson = new HashMap<>();
        sourceJson.put("taxa", sourceTaxa);

        File sourceFile = inputDir.resolve("amfactsheet.json").toFile();
        new ObjectMapper().writeValue(sourceFile, sourceJson);

        // 4. Source configuration with the desired field order
        List<Map<String, Object>> sources = new ArrayList<>();
        Map<String, Object> sourceConfig = new HashMap<>();
        sourceConfig.put("filename", "amfactsheet");
        sourceConfig.put("name", "Australian Museum Factsheets");
        sourceConfig.put("attribution", "Source: Australian Museum");
        sourceConfig.put("fields", Arrays.asList("Introduction", "Identification", "Habitat"));
        sources.add(sourceConfig);

        // 5. Run Merge
        Merge merge = new Merge("https://wikipedia.org", inputDir.toString(), acceptedCsv.getAbsolutePath(), mergeDir.toString(), overrideFile.getAbsolutePath());
        merge.mergeSources(sources);

        // 6. Verify the merged JSON file
        String guid = "urn:lsid:biodiversity.org.au:afd.taxon:1234";
        String encodedGuid = URLEncoder.encode(guid, StandardCharsets.UTF_8);
        String rightChar = encodedGuid.substring(encodedGuid.length() - 2);
        File outputFile = mergeDir.resolve(rightChar).resolve(encodedGuid + ".json").toFile();

        assertTrue(outputFile.exists(), "Output file should exist: " + outputFile.getAbsolutePath());

        String jsonContent = Files.readString(outputFile.toPath());

        // Verify key ordering in raw JSON string
        int introIndex = jsonContent.indexOf("\"Introduction\"");
        int identIndex = jsonContent.indexOf("\"Identification\"");
        int habitatIndex = jsonContent.indexOf("\"Habitat\"");

        assertTrue(introIndex > -1, "Introduction should be in output JSON");
        assertTrue(identIndex > -1, "Identification should be in output JSON");
        assertTrue(habitatIndex > -1, "Habitat should be in output JSON");

        assertTrue(introIndex < identIndex, "Introduction must appear before Identification in JSON");
        assertTrue(identIndex < habitatIndex, "Identification must appear before Habitat in JSON");

        // Verify key ordering via Jackson JsonNode fieldNames()
        JsonNode root = new ObjectMapper().readTree(jsonContent);
        assertTrue(root.isArray());
        assertEquals(1, root.size());

        JsonNode itemNode = root.get(0);
        List<String> fieldNames = new ArrayList<>();
        itemNode.fieldNames().forEachRemaining(fieldNames::add);

        // Filter out standard metadata fields name, url, attribution
        List<String> contentFields = fieldNames.stream()
                .filter(f -> !f.equals("name") && !f.equals("url") && !f.equals("attribution"))
                .toList();

        assertEquals(Arrays.asList("Introduction", "Identification", "Habitat"), contentFields,
                "Content fields must match the config.json 'fields' order exactly");
    }

    @Test
    void testMergePreservesFieldOrderWithOverrides() throws Exception {
        Path inputDir = tempDir.resolve("input2");
        Files.createDirectories(inputDir);
        Path mergeDir = tempDir.resolve("merge2");
        Files.createDirectories(mergeDir);

        File acceptedCsv = tempDir.resolve("accepted2.csv").toFile();
        try (FileWriter writer = new FileWriter(acceptedCsv)) {
            writer.write("guid,scientificName,genus_s,family_s,order_s,class_s,phylum_s,kingdom_s\n");
            writer.write("urn:test:guid:1,Testus testus,Testus,Testaceae,Testales,Testopsida,Testophyta,Plantae\n");
        }

        // Overrides with fields in arbitrary order
        Map<String, Map<String, Map<String, String>>> overrides = new HashMap<>();
        Map<String, Map<String, String>> guidOverrides = new HashMap<>();
        Map<String, String> sourceOverride = new LinkedHashMap<>();
        sourceOverride.put("url", "https://example.com/override");
        sourceOverride.put("Habitat", "Overridden habitat text.");
        sourceOverride.put("Introduction", "Overridden intro text.");
        sourceOverride.put("Identification", "Overridden ID text.");
        guidOverrides.put("customsource", sourceOverride);
        overrides.put("urn:test:guid:1", guidOverrides);

        File overrideFile = tempDir.resolve("overrides2.json").toFile();
        new ObjectMapper().writeValue(overrideFile, overrides);

        // Source file with base data
        Map<String, Object> sourceTaxa = new HashMap<>();
        Map<String, String> baseRecord = new HashMap<>();
        baseRecord.put("url", "https://example.com/base");
        baseRecord.put("Identification", "Base ID.");
        sourceTaxa.put("urn:test:guid:1", baseRecord);

        Map<String, Object> sourceJson = new HashMap<>();
        sourceJson.put("taxa", sourceTaxa);
        File sourceFile = inputDir.resolve("customsource.json").toFile();
        new ObjectMapper().writeValue(sourceFile, sourceJson);

        List<Map<String, Object>> sources = new ArrayList<>();
        Map<String, Object> sourceConfig = new HashMap<>();
        sourceConfig.put("filename", "customsource");
        sourceConfig.put("name", "Custom Source");
        sourceConfig.put("attribution", "Attribution");
        sourceConfig.put("fields", Arrays.asList("Introduction", "Identification", "Habitat"));
        sources.add(sourceConfig);

        Merge merge = new Merge("https://wikipedia.org", inputDir.toString(), acceptedCsv.getAbsolutePath(), mergeDir.toString(), overrideFile.getAbsolutePath());
        merge.mergeSources(sources);

        String guid = "urn:test:guid:1";
        String encodedGuid = URLEncoder.encode(guid, StandardCharsets.UTF_8);
        String rightChar = encodedGuid.substring(encodedGuid.length() - 2);
        File outputFile = mergeDir.resolve(rightChar).resolve(encodedGuid + ".json").toFile();

        assertTrue(outputFile.exists());
        String jsonContent = Files.readString(outputFile.toPath());

        JsonNode root = new ObjectMapper().readTree(jsonContent);
        JsonNode itemNode = root.get(0);
        List<String> fieldNames = new ArrayList<>();
        itemNode.fieldNames().forEachRemaining(fieldNames::add);

        List<String> contentFields = fieldNames.stream()
                .filter(f -> !f.equals("name") && !f.equals("url") && !f.equals("attribution"))
                .toList();

        assertEquals(Arrays.asList("Introduction", "Identification", "Habitat"), contentFields);
    }
}
