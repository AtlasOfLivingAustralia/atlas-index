/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.taxon.TaxonData;
import au.org.ala.search.model.taxon.TaxonDataId;
import au.org.ala.search.repo.TaxonDataPostgresRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Service for managing admin overrides for taxon data.
 * - Persists in postgresql database.
 * - Used by taxon-descriptions tool for custom descriptions.
 * - Replaces the old hidden images species list that overrides the default hidden images species list for taxon records in ES.
 * - Replaces the old preferred images species list that overrides the default preferred images species list for taxon records in ES.
 *
 * Future: create a process for admin to manage new names indexes where old taxonConceptIds
 *  are no longer valid.
 * Future: add process for admin to remove or fix the imageIds in this taxon data when they are no longer valid.
 */
@Slf4j
@Service
public class TaxonDataService {
    protected final TaxonDataPostgresRepository taxonDataPostgresRepository;
    private final AuditService auditService;
    private final StaticFileStoreService staticFileStoreService;
    private final ObjectMapper objectMapper;

    public TaxonDataService(TaxonDataPostgresRepository taxonDataPostgresRepository,
                            AuditService auditService,
                            StaticFileStoreService staticFileStoreService,
                            ObjectMapper objectMapper) {
        this.taxonDataPostgresRepository = taxonDataPostgresRepository;
        this.auditService = auditService;
        this.staticFileStoreService = staticFileStoreService;
        this.objectMapper = objectMapper;
    }

    /**
     * Generic create or update method for taxon data.
     *
     * @param taxonConceptId
     * @param key
     * @param scientificName
     * @param family
     * @param kingdom
     * @param value
     * @return true if the request now matches the database entry, false if not
     */
    @Transactional
    public boolean createOrUpdate(String taxonConceptId, String key, String scientificName, String family, String kingdom, String value, String actor) {
        if (StringUtils.isEmpty(taxonConceptId) || StringUtils.isEmpty(key)) {
            return false;
        }

        // delete record if updating with null or empty data
        if (StringUtils.isEmpty(value)) {
            delete(taxonConceptId, key, actor);
            return true;
        }

        // snapshot before state
        TaxonData before = taxonDataPostgresRepository.findById(new TaxonDataId(taxonConceptId, key)).orElse(null);

        if (before != null && StringUtils.compare(before.getValue(), value) == 0) {
            return true; // no change needed
        }

        TaxonData taxonData = new TaxonData(taxonConceptId, key, scientificName, family, kingdom, value);

        String entityId = taxonConceptId + ":" + key;
        Map<String, Object> diff = AuditService.merge(
                AuditService.diff("scientificName", before != null ? before.scientificName : null, scientificName),
                AuditService.merge(
                        AuditService.diff("kingdom", before != null ? before.kingdom : null, kingdom),
                        AuditService.merge(
                                AuditService.diff("family", before != null ? before.family : null, family),
                                AuditService.diff("value",  before != null ? before.value  : null, value))));

        taxonDataPostgresRepository.save(taxonData);
        taxonDataPostgresRepository.flush();

        auditService.record(AuditService.TABLE_TAXON_DATA, entityId, entityId, actor,
                before == null ? AuditService.ACTION_CREATE : AuditService.ACTION_UPDATE, diff);

        return true;
    }

    @Transactional(readOnly = true)
    public String get(String taxonConceptId, String key) {
        if (StringUtils.isEmpty(taxonConceptId) || StringUtils.isEmpty(key)) {
            return null;
        }
        return taxonDataPostgresRepository.getByTaxonConceptIdAndKey(taxonConceptId, key);
    }

    @Transactional
    public void delete(String taxonConceptId, String key, String actor) {
        TaxonData before = taxonDataPostgresRepository.findById(new TaxonDataId(taxonConceptId, key)).orElse(null);
        taxonDataPostgresRepository.deleteByTaxonConceptIdAndKey(taxonConceptId, key);

        String entityId = taxonConceptId + ":" + key;
        Map<String, Object> diff = before == null ? null : AuditService.merge(
                AuditService.diff("scientificName", before.scientificName, null),
                AuditService.merge(
                        AuditService.diff("kingdom", before.kingdom, null),
                        AuditService.merge(
                                AuditService.diff("family", before.family, null),
                                AuditService.diff("value",  before.value,  null))));
        auditService.record(AuditService.TABLE_TAXON_DATA, entityId, entityId, actor,
                AuditService.ACTION_DELETE, diff);
    }

    // Future: use paging or streaming
    @Transactional(readOnly = true)
    public List<TaxonData> findAllByKey (String key) {
        return taxonDataPostgresRepository.findAllByKey(key);
    }

    @Transactional(readOnly = true)
    public long count() {
        return taxonDataPostgresRepository.count();
    }

    /**
     * Applies description overrides stored in taxon_data to the taxon description JSON file
     * in the file store. Returns true if the file was found and written (or had no changes),
     * false if the file does not exist for this taxon or an override is invalid.
     * <p>
     * MAY NOT write a file if no existing description file is found for the taxon.
     */
    public boolean updateDescriptions(String taxonConceptId, String overrideJson) throws IOException {
        String encodedTaxon = URLEncoder.encode(taxonConceptId, StandardCharsets.UTF_8);
        String dir = encodedTaxon.substring(encodedTaxon.length() - 2);
        String filePath = "/taxon-descriptions/" + dir + "/" + encodedTaxon + ".json";
        File descriptionsJsonFile = staticFileStoreService.get(filePath);
        if (descriptionsJsonFile == null) {
            return false;
        }
        List currentDescriptions = objectMapper.readValue(descriptionsJsonFile, List.class);
        staticFileStoreService.cleanupFile(descriptionsJsonFile);

        List overridingDescriptions = objectMapper.readValue(overrideJson, List.class);

        int changeCount = 0;
        for (int i = 0; i < overridingDescriptions.size(); i++) {
            Map<String, Object> override = (Map) overridingDescriptions.get(i);

            Map<String, Object> currentDescriptionMap = (Map<String, Object>) currentDescriptions.stream()
                    .filter(desc -> ((Map) desc).get("name").equals(override.get("source")))
                    .findFirst().orElse(null);

            if (currentDescriptionMap == null) {
                return false;
            }

            String currentValue = (String) currentDescriptionMap.get(override.get("field").toString());

            if (currentValue == null) {
                return false;
            }

            if (StringUtils.equals(currentValue, override.get("value").toString())) {
                continue;
            }

            changeCount++;
            currentDescriptionMap.put(override.get("field").toString(), sanitizeHtml(override.get("value").toString()));
        }

        if (changeCount > 0) {
            File newDescriptionsFile = File.createTempFile("descriptions", ".json");
            objectMapper.writeValue(newDescriptionsFile, currentDescriptions);
            staticFileStoreService.copyToFileStore(newDescriptionsFile, filePath, true);
        }

        return true;
    }

    private String sanitizeHtml(String value) {
        org.jsoup.nodes.Document doc = Jsoup.parse(value);
        Element body = doc.body();

        if (body.children().isEmpty()) {
            doc = Jsoup.parse("<p>" + value + "</p>");
            body = doc.body();
        }

        List<Element> list = new ArrayList<>();
        list.add(body);
        while (!list.isEmpty()) {
            Element element = list.remove(0);
            element.clearAttributes();
            element.select("img").remove();
            for (Element child : element.children()) {
                if (child.tag().getName().equals("a")) {
                    child.tagName("span");
                }
                list.add(child);
            }
        }

        return doc.body().html();
    }
}
