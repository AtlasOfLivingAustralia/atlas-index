package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.ListBackedFields;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.ListService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.util.ListToFieldValue;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.common.util.StringUtils;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
public class ListImportService {
    private static final TaskType taskType = TaskType.LISTS;

    private static final Logger logger = LoggerFactory.getLogger(ListImportService.class);
    private static final String listsFavouriteField = "favourite";
    protected final ElasticService elasticService;
    protected final ListService listService;
    protected final LogService logService;
    protected final ListCache listCache;
    @Value("${lists.uiUrl}")
    private String listsUiUrl;
    @Value("${lists.conservation.statusField}")
    private String listsConservationStatusField;
    private String getListsConservationIUCNStatusField = "IUCN_equivalent_status";
    @Value("${lists.favourite.config}")
    private String favouriteConfig;
    @Value("${lists.images.ids}")
    private String listsImagesIds;

    @Value("${lists.images.preferred.id}")
    private String listsImagesPreferred;
    @Value("${lists.images.preferred.field}")
    private String listsImagesPreferredField;

    @Value("${lists.images.hidden.id}")
    private String listsImagesHidden;
    @Value("${lists.images.hidden.field}")
    private String listsImagesHiddenField;

    @Value("${lists.native-introduced}")
    private String nativeIntroduced;

    // used to suppress duplicate error messages
    private boolean kvpError;

    public ListImportService(ElasticService elasticService, ListService listService, LogService logService, ListCache listCache) {
        this.elasticService = elasticService;
        this.listService = listService;
        this.logService = logService;
        this.listCache = listCache;
    }

    @PostConstruct
    void init() {
        // test format of favouriteConfig
        if (StringUtils.isNotEmpty(favouriteConfig)) {
            try {
                String[] lists = favouriteConfig.split(";");
                for (String item : lists) {
                    String[] listIdString = item.split(",");
                    assert StringUtils.isNotEmpty(listIdString[0]);
                    assert StringUtils.isNotEmpty(listIdString[1]);
                }
            } catch (Exception e) {
                logger.error("lists.favourite.config is invalid. Must be a list of 'listId,label' separated by ';'. e.g. 'dr4778,interest;dr781,iconic'");
                throw e;
            }
        }
    }

    // Performance: not an immediate concern, but longer term this should update once per taxon instead of once
    // per list per taxon.
    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        logService.log(taskType, "Starting lists import");

        Map<String, Date> existingLists = elasticService.queryItems("idxtype", IndexDocType.SPECIESLIST.name());

        // there are only a small number of authoritativeLists
        List<Map<String, Object>> authoritativeLists = listService.authoritativeLists();
        List<Map<String, Object>> sdsLists = listService.sdsLists();
        List<String> conservationLists = new ArrayList<>();
        List<String> attributeLists = new ArrayList<>();
        List<IndexQuery> authLists = processLists(existingLists, authoritativeLists, conservationLists, attributeLists);
        int counter = elasticService.flushImmediately(authLists);
        long deleted = elasticService.removeDeletedItems(existingLists);
        logService.log(taskType, "delete: " + deleted);

        // Get a list of all fields. Used to determine what should be removed
        Set<String> indexFields = elasticService.validFields(false);

        logService.log(taskType, "import conservation values (data.conservation_listId)");
        List<String> conservationFields = new ArrayList(indexFields.stream().filter(str -> str.startsWith("conservation_")).toList());
        int conservationCounter = 0;
        for (String listId : conservationLists) {
            conservationFields.remove("conservation_" + listId);
            conservationCounter = importKvpList(
                    Collections.singletonList(listId),
                    "conservation_" + listId,
                    (it -> {
                        for (Map<String, String> map : (List<Map<String, String>>) it.get("kvpValues")) {
                            if (map.get("key").equals(listsConservationStatusField)) {
                                return map.get("value");
                            }
                        }
                        if (!kvpError) {
                            logService.log(taskType, "Conservation list " + listId + " has a null value in field " + listsConservationStatusField);
                            kvpError = true;
                        }
                        return null;
                    }),
                    true, true).size();
        }
        deleteFields(conservationFields);

