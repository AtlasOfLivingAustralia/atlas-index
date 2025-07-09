package au.org.ala;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.stanford.nlp.pipeline.*;
import edu.stanford.nlp.ling.CoreAnnotations;
import edu.stanford.nlp.util.CoreMap;
import edu.stanford.nlp.util.logging.RedwoodConfiguration;
import org.apache.commons.lang3.StringUtils;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.*;

public class DescriptionsExtractor {

    private static final int DEFAULT_MAX_LENGTH = 230;
    private static final List<String> DEFAULT_SOURCES = Arrays.asList("summary", "Summary", "General Description", "Description", "Protologue text", "Brief Description");
    public String mergeDir;
    public String heroDescriptionsFile;

    public static void main(String[] args) throws Exception {
        String configFile = args[0];

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

        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " hero-descriptions found: " + heroDescriptions.size());
    }

    private void processDirectory(File dir, Map<String, String> heroDescriptions, ObjectMapper mapper) throws IOException {
        int noDescriptionCount = 0;
        List<String> failed = new ArrayList<>();
        for (File file : Objects.requireNonNull(dir.listFiles())) {
            if (file.isDirectory()) {
                processDirectory(file, heroDescriptions, mapper);
            } else if (file.isFile() && file.getName().endsWith(".json")) {
                List<Map<String, Object>> taxonDataList = mapper.readValue(file, List.class);
                for (Map<String, Object> taxonData : taxonDataList) {
                    String description = extractDescription(taxonData, DescriptionsExtractor.DEFAULT_SOURCES);
                    if (StringUtils.isEmpty(description)) {
                        // use any source for descriptions as a fallback
                        description = extractDescription(
                            taxonData,
                            taxonData.keySet().stream()
                                .filter(k -> !k.equals("url") && !k.equals("name") && !k.equals("attribution"))
                                .toList()
                        );
                        if (StringUtils.isEmpty(description)) {
                            noDescriptionCount++;
                            failed.add(file.getName());
                        }
                    }
                    if (StringUtils.isNotEmpty(description)) {
                        heroDescriptions.put(file.getName().replace(".json", ""), description);
                    }
                }
            }
        }
        if (noDescriptionCount > 0) {
            System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " no descriptions found for: " + noDescriptionCount + " files");
            System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " errors: first 5 files with no hero-description: " + failed.stream().limit(5).toList());
        }
    }

    private static String extractDescription(Map<String, Object> taxonData, List<String> keys) {
        for (String source : keys) {
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

        // Reduce logging
        RedwoodConfiguration.current().clear().apply();
        RedwoodConfiguration.errorLevel().apply();

        StanfordCoreNLP pipeline = new StanfordCoreNLP(props);

        Annotation document = new Annotation(text);
        pipeline.annotate(document);

        StringBuilder truncatedText = new StringBuilder();
        for (CoreMap sentence : document.get(CoreAnnotations.SentencesAnnotation.class)) {
            String sentenceText = sentence.get(CoreAnnotations.TextAnnotation.class);

            // remove HTML tags and extra spaces for length check
            String withoutHtmlTags = (truncatedText + sentenceText).replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
            if (!truncatedText.isEmpty() && withoutHtmlTags.length() > DescriptionsExtractor.DEFAULT_MAX_LENGTH) {
                break;
            }
            truncatedText.append(sentenceText).append(" ");
        }

        return truncatedText.toString().trim();
    }
}
