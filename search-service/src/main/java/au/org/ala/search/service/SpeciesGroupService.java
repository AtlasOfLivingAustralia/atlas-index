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
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// TODO: When the new species group definitions are finalized (https://github.com/AtlasOfLivingAustralia/ux-ui/issues/162)
//  major changes will be required to this implementation. The new JSON file format will match the namematching service.

@Service
public class SpeciesGroupService {
    private static final Logger logger = LoggerFactory.getLogger(SpeciesGroupService.class);

    public Map<RankedName, SubGroup> invertedSpeciesGroups;

    @Value("${speciesGroup.path}")
    private String speciesGroupPath;

    private static Map<RankedName, SubGroup> invertSpeciesGroups(List<SpeciesGroup> speciesGroups) {
        Map<RankedName, SubGroup> result = new ConcurrentHashMap<>();

        speciesGroups.forEach(
                speciesGroup -> speciesGroup.taxa.forEach(taxa -> result.put(
                        new RankedName(taxa.name.toLowerCase(), normaliseRank(speciesGroup.taxonRank)),
                        new SubGroup(speciesGroup.speciesGroup, taxa.common))));

        return result;
    }

    private static List<SpeciesGroup> loadSpeciesGroups(InputStream inputStream) throws IOException {
        ObjectMapper om = new ObjectMapper();
        return om.readValue(inputStream, new TypeReference<>() {
        });
    }

    static String normaliseRank(String rank) {
        return rank != null ? rank.toLowerCase().replaceAll("[^a-z]", "_") : null;
    }

    @PostConstruct
    void init() throws IOException {
        loadInvertedSpeciesGroupMap();
    }

    private void loadInvertedSpeciesGroupMap() throws IOException {
        invertedSpeciesGroups = invertSpeciesGroups(loadSpeciesGroups());
    }

    private List<SpeciesGroup> loadSpeciesGroups() throws IOException {
        InputStream is = null;
        try {
            if (StringUtils.isNotEmpty(speciesGroupPath)) {
                is = new FileInputStream(speciesGroupPath);
            } else {
                is = Resources.getResource("speciesGroups.json").openStream();
            }
            return loadSpeciesGroups(is);
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
