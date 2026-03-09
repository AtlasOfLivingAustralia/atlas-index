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
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class AdminService {
    protected final ElasticService elasticService;
    protected final TaxonDataService taxonDataService;
    private final ObjectMapper objectMapper;

    public AdminService(ElasticService elasticService, TaxonDataService taxonDataService, ObjectMapper objectMapper) {
        this.elasticService = elasticService;
        this.taxonDataService = taxonDataService;
        this.objectMapper = objectMapper;
    }

    /**
     * This updates the TaxonData table instead of the old species lists.
     * @param setRequest
     * @return
     */
    public boolean setValue(SetRequest setRequest) {
        return setValue(setRequest, "system");
    }

    public boolean setValue(SetRequest setRequest, String actor) {
        boolean updateES = false;
        switch (ListBackedFields.find(setRequest.getKey())) {
            case ListBackedFields.WIKI:
            case ListBackedFields.HIDDEN:
            case ListBackedFields.IMAGE:
            case ListBackedFields.HERO_DESCRIPTION:
                updateES = true;
                break;
            case ListBackedFields.DESCRIPTIONS:
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
                    taxonDataService.createOrUpdate(setRequest.getTaxonID(), setRequest.getKey(), setRequest.getScientificName(), setRequest.getFamily(), setRequest.getKingdom(), overrideJsonString, actor);

                    return taxonDataService.updateDescriptions(setRequest.getTaxonID(), overrideJsonString);
                } catch (IOException e) {
                    log.error("Failed to update static descriptions file", e);
                    return false;
                }
            default:
                return false;
        }

        taxonDataService.createOrUpdate(setRequest.getTaxonID(), setRequest.getKey(), setRequest.getScientificName(), setRequest.getFamily(), setRequest.getKingdom(), setRequest.getValue(), actor);

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
}
