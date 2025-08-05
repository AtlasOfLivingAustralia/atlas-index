/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.model.ListBackedFields;
import au.org.ala.search.model.dto.SetRequest;
import au.org.ala.search.service.remote.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class AdminService {
    protected final ElasticsearchOperations elasticsearchOperations;
    protected final ElasticService elasticService;
    protected final ListApiService listApiService;
    protected final StaticFileStoreService staticFileStoreService;
    protected final DataFileStoreService dataFileStoreService;
    protected final TaxonDataService taxonDataService;
    private final ObjectMapper objectMapper;

    public AdminService(
            ElasticsearchOperations elasticsearchOperations, ElasticService elasticService, ListApiService listApiService, StaticFileStoreService staticFileStoreService, DataFileStoreService dataFileStoreService, TaxonDataService taxonDataService, ObjectMapper objectMapper) {
        this.elasticsearchOperations = elasticsearchOperations;
        this.elasticService = elasticService;
        this.listApiService = listApiService;
        this.staticFileStoreService = staticFileStoreService;
        this.dataFileStoreService = dataFileStoreService;
        this.taxonDataService = taxonDataService;
        this.objectMapper = objectMapper;
    }

    /**
     * This updates the TaxonData table instead of the old species lists.
     * @param setRequest
     * @return
     */
    public boolean setValue(SetRequest setRequest) {
        boolean updateES = false;
        switch (ListBackedFields.find(setRequest.getKey())) {
            case ListBackedFields.WIKI:
            case ListBackedFields.HIDDEN:
            case ListBackedFields.IMAGE:
            case ListBackedFields.HERO_DESCRIPTION:
                updateES = true;
                break;
            case ListBackedFields.DESCRIPTIONS:
                // this is not in ES, do not set listField
                try {
                    // merge new setRequest.value with the existing descriptions override in the database
                    String jsonString = taxonDataService.get(setRequest.getTaxonID(), setRequest.getKey());
                    List currentOverride = StringUtils.isEmpty(jsonString) ? new ArrayList() : objectMapper.readValue(jsonString, List.class);
                    List additionalOverride = objectMapper.readValue(setRequest.getValue(), List.class);
                    for (Object override : additionalOverride) {
                        // remove existing item, if present
                        currentOverride = currentOverride.stream().filter(it ->
                                !(((Map) it).get("source").equals(((Map) override).get("source")) &&
                                        ((Map) it).get("field").equals(((Map) override).get("field")))).toList();
                    }
                    // add the new items together
                    List newItems = new ArrayList();
                    newItems.addAll(currentOverride);
                    newItems.addAll(additionalOverride);
                    String overrideJsonString = objectMapper.writeValueAsString(newItems);
                    taxonDataService.createOrUpdate(setRequest.getTaxonID(), setRequest.getKey(), setRequest.getScientificName(), overrideJsonString);

                    return updateDescriptions(setRequest);
                } catch (IOException e) {
                    log.error("Failed to update static descriptions file", e);
                    return false;
                }
            default:
                return false;
        }

        taxonDataService.createOrUpdate(setRequest.getTaxonID(), setRequest.getKey(), setRequest.getScientificName(), setRequest.getValue());

        // update the Elasticsearch index, where applicable
        if (updateES) {
            String esId = elasticService.queryTaxonId(setRequest.getTaxonID());
            Document doc = Document.create();
            // mark for update or deletion (null value)
            doc.put(setRequest.getKey(), StringUtils.isEmpty(setRequest.getValue()) ? null : setRequest.getValue());
            elasticService.updateImmediately(Collections.singletonList(UpdateQuery.builder(esId).withDocument(doc).build()));
        }

        return true;
    }

    /**
     * The descriptions JSON file can be partially updated, and an override record produced for use by the
     * offline taxon-descriptions tool.
     * <p>
     * The descriptions JSON data is an ordered list of data sources. The structure is as follows:
     * [{
     *   name: "Source name",
     *   attribution: "Attribution HTML",
     *   url: "URL to the original source",
     *   section1Title: "content of section 1 as HTML",
     *   ...
     *   sectionNTitle: "content of section N as HTML"
     * }]
     * <p>
     * The setRequest.value contains JSON data is an ordered list of data sources. The structure is as follows:
     * [
     *   { source: "Source name", field: {section1Title}, value: "content of section 1 as HTML" },
     *     ...
     *   { source: "Source name", field: {sectionNTitle}, value: "content of section N as HTML" }
     * ]
     * <p>
     * Where sectionNTitle is both the key and the text that will be capitalized and be used as the title in the species
     * page.
     * <p>
     * Only the HTML content of each section can be overridden.
     * <p>
     * Refer to the taxon-descriptions tool for more details on how to make larger changes to the descriptions.
     *
     * Future: use DTO for defining the structure of the descriptions JSON data and setRequest.value.
     *
     * @param setRequest
     * @return false if non-allowed changes are detected, true if 0 or more changes applied.
     * @throws IOException
     */
    private boolean updateDescriptions(SetRequest setRequest) throws IOException {
        ObjectMapper objectMapper = new ObjectMapper();

        // 1. fetch the current descriptions JSON file
        String encodedTaxon = URLEncoder.encode(setRequest.getTaxonID(), StandardCharsets.UTF_8);
        String dir = encodedTaxon.substring(encodedTaxon.length() - 2);
        String filePath = "/taxon-descriptions/" + dir + "/" + encodedTaxon + ".json";
        File descriptionsJsonFile = staticFileStoreService.get(filePath);
        if (descriptionsJsonFile == null) {
            // Nothing to override, return false
            return false;
        }
        List currentDescriptions = objectMapper.readValue(descriptionsJsonFile, List.class);
        staticFileStoreService.cleanupFile(descriptionsJsonFile); // this clean up is required if s3 is used

        // 2. determine what source descriptions changed
        List overridingDescriptions = objectMapper.readValue(setRequest.getValue(), List.class);

        int changeCount = 0;
        for (int i = 0; i < overridingDescriptions.size(); i++) {
            Map<String, Object> override = (Map) overridingDescriptions.get(i);

            // find the corresponding source description in the current descriptions
            Map<String, Object> currentDescriptionMap = (Map<String, Object>) currentDescriptions.stream()
                .filter(desc -> ((Map) desc).get("name").equals(override.get("source")))
                .findFirst().orElse(null);

            // source description for this override does not exist
            if (currentDescriptionMap == null) {
                return false;
            }

            String currentValue = (String) currentDescriptionMap.get(override.get("field"));

            // attempting to override something that does not exist in the current description
            if (currentValue == null) {
                return false;
            }

            // value did not change, nothing to do
            if (StringUtils.equals(currentValue, override.get("value").toString())) {
                continue;
            }

            // do the override on the changedDescriptions
            changeCount++;
            currentDescriptionMap.put(override.get("field").toString(), sanitizeHtml(override.get("value").toString()));
        }

        if (changeCount > 0) {
            // 6. write the full description JSON file to the configured location (e.g. s3 or local path)
            File newDescriptionsFile = File.createTempFile("descriptions", ".json");
            objectMapper.writeValue(newDescriptionsFile, currentDescriptions);
            staticFileStoreService.copyToFileStore(newDescriptionsFile, filePath, true);
        }

        return true;
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
