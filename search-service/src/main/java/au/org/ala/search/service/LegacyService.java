/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.model.dto.IndexedField;
import au.org.ala.search.model.dto.Rank;
import au.org.ala.search.names.RankType;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class LegacyService {

    private static final Logger logger = LoggerFactory.getLogger(LegacyService.class);
    public Map<String, Map<String, String>> conservationMapping;
    public Map<String, Rank> taxonRanks;
    @Value("${conservation.mapping.path}")
    private String conservationMappingPath;
    @Value("${taxonRanksFile}")
    private String taxonRanksFile;

    @PostConstruct
    void init() {
        conservationMapping = new ConcurrentHashMap<>();

        if (StringUtils.isNotEmpty(conservationMappingPath)) {
            try {
                URL url = LegacyService.class.getResource(conservationMappingPath);
                if (url == null) {
                    url = URI.create(conservationMappingPath).toURL();
                }

                List<Map<String, String>> sources = (List<Map<String, String>>) new ObjectMapper().readValue(url, Map.class).get("lists");

                for (Map<String, String> item : sources) {
                    String currentField = "conservation_" + item.get("uid");
                    item.put("current", currentField);

                    // legacy -> current
                    conservationMapping.put(item.get("field"), item);

                    // current -> legacy
                    conservationMapping.put(currentField, item);
                }
            } catch (Exception e) {
                logger.error("Failed to read conservation.mapping.path:" + conservationMappingPath);
            }
        }

        try {
            initTaxonRanks();
        } catch (IOException e) {
            logger.error("Failed to init taxon ranks:" + e.getMessage());
        }
    }

    private void initTaxonRanks() throws IOException {
        File file = new File(taxonRanksFile);
        if (file.exists()) {
            ObjectMapper objectMapper = new ObjectMapper();
            taxonRanks = new ConcurrentHashMap<>();
            taxonRanks.putAll(objectMapper.readValue(FileUtils.readFileToString(file, StandardCharsets.UTF_8), new TypeReference<HashMap<String, Rank>>() {
            }));
        } else {
            taxonRanks = new ConcurrentHashMap<>();
            Arrays.stream(RankType.values()).forEach(rankType ->
                    taxonRanks.put(rankType.getRank(), new Rank(null, null, new ArrayList<>(), rankType.getRank(),
                            rankType.getCbRank() != null ? rankType.getCbRank().name().toLowerCase() : null, rankType.getSortOrder())));
        }
    }

    public Map<String, Rank> getRanks(List<IndexedField> indexedFields) {
        Set<String> indexedFieldNames = indexedFields.stream().map(IndexedField::getName).collect(Collectors.toSet());

        // sort "rankID asc"
        LinkedHashMap<String, Rank> sortedRanks = new LinkedHashMap<>();
        taxonRanks.values().stream()
                .filter(r -> indexedFieldNames.contains("rk_" + r.getRank()))
                .sorted(Comparator.comparing(Rank::getRankID))
                .forEach(r -> sortedRanks.put(r.getRank(), r));

        return sortedRanks;
    }
}
