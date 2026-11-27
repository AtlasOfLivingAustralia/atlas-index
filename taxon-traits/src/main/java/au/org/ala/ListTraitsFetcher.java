package au.org.ala;

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;

import java.io.File;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Fetches taxon trait data (and optional companion field-metadata lists) from configured ALA species lists
 * and writes per-taxon JSON files:
 *   {traitsDir}/lists/{last2LsidChars}/{urlEncodedLsid}.json
 *   {traitsDir}/lists/metadata/{metadataId}.json
 */
public class ListTraitsFetcher {

    private static final ObjectMapper mapper = new ObjectMapper();
    private static final int PAGE_SIZE = 500;

    @SuppressWarnings("unchecked")
    public static void fetchAll(Map<String, Object> config, List<Map<String, Object>> listSources, String traitsDir) throws IOException {
        if (listSources == null || listSources.isEmpty()) {
            return;
        }

        String listsUrl = config.containsKey("listsUrl") && config.get("listsUrl") != null
                ? config.get("listsUrl").toString().replaceAll("/$", "")
                : "https://lists-ws.ala.org.au";
        String listsUiUrl = config.containsKey("listsUiUrl") && config.get("listsUiUrl") != null
                ? config.get("listsUiUrl").toString().replaceAll("/$", "")
                : "https://lists.ala.org.au/list";

        File listsRoot = new File(traitsDir + "/lists");
        if (!listsRoot.exists()) {
            listsRoot.mkdirs();
        }

        // Map of LSID -> list of trait sections (one per species list)
        Map<String, List<Map<String, Object>>> taxonTraits = new LinkedHashMap<>();

        for (Map<String, Object> listConfig : listSources) {
            String listId = Objects.toString(listConfig.get("id"), "").trim();
            if (listId.isEmpty()) continue;

            Map<String, String> fieldLabels = loadFields(listConfig);
            Set<String> excludedFields = loadNormalizedStringSet(listConfig.get("excludeFields"));
            Map<String, String> metadataKeyAliases = loadStringMap(listConfig.get("metadataKeyAliases"));
            String metadataId = Objects.toString(listConfig.get("metadataId"), "").trim();
            String metadataKeyField = Objects.toString(listConfig.get("metadataKeyField"), "Column_key").trim();
            String metadataLabelField = Objects.toString(listConfig.get("metadataLabelField"), "Column_header").trim();
            List<String> metadataFields = loadStringList(listConfig.get("metadataFields"));

            MetadataIndex metadataIndex = MetadataIndex.EMPTY;
            if (!metadataId.isEmpty()) {
                metadataIndex = fetchMetadata(listsUrl, metadataId, metadataKeyField, metadataLabelField, metadataFields);
            }
            Map<String, Map<String, String>> usedMetadataByKey = new LinkedHashMap<>();

            System.out.println(TraitsFetcher.ts() + " Fetching list traits for " + listId
                    + " (field filter count: " + (fieldLabels.isEmpty() ? "all" : fieldLabels.size())
                    + (excludedFields.isEmpty() ? "" : ", excluded: " + excludedFields.size()) + ")");

            String metaJson = TraitsFetcher.httpGet(listsUrl + "/ws/speciesList/" + listId);
            if (metaJson == null) {
                System.err.println(TraitsFetcher.ts() + " List metadata not found for " + listId);
                continue;
            }
            Map<String, Object> meta = mapper.readValue(metaJson, Map.class);
            String title = Objects.toString(meta.get("listName"), listId);
            String reference = Objects.toString(meta.get("description"), "");
            String listUrl = listsUiUrl + "/" + listId;

            int offset = 0;
            boolean hasMore = true;
            // Keep at most one section per LSID for a given list (subspecies/synonyms can share a parent LSID).
            Map<String, CandidateSection> listSectionsByLsid = new LinkedHashMap<>();
            int duplicateLsidRows = 0;

            while (hasMore) {
                String itemsJson = TraitsFetcher.httpGet(
                        listsUrl + "/ws/speciesListItems/" + listId + "?includeKVP=true&max=" + PAGE_SIZE + "&offset=" + offset);
                if (itemsJson == null) {
                    break;
                }
                List<Map<String, Object>> page = mapper.readValue(itemsJson, List.class);
                offset += PAGE_SIZE;
                hasMore = page.size() == PAGE_SIZE;

                for (Map<String, Object> row : page) {
                    String lsid = Objects.toString(row.get("lsid"), "").trim();
                    if (lsid.isEmpty()) {
                        continue;
                    }

                    List<Map<String, String>> kvpValues = (List<Map<String, String>>) row.get("kvpValues");
                    if (kvpValues == null || kvpValues.isEmpty()) {
                        continue;
                    }

                    // Species Lists WS returns both underscore-normalized and space-separated KVP twins
                    // for each column; deduplicate while retaining the space-separated label.
                    Set<String> rawKeys = new HashSet<>();
                    for (Map<String, String> kvp : kvpValues) {
                        String key = kvp.get("key");
                        if (StringUtils.isNotBlank(key)) {
                            rawKeys.add(key);
                        }
                    }

                    Map<String, String> kvpMap = new LinkedHashMap<>();
                    Map<String, String> spaceLabels = new HashMap<>();
                    for (Map<String, String> kvp : kvpValues) {
                        String key = kvp.get("key");
                        String value = kvp.get("value");
                        if (StringUtils.isBlank(key) || StringUtils.isBlank(value)) {
                            continue;
                        }
                        if (key.contains(" ")) {
                            String underscoreKey = key.replace(' ', '_');
                            if (rawKeys.contains(underscoreKey)) {
                                spaceLabels.putIfAbsent(underscoreKey, key);
                                continue;
                            }
                        }
                        kvpMap.putIfAbsent(key, value.trim());
                    }

                    List<Map<String, String>> filteredTraits = new ArrayList<>();
                    if (!fieldLabels.isEmpty()) {
                        for (Map.Entry<String, String> fieldEntry : fieldLabels.entrySet()) {
                            String fieldKey = fieldEntry.getKey();
                            if (isExcluded(fieldKey, excludedFields)) {
                                continue;
                            }
                            String val = kvpMap.get(fieldKey);
                            if (val != null) {
                                addTraitEntry(filteredTraits, fieldKey, fieldEntry.getValue(), spaceLabels.get(fieldKey), val,
                                        metadataIndex, metadataKeyAliases, metadataLabelField, usedMetadataByKey);
                            }
                        }
                    } else {
                        for (Map.Entry<String, String> entry : kvpMap.entrySet()) {
                            String fieldKey = entry.getKey();
                            if (isExcluded(fieldKey, excludedFields)) {
                                continue;
                            }
                            addTraitEntry(filteredTraits, fieldKey, "", spaceLabels.get(fieldKey), entry.getValue(),
                                    metadataIndex, metadataKeyAliases, metadataLabelField, usedMetadataByKey);
                        }
                    }

                    if (filteredTraits.isEmpty()) {
                        continue;
                    }

                    Map<String, Object> listSection = new LinkedHashMap<>();
                    listSection.put("dataResourceUid", listId);
                    listSection.put("title", title);
                    listSection.put("reference", reference);
                    listSection.put("listUrl", listUrl);
                    if (!metadataId.isEmpty()) {
                        listSection.put("metadataId", metadataId);
                        listSection.put("metadataUrl", listsUiUrl + "/" + metadataId);
                    }
                    listSection.put("traits", filteredTraits);

                    String rowName = Objects.toString(row.get("name"), "").trim();
                    String matchedSciName = Objects.toString(row.get("scientificName"), "").trim();
                    boolean exactNameMatch = !rowName.isEmpty() && rowName.equalsIgnoreCase(matchedSciName);
                    int populatedCount = countPopulatedTraits(filteredTraits);
                    CandidateSection candidate = new CandidateSection(exactNameMatch, populatedCount, listSection);

                    CandidateSection existing = listSectionsByLsid.get(lsid);
                    if (existing == null) {
                        listSectionsByLsid.put(lsid, candidate);
                    } else {
                        duplicateLsidRows++;
                        if (candidate.isBetterThan(existing)) {
                            listSectionsByLsid.put(lsid, candidate);
                        }
                    }
                }
            }

            for (Map.Entry<String, CandidateSection> entry : listSectionsByLsid.entrySet()) {
                taxonTraits.computeIfAbsent(entry.getKey(), k -> new ArrayList<>()).add(entry.getValue().section);
            }

            if (!metadataId.isEmpty()) {
                writeMetadata(traitsDir, metadataId, usedMetadataByKey);
            }

            System.out.println(TraitsFetcher.ts() + " Fetched " + listSectionsByLsid.size() + " unique taxa for list " + listId
                    + (duplicateLsidRows > 0 ? " (deduplicated " + duplicateLsidRows + " duplicate-LSID rows)" : ""));
        }

        int filesWritten = 0;
        for (Map.Entry<String, List<Map<String, Object>>> entry : taxonTraits.entrySet()) {
            String lsid = entry.getKey();
            String encoded = URLEncoder.encode(lsid, StandardCharsets.UTF_8);
            String shard = encoded.length() >= 2 ? encoded.substring(encoded.length() - 2) : encoded;
            File dir = new File(traitsDir + "/lists/" + shard);
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File outFile = new File(dir, encoded + ".json");
            String json = mapper.writeValueAsString(entry.getValue());
            TraitsFetcher.writeFile(outFile, json);
            filesWritten++;
        }

        System.out.println(TraitsFetcher.ts() + " Finished list traits. Files written: " + filesWritten);
    }