        // IUCN status is found in conservation lists, but a different field.
        logService.log(taskType, "import conservation values (iucn_listId)");
        List<String> iucnFields = new ArrayList(indexFields.stream().filter(str -> str.startsWith("iucn_")).toList());
        int conservationIUCNCounter = 0;
        for (String listId : conservationLists) {
            iucnFields.remove("iucn_" + listId);
            conservationIUCNCounter = importKvpList(
                    Collections.singletonList(listId),
                    "iucn_" + listId,
                    (it -> {
                        Map conservation = new HashMap();
                        for (Map<String, String> map : (List<Map<String, String>>) it.get("kvpValues")) {
                            if (map.get("key").equals(getListsConservationIUCNStatusField)) {
                                return map.get("value");
                            }
                        }
                        if (!kvpError) {
                            logService.log(taskType, "Conservation list " + listId + " has a null value in field " + getListsConservationIUCNStatusField);
                            kvpError = true;
                        }
                        return null;
                    }),
                    true, true).size();
        }
        deleteFields(iucnFields);

        logService.log(taskType, "import lists images");
        int listImageCounter = 0;
        if (StringUtils.isNotEmpty(listsImagesIds)) {
            for (String listId : listsImagesIds.split(",")) {
                listImageCounter += importKvpList(
                        Collections.singletonList(listId),
                        ListBackedFields.IMAGE.field,
                        (it -> {
                            for (Map<String, String> map : (List<Map<String, String>>) it.get("kvpValues")) {
                                if (map.get("key").equals(listsImagesPreferredField)) {
                                    return map.get("value");
                                }
                            }
                            if (!kvpError) {
                                logService.log(taskType, "images list " + listId + " has a null value in field " + listsImagesPreferredField);
                                kvpError = true;
                            }
                            return null;
                        }),
                        false, true).size();
            }
        }

        // 'image' field is also filled by AcceptedTaxonUpdateService.
        // The imageLists are always expected to override existing values.
        // Do not track existing 'image' values and do not delete them.
        logService.log(taskType, "import preferred images");
        int preferredImageCounter = 0;
        if (StringUtils.isNotEmpty(listsImagesPreferred)) {
            preferredImageCounter = importKvpList(
                    Collections.singletonList(listsImagesPreferred),
                    ListBackedFields.IMAGE.field,
                    (it -> {
                        for (Map<String, String> map : (List<Map<String, String>>) it.get("kvpValues")) {
                            if (map.get("key").equals(listsImagesPreferredField)) {
                                return map.get("value");
                            }
                        }
                        if (!kvpError) {
                            logService.log(taskType, "Preferred list " + listsImagesPreferred + " has a null value in field " + listsImagesPreferredField);
                            kvpError = true;
                        }
                        return null;
                    }),
                    false, true).size();
        }

        logService.log(taskType, "import hidden images");
        int hiddenImagesCounter = 0;
        if (StringUtils.isNotEmpty(listsImagesHidden)) {
            hiddenImagesCounter = importKvpList(
                    Collections.singletonList(listsImagesHidden),
                    ListBackedFields.HIDDEN.field,
                    (it -> {
                        for (Map<String, String> map : (List<Map<String, String>>) it.get("kvpValues")) {
                            if (map.get("key").equals(listsImagesHiddenField)) {
                                return map.get("value");
                            }
                        }
                        return null;
                    }),
                    true, true).size();
        }

        // 'favourite' field is populated with a configured string when a TAXON or COMMON is in a species list. To support the
        // ability to remove with, zero downtime during an update, aggregate the lists and apply in a single pass.
        // Keep track of all items updated so that 'weights' can be reapplied.
        logService.log(taskType, "import favourites images (TAXON)");
        int favouritesCounter = 0;
        List<String> favouriteLists = new ArrayList<>(2);
        List<String> favouriteType = new ArrayList<>(2);
        Map<String, Set<String>> stringLookup = new HashMap<>();
        for (String entry : favouriteConfig.split(";")) {
            String[] listIdAndString = entry.split(",");
            favouriteLists.add(listIdAndString[0]);
            favouriteType.add(listIdAndString[1]);
            Set<String> ids = listService.items(listIdAndString[0]).stream().map(it -> (String) it.get("lsid")).collect(Collectors.toSet());
            stringLookup.put(listIdAndString[1], ids);
        }
        // for idxtype:TAXON
        if (!favouriteLists.isEmpty()) {
            List<String> updatedIds =
                    importKvpList(
                            favouriteLists,
                            listsFavouriteField,
                            (it -> {
                                for (int i = 0; i < favouriteLists.size(); i++) {
                                    Set<String> ids = stringLookup.get(favouriteType.get(i));
                                    String lsid = (String) it.get("lsid");
                                    if (ids.contains(lsid)) {
                                        return favouriteType.get(i);
                                    }
                                }
                                return null;
                            }),
                            true, true);
            // we want to update weights, however, we may need to wait for the update to complete
            // as a workaround we just re-run this after n-seconds
            if (!updatedIds.isEmpty()) {
                // TODO: this is not ideal. It is better to keep track of the updated 'favourite' value and update using this, instead of waiting 5 minutes with the hope that all updates property flushed.
                logService.log(taskType, "Updating weights for " + updatedIds.size() + " items, in the background, in 5 minutes.");
                new Thread() {
                    public void run() {
                        try {
                            // wait 5 minutes
                            Thread.sleep(5 * 60 * 1000);
                            updateWeights(updatedIds);
                            logService.log(taskType, "Finished weights for " + updatedIds.size() + " items.");
                        } catch (InterruptedException e) {
                            logger.error(e.getMessage(), e);
                        }
                    }
                }.start();
            }

            favouritesCounter = updatedIds.size();
        }

