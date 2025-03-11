package au.org.ala.search.service;

import au.org.ala.search.model.ListBackedFields;
import au.org.ala.search.model.dto.SetRequest;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.ListService;
import au.org.ala.search.service.remote.StaticFileStoreService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.io.FileUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class AdminService {

    private static final Logger logger = LoggerFactory.getLogger(AdminService.class);
    protected final ElasticsearchOperations elasticsearchOperations;
    protected final ElasticService elasticService;
    protected final ListService listService;
    protected final StaticFileStoreService staticFileStoreService;

    @Value("${lists.images.hidden.id}")
    private String hiddenImageListId;
    @Value("${lists.images.hidden.field}")
    private String hiddenImageListField;
    @Value("${lists.images.preferred.id}")
    private String preferredImageListId;
    @Value("${lists.images.preferred.field}")
    private String preferredImageListField;
    @Value("${lists.hero.description.id}")
    private String heroDescriptionsListId;
    @Value("${lists.hero.description.field}")
    private String heroDescriptionsListField;


    public AdminService(
            ElasticsearchOperations elasticsearchOperations, ElasticService elasticService, ListService listService, StaticFileStoreService staticFileStoreService) {
        this.elasticsearchOperations = elasticsearchOperations;
        this.elasticService = elasticService;
        this.listService = listService;
        this.staticFileStoreService = staticFileStoreService;
    }

    public boolean setValue(SetRequest setRequest) {
        String listId;
        String listField;
        switch (ListBackedFields.find(setRequest.getField())) {
            case ListBackedFields.HIDDEN:
                listId = hiddenImageListId;
                listField = hiddenImageListField;
                break;
            case ListBackedFields.IMAGE:
                listId = preferredImageListId;
                listField = preferredImageListField;
                break;
            case ListBackedFields.HERO_DESCRIPTION:
                listId = heroDescriptionsListId;
                listField = heroDescriptionsListField;
                break;
            case ListBackedFields.DESCRIPTIONS:
                // this is not list-backed, handle separately
                try {
                    return updateDescriptions(setRequest);
                } catch (IOException e) {
                    logger.error("Failed to update descriptions", e);
                    return false;
                }
            default:
                return false;
        }
        listService.updateItem(listId, listField, setRequest);

        String esId = elasticService.queryTaxonId(setRequest.getTaxonID());

        Document doc = Document.create();
        doc.put(setRequest.getField(), setRequest.getValue());

        elasticService.updateImmediately(Collections.singletonList(UpdateQuery.builder(esId).withDocument(doc).build()));

        return true;
    }

    /**
     * The descriptions JSON file can be partially updated, and an override record produced for use by the
     * offline taxon-descriptions tool.
     *
     * The descriptions JSON data is an ordered list of data sources. The structure is as follows:
     * [
     *   {
     *     name: "Source name",
     *     attribution: "Attribution HTML",
     *     url: "URL to the original source",
     *     section1Title: "content of section 1 as HTML",
     *     section2Title: "content of section 2 as HTML",
     *     sectionNTitle: "content of section N as HTML",
     *   }
     * ]
     *
     * Where sectionNTitle is both the key and the text to be used as the title of the section.
     *
     * Only the HTML content of each section can be updated.
     *
     * @param setRequest
     * @return false if non-allowed changes are detected, true if the descriptions were updated.
     * @throws IOException
     */
    private boolean updateDescriptions(SetRequest setRequest) throws IOException {
        ObjectMapper objectMapper = new ObjectMapper();

        // 1. fetch the descriptions JSON file
        String encodedTaxon = URLEncoder.encode(setRequest.getTaxonID(), StandardCharsets.UTF_8);
        String dir = encodedTaxon.substring(encodedTaxon.length() - 2);
        String filePath = "/taxon-descriptions/" + dir + "/" + encodedTaxon + ".json";
        File descriptionsJsonFile = staticFileStoreService.get(filePath);
        List currentDescriptions = objectMapper.readValue(descriptionsJsonFile, List.class);

        if (descriptionsJsonFile == null) {
            // Nothing to override, return false
            return false;
        }

        // 2. determine what source descriptions changed
        List newDescriptions = objectMapper.readValue(setRequest.getValue(), List.class);
        if (newDescriptions.size() != currentDescriptions.size()) {
            // Sources cannot be deleted or added, only updated
            return false;
        }

        List changedDescriptions = new ArrayList();
        for (int i=0;i<newDescriptions.size();i++) {
            Map<String, Object> newDescriptionMap = (Map) newDescriptions.get(i);
            Map<String, Object> currentDescriptionMap = (Map) currentDescriptions.get(i);

            if (!newDescriptionMap.get("name").equals(currentDescriptionMap.get("name"))) {
                // Source names and their order cannot be changed
                return false;
            }

            if (newDescriptionMap.size() != currentDescriptionMap.size()) {
                // Source descriptions cannot be added or removed, only updated
                return false;
            }

            // compare the content of each section, looking for changes
            boolean changed = false;
            int count = 0;
            for (String key : newDescriptionMap.keySet()) {
                if (key.equals("name") || key.equals("attribution") || key.equals("url")) {
                    count++;
                    if (!currentDescriptionMap.get(key).equals(newDescriptionMap.get(key))) {
                        // name, attribution and url cannot be changed individually. Do this using the
                        // taxon-descriptions tool
                        return false;
                    }
                } else {
                    // look for existing keys (section titles) and compare the values for changes
                    if (currentDescriptionMap.containsKey(key)) {
                        count++;
                        if (!currentDescriptionMap.get(key).equals(newDescriptionMap.get(key))) {
                            // sanitise the HTML content
                            newDescriptionMap.put(key, sanitizeHtml(newDescriptionMap.get(key).toString()));

                            changed = true;
                        }
                    }
                }
            }

            if (count != currentDescriptionMap.size()) {
                // sections cannot be added or removed, only updated
                return false;
            }

            // determine if there is a change for this source
            if (changed) {
                changedDescriptions.add(newDescriptionMap);
            }
        }

        if (!changedDescriptions.isEmpty()) {
            // TODO: use the correct overrideFilePath (see comments 3, 4, 5)
            // TODO: use the dataFileStoreService from the in-progress PR for the override.json (see comments 3, 4, 5)

            // 3. fetch the existing override file
            String overrideFilePath = "/taxon-descriptions/" + dir + "/" + encodedTaxon + "-override.json";
            File overrideFile = staticFileStoreService.get(overrideFilePath);
            List overrideDescriptions = overrideFile != null ? objectMapper.readValue(overrideFile, List.class) : new ArrayList();

            // 4. add the changed descriptions to the override file
            for (Object changedDescription : changedDescriptions) {
                Map<String, Object> changedDescriptionMap = (Map) changedDescription;
                boolean found = false;

                // overwrite when there is an existing override for this source (name)
                for (Object overrideDescription : overrideDescriptions) {
                    Map<String, Object> overrideDescriptionMap = (Map) overrideDescription;
                    if (overrideDescriptionMap.get("name").equals(changedDescriptionMap.get("name"))) {
                        found = true;
                        overrideDescriptionMap.putAll(changedDescriptionMap);
                        break;
                    }
                }

                if (!found) {
                    overrideDescriptions.add(changedDescriptionMap);
                }
            }


            // 5. write the updated override file
            File tmpFile = File.createTempFile("override", ".json");
            objectMapper.writeValue(tmpFile, overrideDescriptions);
            staticFileStoreService.copyToFileStore(tmpFile, overrideFilePath, true);

            // 6. write the full description JSON file to the S3 bucket (if using s3)
            File newDescriptionsFile = File.createTempFile("descriptions", ".json");
            objectMapper.writeValue(newDescriptionsFile, changedDescriptions);
            staticFileStoreService.copyToFileStore(newDescriptionsFile, filePath, true);

            return true;
        }

        return false;
    }

    // Sanitize the HTML content, based on taxon-descriptions tool
    private String sanitizeHtml(String value) {
        org.jsoup.nodes.Document doc = Jsoup.parse(value);
        Element body = doc.body();

        // when the content is not html (e.g. from species lists), then wrap it in <p> tag
        if (body.children().isEmpty()) {
            doc = Jsoup.parse("<p>" + value + "</p>");
            body = doc.body();
        }

        // Doing a recursive sanitize was too deep. Use a loop instead.
        List<Element> list = new ArrayList<>();
        list.add(body);
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

        return doc.body().html();
    }
}