    private record CandidateSection(boolean exactNameMatch, int populatedCount, Map<String, Object> section) {
        boolean isBetterThan(CandidateSection other) {
            if (this.exactNameMatch != other.exactNameMatch) {
                return this.exactNameMatch;
            }
            return this.populatedCount > other.populatedCount;
        }
    }

    private static int countPopulatedTraits(List<Map<String, String>> traits) {
        int count = 0;
        for (Map<String, String> trait : traits) {
            String val = trait.get("value");
            if (val != null) {
                String trimmed = val.trim();
                if (!trimmed.isEmpty() && !"NA".equalsIgnoreCase(trimmed) && !"NAV".equalsIgnoreCase(trimmed)) {
                    count++;
                }
            }
        }
        return count;
    }

    private static void addTraitEntry(
            List<Map<String, String>> filteredTraits,
            String fieldKey,
            String configuredLabel,
            String spaceLabel,
            String value,
            MetadataIndex metadataIndex,
            Map<String, String> metadataKeyAliases,
            String metadataLabelField,
            Map<String, Map<String, String>> usedMetadataByKey) {
        String alias = metadataKeyAliases.get(fieldKey);
        if (alias == null && spaceLabel != null) {
            alias = metadataKeyAliases.get(spaceLabel);
        }
        boolean matchedViaAlias = StringUtils.isNotBlank(alias);
        Map<String, String> meta = metadataIndex.lookup(fieldKey, spaceLabel, alias);
        if (meta != null) {
            usedMetadataByKey.putIfAbsent(fieldKey, meta);
        }
        String displayLabel = resolveDisplayLabel(fieldKey, configuredLabel, spaceLabel, meta, metadataLabelField, matchedViaAlias);
        Map<String, String> traitEntry = new LinkedHashMap<>();
        traitEntry.put("key", fieldKey);
        traitEntry.put("name", displayLabel);
        traitEntry.put("value", value);
        filteredTraits.add(traitEntry);
    }