        // for idxtype:COMMON
        logService.log(taskType, "import favourites images (COMMON)");
        int favouritesCommonCounter = 0;
        if (!favouriteLists.isEmpty()) {
            List<String> updatedIds =
                    importKvpList(
                            favouriteLists,
                            listsFavouriteField,
                            (it -> {
                                for (int i = 0; i < favouriteLists.size(); i++) {
                                    Set<String> ids = stringLookup.get(favouriteType.get(i));
                                    String lsid = (String) it.get("lsid");
                                    if (ids.contains(lsid)) {
                                        return favouriteType.get(i);
                                    }
                                }
                                return null;
                            }),
                            true, false);
            // we want to update weights, however, we may need to wait for the update to complete
            // as a workaround we just re-run this after n-seconds
            if (!updatedIds.isEmpty()) {
                // TODO: this is not ideal. It is better to keep track of the updated 'favourite' value and update using this, instead of waiting 5 minutes with the hope that all updates property flushed.
                logService.log(taskType, "Updating weights for " + updatedIds.size() + " items, in the background, in 5 minutes.");
                new Thread() {
                    public void run() {
                        try {
                            // wait 5 minutes
                            Thread.sleep(5 * 60 * 1000);
                            updateWeights(updatedIds);
                            logService.log(taskType, "Finished weights for " + updatedIds.size() + " items.");
                        } catch (InterruptedException e) {
                            logger.error(e.getMessage(), e);
                        }
                    }
                }.start();
            }

            favouritesCommonCounter = updatedIds.size();
        }

        // The expect input and output for native/introduced is explained here
        // https://github.com/AtlasOfLivingAustralia/atlas-index/issues/11#issuecomment-2395219841
        logService.log(taskType, "import native/introduced");
        int nativeIntroducedCounter = 0;
        if (StringUtils.isNotEmpty(nativeIntroduced)) {
            nativeIntroducedCounter = importKvpList(
                    Collections.singletonList(nativeIntroduced),
                    ListBackedFields.NATIVE_INTRODUCED.field,
                    (it -> {
                        Map nativeIntroduced = new HashMap();
                        for (Map<String, String> map : (List<Map<String, String>>) it.get("kvpValues")) {
                            String key = map.get("key");
                            String value = map.get("value");
                            if (key.endsWith(" Status") && StringUtils.isNotEmpty(value)) {
                                nativeIntroduced.put(key.substring(0, key.length() - 7), value);
                            }
                        }

                        String result = null;
                        if (!nativeIntroduced.isEmpty()) {
                            try {
                                result = new ObjectMapper().writeValueAsString(nativeIntroduced);
                            } catch (Exception ignored) {}
                        }

                        return result;
                    }),
                    true, true).size();
        }

        // Track the SDS list that a taxon if found within
        logService.log(taskType, "import sds");
        List<String> sdsFields = new ArrayList(indexFields.stream().filter(str -> str.startsWith("sds_")).toList());
        int sdsCounter = 0;
        for (Map<String, Object> list : sdsLists) {
            String listId = list.get("dataResourceUid").toString();
            sdsFields.remove("sds_" + listId);
            sdsCounter = importKvpList(
                    Collections.singletonList(listId),
                    "sds_" + listId,
                    (it -> {
                        for (Map<String, String> map : (List<Map<String, String>>) it.get("kvpValues")) {
                            // there is no requirement for the value inthe "category" field, but it seems more useful than "true"
                            if (map.get("key").equals("category")) {
                                return map.get("value");
                            }
                        }
                        return "true";
                    }),
                    true, true).size();
        }
        deleteFields(sdsFields);

