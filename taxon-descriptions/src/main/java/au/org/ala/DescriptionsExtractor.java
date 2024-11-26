package au.org.ala;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.stanford.nlp.pipeline.*;
import edu.stanford.nlp.ling.CoreAnnotations;
import edu.stanford.nlp.util.CoreMap;
import org.apache.commons.lang3.StringUtils;

import java.io.File;
import java.io.IOException;
import java.util.*;

public class DescriptionsExtractor {

    private static final int DEFAULT_MAX_LENGTH = 230;
    private static final List<String> DEFAULT_SOURCES = Arrays.asList("General Description", "Description", "Protologue text", "Brief Description");
    private String mergeDir;
    private String heroDescriptionsFile;

    public static void main(String[] args) throws Exception {
        String configFile = "/data/taxon-descriptions/config.json";

        Map<String, String> config = new ObjectMapper().readValue(new File(configFile), Map.class);

        String mergeDir = config.get("mergeDir");
        String heroDescriptionsOutputFile = config.get("heroDescriptionsOutputFile");

        DescriptionsExtractor extractor = new DescriptionsExtractor();
        extractor.mergeDir = mergeDir;
        extractor.heroDescriptionsFile = heroDescriptionsOutputFile;
        extractor.generateHeroDescriptions();
    }

    public void generateHeroDescriptions() throws IOException {
        File inputDir = new File(mergeDir);
        File outputFile = new File(heroDescriptionsFile);

        Map<String, String> heroDescriptions = new HashMap<>();
        ObjectMapper mapper = new ObjectMapper();

        processDirectory(inputDir, heroDescriptions, mapper);

        mapper.writeValue(outputFile, heroDescriptions);
    }

    private void processDirectory(File dir, Map<String, String> heroDescriptions, ObjectMapper mapper) throws IOException {
        for (File file : Objects.requireNonNull(dir.listFiles())) {
            if (file.isDirectory()) {
                processDirectory(file, heroDescriptions, mapper);
            } else if (file.isFile() && file.getName().endsWith(".json")) {
                List<Map<String, Object>> taxonDataList = mapper.readValue(file, List.class);
                for (Map<String, Object> taxonData : taxonDataList) {
                    String description = extractDescription(taxonData);
                    if (StringUtils.isNotEmpty(description)) {
                        heroDescriptions.put(file.getName().replace(".json", ""), description);
                    }
                }
            }
        }
    }

    private static String extractDescription(Map<String, Object> taxonData) {
        for (String source : DescriptionsExtractor.DEFAULT_SOURCES) {
            if (taxonData.containsKey(source) && taxonData.get(source) != null) {
                String text = taxonData.get(source).toString();
                String truncatedText = truncateText(text);
                if (StringUtils.isNotEmpty(truncatedText)) {
                    return truncatedText;
                }
            }
        }
        return null;
    }

    private static String truncateText(String text) {
        Properties props = new Properties();
        props.setProperty("annotators", "tokenize,ssplit");

        StanfordCoreNLP pipeline = new StanfordCoreNLP(props);
        Annotation document = new Annotation(text);
        pipeline.annotate(document);

        StringBuilder truncatedText = new StringBuilder();
        for (CoreMap sentence : document.get(CoreAnnotations.SentencesAnnotation.class)) {
            String sentenceText = sentence.get(CoreAnnotations.TextAnnotation.class);
            if (truncatedText.length() + sentenceText.length() > DescriptionsExtractor.DEFAULT_MAX_LENGTH) {
                break;
            }
            truncatedText.append(sentenceText).append(" ");
        }

        return truncatedText.toString().trim();
    }
}