    private static class MetadataIndex {
        static final MetadataIndex EMPTY = new MetadataIndex(Collections.emptyMap(), Collections.emptyMap(), Collections.emptyMap());
        final Map<String, Map<String, String>> byKey;
        final Map<String, Map<String, String>> byLabel;
        final Map<String, Map<String, String>> byNormalized;

        MetadataIndex(
                Map<String, Map<String, String>> byKey,
                Map<String, Map<String, String>> byLabel,
                Map<String, Map<String, String>> byNormalized) {
            this.byKey = byKey;
            this.byLabel = byLabel;
            this.byNormalized = byNormalized;
        }

        Map<String, String> lookup(String fieldKey, String spaceLabel, String alias) {
            if (StringUtils.isNotBlank(alias)) {
                Map<String, String> entry = byKey.get(alias);
                if (entry != null) return entry;
                entry = byLabel.get(alias);
                if (entry != null) return entry;
                entry = byNormalized.get(normalizeKey(alias));
                if (entry != null) return entry;
            }
            Map<String, String> entry = byKey.get(fieldKey);
            if (entry != null) return entry;
            if (StringUtils.isNotBlank(spaceLabel)) {
                entry = byLabel.get(spaceLabel);
                if (entry != null) return entry;
            }
            entry = byLabel.get(fieldKey);
            if (entry != null) return entry;
            return byNormalized.get(normalizeKey(fieldKey));
        }
    }

