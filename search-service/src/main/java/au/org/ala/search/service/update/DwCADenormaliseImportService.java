package au.org.ala.search.service.update;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.cache.*;
import au.org.ala.search.model.dto.RankedName;
import au.org.ala.search.model.dto.SubGroup;
import au.org.ala.search.service.SpeciesGroupService;
import au.org.ala.search.service.remote.LogService;
import org.apache.commons.lang3.StringUtils;
import org.gbif.utils.file.csv.CSVReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.*;

@Service
public class DwCADenormaliseImportService {
    private static final TaskType taskType = TaskType.DWCA;
    private static final Logger logger = LoggerFactory.getLogger(DwCADenormaliseImportService.class);
    // priority is low to high
    static String[] linkIdentifierTaxonomicStatusPriority =
            new String[]{"inferredAccepted", "accepted"};
    protected final SpeciesGroupService speciesGroupService;
    protected final LogService logService;

    List<DenormalTaxon> parentNodes;
    Map<String, DenormalTaxon> linkIdentifiers;
    Set<String> linkIdentifierConflict;
    Set<String> alreadyDenormalized = new HashSet<>();
    Map<String, String> cacheCommonName;
    Integer[] sortByAcceptedConceptID;
    Integer[] sortByGuid;
    private DenormalCache cache;

    @Value("${priority.norm}")
    private Integer priorityNorm;
    @Value("${dwca.extract.commonNamePath}")
    private String commonNamePath;

    public DwCADenormaliseImportService(SpeciesGroupService speciesGroupService, LogService logService) {
        this.speciesGroupService = speciesGroupService;
        this.logService = logService;
    }

    static String normaliseRank(String rank) {
        return rank != null ? rank.toLowerCase().replaceAll("[^a-z]", "_") : null;
    }

    static String buildLinkText(String scientificName) {
        return scientificName.trim().replaceAll("[^\\w\\s]", "").replaceAll("\\s+", "_");
    }

    public void setCache(DenormalCache cache) {
        this.cache = cache;

        logService.log(taskType, "Starting cache for denormalize");
        Arrays.sort(cache.cacheTaxon, new Denormal.DenormalCompare());
        Arrays.sort(cache.cacheIdentifier, new Denormal.DenormalCompare());
        Arrays.sort(cache.cacheVariant, new Denormal.DenormalCompare());
        Arrays.sort(cache.cacheVernacular, new Denormal.DenormalCompare());

        // find parent nodes and linkIdentifier items
        parentNodes = new ArrayList<>();
        linkIdentifiers = new HashMap<>(600000);
        linkIdentifierConflict = new HashSet<>(100000);
        for (DenormalTaxon de : cache.cacheTaxon) {
            if (de.acceptedConceptID == null && de.key == null) { // .key is parentGuid
                parentNodes.add(de);
            }

            String linkText = buildLinkText(de.scientificName);

            DenormalTaxon ltItem = linkIdentifiers.get(linkText);
            if (ltItem == null) {
                linkIdentifiers.put(linkText, de);
            } else {
                int diff = getPriorityDiff(ltItem.taxonomicStatus, de.taxonomicStatus);
                if (diff < 0) {
                    linkIdentifiers.put(linkText, de);

                    // no longer a conflict for this linkText, if there was one
                    linkIdentifierConflict.remove(linkText);
                } else if (diff == 0) {
                    // need to flag that there is a conflict, so we do not use it.
                    linkIdentifierConflict.add(linkText);
                }
            }
        }

        // resort cacheTaxon for acceptedConceptID search
        sortByAcceptedConceptID = new Integer[cache.cacheTaxon.length];
        for (int i = 0; i < sortByAcceptedConceptID.length; i++) sortByAcceptedConceptID[i] = i;
        final DenormalTaxon[] finalCacheTaxon = cache.cacheTaxon;
        Arrays.sort(sortByAcceptedConceptID, (o1, o2) -> {
            String a = finalCacheTaxon[o1].acceptedConceptID;
            String b = finalCacheTaxon[o2].acceptedConceptID;

            a = a == null ? "" : a;
            b = b == null ? "" : b;
            return a.compareTo(b);
        });

        // resort cacheTaxon for guid search
        sortByGuid = new Integer[cache.cacheTaxon.length];
        for (int i = 0; i < sortByGuid.length; i++) sortByGuid[i] = i;
        Arrays.sort(sortByGuid, (o1, o2) -> {
            String a = finalCacheTaxon[o1].guid;
            String b = finalCacheTaxon[o2].guid;

            a = a == null ? "" : a;
            b = b == null ? "" : b;
            return a.compareTo(b);
        });

        cacheCommonName();
        logService.log(taskType, "Finished cache for denormalize");
    }

    public void deleteCaches() {
        // clear caches
        cache = null;
        linkIdentifiers = null;
        parentNodes = null;
        cacheCommonName = null;
        sortByAcceptedConceptID = null;
        sortByGuid = null;

        alreadyDenormalized.clear();
    }

