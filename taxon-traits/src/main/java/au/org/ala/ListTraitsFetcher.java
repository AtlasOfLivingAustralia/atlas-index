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
import java.nio.file.Files;
import java.util.*;

/**
 * Fetches taxon trait data from configured ALA species lists and writes per-taxon JSON files:
 * {traitsDir}/lists/{last2LsidChars}/{urlEncodedLsid}.json
 */
public class ListTraitsFetcher {

    private static final ObjectMapper mapper = new ObjectMapper();
    private static final int PAGE_SIZE = 500;

    @SuppressWarnings("unchecked")
    public static void fetchAll(Map<String, Object> config, String traitsDir) throws IOException {
        Object listsObj = config.get("lists");
        if (!(listsObj instanceof List<?> rawLists) || rawLists.isEmpty()) {
            return;
        }

        String listsUrl = config.containsKey("listsUrl")
                ? config.get("listsUrl").toString().replaceAll("/$", "")
                : "https://lists-ws.ala.org.au";
        String listsUiUrl = config.containsKey("listsUiUrl")
                ? config.get("listsUiUrl").toString().replaceAll("/$", "")
                : "https://lists.ala.org.au/list";

        File listsRoot = new File(traitsDir + "/lists");
        if (!listsRoot.exists()) {
            listsRoot.mkdirs();
        }

        // Map of LSID -> list of trait sections (one per species list)
        Map<String, List<Map<String, Object>>> taxonTraits = new LinkedHashMap<>();

        for (Object item : rawLists) {
            if (!(item instanceof Map)) continue;
            Map<String, Object> listConfig = (Map<String, Object>) item;
            String listId = Objects.toString(listConfig.get("id"), "").trim();
            if (listId.isEmpty()) continue;

            List<String> allowedAttributes = loadAttributes(listConfig);
            System.out.println(TraitsFetcher.ts() + " Fetching list traits for " + listId
                    + " (attribute filter count: " + (allowedAttributes.isEmpty() ? "all" : allowedAttributes.size()) + ")");

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
                    if (!allowedAttributes.isEmpty()) {
                        for (String attr : allowedAttributes) {
                            String val = kvpMap.get(attr);
                            if (val != null) {
                                Map<String, String> traitEntry = new LinkedHashMap<>();
                                traitEntry.put("name", attr);
                                traitEntry.put("value", val);
                                filteredTraits.add(traitEntry);
                            }
                        }
                    } else {
                        for (Map.Entry<String, String> entry : kvpMap.entrySet()) {
                            Map<String, String> traitEntry = new LinkedHashMap<>();
                            traitEntry.put("name", entry.getKey());
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
    private static List<String> loadAttributes(Map<String, Object> listConfig) throws IOException {
        Object attrsObj = listConfig.get("attributes");
        if (attrsObj instanceof List<?> attrs) {
            List<String> result = new ArrayList<>();
            for (Object a : attrs) {
                if (a != null && !a.toString().trim().isEmpty()) {
                    result.add(a.toString().trim());
                }
            }
            return result;
        }
        Object fileObj = listConfig.get("attributesFile");
        if (fileObj != null && !fileObj.toString().trim().isEmpty()) {
            List<String> lines = Files.readAllLines(new File(fileObj.toString().trim()).toPath(), StandardCharsets.UTF_8);
            List<String> result = new ArrayList<>();
            for (String line : lines) {
                String trimmed = line.trim();
                if (!trimmed.isEmpty()) {
                    result.add(trimmed);
                }
            }
            return result;
        }
        return Collections.emptyList();
    }
}