    @SuppressWarnings("unchecked")
    private static MetadataIndex fetchMetadata(
            String listsUrl,
            String metadataId,
            String metadataKeyField,
            String metadataLabelField,
            List<String> metadataFields) throws IOException {

        System.out.println(TraitsFetcher.ts() + " Fetching field metadata list " + metadataId);
        Map<String, Map<String, String>> byKey = new LinkedHashMap<>();
        Map<String, Map<String, String>> byLabel = new LinkedHashMap<>();
        Map<String, Map<String, String>> byNormalized = new LinkedHashMap<>();

        int offset = 0;
        boolean hasMore = true;
        while (hasMore) {
            String itemsJson = TraitsFetcher.httpGet(
                    listsUrl + "/ws/speciesListItems/" + metadataId + "?includeKVP=true&max=" + PAGE_SIZE + "&offset=" + offset);
            if (itemsJson == null) {
                break;
            }
            List<Map<String, Object>> page = mapper.readValue(itemsJson, List.class);
            offset += PAGE_SIZE;
            hasMore = page.size() == PAGE_SIZE;

            for (Map<String, Object> row : page) {
                List<Map<String, String>> kvpValues = (List<Map<String, String>>) row.get("kvpValues");
                if (kvpValues == null || kvpValues.isEmpty()) {
                    continue;
                }

                Map<String, String> rawKvp = new LinkedHashMap<>();
                for (Map<String, String> kvp : kvpValues) {
                    String k = kvp.get("key");
                    String v = kvp.get("value");
                    if (StringUtils.isNotBlank(k) && v != null) {
                        rawKvp.putIfAbsent(k, v.trim());
                    }
                }

                String keyVal = rawKvp.get(metadataKeyField);
                if (StringUtils.isBlank(keyVal)) {
                    continue;
                }

                Map<String, String> entry = new LinkedHashMap<>();
                if (!metadataFields.isEmpty()) {
                    for (String mf : metadataFields) {
                        String val = rawKvp.get(mf);
                        if (StringUtils.isNotBlank(val)) {
                            entry.put(mf, val);
                        }
                    }
                } else {
                    for (Map.Entry<String, String> e : rawKvp.entrySet()) {
                        if (StringUtils.isNotBlank(e.getValue())) {
                            entry.put(e.getKey(), e.getValue());
                        }
                    }
                }

                if (!entry.isEmpty()) {
                    byKey.put(keyVal, entry);
                    byNormalized.putIfAbsent(normalizeKey(keyVal), entry);
                    String labelVal = rawKvp.get(metadataLabelField);
                    if (StringUtils.isNotBlank(labelVal)) {
                        byLabel.putIfAbsent(labelVal, entry);
                        byNormalized.putIfAbsent(normalizeKey(labelVal), entry);
                    }
                }
            }
        }

        return new MetadataIndex(byKey, byLabel, byNormalized);
    }