    private void cacheCommonName() {
        File file = new File(commonNamePath);
        if (file.exists()) {
            cacheCommonName = new HashMap<>(100000);
            try (CSVReader reader = new CSVReader(file, "UTF-8", ",", '"', 0)) {
                while (reader.hasNext()) {
                    String[] line = reader.next();
                    cacheCommonName.put(line[0], line[1]);
                }
            } catch (Exception e) {
                logService.log(taskType, "failed to read commonName CSV: " + commonNamePath + ", " + e.getMessage());
                logger.error("failed to read commonName CSV: " + commonNamePath + ", " + e.getMessage());
            }
        } else {
            logService.log(taskType, "commonName CSV does not exist: " + commonNamePath);
            cacheCommonName = new HashMap<>();
        }
    }

    public <T extends Denormal> T[] findCachedTaxon(String guid, T[] cacheArray) {
        int anyIdx = Arrays.binarySearch(cacheArray, new Denormal(guid), new Denormal.DenormalCompare());

        if (anyIdx < 0) {
            return null;
        }

        int firstIdx = anyIdx;
        while (firstIdx > 0 && cacheArray[firstIdx - 1].key != null && cacheArray[firstIdx - 1].key.equals(guid)) {
            firstIdx--;
        }

        int lastIdx = anyIdx;
        while (lastIdx < cacheArray.length - 2 && cacheArray[lastIdx + 1].key.equals(guid)) {
            lastIdx++;
        }

        return Arrays.copyOfRange(cacheArray, firstIdx, lastIdx + 1);
    }

    private String[] findAssociatedNames(final String guid) {
        final DenormalTaxon[] fa = cache.cacheTaxon;
        int anyIdx = Arrays.binarySearch(sortByAcceptedConceptID, -1, (o1, o2) -> {
            String a = o1 == -1 ? guid : fa[o1].acceptedConceptID;
            String b = o2 == -1 ? guid : fa[o2].acceptedConceptID;

            a = a == null ? "" : a;
            b = b == null ? "" : b;
            return a.compareTo(b);
        });

        if (anyIdx < 0) {
            return null;
        }

        int firstIdx = anyIdx;
        while (firstIdx > 0 && fa[sortByAcceptedConceptID[firstIdx - 1]].acceptedConceptID != null
                && fa[sortByAcceptedConceptID[firstIdx - 1]].acceptedConceptID.equals(guid)) {
            firstIdx--;
        }

        int lastIdx = anyIdx;
        while (lastIdx < fa.length - 2
                && fa[sortByAcceptedConceptID[lastIdx + 1]].acceptedConceptID.equals(guid)) {
            lastIdx++;
        }

        String[] found = new String[lastIdx - firstIdx + 1];
        for (int i = firstIdx; i <= lastIdx; i++) {
            found[i - firstIdx] = fa[sortByAcceptedConceptID[i]].scientificName;
        }
        return found;
    }

    private DenormalTaxon findCachedTaxonByGuid(final String guid) {
        final DenormalTaxon[] fa = cache.cacheTaxon;
        int idx = Arrays.binarySearch(sortByGuid, -1, (o1, o2) -> {
            String a = o1 == -1 ? guid : fa[o1].guid;
            String b = o2 == -1 ? guid : fa[o2].guid;

            a = a == null ? "" : a;
            b = b == null ? "" : b;
            return a.compareTo(b);
        });

        if (idx < 0) {
            return null;
        }

        return fa[sortByGuid[idx]];
    }

    // < 0 is A < B
    int getPriorityDiff(String taxonomicStatusA, String taxonomicStatusB) {
        int orderA = -1;
        int orderB = -1;
        for (int i = 0; i < linkIdentifierTaxonomicStatusPriority.length; i++) {
            if (linkIdentifierTaxonomicStatusPriority[i].equals(taxonomicStatusA)) {
                orderA = i;
            }
            if (linkIdentifierTaxonomicStatusPriority[i].equals(taxonomicStatusB)) {
                orderB = i;
            }
        }

        return orderA - orderB;
    }

