package au.org.ala.search.service;

import au.org.ala.search.model.dto.RankedName;
import au.org.ala.search.model.dto.SpeciesGroup;
import au.org.ala.search.model.dto.SubGroup;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.io.Resources;
import jakarta.annotation.PostConstruct;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for species groups files in the format of namematching service.
 *
 * The concept of "subGroup" no longer applies.
 *
 * */
@Service
public class SpeciesGroupService {
    private static final Logger logger = LoggerFactory.getLogger(SpeciesGroupService.class);

    public Map<RankedName, SubGroup> invertedSpeciesGroups;

    Map<String, List<SpeciesGroup>> groupByRank = new ConcurrentHashMap<>();

    public SpeciesGroupService() {
        invertedSpeciesGroups = new HashMap<>();
    }

    public static void main(String[] args) {
        SpeciesGroupService speciesGroupService = new SpeciesGroupService();
        try {
            speciesGroupService.init();
        } catch (IOException e) {
            e.printStackTrace();
        }
        List<RankedName> rankedNames = new ArrayList<>();
        rankedNames.add(new RankedName("Chytridiomycota".toLowerCase(), "phylum"));
        System.out.println(speciesGroupService.groupsFor(rankedNames));
    }

    public List<String> groupsFor(List<RankedName> rankedNames) {
        if (rankedNames == null || rankedNames.isEmpty()) {
            return null;
        }

        List<String> speciesGroups = new ArrayList<>(5);
        List<SpeciesGroup> candidateGroups = new ArrayList<>(5);

        // do a search for candidate groups that satisfy the rank and include names
        for (RankedName rankedName : rankedNames) {
            String rank = normaliseRank(rankedName.getRank());
            List<SpeciesGroup> groups = groupByRank.get(rank);
            if (groups != null) {
                for (SpeciesGroup group : groups) {
                    if (group.included != null && group.included.contains(rankedName.getName())) {
                        candidateGroups.add(group);
                    }
                }
            }
        }

        // exclude groups that have excluded names anywhere in the list of rankedNames
        for (SpeciesGroup candidateGroup : candidateGroups) {
            boolean exclude = false;
            for (RankedName rankedName : rankedNames) {
                if (candidateGroup.excluded != null && candidateGroup.excluded.contains(rankedName.getName())) {
                    exclude = true;
                    break;
                }
            }
            if (!exclude) {
                speciesGroups.add(candidateGroup.name);
            }
        }

        return speciesGroups;
    }

    @Value("${speciesGroup.path}")
    private String speciesGroupPath;

    static String normaliseRank(String rank) {
        return rank != null ? rank.toLowerCase().replaceAll("[^a-z]", "_") : null;
    }

    @PostConstruct
    void init() throws IOException {
        List<SpeciesGroup> speciesGroups = loadSpeciesGroups();
        if (speciesGroups != null) {
            for (SpeciesGroup speciesGroup : speciesGroups) {
                // substitute rank "class" for input spec "classs" and "subclass" for "subclasss"
                if (speciesGroup.rank.equals("classs")) {
                    speciesGroup.rank = "class";
                } else if(speciesGroup.rank.equals("subclasss")) {
                    speciesGroup.rank = "subclass";
                }

                String rank = normaliseRank(speciesGroup.rank);
                List<SpeciesGroup> groups = groupByRank.get(rank);
                if (groups == null) {
                    groups = new ArrayList<>();
                    groupByRank.put(rank, groups);
                }

                // normalise the included and excluded names
                if (speciesGroup.included != null) {
                    Set<String> names = new HashSet<>();
                    for (String name : speciesGroup.included) {
                        names.add(name.toLowerCase());
                    }
                    speciesGroup.included = names;
                }
                if (speciesGroup.excluded != null) {
                    Set<String> names = new HashSet<>();
                    for (String name : speciesGroup.excluded) {
                        names.add(name.toLowerCase());
                    }
                    speciesGroup.excluded = names;
                }

                groups.add(speciesGroup);
            }
        }
    }

    private List<SpeciesGroup> loadSpeciesGroups() throws IOException {
        InputStream is = null;
        try {
            if (StringUtils.isNotEmpty(speciesGroupPath)) {
                is = new FileInputStream(speciesGroupPath);
            } else {
                is = Resources.getResource("speciesGroups.json").openStream();
            }

            ObjectMapper om = new ObjectMapper();
            return om.readValue(is, new TypeReference<List<SpeciesGroup>>() {});
        } catch (IOException e) {
            logger.error("failed to load speciesGroups " + speciesGroupPath, e);
        } finally {
            if (is != null) {
                is.close();
            }
        }
        return null;
    }
}
