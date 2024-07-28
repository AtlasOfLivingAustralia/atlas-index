package au.org.ala.search.service.remote;

import au.org.ala.search.model.AdminIndex;
import au.org.ala.search.model.ImageUrlType;
import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.dto.*;
import au.org.ala.search.model.query.Op;
import au.org.ala.search.model.query.Term;
import au.org.ala.search.names.VernacularType;
import au.org.ala.search.service.LegacyService;
import au.org.ala.search.util.QueryParserUtil;
import au.org.ala.search.util.Weight;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.SortOptions;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.Time;
import co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import co.elastic.clients.elasticsearch._types.aggregations.AggregationBuilders;
import co.elastic.clients.elasticsearch._types.aggregations.MultiBucketAggregateBase;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import co.elastic.clients.elasticsearch._types.query_dsl.*;
import co.elastic.clients.elasticsearch.core.ClosePointInTimeRequest;
import co.elastic.clients.elasticsearch.core.OpenPointInTimeRequest;
import co.elastic.clients.elasticsearch.core.SearchRequest;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.elasticsearch.core.search.PointInTimeReference;
import co.elastic.clients.json.JsonData;
import com.opencsv.CSVReader;
import com.opencsv.CSVWriter;
import com.opencsv.exceptions.CsvValidationException;
import jakarta.annotation.PostConstruct;
import jakarta.json.JsonValue;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchAggregation;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchAggregations;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.client.elc.NativeQueryBuilder;
import org.springframework.data.elasticsearch.core.*;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.*;
import org.springframework.data.elasticsearch.core.query.Query;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.*;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * TODO: Split into separate services
 * - update services
 * - legacy search services, excluding services used by V2 Controller and updates
 * - new search services, but include legacy services still required for updates and V2 Controller
 */
@Service
public class ElasticService {
    final static int BULK_BATCH_SIZE = 100;
    private static final Logger logger = LoggerFactory.getLogger(ElasticService.class);
    protected final ElasticsearchOperations elasticsearchOperations;
    protected final ElasticsearchClient elasticsearchClient;
    protected final LegacyService legacyService;
    private final MessageSource messageSource;

    final private Integer MAX_RESULTS = 10000;
    public Map<String, SearchItemIndex> datasetMap;
    List<IndexedField> indexFieldsList = null;
    Set<String> validFieldNames = null;
    @Value("${elastic.index}")
    private String elasticIndex;
    @Value("${elastic.pageSize}")
    private Integer elasticPageSize;
    @Value("${priority.norm}")
    private Double priorityNorm;
    @Value("${priority.min}")
    private Double priorityMin;
    @Value("${priority.max}")
    private Double priorityMax;
    @Value("${vernacularName.common}")
    private String vernacularNameCommon;
    @Value("${image.url}")
    private String imageUrl;
    @Value("${attribution.default}")
    private String attributionDefault;
    @Value("${attribution.synonym}")
    private String attributionSynonym;
    @Value("${attribution.common}")
    private String attributionCommon;
    @Value("${attribution.identifier}")
    private String attributionIdentifier;
    @Value("${attribution.variant}")
    private String attributionVariant;
    @Value("${commonName.defaultLanguage}")
    private String commonNameDefaultLanguage;
    @Value("${collections.url}")
    private String collectionsUrl;
    @Value("${defaultDownloadFields}")
    private String defaultDownloadFields;
    private Integer vernacularNameCommonPriority;

    @Value("${downloadMaxRows}")
    private Integer downloadMaxRows;

    public ElasticService(
            ElasticsearchOperations elasticsearchOperations, ElasticsearchClient elasticsearchClient, LegacyService legacyService, MessageSource messageSource) {
        this.elasticsearchOperations = elasticsearchOperations;
        this.elasticsearchClient = elasticsearchClient;
        this.legacyService = legacyService;
        this.messageSource = messageSource;
    }

    @PostConstruct
    void init() {
        VernacularType vt = VernacularType.find(vernacularNameCommon.toUpperCase());
        if (vt != null) {
            vernacularNameCommonPriority = vt.getPriority();
        } else {
            logger.error("config vernacularNameCommon=" + vernacularNameCommon + " is invalid");
        }

        // @Document(createIndex=true) is not working as expected when >1 @Document, so create explicitly if !exist
        IndexOperations indexOperations = elasticsearchOperations.indexOps(AdminIndex.class);
        if (!indexOperations.exists()) {
            indexOperations.createWithMapping();
        }

        indexOperations = elasticsearchOperations.indexOps(SearchItemIndex.class);
        if (!indexOperations.exists()) {
            indexOperations.createWithMapping();
        }

        datasetMap = new ConcurrentHashMap<>();
    }

    public Map<String, Date> queryItems(String field, String value) {
        int page = 0;
        boolean hasMore = true;

        Map<String, Date> result = new HashMap<>();

        while (hasMore) {
            PageRequest p = PageRequest.of(page, elasticPageSize);
            page++;

            Query query = NativeQuery.builder()
                    .withQuery(q -> q.term(t -> t.field(field).value(value)))
                    .withSourceFilter(new FetchSourceFilter(new String[]{"id", "modified"}, null))
                    .withPageable(p)
                    .build();

            Map<String, Date> currentPage = elasticsearchOperations.search(query, SearchItemIndex.class).stream()
                    .collect(Collectors.toMap(a -> a.getContent().getId(), a -> a.getContent().getModified()));

            hasMore = currentPage.size() == elasticPageSize;

            result.putAll(currentPage);
        }
        return result;
    }

    public Map<String, String[]> queryItems(String field, String value, String keyField, String[] otherFields, int max) {
        int page = 0;
        boolean hasMore = true;
        int pageSize = max < 0 ? elasticPageSize : max;

        Map<String, String[]> result = new HashMap<>();

        while (hasMore) {
            PageRequest p = PageRequest.of(page, pageSize);
            page++;

            NativeQueryBuilder query = NativeQuery.builder()
                    .withSourceFilter(new FetchSourceFilter(otherFields, null))
                    .withPageable(p);
            if ("*".equals(value)) {
                if (field.startsWith("data.")) {
                    query.withQuery(q -> q.nested(n -> n.path("data").query(q2 -> q2.exists(t -> t.field(field)))));
                } else {
                    query.withQuery(q -> q.exists(t -> t.field(field)));
                }
            } else {
                query.withQuery(q -> q.term(t -> t.field(field).value(value)));
            }

            Map<String, String[]> currentPage = new HashMap<>();
            for (SearchHit<Map> item : elasticsearchOperations.search(query.build(), Map.class, IndexCoordinates.of(elasticIndex))) {
                String[] values = new String[otherFields.length];
                String key;
                try {
                    key = (String) item.getContent().get(keyField);
                    for (int i = 0; i < otherFields.length; i++) {
                        if (otherFields[i].startsWith("data.") && !item.getContent().containsKey(otherFields[i])) {
                            if (item.getContent().get("data") != null) {
                                values[i] = String.valueOf(((Map) item.getContent().get("data")).get(otherFields[i].substring(5)));
                            }
                        } else {
                            values[i] = (String) item.getContent().get(otherFields[i]);
                        }
                    }
                } catch (Exception e) {
                    return null;
                }

                currentPage.put(key, values);
            }

            hasMore = currentPage.size() == pageSize && pageSize == elasticPageSize;

            result.putAll(currentPage);
        }
        return result;
    }

    public SearchItemIndex getDocument(String id) {
        Query query = NativeQuery.builder()
                .withQuery(q -> q.term(t -> t.field("id").value(id)))
                .withMaxResults(1)
                .build();

        Optional<SearchHit<SearchItemIndex>> result = elasticsearchOperations.search(query, SearchItemIndex.class).stream().findFirst();

        return result.map(SearchHit::getContent).orElse(null);
    }

    public Map getDocumentMap(String id) {
        Query query = NativeQuery.builder()
                .withQuery(q -> q.term(t -> t.field("id").value(id)))
                .withMaxResults(1)
                .build();

        Optional<SearchHit<Map>> result = elasticsearchOperations.search(query, Map.class, IndexCoordinates.of(elasticIndex)).stream().findFirst();

        return result.map(SearchHit::getContent).orElse(null);
    }