        // This section maintains the field "speciesList" for each taxon that appears in authoritative lists. This field
        // contains a list of listIds that the taxon appears in. The initial purpose is for use with species-pages
        // resource tab where there are buttons that will be visible depending on what lists the taxon appears in.
        // While the actual auth lists required is small, the decision to add all auth lists was to reduce future
        // maintenance of config.
        logService.log(taskType, "import speciesList field with lists of auth lists");
        int allListsCounter = 0;
        List<String> allLists = new ArrayList<>(10000);
        Map<String, List<String>> allListsLookup = new HashMap<>();
        for (Map<String, Object> list : authoritativeLists) {
            String listId = list.get("dataResourceUid").toString();
            allLists.add(listId);
            Set<String> ids = listService.items(listId).stream().map(it -> (String) it.get("lsid")).collect(Collectors.toSet());

            for (String id : ids) {
                List<String> listIds = allListsLookup.get(id);
                if (listIds == null) {
                    listIds = new ArrayList();
                    allListsLookup.put(id, listIds);
                }
                listIds.add(listId);
            }
        }
        if (!allLists.isEmpty()) {
            List<String> updatedIds = setFieldValues("speciesList", allListsLookup);
            allListsCounter = updatedIds.size();
        }

        // nested fields may have changed, cache the new list
        elasticService.indexFields(true);

        // update lists cache now
        listCache.cacheListNames();

        // dynamic fields may have changed, cache the new list
        elasticService.indexFields(true);

        logService.log(taskType, "Finished updates authoritative: " + counter
                + ", conservation: " + conservationCounter /*+ ", attributes: " + attributesCounter*/
                + ", favouritesTaxon: " + favouritesCounter + ", favouritesCommon: " + favouritesCommonCounter
                + ", hiddenImages: " + hiddenImagesCounter
                + ", preferredImages (all): " + preferredImageCounter
                + ", list images: " + listImageCounter
                + ", native/introduced: " + nativeIntroducedCounter
                + ", conservationIUCN: " + conservationIUCNCounter
                + ", sds: " + sdsCounter
                + ", auth lists: " + allListsCounter);