    private static void writeMetadata(
            String traitsDir,
            String metadataId,
            Map<String, Map<String, String>> metadataByKey) throws IOException {
        File metaDir = new File(traitsDir + "/lists/metadata");
        if (!metaDir.exists()) {
            metaDir.mkdirs();
        }
        File outFile = new File(metaDir, metadataId + ".json");
        TraitsFetcher.writeFile(outFile, mapper.writeValueAsString(metadataByKey));
        System.out.println(TraitsFetcher.ts() + " Wrote " + metadataByKey.size() + " field metadata entries to " + outFile.getAbsolutePath());
    }

    private static String resolveDisplayLabel(
            String fieldKey,
            String configuredLabel,
            String spaceLabel,
            Map<String, String> meta,
            String metadataLabelField,
            boolean matchedViaAlias) {
        if (StringUtils.isNotBlank(configuredLabel)) {
            return configuredLabel.trim();
        }
        if (matchedViaAlias) {
            return StringUtils.isNotBlank(spaceLabel) ? spaceLabel.trim() : fieldKey.replace('_', ' ');
        }
        if (meta != null && StringUtils.isNotBlank(meta.get(metadataLabelField))) {
            return meta.get(metadataLabelField).trim();
        }
        if (StringUtils.isNotBlank(spaceLabel)) {
            return spaceLabel.trim();
        }
        return fieldKey;
    }

    private static String normalizeKey(String key) {
        return key.trim().replaceAll("[\\s_]+", "_").toLowerCase(Locale.ROOT);
    }

    private static boolean isExcluded(String fieldKey, Set<String> excludedFields) {
        return !excludedFields.isEmpty() && excludedFields.contains(normalizeKey(fieldKey));
    }

    private static Set<String> loadNormalizedStringSet(Object obj) {
        List<String> list = loadStringList(obj);
        if (list.isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> result = new HashSet<>();
        for (String item : list) {
            result.add(normalizeKey(item));
        }
        return result;
    }

    private static Map<String, String> loadStringMap(Object obj) {
        if (!(obj instanceof Map<?, ?> map)) {
            return Collections.emptyMap();
        }
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                String k = entry.getKey().toString().trim();
                String v = entry.getValue().toString().trim();
                if (!k.isEmpty() && !v.isEmpty()) {
                    result.put(k, v);
                }
            }
        }
        return result;
    }

    private static Map<String, String> loadFields(Map<String, Object> listConfig) {
        Object fieldsObj = listConfig.get("fields");
        Map<String, String> result = new LinkedHashMap<>();
        if (fieldsObj instanceof Map<?, ?> fieldsMap) {
            for (Map.Entry<?, ?> entry : fieldsMap.entrySet()) {
                if (entry.getKey() != null && !entry.getKey().toString().trim().isEmpty()) {
                    String key = entry.getKey().toString().trim();
                    String label = entry.getValue() != null ? entry.getValue().toString() : "";
                    result.put(key, label);
                }
            }
        } else if (fieldsObj instanceof List<?> fieldsList) {
            for (Object item : fieldsList) {
                if (item != null && !item.toString().trim().isEmpty()) {
                    result.put(item.toString().trim(), "");
                }
            }
        }
        return result;
    }

    private static List<String> loadStringList(Object obj) {
        if (!(obj instanceof List<?> list)) {
            return Collections.emptyList();
        }
        List<String> result = new ArrayList<>();
        for (Object item : list) {
            if (item != null && !item.toString().trim().isEmpty()) {
                result.add(item.toString().trim());
            }
        }
        return result;
    }
}