    // This retrieves the document id for the guid. It will be idxtype TAXON and not have an acceptedConceptID.
    public String queryTaxonId(String guid) {
        Query query = NativeQuery.builder()
                .withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("guid").value(guid)));
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXON")));
                    bq.filter(f -> f.bool(b -> b.mustNot(q -> q.exists(eq -> eq.field("acceptedConceptID")))));
                    return bq;
                }))
                .withSourceFilter(new FetchSourceFilter(new String[]{"id"}, null))
                .withMaxResults(1)
                .build();

        Optional<SearchHit<SearchItemIndex>> result = elasticsearchOperations.search(query, SearchItemIndex.class).stream().findFirst();

        return result.map(it -> it.getContent().getId()).orElse(null);
    }

    public void addWeights(SearchItemIndex item) {
        item.setSearchWeight(Weight.calcSearchWeight(item, priorityMin, priorityMax, priorityNorm, vernacularNameCommonPriority));
        item.setSuggestWeight(Weight.calcSuggestWeight(item, priorityMin, priorityMax, priorityNorm, vernacularNameCommonPriority));
    }

    @Async("elasticSearchUpdate")
    public void flush(List<IndexQuery> buffer) {
        if (!buffer.isEmpty()) {
            try {
                elasticsearchOperations.bulkIndex(buffer, SearchItemIndex.class);
            } catch (Exception e) {
                logger.error("failed: " + e.getMessage(), e);
            }
        }
    }

    public int flushImmediately(List<IndexQuery> buffer) {
        int count = buffer.size();

        if (!buffer.isEmpty()) {
            // this does inserts and updates
            elasticsearchOperations.bulkIndex(buffer, SearchItemIndex.class);

            buffer.clear();
        }

        return count;
    }

    /**
     * Usage: elasticService.update(new ArrayList<>(buffer));
     */
    @Async("elasticSearchUpdate")
    public void update(List<UpdateQuery> buffer) {
        if (!buffer.isEmpty()) {
            try {
                elasticsearchOperations.bulkUpdate(buffer, SearchItemIndex.class);
            } catch (Exception e) {
                logger.error("failed: " + e.getMessage(), e);
            }
        }
    }

    public void updateImmediately(List<UpdateQuery> buffer) {
        if (!buffer.isEmpty()) {
            // this does inserts and updates
            elasticsearchOperations.bulkUpdate(buffer, SearchItemIndex.class);
        }
    }

    public long removeDeletedItems(Map<String, Date> existingItems) {
        if (!existingItems.isEmpty()) {
            Query deleteQuery = new NativeQueryBuilder()
                    .withQuery(q -> q.terms(t -> t.field("id").terms(ts ->
                            ts.value(existingItems.keySet().stream().map(FieldValue::of).collect(Collectors.toList())))))
                    .build();
            ByQueryResponse op = elasticsearchOperations.delete(deleteQuery, SearchItemIndex.class);
            return op.getDeleted();
        }
        return 0;
    }

    public long removeDeletedItems(List<String> existingIds) {
        if (!existingIds.isEmpty()) {
            Query deleteQuery = new NativeQueryBuilder()
                    .withQuery(q -> q.terms(t -> t.field("id").terms(ts ->
                            ts.value(existingIds.stream().map(FieldValue::of).collect(Collectors.toList())))))
                    .build();
            ByQueryResponse op = elasticsearchOperations.delete(deleteQuery, SearchItemIndex.class);
            return op.getDeleted();
        }
        return 0;
    }

    public void queryDelete(String field, String value) {
        Query deleteQuery = new NativeQueryBuilder()
                .withQuery(q -> q.term(t -> t.field(field).value(value)))
                .build();
        ByQueryResponse response = elasticsearchOperations.delete(deleteQuery, SearchItemIndex.class);

        logger.info("deleting " + response.getDeleted() + " found with " + field + ":" + value);
    }

    public long queryCount(String field, String value) {
        Query query = NativeQuery.builder()
                .withQuery(q -> q.term(t -> t.field(field).value(value)))
                .withFilter(q -> q.term(t -> t.field("_index").value(elasticIndex)))
                .withMaxResults(0)
                .withTrackScores(false)
                .build();

        return elasticsearchOperations.search(query, SearchItemIndex.class).getTotalHits();
    }

    // This will not work on dynamic fields given the type "text".
    public List<String> queryFacet(String field, String value, String facet) {
        Query query = NativeQuery.builder()
                .withQuery(q -> q.term(t -> t.field(field).value(value)))
                .withMaxResults(0)
                .withAggregation("facet", Aggregation.of(a -> a.terms(t -> t.field(facet).size(Integer.MAX_VALUE))))
                .build();

        return ((ElasticsearchAggregations) elasticsearchOperations.search(query, SearchItemIndex.class).getAggregations())
                .aggregations().getFirst().aggregation().getAggregate().sterms().buckets().array().stream()
                .map(a -> a.key().stringValue()).toList();
    }

    public IndexQuery buildIndexQuery(SearchItemIndex item) {
        addWeights(item);

        return new IndexQueryBuilder().withId(item.getId()).withObject(item).build();
    }

    String openPointInTime() throws IOException {
        OpenPointInTimeRequest request = new OpenPointInTimeRequest.Builder()
                .index(elasticIndex)
                .keepAlive(new Time.Builder().time("60m").build())
                .build();

        return elasticsearchClient.openPointInTime(request).id();
    }

    // TODO: Use PIT for queryPointInTimeAfter
    // 1. openPointInTime
    // 2. queryPointInTimeAfter
    // 3. update PIT and searchAfter. repeat (2)
    // 4. closePointInTime
    void closePointInTime(String pit) throws IOException {
        ClosePointInTimeRequest request = new ClosePointInTimeRequest.Builder().id(pit).build();

        elasticsearchClient.closePointInTime(request);
    }

    public SearchResponse<SearchItemIndex> queryPointInTimeAfter(
            String pit,
            List<FieldValue> searchAfter,
            Integer pageSize,
            Map<String, Object> query,
            co.elastic.clients.elasticsearch._types.query_dsl.Query opQuery,
            List<FieldAndFormat> fieldList,
            List<SortOptions> sortOptions,
            Boolean trackTotalHits)
            throws IOException {

        SearchRequest.Builder searchRequest = new SearchRequest.Builder()
                .size(pageSize)
                .trackTotalHits(t -> t.enabled(trackTotalHits))
                .index(elasticIndex) // Is this needed when using elasticsearchClient?
                .source(sc -> sc.fetch(false));

        if (query != null) {
            // TODO: migrate to using Op generated query
            searchRequest.query(q -> q.bool(bq -> {
                for (Map.Entry<String, Object> item : query.entrySet()) {
                    if (item.getValue() instanceof List) {
                        bq.must(
                                q2 -> q2.bool(bq2 -> {
                                    for (Object v : (List) item.getValue()) {
                                        if (item.getKey().startsWith("-")) {
                                            bq2.mustNot(q3 -> q3.term(t -> t.field(fieldMapping(item.getKey())).value((String) v)));
                                        } else {
                                            bq2.should(q3 -> q3.term(t -> t.field(fieldMapping(item.getKey())).value((String) v)));
                                        }
                                    }
                                    return bq2;
                                }));
                    } else if (item.getKey().startsWith("not exists ")) {
                        bq.mustNot(q3 -> q3.exists(eq -> eq.field(fieldMapping(item.getKey().substring("not exists ".length())))));
                    } else if (item.getKey().startsWith("exists ")) {
                        bq.must(q3 -> q3.exists(eq -> eq.field(fieldMapping(item.getKey().substring("exists ".length())))));
                    } else if (item.getKey().startsWith("-")) {
                        bq.mustNot(f -> f.term(t -> t.field(fieldMapping(item.getKey().substring(1))).value((String) item.getValue())));
                    } else {
                        bq.filter(f -> f.term(t -> t.field(fieldMapping(item.getKey())).value((String) item.getValue())));
                    }
                }
                return bq;
            }));
        } else if (opQuery != null) {
            searchRequest.query(opQuery);
        }

        if (fieldList != null) {
            searchRequest.fields(fieldList);
        } else {
            searchRequest.source(s -> s.filter(sf -> sf.includes("*")));
        }

        if (pit != null) {
            searchRequest.sort(s -> s.field(fs -> fs.field("_shard_doc").order(SortOrder.Asc)));
            searchRequest.pit(new PointInTimeReference.Builder().id(pit).keepAlive(t -> t.time("60m")).build());
        } else if (sortOptions != null) {
            searchRequest.sort(sortOptions);
        } else {
            searchRequest.sort(s -> s.field(fs -> fs.field("id").order(SortOrder.Asc)));
        }

        if (searchAfter != null) {
            searchRequest.searchAfter(searchAfter);
        }

        return elasticsearchClient.search(searchRequest.build(), SearchItemIndex.class);
    }

    private String fieldMapping(String key) {
        if (key.startsWith("rk") || key.startsWith("conservation_")) {
            return "data." + key;
        }
        // TODO: other data.* fields, if they are in use

        return key;
    }

    public List<IndexedField> indexFields(boolean forceUpdate) {
        if (indexFieldsList == null || forceUpdate) {
            List<IndexedField> result = new ArrayList<>(250);

            Map<String, Object> properties = (Map<String, Object>) elasticsearchOperations.indexOps(SearchItemIndex.class).getMapping().get("properties");

            for (Map.Entry<String, Object> item : properties.entrySet()) {
                result.addAll(propertyToIndexedFields(item, properties.keySet()));
            }

            indexFieldsList = result;
            validFieldNames = result.stream().map(IndexedField::getName).collect(Collectors.toSet());
        }

        return indexFieldsList;
    }

    public Set<String> validFields(boolean forceUpdate) {
        if (indexFieldsList == null || forceUpdate) {
            indexFields(true);
        }

        return validFieldNames;
    }

    private Collection<IndexedField> propertyToIndexedFields(Map.Entry<String, Object> item, Set<String> existingKeys) {
        Map<String, Object> attr = (Map<String, Object>) item.getValue();

        String type = (String) attr.get("type");
        String dataType = switch (type) {
            case "keyword", "text" -> "string";
            case "boolean" -> "boolean";
            case "integer" -> "int";
            case "long" -> "long";
            case "double" -> "double";
            case "float" -> "float";
            case "object" -> "object";
            case "nested" -> "nested";
            default -> "other";
        };

        if ("nested".equals(type)) {
            // recurse
            Map<String, Object> properties = (Map<String, Object>) attr.get("properties");
            List<IndexedField> list = new ArrayList<>(properties.size());
            for (Map.Entry<String, Object> property : properties.entrySet()) {
                Collection<IndexedField> subList = propertyToIndexedFields(property, existingKeys);

                // check for duplicates when flattening
                for (IndexedField subItem : subList) {
                    if (existingKeys.contains(subItem.getName())) {
                        logger.warn("Found a duplicate when flattening indexFields: " + subItem.getName());
                    }
                }

                list.addAll(subList);
            }
            return list;
        } else {
            return Collections.singleton(new IndexedField(item.getKey(), dataType, !"text".equals(type), true, null));
        }
    }

    public List<Classification> getClassification(SearchItemIndex taxon) {
        List<Classification> classification = new ArrayList<>();

        if (taxon == null) {
            return classification; // empty list
        }

        classification.add(new Classification(taxon.rank, taxon.rankID, taxon.scientificName, taxon.guid));

        //get parents
        String parentGuid = taxon.parentGuid;
        Set<String> seen = new HashSet<>();
        boolean stop = false;
        while (!stop && StringUtils.isNotEmpty(parentGuid)) {
            taxon = getTaxon(parentGuid);
            if (taxon != null && !seen.contains(taxon.guid)) {
                classification.add(new Classification(taxon.rank, taxon.rankID, taxon.scientificName, taxon.guid));
                seen.add(taxon.guid);
                parentGuid = taxon.parentGuid;
            } else {
                stop = true;
            }
        }
        return classification;
    }

    public SearchItemIndex getTaxon(String q) {
        return getTaxon(q, true, true);
    }

    public SearchItemIndex getTaxon(String q, boolean follow, boolean nameFallback) {
        NativeQueryBuilder query =
                NativeQuery.builder().withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXON")));
                    bq.must(bqq -> bqq.bool(b -> {
                        b.should(s -> s.term(t2 -> t2.field("guid").value(q)));
                        b.should(s -> s.term(t3 -> t3.field("linkIdentifier").caseInsensitive(true).value(q)));
                        return b;
                    }));
                    return bq;
                })).withMaxResults(1);

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.getTotalHits() > 0) {
            // return accepted
            SearchItemIndex item = result.getSearchHits().getFirst().getContent();
            if (follow && StringUtils.isNotEmpty(item.getAcceptedConceptID())) {
                return getTaxon(item.getAcceptedConceptID());
            } else {
                return item;
            }
        } else if (nameFallback) {
            SearchItemIndex item = getTaxonByName(q, true);
            if (follow && item != null && StringUtils.isNotEmpty(item.acceptedConceptID)) {
                return getTaxon(item.acceptedConceptID);
            } else {
                return item;
            }
        }
        return null;
    }

    public Map getTaxonMap(String q, boolean follow, boolean nameFallback) {
        NativeQueryBuilder query =
                NativeQuery.builder().withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXON")));
                    bq.must(bqq -> bqq.bool(b -> {
                        b.should(s -> s.term(t2 -> t2.field("guid").value(q)));
                        b.should(s -> s.term(t3 -> t3.field("linkIdentifier").caseInsensitive(true).value(q)));
                        return b;
                    }));
                    return bq;
                })).withMaxResults(1);

        SearchHits<Map> result = elasticsearchOperations.search(query.build(), Map.class, IndexCoordinates.of(elasticIndex));
        if (result.getTotalHits() > 0) {
            // return accepted
            Map item = result.getSearchHits().getFirst().getContent();
            if (follow && StringUtils.isNotEmpty((String) item.get("acceptedConceptID"))) {
                return getTaxonMap((String) item.get("acceptedConceptID"), true, true);
            } else {
                return item;
            }
        } else if (nameFallback) {
            Map item = getTaxonByNameMap(q, true);
            if (follow && item != null && StringUtils.isNotEmpty((String) item.get("acceptedConceptID"))) {
                return getTaxonMap((String) item.get("acceptedConceptID"), true, true);
            } else {
                return item;
            }
        }
        return null;
    }

    public Map<String, String> getNestedFields(String id) {
        NativeQueryBuilder query =
                NativeQuery.builder().withQuery(wq -> wq.term(t -> t.field("id").value(id))).withMaxResults(1);

        SearchHits<Map> result = elasticsearchOperations.search(query.build(), Map.class, IndexCoordinates.of(elasticIndex));
        if (result.getTotalHits() > 0) {
            // return with nested data only
            Map<String, Object> item = (Map<String, Object>) result.getSearchHits().getFirst().getContent();
            Map<String, String> data = (Map<String, String>) item.get("data");
            if (data == null) {
                data = new HashMap<>();
            }
            for (Map.Entry<String, Object> entry : item.entrySet()) {
                if (entry.getKey().startsWith("data.")) {
                    data.put(entry.getKey().substring(5), (String) entry.getValue());
                }
            }

            return data;
        }
        return null;
    }

    public SearchItemIndex getTaxonByName(String q, boolean searchVernacular) {
        List<SearchItemIndex> list = getTaxonsByName(q, 1, searchVernacular);
        if (!list.isEmpty()) {
            return list.getFirst();
        } else {
            return null;
        }
    }

    public Map getTaxonByNameMap(String q, boolean searchVernacular) {
        List<Map> list = getTaxonsByNameMap(q, 1, searchVernacular);
        if (!list.isEmpty()) {
            return list.getFirst();
        } else {
            return null;
        }
    }

    public List<SearchItemIndex> getTaxonsByName(String q, int max, boolean searchVernacular) {
        final String cleanQ = cleanupId(q);

        List<SearchItemIndex> list = new ArrayList<>();

        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.functionScore(fs -> fs.query(fsq -> fsq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXON")));
                    bq.must(bqq -> bqq.bool(b -> {
                        b.should(s -> s.term(t -> t.field("scientificName").value(cleanQ).caseInsensitive(true).boost(100.0f)));
                        b.should(s -> s.term(t -> t.field("nameComplete").value(cleanQ).caseInsensitive(true).boost(10.0f)));
                        if (searchVernacular) {
                            b.should(s -> s.matchPhrase(t -> t.field("commonName").query(cleanQ)));
                        }
                        return b;
                    }));
                    return bq;
                })).functions(fs1 -> fs1.fieldValueFactor(fv -> fv.field("searchWeight")))))
                .withMaxResults(max) // this is used by the legacy /guid/{name} field, and it has a max of 10
                .withTrackScores(true);

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.getTotalHits() > 0) {
            for (SearchHit<SearchItemIndex> hit : result.getSearchHits()) {
                list.add(hit.getContent());
            }
        }
        return list;
    }

    public List<Map> getTaxonsByNameMap(String q, int max, boolean searchVernacular) {
        final String cleanQ = cleanupId(q);

        List<Map> list = new ArrayList<>();

        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.functionScore(fs -> fs.query(fsq -> fsq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXON")));
                    bq.must(bqq -> bqq.bool(b -> {
                        b.should(s -> s.term(t -> t.field("scientificName").value(cleanQ).caseInsensitive(true).boost(100.0f)));
                        b.should(s -> s.term(t -> t.field("nameComplete").value(cleanQ).caseInsensitive(true).boost(10.0f)));
                        if (searchVernacular) {
                            b.should(s -> s.matchPhrase(t -> t.field("commonName").query(cleanQ)));
                        }
                        return b;
                    }));
                    return bq;
                })).functions(fs1 -> fs1.fieldValueFactor(fv -> fv.field("searchWeight")))))
                .withMaxResults(max) // this is used by the legacy /guid/{name} field, and it has a max of 10
                .withTrackScores(true);

        SearchHits<Map> result = elasticsearchOperations.search(query.build(), Map.class, IndexCoordinates.of(elasticIndex));
        if (result.getTotalHits() > 0) {
            for (SearchHit<Map> hit : result.getSearchHits()) {
                list.add(hit.getContent());
            }
        }
        return list;
    }

    public SearchItemIndex getTaxonByPreviousIdentifier(String q, boolean follow) {
        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("guid").value(q)));
                    return bq;
                }))
                .withMaxResults(1)
                .withTrackScores(false);

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.getTotalHits() > 0) {
            String taxonGuid = result.getSearchHits().getFirst().getContent().taxonGuid;
            if (StringUtils.isNotEmpty(taxonGuid)) {
                return getTaxon(taxonGuid, follow, false);
            }
        }
        return null;
    }

    public Map getTaxonByPreviousIdentifierMap(String q, boolean follow) {
        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("guid").value(q)));
                    return bq;
                }))
                .withMaxResults(1)
                .withTrackScores(false);

        SearchHits<Map> result = elasticsearchOperations.search(query.build(), Map.class, IndexCoordinates.of(elasticIndex));
        if (result.getTotalHits() > 0) {
            String taxonGuid = (String) result.getSearchHits().getFirst().getContent().get("taxonGuid");
            if (StringUtils.isNotEmpty(taxonGuid)) {
                return getTaxonMap(taxonGuid, follow, false);
            }
        }
        return null;
    }

    public List<SearchHit<SearchItemIndex>> getSynonyms(String acceptedConceptID) {
        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXON")));
                    bq.filter(f -> f.term(t -> t.field("acceptedConceptID").value(acceptedConceptID)));
                    return bq;
                }))
                .withMaxResults(MAX_RESULTS)
                .withTrackScores(false);

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.getTotalHits() > 0) {
            return result.getSearchHits();
        } else {
            return new ArrayList<>();
        }
    }

    public List<SearchHit<SearchItemIndex>> getTaxonGuid(String guid, IndexDocType type) {
        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value(type.name())));
                    bq.filter(f -> f.term(t -> t.field("taxonGuid").value(guid)));
                    return bq;
                }))
                .withMaxResults(MAX_RESULTS)
                .withTrackScores(false);

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.getTotalHits() > 0) {
            return result.getSearchHits();
        } else {
            return new ArrayList<>();
        }
    }

    public SearchItemIndex getDataset(String datasetID) {
        SearchItemIndex item = datasetMap.get(datasetID);
        if (item == null) {
            item = searchDataset(datasetID);
        }
        if (item != null) {
            datasetMap.put(datasetID, item);
        }
        return item;
    }

    public SearchItemIndex searchDataset(String datasetID) {
        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value(IndexDocType.DATARESOURCE.name())));
                    bq.filter(f -> f.term(t -> t.field("datasetID").value(datasetID)));
                    return bq;
                }))
                .withMaxResults(1)
                .withTrackScores(false);

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.getTotalHits() > 0) {
            return result.getSearchHits().getFirst().getContent();
        } else {
            return null;
        }
    }

    public SearchItemIndex getTaxonVariantByName(String q, boolean follow) {
        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq1 -> wq1.functionScore(fs -> fs.query(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXONVARIANT")));
                    bq.must(bqq -> bqq.bool(b -> b.should(s -> s.term(t -> t.field("scientificName").value(q).caseInsensitive(true)))
                            .should(s -> s.term(t -> t.field("nameComplete").value(q).caseInsensitive(true)))));
                    return bq;
                })).functions(fn -> fn.fieldValueFactor(fv -> fv.field("searchWeight")))))
                .withMaxResults(1)
                .withTrackScores(false);

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.getTotalHits() > 0) {
            // return taxonGuid TAXON
            return getTaxon(result.getSearchHits().getFirst().getContent().taxonGuid, follow, false);
        } else {
            return null;
        }
    }

    public Map getTaxonVariantByNameMap(String q, boolean follow) {
        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq1 -> wq1.functionScore(fs -> fs.query(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXONVARIANT")));
                    bq.must(bqq -> bqq.bool(b -> b.should(s -> s.term(t -> t.field("scientificName").value(q).caseInsensitive(true)))
                            .should(s -> s.term(t -> t.field("nameComplete").value(q).caseInsensitive(true)))));
                    return bq;
                })).functions(fn -> fn.fieldValueFactor(fv -> fv.field("searchWeight")))))
                .withMaxResults(1)
                .withTrackScores(false);

        SearchHits<Map> result = elasticsearchOperations.search(query.build(), Map.class, IndexCoordinates.of(elasticIndex));
        if (result.getTotalHits() > 0) {
            // return taxonGuid TAXON
            return getTaxonMap((String) result.getSearchHits().getFirst().getContent().get("taxonGuid"), follow, false);
        } else {
            return null;
        }
    }

    public List<ChildConcept> getChildConcepts(String taxonID, Integer within, Boolean unranked) {
        String cleanId = cleanupId(taxonID);
        SearchItemIndex baseTaxon = getTaxon(cleanId);
        int baseRankID = baseTaxon != null && baseTaxon.rankID != null ? baseTaxon.rankID : -1;

        // TODO: does this query do what I think it does?
        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXON")));
                    bq.filter(f -> f.term(t -> t.field("parentGuid").value(cleanId)));
                    if (baseRankID > 0 && within > 0) {
                        // rankID in a range
                        bq.should(q -> q.range(r ->
                                r.field("rankID")
                                        .gte(JsonData.of(unranked ? -1 : baseRankID + 1))
                                        .lte(JsonData.of(baseRankID + within))));
                        // OR rankID does not exist
                        bq.should(q -> q.bool(b -> b.mustNot(m -> m.exists(r -> r.field("rankID")))));
                        // TODO: original code has an fq parameter that is not documented in openapi, is this used?
                    }
                    return bq;
                }))
                .withMaxResults(MAX_RESULTS)
                .withTrackScores(false);

        List<ChildConcept> children = new ArrayList<>();

        // queryChildConcepts
        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.hasSearchHits()) {
            for (SearchHit<SearchItemIndex> hit : result.getSearchHits()) {
                SearchItemIndex taxon = hit.getContent();
                children.add(new ChildConcept(taxon.guid, taxon.parentGuid, taxon.scientificName,
                        taxon.nameComplete != null ? taxon.nameComplete : taxon.scientificName,
                        taxon.nameFormatted, taxon.scientificNameAuthorship, taxon.rank, taxon.rankID));
            }
        }

        children.sort((o1, o2) -> {
            // TODO: copied this from bie-index, it looks odd
            Integer r1 = o1.getRankID();
            Integer r2 = o2.getRankID();

            if (r1 <= 0 && r2 > 0) {
                return 10000;
            }
            if (r2 <= 0 && r1 > 0) {
                return -10000;
            }
            if (!r2.equals(r1)) {
                return r1 - r2;
            }

            if (o1.getName() != null) {
                return o1.getName().compareTo(o2.getName());
            } else {
                return 0;
            }
        });

        return children;
    }

    public Map<String, Object> imageSearch(String taxonID, Integer start, Integer rows) {
        String guid = null;
        String rank = null;
        if (StringUtils.isNotEmpty(taxonID)) {
            SearchItemIndex item = getTaxon(taxonID, false, false);
            if (item == null) {
                return null;
            }
            guid = item.guid;
            rank = item.rank;
        }

        final String fguid = guid;
        final String frank = rank;

        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXON")));
                    // rankID in a range
                    bq.must(q -> q.range(r -> r.field("rankID").gte(JsonData.of(7000))));
                    // AND image available
                    bq.must(q -> q.exists(e -> e.field("image")));
                    if (StringUtils.isNotEmpty(taxonID)) {
                        // AND (guid:fguid OR rk_frank:fguid)
                        bq.must(q -> q.bool(b -> b.should(s -> s.term(t -> t.field("guid").value(fguid)))
                                // TODO: rk_* searches are problematic because it is not a multivalue field
                                .should(s -> s.term(t -> t.field("rk_" + frank).value(fguid)))));
                    }
                    return bq;
                }))
                .withPageable(PageRequest.of(start / rows, rows));

        SearchHits<SearchItemIndex> searchResults = elasticsearchOperations.search(query.build(), SearchItemIndex.class);

        List<Map<String, Object>> result = new ArrayList<>();
        // TODO: mapping to SearchItemIndex.class can exclude some data.* fields
        for (SearchHit<SearchItemIndex> hit : searchResults.getSearchHits()) {
            result.add(formatDoc(hit.getContent()));
        }

        Map<String, Object> output = new HashMap<>();
        output.put("totalRecords", searchResults.getTotalHits());
        output.put("facetResults", new String[0]);
        output.put("results", result);

        return output;
    }

    public ShortProfile getShortProfile(String taxonID) {
        SearchItemIndex item = getTaxon(taxonID);

        if (item != null) {
            String thumbnail = null;
            String large = null;
            if (StringUtils.isNotEmpty(item.image)) {
                String image = item.image.split(",")[0];
                thumbnail = imageUrl + ImageUrlType.THUMBNAIL.path + image;
                large = imageUrl + ImageUrlType.LARGE.path + image;

            }
            return new ShortProfile(item.guid, item.scientificName, item.scientificNameAuthorship,
                    item.rank, item.rankID, item.data.get("rk_kingdom"), item.data.get("rk_family"), item.commonNameSingle,
                    thumbnail, large);
        }

        return null;
    }

    public LongProfile getLongProfileForName(String name, Boolean vernacular) {
        SearchItemIndex item = getTaxonByName(name, vernacular);
        if (item != null) {
            String imageLarge = null;
            String imageThumbnail = null;
            String imageSmall = null;
            String imageMetadata = null;
            if (StringUtils.isNotEmpty(item.image)) {
                String image = item.image.split(",")[0];
                imageLarge = imageUrl + ImageUrlType.LARGE.path + image;
                imageThumbnail = imageUrl + ImageUrlType.THUMBNAIL.path + image;
                imageSmall = imageUrl + ImageUrlType.SMALL.path + image;
                imageMetadata = imageUrl + ImageUrlType.METADATA.path + image;
            }

            return new LongProfile(item.guid,
                    item.guid,
                    item.parentGuid,
                    item.scientificName,
                    item.nameComplete,
                    item.commonName,
                    item.commonNameSingle,
                    item.rank,
                    item.rankID,
                    StringUtils.isNotEmpty(item.acceptedConceptID) ? item.acceptedConceptID : item.guid,
                    StringUtils.isNotEmpty(item.acceptedConceptName) ? item.acceptedConceptName : item.scientificName,
                    item.taxonomicStatus,
                    item.image,
                    imageLarge,
                    imageThumbnail,
                    imageLarge,
                    imageSmall,
                    imageMetadata,
                    item.data.get("rk_kingdom"),
                    item.data.get("rk_phylum"),
                    item.data.get("rk_class"),
                    item.data.get("rk_order"),
                    item.data.get("rk_family"),
                    item.data.get("rk_genus"),
                    item.scientificNameAuthorship,
                    item.linkIdentifier);
        } else {
            return null;
        }
    }

    public List<TaxaBatchItem> getTaxa(List<String> taxonIDs) {
        List<TaxaBatchItem> matchingTaxa = new ArrayList<>();

        Map<String, TaxaBatchItem> resultMap = new HashMap<>();

        List<String> buffer = new ArrayList<>(BULK_BATCH_SIZE);
        for (int i = 0; i < taxonIDs.size(); i++) {
            buffer.add(taxonIDs.get(i));

            if (buffer.size() == BULK_BATCH_SIZE || i == taxonIDs.size() - 1) {
                List<TaxaBatchItem> results = getTaxaBatch(buffer);

                for (TaxaBatchItem result : results) {
                    resultMap.put(result.getGuid(), result);
                    if (StringUtils.isNotEmpty(result.getLinkIdentifier())) {
                        resultMap.put(result.getLinkIdentifier(), result);
                    }
                }

                for (String str : buffer) {
                    matchingTaxa.add(resultMap.get(str));
                }

                buffer.clear();
            }
        }
        return matchingTaxa;
    }

    private List<TaxaBatchItem> getTaxaBatch(List<String> guidList) {
        List<TaxaBatchItem> output = new ArrayList<>(guidList.size());
        List<FieldValue> list = guidList.stream().map(FieldValue::of).toList();

        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.bool(bq -> {
                    bq.filter(f -> f.term(t -> t.field("idxtype").value("TAXON")));
                    bq.should(bqq -> bqq.terms(t -> t.field("guid").terms(tq -> tq.value(list))));
                    bq.should(bqq -> bqq.terms(t -> t.field("linkIdentifier").terms(tq -> tq.value(list))));
                    return bq;
                }))
                .withMaxResults(guidList.size())
                .withTrackScores(false);

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.getTotalHits() > 0) {
            for (SearchHit<SearchItemIndex> hit : result.getSearchHits()) {
                SearchItemIndex item = hit.getContent();

                String thumbnail = null;
                String smallImage = null;
                String largeImage = null;
                if (StringUtils.isNotEmpty(item.image)) {
                    String image = item.image;
                    thumbnail = imageUrl + ImageUrlType.THUMBNAIL.path + image;
                    smallImage = imageUrl + ImageUrlType.SMALL.path + image;
                    largeImage = imageUrl + ImageUrlType.LARGE.path + image;
                }

                output.add(new TaxaBatchItem(
                        item.guid,
                        item.scientificName,
                        item.scientificNameAuthorship,
                        StringUtils.isNotEmpty(item.nameComplete) ? item.nameComplete : item.scientificName,
                        item.rank,
                        item.data.get("rk_kingdom"),
                        item.data.get("rk_phylum"),
                        item.data.get("rk_class"),
                        item.data.get("rk_order"),
                        item.data.get("rk_family"),
                        item.data.get("rk_genus"),
                        item.datasetName,
                        item.datasetID,
                        item.wikiUrl_s,
                        item.hiddenImages_s,
                        thumbnail,
                        smallImage,
                        largeImage,
                        item.linkIdentifier,
                        item.commonNameSingle));
            }
        }

        return output;
    }

    public Map<String, Object> extractClassification(SearchItemIndex item) {
        Map<String, Object> map = new LinkedHashMap<>();

        String orderString = item.data.get("rankOrder");
        if (StringUtils.isNotEmpty(orderString)) {
            String[] orderedKeys = orderString.split(",");
            for (int i = orderedKeys.length - 1; i >= 0; i--) {
                String next = orderedKeys[i];
                map.put(next, item.data.get("rk_" + next));
                map.put(next + "Guid", item.data.get("rkid_" + next));
            }
        }

        if (StringUtils.isNotEmpty(item.rank)) {
            map.put(item.rank, item.scientificName); // current name in classification
            map.put(item.rank + "Guid", item.guid);
        }

        map.put("scientificName", item.scientificName);
        map.put("guid", item.guid);

        return map;
    }

    public String cleanupId(String id) {
        id = id.replaceAll("\\+", " ");

        // attempt decode
        try {
            id = URLDecoder.decode(id, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
        }

        // substitutions for legacy requests
        if (id.matches("https:/[^/]")) {
            id = id.replaceAll("https:/", "https://");
        }

        return id.trim();
    }

    public Map<String, Object> getTaxonResponse(String id) {
        id = cleanupId(id);

        SearchItemIndex taxon = getTaxon(id, false, false);
        if (taxon == null) {
            taxon = getTaxonByName(id, true);
        }
        if (taxon == null) {
            taxon = getTaxonVariantByName(id, false);
        }
        if (taxon == null) {
            taxon = getTaxonByPreviousIdentifier(id, false);
        }
        if (taxon == null) {
            return null;
        }

        // When there is an acceptedConceptID followed, return immediately
        if (!taxon.guid.equals(id)) {
            Map<String, Object> m = new HashMap<>();
            m.put("redirect", URLEncoder.encode(taxon.guid, StandardCharsets.UTF_8));
            return m;
        }

        /*
        TODO: There must be a better way to get nested data.

        Nested "data.*" has issues. For example information "data.conservation_*" is inconsistently returned from
        Elasticsearch in the _source. These are dynamicly created fields. Sometimes they return in the _source as
        "data.conservation_*": "value", other times as "data": { "conservation_*": "value" }. I think it has something
        to do with how elastic search stores the information as the fields are added with an update after the document
        is created. The updated mapping in the index is correct. It is just that the raw response from Elasticsearch
        can be wrong.

        The workaround is to avoid the default mapping from the response to SearchItemIndex.

         */
        Map<String, String> data = getNestedFields(taxon.id);
        taxon.data = data;

        List<SearchHit<SearchItemIndex>> synonyms = getSynonyms(taxon.guid);
        List<SearchHit<SearchItemIndex>> commonNames = new ArrayList<>(getTaxonGuid(taxon.guid, IndexDocType.COMMON));
        Map<String, Object> classification = extractClassification(taxon);

        commonNames.sort((n1, n2) -> {
            int s = n2.getContent().priority - n1.getContent().priority;
            if (s == 0) {
                s = n1.getContent().name.compareTo(n2.getContent().name);
            }
            return s;
        });

        List<SearchHit<SearchItemIndex>> identifiers = getTaxonGuid(taxon.guid, IndexDocType.IDENTIFIER);
        List<SearchHit<SearchItemIndex>> variants = getTaxonGuid(taxon.guid, IndexDocType.TAXONVARIANT);

        //Dataset index
        // TODO: clarify behaviour because some of these datasetID's are private, e.g. dr2700
        SearchItemIndex dataset = getDataset(taxon.datasetID);
        String taxonDatasetURL = null;
        String taxonDatasetName = null;
        if (dataset != null) {
            taxonDatasetURL = dataset.guid;
            taxonDatasetName = dataset.name;
        }

        Map<String, Object> model = new LinkedHashMap<>();
        Map<String, Object> taxonConcept = new LinkedHashMap<>();
        model.put("taxonConcept", taxonConcept);
        taxonConcept.put("guid", taxon.guid);
        taxonConcept.put("parentGuid", taxon.parentGuid);
        taxonConcept.put("nameString", taxon.scientificName);
        taxonConcept.put("nameComplete", taxon.nameComplete);
        taxonConcept.put("nameFormatted", taxon.nameFormatted);
        taxonConcept.put("author", taxon.scientificNameAuthorship);
        taxonConcept.put("nomenclaturalCode", taxon.nomenclaturalCode);
        taxonConcept.put("taxonomicStatus", taxon.taxonomicStatus);
        taxonConcept.put("nomenclaturalStatus", taxon.nomenclaturalStatus);
        taxonConcept.put("rankString", taxon.rank);
        taxonConcept.put("nameAuthority", StringUtils.isNotEmpty(taxon.datasetName) ? taxon.datasetName : (
                StringUtils.isNotEmpty(taxonDatasetName) ? taxonDatasetName : attributionDefault
        ));
        taxonConcept.put("rankID", taxon.rankID);
        taxonConcept.put("nameAccordingTo", taxon.nameAccordingTo);
        taxonConcept.put("nameAccordingToID", taxon.nameAccordingToID);
        taxonConcept.put("namePublishedIn", taxon.namePublishedIn);
        taxonConcept.put("namePublishedInYear", taxon.namePublishedInYear);
        taxonConcept.put("namePublishedInID", taxon.namePublishedInID);
        taxonConcept.put("taxonRemarks", taxon.taxonRemarks);
        taxonConcept.put("provenance", taxon.provenance);
        taxonConcept.put("favourite", taxon.favourite);
        taxonConcept.put("infoSourceURL", StringUtils.isNotEmpty(taxon.source) ? taxon.source : taxonDatasetURL);
        taxonConcept.put("datasetURL", taxonDatasetURL);

        model.put("taxonName", new ArrayList<>());
        model.put("classification", classification);
        model.put("synonyms", synonyms.stream().map(it -> {
            SearchItemIndex d = getDataset(it.getContent().datasetID);
            String datasetURL = d != null ? d.guid : null;
            String datasetName = d != null ? d.name : null;

            Map<String, Object> synonymMap = new LinkedHashMap<>();
            synonymMap.put("nameString", it.getContent().scientificName);
            synonymMap.put("nameComplete", it.getContent().nameComplete);
            synonymMap.put("nameFormatted", it.getContent().nameFormatted);
            synonymMap.put("nameGuid", it.getContent().guid);
            synonymMap.put("nomenclaturalCode", it.getContent().nomenclaturalCode);
            synonymMap.put("taxonomicStatus", it.getContent().taxonomicStatus);
            synonymMap.put("nomenclaturalStatus", it.getContent().nomenclaturalStatus);
            synonymMap.put("nameAccordingTo", it.getContent().nameAccordingTo);
            synonymMap.put("nameAccordingToID", it.getContent().nameAccordingToID);
            synonymMap.put("namePublishedIn", it.getContent().namePublishedIn);
            synonymMap.put("namePublishedInYear", it.getContent().namePublishedInYear);
            synonymMap.put("namePublishedInID", it.getContent().namePublishedInID);
            synonymMap.put("nameAuthority", StringUtils.isNotEmpty(it.getContent().datasetName) ? it.getContent().datasetName :
                    (StringUtils.isNotEmpty(datasetName) ? datasetName :
                            (StringUtils.isNotEmpty(attributionSynonym) ? attributionSynonym : attributionDefault)));
            synonymMap.put("taxonRemarks", it.getContent().taxonRemarks);
            synonymMap.put("provenance", it.getContent().provenance);
            synonymMap.put("infoSourceURL", StringUtils.isNotEmpty(it.getContent().source) ? it.getContent().source : datasetURL);
            synonymMap.put("datasetURL", datasetURL);

            return synonymMap;
        }).toList());

        model.put("commonNames", commonNames.stream().map(it -> {
            SearchItemIndex d = getDataset(it.getContent().datasetID);
            String datasetURL = d != null ? d.guid : null;
            String datasetName = d != null ? d.name : null;

            Map<String, Object> commonNamesMap = new LinkedHashMap<>();
            commonNamesMap.put("nameString", it.getContent().name);
            commonNamesMap.put("status", it.getContent().status);
            commonNamesMap.put("priority", it.getContent().priority);
            commonNamesMap.put("language", StringUtils.isNotEmpty(it.getContent().language) ? it.getContent().language : commonNameDefaultLanguage);
            commonNamesMap.put("temporal", it.getContent().temporal);
            commonNamesMap.put("locationID", it.getContent().locationID);
            commonNamesMap.put("locality", it.getContent().locality);
            commonNamesMap.put("countryCode", it.getContent().countryCode);
            commonNamesMap.put("sex", it.getContent().sex);
            commonNamesMap.put("lifeStage", it.getContent().lifeStage);
            commonNamesMap.put("isPlural", it.getContent().isPlural ? it.getContent().isPlural : null);
            commonNamesMap.put("organismPart", it.getContent().organismPart);

            commonNamesMap.put("infoSourceName", StringUtils.isNotEmpty(it.getContent().datasetName) ? it.getContent().datasetName :
                    (StringUtils.isNotEmpty(datasetName) ? datasetName :
                            (StringUtils.isNotEmpty(attributionCommon) ? attributionCommon : attributionDefault)));
            commonNamesMap.put("taxonRemarks", it.getContent().taxonRemarks);
            commonNamesMap.put("provenance", it.getContent().provenance);
            commonNamesMap.put("labels", it.getContent().labels);
            commonNamesMap.put("infoSourceURL", StringUtils.isNotEmpty(it.getContent().source) ? it.getContent().source : datasetURL);
            commonNamesMap.put("datasetURL", datasetURL);

            return commonNamesMap;
        }).toList());

        Map<String, Object> conservationStatuses = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : data.entrySet()) {
            if (entry.getKey().startsWith("conservation_")) {
                String dr = entry.getKey().substring("conservation_".length());
                String label = entry.getKey();
                if (legacyService.conservationMapping.containsKey(entry.getKey())) {
                    label = legacyService.conservationMapping.get(entry.getKey()).get("label");
                }
                if (entry.getValue() != null) {
                    Map<String, Object> conservationEntry = new LinkedHashMap<>();
                    conservationEntry.put("dr", dr);
                    conservationEntry.put("status", entry.getValue());
                    conservationStatuses.put(label, conservationEntry);
                }
            }
        }

        model.put("imageIdentifier", taxon.image);
        model.put("wikiUrl", taxon.wikiUrl_s);
        model.put("hiddenImages", taxon.hiddenImages_s);
        model.put("conservationStatuses", conservationStatuses);
        model.put("extantStatuses", new ArrayList<>());
        model.put("habitats", new ArrayList<>());
        model.put("categories", new ArrayList<>());
        model.put("simpleProperties", new ArrayList<>());
        model.put("images", new ArrayList<>());

        model.put("identifiers", identifiers.stream().map(it -> {
            SearchItemIndex d = getDataset(it.getContent().datasetID);
            String datasetURL = d != null ? d.guid : null;
            String datasetName = d != null ? d.name : null;

            Map<String, Object> identifiersMap = new HashMap<>();
            identifiersMap.put("identifier", it.getContent().guid);
            identifiersMap.put("nameString", it.getContent().name);
            identifiersMap.put("status", it.getContent().status);
            identifiersMap.put("subject", it.getContent().subject);
            identifiersMap.put("format", it.getContent().format);
            identifiersMap.put("provenance", it.getContent().provenance);
            identifiersMap.put("infoSourceName", StringUtils.isNotEmpty(it.getContent().datasetName) ? it.getContent().datasetName :
                    (StringUtils.isNotEmpty(datasetName) ? datasetName :
                            (StringUtils.isNotEmpty(attributionIdentifier) ? attributionIdentifier : attributionDefault)));
            identifiersMap.put("infoSourceURL", StringUtils.isNotEmpty(it.getContent().source) ? it.getContent().source : datasetURL);
            identifiersMap.put("datasetURL", datasetURL);

            return identifiersMap;
        }).toList());

        model.put("variants", variants.stream().map(it -> {
            SearchItemIndex d = getDataset(it.getContent().datasetID);
            String datasetURL = d != null ? d.guid : null;
            String datasetName = d != null ? d.name : null;

            Map<String, Object> variantsMap = new HashMap<>();
            variantsMap.put("nameString", it.getContent().scientificName);
            variantsMap.put("nameComplete", it.getContent().nameComplete);
            variantsMap.put("nameFormatted", it.getContent().nameFormatted);
            variantsMap.put("identifier", it.getContent().guid);
            variantsMap.put("taxonomicStatus", it.getContent().taxonomicStatus);
            variantsMap.put("nomenclaturalStatus", it.getContent().nomenclaturalStatus);
            variantsMap.put("nomenclaturalCode", it.getContent().nomenclaturalCode);

            variantsMap.put("nameAccordingTo", it.getContent().nameAccordingTo);
            variantsMap.put("nameAccordingToID", it.getContent().nameAccordingToID);
            variantsMap.put("namePublishedIn", it.getContent().namePublishedIn);
            variantsMap.put("namePublishedInYear", it.getContent().namePublishedInYear);
            variantsMap.put("namePublishedInID", it.getContent().namePublishedInID);

            variantsMap.put("taxonRemarks", it.getContent().taxonRemarks);
            variantsMap.put("provenance", it.getContent().provenance);
            variantsMap.put("priority", it.getContent().priority);

            variantsMap.put("nameAuthority", StringUtils.isNotEmpty(it.getContent().datasetName) ? it.getContent().datasetName : attributionVariant);

            variantsMap.put("infoSourceName", StringUtils.isNotEmpty(it.getContent().datasetName) ? it.getContent().datasetName :
                    (StringUtils.isNotEmpty(datasetName) ? datasetName :
                            (StringUtils.isNotEmpty(attributionVariant) ? attributionVariant : attributionDefault)));
            variantsMap.put("infoSourceURL", StringUtils.isNotEmpty(it.getContent().source) ? it.getContent().source : datasetURL);
            variantsMap.put("datasetURL", datasetURL);

            return variantsMap;
        }).toList());

        if (StringUtils.isNotEmpty(taxon.taxonConceptID)) taxonConcept.put("taxonConceptID", taxon.taxonConceptID);
        if (StringUtils.isNotEmpty(taxon.scientificNameID))
            taxonConcept.put("scientificNameID", taxon.scientificNameID);
        if (StringUtils.isNotEmpty(taxon.acceptedConceptID))
            taxonConcept.put("acceptedConceptID", taxon.acceptedConceptID);
        if (StringUtils.isNotEmpty(taxon.acceptedConceptName))
            taxonConcept.put("acceptedConceptName", taxon.acceptedConceptName);

        if (StringUtils.isNotEmpty(taxon.linkIdentifier)) model.put("linkIdentifier", taxon.linkIdentifier);

        return model;
    }

    public List<SearchItemIndex> autocomplete(String q, String idxtype, String kingdom, Integer rows) {
        final String cleanQ = cleanupId(q);

        List<SearchItemIndex> list = new ArrayList<>();

        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(wq -> wq.functionScore(fs -> fs.query(fsq -> fsq.bool(bq -> {
                    if (StringUtils.isNotEmpty(idxtype)) {
                        bq.filter(f -> f.term(t -> t.field("idxtype").value(idxtype)));
                    }
                    if (StringUtils.isNotEmpty(kingdom)) {
                        // TODO: this is flawed because records can have multiple kingdoms, e.g. rk_kingdom, rk_kingdom1
                        bq.filter(f -> f.term(t -> t.field("data.rk_kingdom").value(idxtype)));
                    }
                    // autocomplete for ES, 3 fields; name, scientificName, commonName
                    bq.must(bqq -> bqq.multiMatch(mm -> mm.query(cleanQ).type(TextQueryType.BoolPrefix)
                            .fields("name", "name._2gram", "name._3gram",
                                    "scientificName", "scientificName._2gram", "scientificName._3gram",
                                    "commonName", "commonName._2gram", "commonName._3gram")));
                    return bq;
                })).functions(fs1 -> fs1.fieldValueFactor(fv -> fv.field("suggestWeight"))))) // used by bie-index /suggest
                .withMaxResults(rows) // this is used by the legacy /guid/{name} field, and it has a max of 10
                .withTrackScores(true);

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.getTotalHits() > 0) {
            for (SearchHit<SearchItemIndex> hit : result.getSearchHits()) {
                list.add(hit.getContent());
            }
        }
        return list;
    }

    // TODO: support fqs other than "field:value", e.g. op parser
    public List<SearchItemIndex> autocomplete(String q, String [] fqs, Integer rows) {
        final String cleanQ = cleanupId(q);

        List<SearchItemIndex> list = new ArrayList<>();

        Set<String> queryFields = new HashSet<>();
        queryFields.addAll(Arrays.asList("name", "scientificName", "commonName", "guid", "id", "idxtype", "image", "rank", "taxonomicStatus"));

        NativeQueryBuilder query = NativeQuery.builder()
                // TODO: get feedback from testing before finalizing this autocomplete
//                .withQuery(wq -> wq.functionScore(fs -> fs.query(fsq -> fsq.bool(bq -> {
//                    if (fqs != null) {
//                        for (String fq : fqs) {
//                            String[] parts = fq.split(":");
//                            if (parts.length == 2) {
//                                queryFields.add(parts[0]);
//                                bq.filter(f -> f.term(t -> t.field(parts[0]).value(parts[1])));
//                            }
//                        }
//                    }
//                    // autocomplete for ES, 3 fields; name, scientificName, commonName
//                    bq.must(bqq -> bqq.multiMatch(mm -> mm.query(cleanQ).type(TextQueryType.BoolPrefix)
//                            .fields("name", "name._2gram", "name._3gram",
//                                    "scientificName", "scientificName._2gram", "scientificName._3gram",
//                                    "commonName", "commonName._2gram", "commonName._3gram")));
//                    return bq;
//                })).functions(fs1 -> fs1.fieldValueFactor(fv -> fv.field("suggestWeight"))))) // used by bie-index /suggest and still seems useful
                .withQuery(wq -> wq.functionScore(fs -> fs.query(fsq -> fsq.bool(bq -> {
                    if (fqs != null) {
                        for (String fq : fqs) {
                            String[] parts = fq.split(":");
                            if (parts.length == 2) {
                                queryFields.add(parts[0]);
                                bq.filter(f -> f.term(t -> t.field(parts[0]).value(parts[1])));
                            }
                        }
                    }
                    bq.mustNot(bqq -> bqq.terms(t -> t.field("idxtype").terms(ts -> ts.value(Arrays.stream(new String [] {"TAXONVARIANT", "IDENTIFIER"}).map(FieldValue::of).collect(Collectors.toList())))));
                    bq.must(bqq -> bqq.match(mm -> mm.query(cleanQ).field("prefix").operator(Operator.And)));
                    return bq;
                })).functions(fs1 -> fs1.fieldValueFactor(fv -> fv.field("suggestWeight"))))) // used by bie-index /suggest and still seems useful
                .withMaxResults(rows)
                .withTrackScores(true)
                .withSourceFilter(new FetchSourceFilter(queryFields.toArray(new String[0]), null));

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        if (result.getTotalHits() > 0) {
            Set<String> seen = new HashSet<>();
            for (SearchHit<SearchItemIndex> hit : result.getSearchHits()) {
                if (!seen.contains(hit.getContent().guid)) {
                    seen.add(hit.getContent().guid);
                    list.add(hit.getContent());
                }
            }
        }
        return list;
    }

    private Map<String, Object> formatDoc(SearchItemIndex item) {
        Map<String, Object> doc = new LinkedHashMap<>();
        if (item.idxtype.equals(IndexDocType.TAXON.name())) {
            doc.put("id", item.id);
            doc.put("guid", item.guid);
            doc.put("linkIdentifier", item.linkIdentifier);
            doc.put("idxtype", item.idxtype);
            doc.put("name", item.scientificName);
            doc.put("kingdom", item.data.get("rk_kingdom")); // TODO: rk_* fields are problematic
            doc.put("nomenclaturalCode", item.nomenclaturalCode);
            doc.put("scientificName", item.scientificName);
            doc.put("scientificNameAuthorship", item.scientificNameAuthorship);
            doc.put("author", item.scientificNameAuthorship);
            doc.put("nameComplete", item.nameComplete);
            doc.put("nameFormatted", item.nameFormatted);
            doc.put("taxonomicStatus", item.taxonomicStatus);
            doc.put("nomenclaturalStatus", item.nomenclaturalStatus);
            doc.put("parentGuid", item.parentGuid);
            doc.put("rank", item.rank);
            doc.put("rankID", item.rankID != null ? item.rankID : -1);
            doc.put("commonName", item.commonName != null ? StringUtils.join(item.commonName, ",") : null);
            doc.put("commonNameSingle", item.commonNameSingle);
            doc.put("occurrenceCount", item.occurrenceCount);
            doc.put("conservationStatus", null);
            doc.put("favourite", item.favourite);
            doc.put("infoSourceName", item.datasetName);
            doc.put("infoSourceURL", collectionsUrl + "/public/show/" + item.datasetID);

            if (StringUtils.isNotEmpty(item.acceptedConceptID)) {
                doc.put("acceptedConceptID", item.acceptedConceptID);
                if (StringUtils.isNotEmpty(item.acceptedConceptName)) {
                    doc.put("acceptedConceptName", item.acceptedConceptName);
                }
                doc.put("guid", item.acceptedConceptID);
                doc.put("linkIdentifier", null); // Otherwise points to the synonym
            }

            if (StringUtils.isNotEmpty(item.image)) {
                doc.put("image", item.image);
                doc.put("imageUrl", imageUrl + ImageUrlType.SMALL.path + item.image);
                doc.put("thumbnailUrl", imageUrl + ImageUrlType.THUMBNAIL.path + item.image);
                doc.put("smallImageUrl", imageUrl + ImageUrlType.SMALL.path + item.image);
                doc.put("largeImageUrl", imageUrl + ImageUrlType.LARGE.path + item.image);
            }

            doc.putAll(extractClassification(item));
        } else if (item.idxtype.equals(IndexDocType.TAXONVARIANT.name())) {
            doc.put("id", item.id);
            doc.put("guid", item.guid);
            doc.put("linkIdentifier", item.linkIdentifier);
            doc.put("idxtype", item.idxtype);
            doc.put("name", item.scientificName);
            doc.put("nomenclaturalCode", item.nomenclaturalCode);
            doc.put("scientificName", item.scientificName);
            doc.put("scientificNameAuthorship", item.scientificNameAuthorship);
            doc.put("author", item.scientificNameAuthorship);
            doc.put("nameComplete", item.nameComplete);
            doc.put("nameFormatted", item.nameFormatted);
            doc.put("taxonomicStatus", item.taxonomicStatus);
            doc.put("nomenclaturalStatus", item.nomenclaturalStatus);
            doc.put("rank", item.rank);
            doc.put("rankID", item.rankID != null ? item.rankID : -1);
            doc.put("infoSourceName", item.datasetName);
            doc.put("infoSourceURL", collectionsUrl + "/public/show/" + item.datasetID);

        } else if (item.idxtype.equals(IndexDocType.COMMON.name())) {
            doc.put("id", item.id);
            doc.put("guid", item.guid);
            doc.put("linkIdentifier", item.linkIdentifier);
            doc.put("idxtype", item.idxtype);
            doc.put("name", item.scientificName);
            doc.put("language", item.language);
            doc.put("acceptedConceptName", item.acceptedConceptName);
            doc.put("favourite", item.favourite);
            doc.put("infoSourceName", item.datasetName);
            doc.put("infoSourceURL", collectionsUrl + "/public/show/" + item.datasetID);

            if (StringUtils.isNotEmpty(item.image)) {
                doc.put("image", item.image);
                doc.put("imageUrl", imageUrl + ImageUrlType.SMALL.path + item.image);
                doc.put("thumbnailUrl", imageUrl + ImageUrlType.THUMBNAIL.path + item.image);
                doc.put("smallImageUrl", imageUrl + ImageUrlType.SMALL.path + item.image);
                doc.put("largeImageUrl", imageUrl + ImageUrlType.LARGE.path + item.image);
            }
        } else {
            doc.put("id", item.id);
            doc.put("guid", item.guid);
            doc.put("linkIdentifier", item.linkIdentifier);
            doc.put("idxtype", item.idxtype);
            doc.put("name", item.name);
            doc.put("description", item.description);
            if (StringUtils.isNotEmpty(item.taxonGuid)) {
                doc.put("taxonGuid", item.taxonGuid);
            }
            if (StringUtils.isNotEmpty(item.centroid)) {
                doc.put("centroid", item.centroid);
            }
            if (StringUtils.isNotEmpty(item.favourite)) {
                doc.put("favourite", item.favourite);
            }
            if (StringUtils.isNotEmpty(item.description)) {
                doc.put("content", item.description); // bie-index's content field is now in description
            }
            if (StringUtils.isNotEmpty(item.taxonGuid)) {
                doc.put("taxonGuid", item.taxonGuid);
            }

            if (StringUtils.isNotEmpty(item.image)) {
                if (!item.image.startsWith("http")) {
                    doc.put("image", item.image);
                    doc.put("imageUrl", imageUrl + ImageUrlType.SMALL.path + item.image);
                    doc.put("thumbnailUrl", imageUrl + ImageUrlType.THUMBNAIL.path + item.image);
                } else {
                    doc.put("image", item.image);
                    doc.put("imageUrl", item.image);
                    doc.put("thumbnailUrl", item.image);
                }
            }

            if (StringUtils.isNotEmpty(item.projectType)) {
                doc.put("projectType", item.projectType);
            }
            if (StringUtils.isNotEmpty(item.containsActivity)) {
                doc.put("containsActivity", item.containsActivity);
            }
            if (StringUtils.isNotEmpty(item.dateCreated)) {
                doc.put("dateCreated", item.dateCreated);
            }
            if (StringUtils.isNotEmpty(item.keywords)) {
                doc.put("keywords", item.keywords);
            }

            if (StringUtils.isNotEmpty(item.type)) {
                doc.put("type", item.type);
            }
            if (StringUtils.isNotEmpty(item.dateCreated)) {
                doc.put("dateCreated", item.dateCreated);
            }
            if (item.itemCount != null) {
                doc.put("itemCount", item.itemCount);
            }
            if (item.isAuthoritative != null) {
                doc.put("isAuthoritative", item.isAuthoritative);
            }
            if (item.isInvasive != null) {
                doc.put("isInvasive", item.isInvasive);
            }
            if (item.isThreatened != null) {
                doc.put("isThreatened", item.isThreatened);
            }
            if (item.region != null) {
                doc.put("region", item.region);
            }
        }

        return doc;
    }

    public File download(String q, String[] fqs, String fields) throws Exception {
        if (StringUtils.isEmpty(fields)) {
            // default fields
            fields = defaultDownloadFields;

            // if no default fields, add guid
            if (StringUtils.isEmpty(fields)) {
                fields = "guid";
            }

            // if the defaultDownloadFields contain no rk_ fields, include all rk_ and rkid_ fields available in SOLR
            if (!fields.contains("rk_")) {
                // prefix ranks with rk_ and rkid_
                String rankFields = "";
                for (String rank : legacyService.getRanks(indexFields(false)).keySet()) {
                    // reverse the order so that it matches bie-index
                    rankFields = ",rk_" + rank + ",rkid_" + rank + rankFields;
                }
                fields += rankFields;
            }
        }

        String[] fieldsSplit = fields.split(",");
        List<FieldAndFormat> fieldList = new ArrayList<>(fieldsSplit.length);
        for (String field : fieldsSplit) {
            fieldList.add(new FieldAndFormat.Builder().field(fieldMapping(field)).build());
        }
        int[] columnCount = new int[fieldList.size()];
        Arrays.fill(columnCount, 0);

        // exclude idxtype IDENTIFIER and TAXONVARIANT
        List<String> allFqs = fqs == null ? new ArrayList() : new ArrayList<>(Arrays.asList(fqs));
        allFqs.add("-idxtype:IDENTIFIER");
        allFqs.add("-idxtype:TAXONVARIANT");

        Op op = QueryParserUtil.parse(q, allFqs.toArray(new String[0]), this::isValidField);
        if (op == null) {
            throw new Exception("Invalid query");
        }

        // generate tmpFile, includes empty columns
        File tmpFile = File.createTempFile("download", "csv");
        try (CSVWriter writer = new CSVWriter(new FileWriter(tmpFile))) {
            writer.writeNext(Arrays.stream(fieldsSplit).map(it -> {
                String formattedField = it.replaceAll("^rk_", "").replaceAll("^rkid_", "");
                return messageSource.getMessage(formattedField, null, formattedField, Locale.getDefault());
            }).toArray(String[]::new));

            String[] row = new String[fieldsSplit.length];

            int count = 0;

            List<FieldValue> searchAfter = null;
            boolean hasMore = true;
            while (hasMore && count < downloadMaxRows) {
                SearchResponse<SearchItemIndex> result = queryPointInTimeAfter(
                        null, searchAfter, elasticPageSize, null, opToQuery(op), fieldList, null, false);
                List<Hit<SearchItemIndex>> hits = result.hits().hits();

                if (hits.isEmpty()) {
                    hasMore = false;
                    continue;
                }

                searchAfter = hits.getLast().sort();

                for (Hit<SearchItemIndex> item : hits) {
                    count++;
                    if (count >= downloadMaxRows) {
                        break;
                    }

                    for (int i = 0; i < fieldList.size(); i++) {
                        String field = fieldList.get(i).field();
                        if (item.fields().get(field) != null) {
                            String value = item.fields().get(field).toJson().asJsonArray().getJsonString(0).getString();
                            row[i] = value;
                            columnCount[i]++;
                        } else if (field.startsWith("data.") && item.fields().get("data") != null) {
                            JsonValue jv = item.fields().get("data").toJson().asJsonArray().getJsonObject(0).get(field.substring(5));
                            if (jv != null) {
                                String value = jv.asJsonArray().getJsonString(0).getString();
                                row[i] = value;
                                columnCount[i]++;
                            } else {
                                row[i] = "";
                            }
                        } else {
                            row[i] = "";
                        }
                    }
                    writer.writeNext(row);
                }

                hasMore = hits.size() == elasticPageSize;
            }

            writer.flush();
        }

        int totalColumns = 0;
        for (int j : columnCount) {
            if (j > 0) {
                totalColumns++;
            }
        }
        int fTotalColumns = totalColumns;

        File tmpFinalFile = File.createTempFile("download", ".csv");
        try (FileOutputStream out = new FileOutputStream(tmpFinalFile)) {
            try (CSVWriter writer = new CSVWriter(new OutputStreamWriter(out))) {
                String[] outputRow = new String[fTotalColumns];
                try (CSVReader reader = new CSVReader(new FileReader(tmpFile))) {
                    String[] inputRow;
                    while ((inputRow = reader.readNext()) != null) {
                        // map tmpFile to output CSV and skip empty columns
                        for (int i = 0, pos = 0; i < columnCount.length; i++) {
                            if (columnCount[i] > 0) {
                                outputRow[pos++] = inputRow[i];
                            }
                        }
                        writer.writeNext(outputRow);
                    }
                } catch (CsvValidationException e) {
                    // not expected because it is reading a CSV it wrote moments ago
                    throw new RuntimeException(e);
                }
                writer.flush();
            }
        } finally {
            tmpFile.delete();
        }

        return tmpFile;
    }

    public SearchHits<SearchItemIndex> search(Op op, int page, int pageSize) {
        PageRequest pageRequest = PageRequest.of(page, pageSize);

        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery(opToQuery(op))
                .withPageable(pageRequest)
                .withTrackTotalHits(true);

        return elasticsearchOperations.search(query.build(), SearchItemIndex.class);
    }

    private co.elastic.clients.elasticsearch._types.query_dsl.Query opToQuery(Op op) {
        if (op.terms.size() == 1) {
            // single term
            return termToQuery(op.terms.get(0), false);
        } else {
            // multiple terms
            return BoolQuery.of(bq -> {
                for (Term term : op.terms) {
                    if (op.andOp) {
                        if (term.negate) {
                            bq.mustNot(termToQuery(term, true));
                        } else {
                            bq.must(termToQuery(term, true));
                        }
                    } else {
                        bq.should(termToQuery(term, false));
                    }
                }
                return bq;
            })._toQuery();
        }
    }

    private co.elastic.clients.elasticsearch._types.query_dsl.Query termToQuery(Term term, boolean negated) {
        if (!negated && term.negate) {
            return BoolQuery.of(bq -> {
                bq.mustNot(termToQuery(term, true));
                return bq;
            })._toQuery();
        } else {
            if (term.op != null) {
                return opToQuery(term.op);
            } else if (term.field == null) {
                // dismax? attempting to match
                return DisMaxQuery.of(dmq -> dmq.queries(
                        TermQuery.of(tq -> tq.field("exact_text").value(term.value))._toQuery(),
                        MatchQuery.of(mq -> {
                            // default search field for free text search
                            mq.field("all");
                            mq.query(term.value);
                            return mq;
                        })._toQuery(),
                        MatchQuery.of(mq -> {
                            // default search field for free text search
                            mq.field("description");
                            mq.query(term.value);
                            mq.boost(0.2f);
                            return mq;
                        })._toQuery()
                ).tieBreaker(0.0))._toQuery();
            } else if ("*".equals(term.value)) {
                return nestedWrapper(term.field, ExistsQuery.of(eq -> eq.field(term.field))._toQuery());
            } else {
                if (isKeywordField(term.field)) {
                    return nestedWrapper(term.field, TermQuery.of(tq -> tq.field(term.field).value(term.value))._toQuery());
                } else {
                    return nestedWrapper(term.field, MatchPhraseQuery.of(m -> m.field(term.field).query(term.value))._toQuery());
                }
            }
        }
    }

    private co.elastic.clients.elasticsearch._types.query_dsl.Query nestedWrapper(String field, co.elastic.clients.elasticsearch._types.query_dsl.Query query) {
        if (field.startsWith("data.")) {
            return NestedQuery.of(nf -> nf.path("data").query(query))._toQuery();
        } else {
            return query;
        }
    }

    private boolean isKeywordField(String field) {
        boolean textField = "commonName".equals(field) || "description".equals(field);
        if (textField) {
            return false;
        }

        boolean dataField = field.startsWith("data.");
        if (!dataField) {
            return true;
        }

        boolean keywordDataField = field.startsWith("data.conservation_") || field.startsWith("data.rk");
        return !keywordDataField;
    }

    /**
     * This is the legacy search service so the output is just a Map<String, Object> with the fields that are needed.
     */
    public Map<String, Object> searchLegacy(String q, String[] fqs, int page, int pageSize, String sort, String dir, String facets) {
        PageRequest pageRequest = PageRequest.of(page, pageSize);

        Op op = QueryParserUtil.parse(q, fqs, this::isValidField);
        if (op == null) {
            return null;
        }

        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery((wq1 -> wq1.functionScore(fs -> fs.query(opToQuery(op))
                        .functions(fn -> fn.fieldValueFactor(fv -> fv.field("searchWeight"))))))
                .withPageable(pageRequest)
                .withTrackTotalHits(true);

        if (StringUtils.isNotEmpty(sort) && StringUtils.isNotEmpty(dir)) {
            query.withSort(s -> s.field(f -> f.field(sort).order("desc".equalsIgnoreCase(dir) ? SortOrder.Desc : SortOrder.Asc)));
        }

        if (facets != null) {
            for (String facet : facets.split(",")) {
                query.withAggregation(facet, AggregationBuilders.terms(ts -> ts.field(facet).size(100))); // '100' is from bie-index
            }
        }

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);

        Map<String, Object> mapResult = new HashMap<>();
        List<Object> searchResults = new ArrayList<>();
        mapResult.put("searchResults", searchResults);
        mapResult.put("totalRecords", result.getTotalHits());
        mapResult.put("queryTitle", getQueryTitle(q));

        for (SearchHit<SearchItemIndex> hit : result.getSearchHits()) {
            Map<String, Object> doc = formatDoc(hit.getContent());
            searchResults.add(doc);
        }

        List<Map<String, Object>> facetResults = new ArrayList();
        mapResult.put("facetResults", facetResults);
        Map<String, ElasticsearchAggregation> aggregations = ((ElasticsearchAggregations) ((SearchHitsImpl) result).getAggregations()).aggregationsAsMap();
        for (Map.Entry<String, ElasticsearchAggregation> entry : aggregations.entrySet()) {
            Map<String, Object> facetItemMap = new HashMap<>();
            facetResults.add(facetItemMap);
            facetItemMap.put("fieldName", entry.getKey());

            List<Map<String, Object>> facetItems = new ArrayList<>();
            facetItemMap.put("fieldResult", facetItems);

            List<StringTermsBucket> buckets = (List<StringTermsBucket>) ((MultiBucketAggregateBase) entry.getValue().aggregation().getAggregate()._get()).buckets()._get();
            for (StringTermsBucket bucket : buckets) {
                Map<String, Object> itemMap = new HashMap<>();
                itemMap.put("label", bucket.key().stringValue());
                itemMap.put("count", bucket.docCount());
                itemMap.put("fieldValue", bucket.key().stringValue());
                itemMap.put("fq", entry.getKey() + ":\"" + bucket.key().stringValue().replaceAll("\"", "\\\"") + "\"");
                facetItems.add(itemMap);
            }
        }

        return mapResult;
    }

    public Map<String, Object> search(String q, String[] fqs, int page, int pageSize, String sort, String dir, String facets, String [] fl) {
        PageRequest pageRequest = PageRequest.of(page, Math.max(1, pageSize));

        Op op = QueryParserUtil.parse(q, fqs, this::isValidField);
        if (op == null) {
            return null;
        }

        NativeQueryBuilder query = NativeQuery.builder()
                .withQuery((wq1 -> wq1.functionScore(fs -> fs.query(opToQuery(op))
                        .functions(fn -> fn.fieldValueFactor(fv -> fv.field("searchWeight"))))))
                .withPageable(pageRequest)
                .withTrackTotalHits(true);

        if (fl != null && fl.length > 0) {
            query.withSourceFilter(new FetchSourceFilter(fl, null));
        }

        if (StringUtils.isNotEmpty(sort) && StringUtils.isNotEmpty(dir)) {
            query.withSort(s -> s.field(f -> f.field(sort).order("desc".equalsIgnoreCase(dir) ? SortOrder.Desc : SortOrder.Asc)));
        }

        if (facets != null) {
            for (String facet : facets.split(",")) {
                query.withAggregation(facet, AggregationBuilders.terms(ts -> ts.field(facet).size(100))); // '100' is from bie-index
            }
        }

        SearchHits<Map> result = elasticsearchOperations.search(query.build(), Map.class, IndexCoordinates.of(elasticIndex));

        Map<String, Object> mapResult = new HashMap<>();
        List<Object> searchResults = new ArrayList<>();
        mapResult.put("searchResults", searchResults);
        mapResult.put("totalRecords", result.getTotalHits());
        mapResult.put("queryTitle", getQueryTitle(q));

        for (SearchHit<Map> item : result) {
            if (fl != null && fl.length > 0) {
                Map values = new HashMap();
                try {
                    for (int i = 0; i < fl.length; i++) {
                        if (fl[i].startsWith("data.") && !item.getContent().containsKey(fl[i])) {
                            if (item.getContent().get("data") != null) {
                                values.put(fl[i], ((Map) item.getContent().get("data")).get(fl[i].substring(5)));
                            }
                        } else {
                            values.put(fl[i], item.getContent().get(fl[i]));
                        }
                    }
                    searchResults.add(values);
                } catch (Exception e) {
                    // TODO: ??
                }
            } else {
                // TODO: flatten "data." fields
                searchResults.add(item.getContent());
            }
        }

        List<Map<String, Object>> facetResults = new ArrayList();
        mapResult.put("facetResults", facetResults);
        Map<String, ElasticsearchAggregation> aggregations = ((ElasticsearchAggregations) ((SearchHitsImpl) result).getAggregations()).aggregationsAsMap();
        for (Map.Entry<String, ElasticsearchAggregation> entry : aggregations.entrySet()) {
            Map<String, Object> facetItemMap = new HashMap<>();
            facetResults.add(facetItemMap);
            facetItemMap.put("fieldName", entry.getKey());

            List<Map<String, Object>> facetItems = new ArrayList<>();
            facetItemMap.put("fieldResult", facetItems);

            List<StringTermsBucket> buckets = (List<StringTermsBucket>) ((MultiBucketAggregateBase) entry.getValue().aggregation().getAggregate()._get()).buckets()._get();
            for (StringTermsBucket bucket : buckets) {
                Map<String, Object> itemMap = new HashMap<>();
                itemMap.put("label", bucket.key().stringValue());
                itemMap.put("count", bucket.docCount());
                itemMap.put("fieldValue", bucket.key().stringValue());
                itemMap.put("fq", entry.getKey() + ":\"" + bucket.key().stringValue().replaceAll("\"", "\\\"") + "\"");
                facetItems.add(itemMap);
            }
        }

        return mapResult;
    }


    private String getQueryTitle(String q) {
        String queryTitle = q;

        Pattern pattern = Pattern.compile("rkid_([a-z]{1,}):\"?([^\"]*)\"?");
        Matcher matcher = pattern.matcher(q);
        if (matcher.find()) {
            try {
                String rankName = matcher.group(0);
                String guid = matcher.group(1);
                ShortProfile shortProfile = getShortProfile(guid);
                if (shortProfile != null) {
                    queryTitle = rankName + " " + shortProfile.getScientificName();
                } else {
                    queryTitle = rankName + " " + guid;
                }
            } catch (Exception ignored){
            }
        }

        if(StringUtils.isEmpty(queryTitle)){
            queryTitle = "all records";
        }

        return queryTitle;
    }

    public boolean isValidField(String fieldName) {
        return validFields(false).contains(fieldName);
    }
}