    private void getParentValues(String guid, Map<String, String> parentData, List<String> speciesGroups, List<String> speciesSubgroups, List<String> seenGuid, List<String> rankSeen) {
        DenormalTaxon parent = findCachedTaxonByGuid(guid);
        if (parent != null) {
            if (StringUtils.isNotEmpty(parent.rank) && parent.rankID != 0) {
                String normalisedRank = normaliseRank(parent.rank);

                // re-number duplicates
                int unique = 0;
                String uniqueSuffix = "";
                while (parentData.containsKey("rk_" + normalisedRank + uniqueSuffix)) {
                    unique++;
                    uniqueSuffix = String.valueOf(unique);
                }
                parentData.put("rk_" + normalisedRank + uniqueSuffix, parent.scientificName);
                parentData.put("rkid_" + normalisedRank + uniqueSuffix, parent.guid);

                // order
                rankSeen.add(normalisedRank + uniqueSuffix);

                // we have a unique rank name and value, check if it's in the species group list
                RankedName rn = new RankedName(parent.scientificName.toLowerCase(), normalisedRank);
                SubGroup speciesGroup = speciesGroupService.invertedSpeciesGroups.get(rn);
                if (speciesGroup != null) {
                    speciesGroups.add(speciesGroup.group);
                    speciesSubgroups.add(speciesGroup.subGroup);
                }
            }
            // key == parentGuid for DenormalTaxon
            if (parent.key != null) {
                // This test was in bie-index, and while it should never happen, test just in case
                if (seenGuid.contains(parent.key)) {
                    logService.log(taskType, "infinite loop for parentGuid follow for: " + guid);
                    logger.error("infinite loop for parentGuid follow for: " + guid);
                    return;
                }

                getParentValues(parent.key, parentData, speciesGroups, speciesSubgroups, seenGuid, rankSeen);
            }
        }
    }

    // The purpose of this is to denormalize during ingestion making use of cached data.
    // e.g. instead of the old denormalize (parent + recursion for children), this will follow to the parent
    // to get the data.rk* values
    public void denormalizeItemOnly(SearchItemIndex item) {
        // taxon with acceptedTaxonID value undergo different denormalization
        if (item.acceptedConceptID != null) {
            String linkText = buildLinkText(item.scientificName);
            DenormalTaxon ltItem = linkIdentifiers.get(linkText);
            if (ltItem != null && ltItem.guid.equals(item.guid) && !linkIdentifierConflict.contains(linkText)) {
                item.linkIdentifier = linkText;
            }

            return;
        }

        // find parent data.rk* values
        if (item.parentGuid != null) {
            Map<String, String> parentData = new HashMap<>();
            List<String> speciesGroups = new ArrayList<>();
            List<String> speciesSubgroups = new ArrayList<>();
            List<String> seenGuid = new ArrayList<>();
            List<String> rankSeen = new ArrayList<>();
            seenGuid.add(item.guid);

            getParentValues(item.parentGuid, parentData, speciesGroups, speciesSubgroups, seenGuid, rankSeen);

            // An approach to retain the order rk_*/rkid_* as the tree is traversed. Probably not the best approach.
            parentData.put("rankOrder", StringUtils.join(rankSeen, ","));

            if (!speciesGroups.isEmpty()) {
                item.speciesGroup = speciesGroups.toArray(new String[0]);
                item.speciesSubgroup = speciesSubgroups.toArray(new String[0]);
            }

            if (item.data == null) {
                item.data = parentData;
            } else {
                item.data.putAll(parentData);
            }
        }

        DenormalIdentifier[] identifiers = findCachedTaxon(item.guid, cache.cacheIdentifier);
        DenormalVariant[] variants = findCachedTaxon(item.guid, cache.cacheVariant);
        DenormalVernacular[] commonNames = findCachedTaxon(item.guid, cache.cacheVernacular);

        Integer priority = null;
        if (variants != null) {
            List<String> names = new ArrayList<>();
            for (DenormalVariant it : variants) {
                int p = it.priority != null ? it.priority : priorityNorm;
                if (priority == null || p > priority) {
                    priority = p;
                }
                if (StringUtils.isNotEmpty(it.scientificName)) names.add(it.scientificName);
                if (StringUtils.isNotEmpty(it.nameComplete)) names.add(it.nameComplete);
            }
            names.remove(item.scientificName);
            names.remove(item.nameComplete);
            if (!names.isEmpty()) item.nameVariant = names.toArray(new String[0]);
        }
        item.priority = priority != null ? priority : priorityNorm;

        if (commonNames != null) {
            item.commonName = Arrays.stream(commonNames).map(it -> it.name).distinct().toArray(String[]::new);

            // aligns commonName with namematching-service
            String namesServiceCommonName = cacheCommonName.get(item.guid);
            item.commonNameSingle = namesServiceCommonName != null ? namesServiceCommonName : commonNames[0].name;
        }

        if (identifiers != null) {
            item.additionalIdentifiers = Arrays.stream(identifiers).map(it -> it.guid).distinct().toArray(String[]::new);
        }

        String[] names = findAssociatedNames(item.guid);
        if (names != null) {
            item.additionalNames_m_s = Arrays.stream(names).distinct().toArray(String[]::new);
        }

        String linkText = buildLinkText(item.scientificName);
        DenormalTaxon ltItem = linkIdentifiers.get(linkText);
        if (ltItem != null && ltItem.guid.equals(item.guid) && !linkIdentifierConflict.contains(linkText)) {
            item.linkIdentifier = linkText;
        }
    }
}
