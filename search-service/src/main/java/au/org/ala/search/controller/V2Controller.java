package au.org.ala.search.controller;

import au.org.ala.search.service.queue.QueueService;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.queue.*;
import au.org.ala.search.model.dto.*;
import au.org.ala.search.service.AdminService;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.LegacyService;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.aggregations.AggregationBuilders;
import co.elastic.clients.elasticsearch._types.aggregations.MultiBucketAggregateBase;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchAggregation;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchAggregations;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.client.elc.NativeQueryBuilder;
import org.springframework.data.elasticsearch.core.*;
import org.springframework.data.elasticsearch.core.query.FetchSourceFilter;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Nullable;
import java.io.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * bie-index API services, minus some admin services
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class V2Controller {
    private static final Logger logger = LoggerFactory.getLogger(V2Controller.class);

    public static final String SPECIES_ID = "species_v2";
    public static final String SEARCH_AUTO_ID = "autocomplete_v2";
    public static final String LIST_ID = "list_v2";

    @Value("#{'${openapi.servers}'.split(',')[0]}")
    public String baseUrl;

    protected final ElasticService elasticService;
    protected final LegacyService legacyService;
    protected final AdminService adminService;
    protected final AuthService authService;
    protected final ElasticsearchOperations elasticsearchOperations;
    protected final QueueService queueService;
    protected final DownloadFileStoreService downloadFileStoreService;

    public V2Controller(ElasticService elasticService, LegacyService legacyService, AdminService adminService, AuthService authService, ElasticsearchOperations elasticsearchOperations, QueueService queueService, DownloadFileStoreService downloadFileStoreService) {
        this.elasticService = elasticService;
        this.legacyService = legacyService;
        this.adminService = adminService;
        this.authService = authService;
        this.elasticsearchOperations = elasticsearchOperations;
        this.queueService = queueService;
        this.downloadFileStoreService = downloadFileStoreService;
    }

    @Tag(name = "Search")
    @Operation(
            operationId = SPECIES_ID,
            summary = "Get accepted records for a list of guids and names.",
            description = "For each given guid or name, the following searches will be performed in order,<br/>"
                    + "before returning the accepted identifier:<br/>"
                    + "1. Search for matching TAXON guid or linkIdentifier<br/>"
                    + "2. Search for the first matching TAXON scientificName or nameComplete or commonName<br/>" // TODO: raising a question about how the commonName match is done. Do we need a 2nd commonName field for exact matches? Do we need to use the subfield that is 'keyword'?
                    + "3. Search for matching TAXONVARIANT scientificName or nameComplete<br/>"
                    + "4. Search for matching IDENTIFIER guid (previous identifier)"
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @PostMapping(path = {"/v2/species"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<SearchItemIndex>> species(
            // TODO: add to openapi service to get a real example, see OpenapiService
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "The JSON list of guids or scientificNames to search",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = "[\"urn:lsid:biodiversity.org.au:afd.taxon:1\",\"Koala\"]"
                            )))
            @RequestBody
            List<String> qs
    ) {
        if (qs == null || qs.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        List<SearchItemIndex> result = new ArrayList<>();
        for (String q : qs) {
            String id = elasticService.cleanupId(q);

            SearchItemIndex taxon = elasticService.getTaxon(id, true, true);
            if (taxon == null) {
                taxon = elasticService.getTaxonVariantByName(id, true);
            }
            if (taxon == null) {
                taxon = elasticService.getTaxonByPreviousIdentifier(id, true);
            }

            result.add(taxon);
        }
        return ResponseEntity.ok(result);
    }

    @Tag(name = "Search")
    @Operation(
            operationId = SEARCH_AUTO_ID,
            summary = "Autocomplete search",
            description = "Used to provide a list of scientific and common names that can be used to automatically complete a supplied partial name."
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = {"/v2/autocomplete"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<SearchItemIndex>> searchAuto(
            @Parameter(
                    description = "The value to auto complete e.g. q=Mac",
                    example = "Mac")
            @RequestParam(name = "q") String q,
            @Parameter(
                    description = "The index type to limit, or other fq. One of TAXON, TAXONVARIANT, COMMON, IDENTIFIER, REGION, COLLECTION, INSTITUTION, DATAPROVIDER, DATASET, LOCALITY, WORDPRESS, LAYER, SPECIESLIST, KNOWLEDGEBASE, BIOCOLLECT.",
                    example = "idxtype:TAXON")
            @Nullable @RequestParam(name = "fq", required = false) String [] fqs,
            @Parameter(
                    description = "The maximum number of results to return (default = 10)",
                    example = "10")
            @Nullable @RequestParam(name = "limit", required = false, defaultValue = "10") Integer limit
    ) {
        List<SearchItemIndex> autoCompleteList = elasticService.autocomplete(q, fqs, limit);

        return ResponseEntity.ok(autoCompleteList);
    }

    @Tag(name = "Search")
    @Operation(
            operationId = LIST_ID,
            summary = "Search the BIE",
            description = "Search the BIE by solr query  or free text search"
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping("/v2/list")
    public /*List<SearchItemIndex>*/ Object search(
            @Parameter(
                    description = "Primary search  query for the form field:value e.g. q=rk_genus:Macropus or freee text e.g q=gum",
                    example = "gum"
            )
            @RequestParam(name = "q") String q,

            @Parameter(
                    description = "Filters to be applied to the original query. These are additional params of the form fq=INDEXEDFIELD:VALUE.",
                    example = "{\"imageAvailable:\\\"true\\\"\"}"
            )
            @Nullable @RequestParam(name = "fq", required = false) String[] fqs,

            @Parameter(
                    description = "The records offset, to enable paging",
                    example = "0"
            )
            @Nullable @RequestParam(name = "page", required = false, defaultValue = "0") Integer page,

            @Parameter(
                    description = "The number of records to return",
                    example = "5"
            )
            @Nullable @RequestParam(name = "pageSize", required = false, defaultValue = "10") Integer pageSize,

            @Parameter(
                    description = "The field to sort the records by: i.e. acceptedConceptName, scientificName, commonNameSingle, rank",
                    example = "commonNameSingle"
            )
            @Nullable @RequestParam(name = "sort", required = false) String sort,

            @Parameter(
                    description = "Sort direction 'asc' or 'desc'",
                    example = "asc"
            )
            @Nullable @RequestParam(name = "dir", required = false) String dir,

            @Parameter(
                    description = "Comma delimited of fields to display facets for.",
                    example = "datasetName,commonNameSingle"
            )
            @Nullable @RequestParam(name = "facets", required = false) String facets,

        @Parameter(
                description = "Comma delimited fields to return",
                example = "guid,name,idxtype"
        )
        @Nullable @RequestParam(name = "fl", required = false) String fl) {
        // TODO: finish, use op parser util

        // species-lists is 1 to n, remain consistent here
        PageRequest pageRequest = PageRequest.of(page, pageSize);

        NativeQueryBuilder query =
                NativeQuery.builder().withQuery(wq -> wq.bool(bq -> {
                            if (!"*".equals(q)) {
                                bq.must(m -> m.matchPhrase(mq -> mq.field("all").query(q)));
                            }
                            bq.mustNot(bqq -> bqq.terms(t -> t.field("idxtype").terms(ts -> ts.value(Arrays.stream(new String [] {"TAXONVARIANT", "IDENTIFIER"}).map(FieldValue::of).collect(Collectors.toList())))));
                            if (fqs != null) {
                                for (String fq : fqs) {
                                    String[] fieldValue = fq.split(":");
                                    bq.filter(f -> f.term(t -> t.field(fieldValue[0]).value(fieldValue[1])));
                                }
                            }
                            return bq;
                        }))
                        .withPageable(pageRequest);

        if (StringUtils.isNotEmpty(fl)) {
            query.withSourceFilter(new FetchSourceFilter(fl.split(","), null));
        }

//        NativeQueryBuilder query = NativeQuery.builder()
//                .withQuery(wq -> wq.bool(bq -> {
//                    bq.must(q -> formatTerm(q));
//                    for (String fq : fqs) {
//                        bq.must(fq);
//                    }
//                    return bq;
//                }));

        if (StringUtils.isNotEmpty(sort)) {
            query.withSort(s -> s.field(f -> f.field(sort).order("desc".equalsIgnoreCase(dir) ? SortOrder.Desc : SortOrder.Asc)));
        }

        if (facets != null) {
            for (String facet : facets.split(",")) {
                query.withAggregation(facet, AggregationBuilders.terms(ts -> ts.field(facet).size(100)));
            }
        }

        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
        List<SearchItemIndex> hits = (List<SearchItemIndex>) SearchHitSupport.unwrapSearchHits(result);

        Map<String, Object> mapResult = new HashMap<>();
        mapResult.put("list", hits);

        Map<String, Object> facetMap = new HashMap<>();
        mapResult.put("facets", facetMap);
        Map<String, ElasticsearchAggregation> aggregations = ((ElasticsearchAggregations) ((SearchHitsImpl) result).getAggregations()).aggregationsAsMap();
        for (Map.Entry<String, ElasticsearchAggregation> entry : aggregations.entrySet()) {
            Map<String, Object> facetItemMap = new HashMap<>();

            List<Map<String, Object>> facetItems = new ArrayList<>();

            List<StringTermsBucket> buckets = (List<StringTermsBucket>) ((MultiBucketAggregateBase) entry.getValue().aggregation().getAggregate()._get()).buckets()._get();
            for (StringTermsBucket bucket : buckets) {
                Map<String, Object> itemMap = new HashMap<>();
                itemMap.put("label", bucket.key().stringValue());
                itemMap.put("count", bucket.docCount());
                itemMap.put("fq", entry.getKey() + ":\"" + bucket.key().stringValue() + "\"");
                facetItems.add(itemMap);
            }
            facetItemMap.put("list", facetItems);
            facetMap.put(entry.getKey(), facetItemMap);
        }

        mapResult.put("totalRecords", result.getTotalHits());

        return mapResult;
    }

    @Tag(name = "fields")
    @Operation(
            operationId = "fields",
            summary = "Gets the list of indexed fields"
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = "/v2/indexFields", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<IndexedField> indexedFields() {
        return elasticService.indexFields(true);
    }

    @Tag(name = "download")
    @Operation(
            operationId = "downloadSearch",
            // TODO: Use OpenapiService to inject the config value downloadMaxRows into the summary.
            summary = "Start a job to create a zipped CSV containing all the records of search result"
    )
    @ApiResponse(description = "Job status", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @PostMapping(path = "/v2/download/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Status> queueDownload(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "A download request including a query and filename.",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = "{\"query\":\"Koala\", \"filename\":\"koala-20240101\"}"
                            )))
            @RequestBody
            SearchDownloadRequest searchDownloadRequest
    ) {
        return addToQueue(searchDownloadRequest);
    }

    @Tag(name = "download")
    @Operation(
            operationId = "downloadFieldguide",
            summary = "Start a job to create a PDF fieldguide"
    )
    @ApiResponse(description = "Job Status", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @PostMapping(path = "/v2/download/fieldguide", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Status> queueFieldguide(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "The fieldguide download request including a list of id and filename.",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = "{\"id\": [\"urn:lsid:biodiversity.org.au:afd.taxon:1\"], \"filename\":\"fieldguide-20240101\"}"
                            )))
            @RequestBody
            FieldguideDownloadRequest fieldguideDownloadRequest
    ) {
        return addToQueue(fieldguideDownloadRequest);
    }

    private ResponseEntity<Status> addToQueue(DownloadRequest downloadRequest) {
        Status status = queueService.add(downloadRequest);

        if (status != null) {
            return ResponseEntity.ok(status);
        } else {
            return ResponseEntity.badRequest().build();
        }
    }

    @Tag(name = "download")
    @Operation(
            operationId = "downloadStatus",
            summary = "Get the status of a job and download the file"
    )
    @ApiResponse(description = "Job Status", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = "/v2/download", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> download(
            @Parameter(
                    description = "The download id",
                    example = "1234"
            )
            @RequestParam(name = "id") String id,
            @Parameter(
                    description = "default false. Use true to download the file (directly or via a redirect)",
                    example = "true"
            )
            @RequestParam(name = "download") Boolean download) {
        QueueItem queueItem = queueService.get(id);
        if (queueItem == null) {
            return ResponseEntity.notFound().build();
        }

        if (download && queueItem.status.getStatusCode() == StatusCode.FINISHED) {
            try {
                HttpHeaders headers = new HttpHeaders();
                if (downloadFileStoreService.isS3()) {
                    String tmpUrl = downloadFileStoreService.createPresignedGetUrl(queueItem);
                    headers.add("Location", tmpUrl);
                    return new ResponseEntity<>(null, headers, HttpStatus.FOUND);
                } else {
                    File file = new File(downloadFileStoreService.getFilePath(queueItem));
                    InputStreamResource inputStreamResource = new InputStreamResource(new FileInputStream(file));

                    headers.setContentLength(file.length());
                    headers.setContentDisposition(ContentDisposition.builder("attachment").filename(file.getName()).build());

                    if (file.getName().endsWith(".pdf")) {
                        headers.setContentType(MediaType.APPLICATION_PDF);
                    } else if (file.getName().endsWith(".zip")) {
                        headers.setContentType(new MediaType("application/zip"));
                    }

                    return ResponseEntity.ok().headers(headers).body(inputStreamResource);
                }
            } catch (FileNotFoundException e) {
                return ResponseEntity.notFound().build();
            }
        }

        return ResponseEntity.ok(new StatusResponse(queueItem.status, baseUrl + "/v2/download"));
    }
}