        return CompletableFuture.completedFuture(true);
    }

    // removes pages from existingPages as they are found
    private List<IndexQuery> processLists(
            Map<String, Date> existingLists,
            List<Map<String, Object>> lists,
            List<String> conservationLists,
            List<String> attributeLists) {
        List<IndexQuery> updateList = new ArrayList<>();

        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");

            logService.log(taskType, "found " + lists.size() + " authoritative lists");

            for (Map<String, Object> list : lists) {
                Date current = sdf.parse(list.get("lastUpdated").toString());
                Date created = sdf.parse(list.get("dateCreated").toString());
                String id = list.get("dataResourceUid").toString();
                String name = list.get("listName").toString();
                String url = listsUiUrl + id;
                String listType = list.get("listType").toString();
                String description = (String) list.get("description");

                if ((boolean) list.getOrDefault("isThreatened", false)) {
                    conservationLists.add(id);
                }

                if ((boolean) list.getOrDefault("isBIE", false)) {
                    attributeLists.add(id);
                }

                Date stored = existingLists.get(id);
                if (stored == null || stored.compareTo(current) < 0) {
                    SearchItemIndex item = SearchItemIndex.builder()
                            .id(id)
                            .guid(url)
                            .idxtype(IndexDocType.SPECIESLIST.name())
                            .name(name)
                            .description(description)
                            .modified(current)
                            .dateCreated(String.valueOf(list.get("dateCreated")))
                            .itemCount((Integer) list.get("itemCount"))
                            .isAuthoritative((Boolean) list.get("isAuthoritative"))
                            .isInvasive((Boolean) list.get("isInvasive"))
                            .isThreatened((Boolean) list.get("isThreatened"))
                            .region(String.valueOf(list.get("region")))
                            .type(listType)
                            .created(created)
                            .build();

                    updateList.add(elasticService.buildIndexQuery(item));
                }

                // remove this list from existingLists so that existingLists will only contain lists deleted
                if (stored != null) {
                    // assume no duplicates
                    existingLists.remove(id);
                }
            }
        } catch (Exception e) {
            logService.log(taskType, "Error processing lists: " + e.getMessage());
            logger.error(e.getMessage(), e);
        }

        return updateList;
    }

    /**
     * Utility function that updates a field for an accepted type TAXON record based on a species list
     *
     * @param listIds        one or more lists that will update the TAXON record matched by taxonId
     * @param field          field to update
     * @param value          function to convert species list to the value for a field
     * @param trackAndDelete use true when 'field' is updated only by a single call to this function,
     *                       for removal of old values
     * @param isTaxon        true if idxtype:TAXON, false if idxtype:COMMON
     * @return list of ids that were updated
     */
    private List<String> importKvpList(
            List<String> listIds, String field, ListToFieldValue value, Boolean trackAndDelete, boolean isTaxon) {
        List<String> updatedIds = new ArrayList<>();
        List<UpdateQuery> buffer = new ArrayList<>();
        Set<String> seenIds = new HashSet();

        kvpError = false;

        int counter = 0;
        int duplicateIds = 0;

        String guidField = isTaxon ? "guid" : "taxonGuid";

        try {
            Map<String, String[]> existingItems = trackAndDelete
                    ? elasticService.queryItems(field + ":*", guidField, new String[]{guidField, "id", field}, -1)
                    : new HashMap<>();

            List<Map<String, Object>> items = new ArrayList<>();
            for (String listId : listIds) {
                items.addAll(listService.items(listId));
            }

            for (Map<String, Object> item : items) {
                String guid = (String) item.get("lsid");
                if (StringUtils.isEmpty(guid)) {
                    continue;
                }

                if (seenIds.contains(guid)) {
                    duplicateIds++;
                    continue;
                }

                seenIds.add(guid);

                String status = value.convert(item);

                String[] stored = existingItems.remove(guid);

                // alternative null values
                if (stored != null && "[]".equals(stored[2])) {
                    stored = null;
                }
                if (status != null && "[]".equals(status)) {
                    status = null;
                }

                if (stored != null && ((stored[2] == null && status != null) || !(stored[2] != null && stored[2].equals(status)))) {
                    // existing values to change
                    Document doc = Document.create();
                    doc.put(field, status);
                    buffer.add(UpdateQuery.builder(stored[1]).withDocument(doc).build());
                    updatedIds.add(stored[1]);
                } else if (stored == null && status != null) {
                    // new value to create
                    List<String> ids = null;
                    if (isTaxon) {
                        String id = elasticService.queryTaxonId(guid);
                        if (id != null) {
                            ids = Collections.singletonList(id);
                        }
                    } else {
                        ids = elasticService.queryCommonIds(guid);
                    }
                    if (ids != null && !ids.isEmpty()) {
                        // Performance: COMMON records will always be updated, or at best, all but one, change this to speed up the process
                        for (String id : ids) {
                            Document doc = Document.create();
                            doc.put(field, status);
                            buffer.add(UpdateQuery.builder(id).withDocument(doc).build());
                            updatedIds.add(id);
                        }
                    } else {
                        // Only report missing taxonIds for idxtype:TAXON
                        if (isTaxon) {
                            logService.log(taskType, "taxonId missing: " + guid);
                        }
                    }
                }
            }

            // clear field for those that no longer exist
            for (Map.Entry<String, String[]> es : existingItems.entrySet()) {
                Document doc = Document.create();
                doc.put(field, null);
                buffer.add(UpdateQuery.builder(es.getValue()[1]).withDocument(doc).build());
                updatedIds.add(es.getValue()[1]);
            }

            counter += buffer.size();
            // Had a problem with updating nested contents. Wait for update.
            elasticService.updateImmediately(buffer);
            buffer.clear();

            logService.log(taskType,
                    "finished kvp list " + field + ", new:" + counter
                            + ", removed:" + existingItems.size() + ", duplicates(ERRORS):" + duplicateIds);
        } catch (Exception e) {
            logService.log(taskType, "failed kvp list " + field + ", " + e.getMessage());
            logger.error("failed kvp list " + field + ", " + e.getMessage(), e);
        }

        return updatedIds;
    }

    void updateWeights(List<String> ids) {
        List<UpdateQuery> buffer = new ArrayList<>();
        for (String id : ids) {
            SearchItemIndex item = elasticService.getDocument(id);
            Double origSearchWeight = item.searchWeight;
            Double origSuggestWeight = item.suggestWeight;
            elasticService.addWeights(item);

            Document doc = Document.create();
            if (origSearchWeight != item.searchWeight) {
                doc.put("searchWeight", item.searchWeight);
            }
            if (origSuggestWeight != item.suggestWeight) {
                doc.put("suggestWeight", item.suggestWeight);
            }
            if (!doc.isEmpty()) {
                buffer.add(UpdateQuery.builder(id).withDocument(doc).build());
            }
        }

        elasticService.updateImmediately(buffer);
    }

    /**
     * Utility function that updates a taxon field using a map of taxonIds and values
     *
     * @param field          field to update
     * @param taxonIdMap     map of taxonId and list of values for the field
     * @return list of ids that were updated
     */
    private List<String> setFieldValues(
            String field, Map<String, List<String>> taxonIdMap) {
        List<String> updatedIds = new ArrayList<>();
        List<UpdateQuery> buffer = new ArrayList<>();

        kvpError = false;

        int counter = 0;

        try {
            Map<String, String[]> existingItems = elasticService.queryItems(field + ":*", "guid", new String[]{"guid", "id", field}, -1);

            for (Map.Entry<String, List<String>> entry : taxonIdMap.entrySet()) {
                String guid = entry.getKey();
                if (StringUtils.isEmpty(guid)) {
                    continue;
                }

                String[] stored = existingItems.remove(guid);

                // alternative null values
                if (stored != null && ("[]".equals(stored[2]) || StringUtils.isEmpty(stored[2]))) {
                    stored = null;
                }

                if (stored != null && !arraysEqual(stored[2], entry.getValue())) {
                    // existing values to change
                    Document doc = Document.create();
                    doc.put(field, entry.getValue());
                    buffer.add(UpdateQuery.builder(stored[1]).withDocument(doc).build());
                    updatedIds.add(stored[1]);
                } else if (stored == null) {
                    // new value to create
                    String id = elasticService.queryTaxonId(guid);
                    if (id != null) {
                        Document doc = Document.create();
                        doc.put(field, entry.getValue());
                        buffer.add(UpdateQuery.builder(id).withDocument(doc).build());
                        updatedIds.add(id);
                    } else {
                        logService.log(taskType, "taxonId missing: " + guid);
                    }
                }
            }

            // clear field for those that no longer exist
            for (Map.Entry<String, String[]> es : existingItems.entrySet()) {
                Document doc = Document.create();
                doc.put(field, null);
                buffer.add(UpdateQuery.builder(es.getValue()[1]).withDocument(doc).build());
                updatedIds.add(es.getValue()[1]);
            }

            counter += buffer.size();
            // Had a problem with updating nested contents. Wait for update.
            elasticService.updateImmediately(buffer);
            buffer.clear();

            logService.log(taskType,
                    "finished list " + field + ", new:" + counter
                            + ", removed:" + existingItems.size());
        } catch (Exception e) {
            logService.log(taskType, "failed list " + field + ", " + e.getMessage());
            logger.error("failed list " + field + ", " + e.getMessage(), e);
        }

        return updatedIds;
    }

    private boolean arraysEqual(String a, List<String> b) {
        if (StringUtils.isEmpty(a)) {
            return b.isEmpty();
        }

        String [] split = a.split(",");

        if (split.length != b.size()) {
            return false;
        }

        for (String s : split) {
            if (!b.contains(s)) {
                return false;
            }
        }

        return true;
    }

    // page over documents with a field and zero it out
    private void deleteFields(List<String> fieldsToDelete) {
        for (String field : fieldsToDelete) {
            Map<String, String[]> existingItems = elasticService.queryItems( field + ":*", "id", new String[]{"id"}, -1);

            // buffer all updates for a single field, regardless of size
            List<UpdateQuery> buffer = new ArrayList<>();

            for (Map.Entry<String, String[]> es : existingItems.entrySet()) {
                Document doc = Document.create();
                doc.put(field, null);
                buffer.add(UpdateQuery.builder(es.getValue()[0]).withDocument(doc).build());
            }

            elasticService.updateImmediately(buffer);

            logService.log(taskType, "delete field " + field + ", removed:" + existingItems.size());

        }
    }
}
