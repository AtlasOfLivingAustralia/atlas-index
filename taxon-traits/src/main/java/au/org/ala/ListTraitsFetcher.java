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
            String metadataId = Objects.toString(listConfig.get("metadataId"), "").trim();
            String metadataKeyField = Objects.toString(listConfig.get("metadataKeyField"), "Column_key").trim();
            String metadataLabelField = Objects.toString(listConfig.get("metadataLabelField"), "Column_header").trim();
            List<String> metadataFields = loadStringList(listConfig.get("metadataFields"));

            Map<String, Map<String, String>> metadataByKey = Collections.emptyMap();
            if (!metadataId.isEmpty()) {
                metadataByKey = fetchAndWriteMetadata(
                        listsUrl, traitsDir, metadataId, metadataKeyField, metadataFields, fieldLabels.keySet());
            }

            System.out.println(TraitsFetcher.ts() + " Fetching list traits for " + listId
                    + " (field filter count: " + (fieldLabels.isEmpty() ? "all" : fieldLabels.size()) + ")");

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
            int listTaxonCount = 0;

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

                    Map<String, String> kvpMap = new LinkedHashMap<>();
                    for (Map<String, String> kvp : kvpValues) {
                        String key = kvp.get("key");
                        String value = kvp.get("value");
                        if (StringUtils.isNotBlank(key) && StringUtils.isNotBlank(value) && !"NA".equalsIgnoreCase(value.trim())) {
                            kvpMap.putIfAbsent(key, value.trim());
                        }
                    }

                    List<Map<String, String>> filteredTraits = new ArrayList<>();
                    if (!fieldLabels.isEmpty()) {
                        for (Map.Entry<String, String> fieldEntry : fieldLabels.entrySet()) {
                            String fieldKey = fieldEntry.getKey();
                            String val = kvpMap.get(fieldKey);
                            if (val != null) {
                                String displayLabel = resolveDisplayLabel(fieldKey, fieldEntry.getValue(), metadataByKey, metadataLabelField);
                                Map<String, String> traitEntry = new LinkedHashMap<>();
                                traitEntry.put("key", fieldKey);
                                traitEntry.put("name", displayLabel);
                                traitEntry.put("value", val);
                                filteredTraits.add(traitEntry);
                            }
                        }
                    } else {
                        for (Map.Entry<String, String> entry : kvpMap.entrySet()) {
                            String fieldKey = entry.getKey();
                            String displayLabel = resolveDisplayLabel(fieldKey, "", metadataByKey, metadataLabelField);
                            Map<String, String> traitEntry = new LinkedHashMap<>();
                            traitEntry.put("key", fieldKey);
                            traitEntry.put("name", displayLabel);
                            traitEntry.put("value", entry.getValue());
                            filteredTraits.add(traitEntry);
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

                    taxonTraits.computeIfAbsent(lsid, k -> new ArrayList<>()).add(listSection);
                    listTaxonCount++;
                }
            }

            System.out.println(TraitsFetcher.ts() + " Fetched " + listTaxonCount + " taxa for list " + listId);
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

    @SuppressWarnings("unchecked")
    private static Map<String, Map<String, String>> fetchAndWriteMetadata(
            String listsUrl,
            String traitsDir,
            String metadataId,
            String metadataKeyField,
            List<String> metadataFields,
            Set<String> allowedFieldKeys) throws IOException {

        System.out.println(TraitsFetcher.ts() + " Fetching field metadata list " + metadataId);
        Map<String, Map<String, String>> metadataByKey = new LinkedHashMap<>();

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
                if (!allowedFieldKeys.isEmpty() && !allowedFieldKeys.contains(keyVal)) {
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
                    metadataByKey.put(keyVal, entry);
                }
            }
        }

        File metaDir = new File(traitsDir + "/lists/metadata");
        if (!metaDir.exists()) {
            metaDir.mkdirs();
        }
        File outFile = new File(metaDir, metadataId + ".json");
        TraitsFetcher.writeFile(outFile, mapper.writeValueAsString(metadataByKey));
        System.out.println(TraitsFetcher.ts() + " Wrote " + metadataByKey.size() + " field metadata entries to " + outFile.getAbsolutePath());

        return metadataByKey;
    }

    private static String resolveDisplayLabel(
            String fieldKey,
            String configuredLabel,
            Map<String, Map<String, String>> metadataByKey,
            String metadataLabelField) {
        if (StringUtils.isNotBlank(configuredLabel)) {
            return configuredLabel.trim();
        }
        Map<String, String> meta = metadataByKey.get(fieldKey);
        if (meta != null && StringUtils.isNotBlank(meta.get(metadataLabelField))) {
            return meta.get(metadataLabelField).trim();
        }
        return fieldKey;
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
