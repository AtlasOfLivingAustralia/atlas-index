package au.org.ala.search.controller;

import au.org.ala.search.model.ImageUrlType;
import au.org.ala.search.model.ListBackedFields;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.dto.*;
import au.org.ala.search.service.AdminService;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.LegacyService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.util.FormatUtil;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.aggregations.AggregationBuilders;
import co.elastic.clients.elasticsearch._types.aggregations.MultiBucketAggregateBase;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch.core.SearchRequest;
import co.elastic.clients.elasticsearch.core.search.PointInTimeReference;
import co.elastic.clients.util.ObjectBuilder;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchAggregation;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchAggregations;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.client.elc.NativeQueryBuilder;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHitSupport;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.SearchHitsImpl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import javax.annotation.Nullable;
import java.io.*;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.*;

import static io.swagger.v3.oas.annotations.enums.ParameterIn.HEADER;

/**
 * bie-index API services, minus some admin services
 * <p>
 * TODO: Rework into a V2Controller
 * - remove path variables
 * - consolidate services
 * - merge single response and list response services
 * - flatten response data structures
 * - support parameter to limit response fields
 * - move towards POST with JSON rather than GET with query parameters
 * - support infrastructure limitations on response size for /downloads
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class V1Controller {
    public static final String SPECIES_LOOKUP_BULK_ID = "speciesLookupBulk";
    public static final String SPECIES_GUIDS_BULKLOOKUP_ID = "speciesGuidsBulklookup";
    public static final String SPECIES_IMAGE_BULK_ID = "speciesImageBulk";
    public static final String CHILD_CONCEPTS_ID = "childConcepts";
    public static final String CLASSIFICATION_ID = "classification";
    public static final String GUID_BATCH_ID = "guidBatch";
    public static final String GUID_ID = "guid";
    public static final String IMAGESEARCH_ID = "imageSearch";
    public static final String SPECIES_SHORTPROFILE_ID = "speciesShortProfile";
    public static final String SPECIES_ID = "species";
    public static final String SEARCH_AUTO_ID = "searchAuto";
    public static final String SEARCH_ID = "search";
    public static final String DOWNLOAD_ID = "download";
    private static final Logger logger = LoggerFactory.getLogger(V1Controller.class);

    protected final ElasticService elasticService;
    protected final LegacyService legacyService;
    protected final AdminService adminService;
    protected final AuthService authService;
    protected final ElasticsearchOperations elasticsearchOperations;

    @Value("${image.url}")
    private String imageUrl;

    public V1Controller(ElasticService elasticService, LegacyService legacyService, AdminService adminService, AuthService authService, ElasticsearchOperations elasticsearchOperations) {
        this.elasticService = elasticService;
        this.legacyService = legacyService;
        this.adminService = adminService;
        this.authService = authService;
        this.elasticsearchOperations = elasticsearchOperations;
    }

    @Tag(name = "bulk")
    @Operation(
            summary = "Batch lookup of multiple taxon names",
            operationId = SPECIES_LOOKUP_BULK_ID,
            description = "Retrieve taxon information for a list of vernacular or scientific names. This operation can be used to retrieve large lists of taxa. By default, the operation searches for both vernacular names and scientific names. Requires a JSON map as a post body. The JSON map must contain a \"names\" key that is the list of scientific names. json {\"names\":[\"Macropus rufus\",\"Macropus greyi\"]} This service will return a list of results. This differs from the original bulk species lookup by including a null value when a name could not be located. To allow the lookup to consider common names, include a \"vernacular\":true value in the JSON map: json {\"names\":[\"Grevillea\"],\"vernacular\":true}")
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @PostMapping(path = "/species/lookup/bulk", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<LongProfile>> speciesLookupBulk(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "The JSON map object the list of names",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = "{\"names\":[\"Grevillea\"],\"vernacular\":true}"
                            )))
            @RequestBody
            SpeciesLookupBulkRequest speciesLookupBulkRequest) {

        List<LongProfile> result = new ArrayList<>();
        for (String name : speciesLookupBulkRequest.names) {
            result.add(elasticService.getLongProfileForName(name, speciesLookupBulkRequest.vernacular));
        }

        return ResponseEntity.ok(result);
    }

    @Tag(name = "bulk")
    @Operation(
            operationId = SPECIES_GUIDS_BULKLOOKUP_ID,
            summary = "Bulk retrieval of species by identifier(s)",
            description = "Retrieve taxon information for a list of identifiers. This operation can be used to retrieve large lists of taxa")
    @ApiResponse(description = "List of species info", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @PostMapping(path = "/species/guids/bulklookup", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SpeciesGuidsBulklookupResponse> speciesGuidsBulklookup(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "The JSON list of GUIDS",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = "[\"https://id.biodiversity.org.au/node/apni/2900921\",\"https://id.biodiversity.org.au/taxon/apni/51446575\"]"
                            )))
            @RequestBody List<String> guidList
    ) {
        return ResponseEntity.ok(new SpeciesGuidsBulklookupResponse(elasticService.getTaxa(guidList)));
    }

    @Tag(name = "bulk")
    @Operation(
            operationId = SPECIES_IMAGE_BULK_ID,
            summary = "Get a list of images for a list of taxon identifiers",
            description = "Return a list of \"hero shot\" preferred image identifiers and links for each taxon specified by the guid or null for no image")
    @ApiResponse(description = "An array of either nulls for not found or packages of image information", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @PostMapping(path = "/species/image/bulk", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Image>> speciesImageBulk(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "The guids to look up",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = "[\"https://id.biodiversity.org.au/node/apni/2900921\",\"https://id.biodiversity.org.au/taxon/apni/51446575\"]"
                            )))
            @RequestBody List<String> ids
    ) {
        List<Image> result = new ArrayList<>();

        for (String id : ids) {
            SearchItemIndex item = elasticService.getTaxon(id);
            if (item == null) {
                item = elasticService.getTaxonByName(id, true);
                if (item != null && StringUtils.isNotEmpty(item.getAcceptedConceptID())) {
                    item = elasticService.getTaxon(item.getAcceptedConceptID());
                }
            }
            if (item == null) {
                item = elasticService.getTaxonVariantByName(id, false);
            }

            if (item != null && StringUtils.isNotEmpty(item.getImage())) {
                String imageId = item.getImage().split(",")[0];
                result.add(new Image(imageId,
                        imageUrl + ImageUrlType.THUMBNAIL.path + imageId,
                        imageUrl + ImageUrlType.SMALL.path + imageId,
                        imageUrl + ImageUrlType.LARGE.path + imageId,
                        imageUrl + ImageUrlType.METADATA.path + imageId));
            } else {
                result.add(null);
            }
        }

        return ResponseEntity.ok(result);
    }

    @Tag(name = "Search")
    @Operation(
            operationId = CHILD_CONCEPTS_ID,
            summary = "Get the child concepts of a taxon with the supplied GUID",
            description = "Return the taxon concepts that are direct children of the specified taxon"
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = "/childConcepts/**", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ChildConcept>> childConcepts(
            /* @PathVariable String id, injected into openapi using OpenAPIExampleService */
            @Nullable @RequestParam(name = "unranked", required = false, defaultValue = "true") Boolean unranked,
            @Nullable @RequestParam(name = "within", required = false, defaultValue = "2000") Integer within,
            HttpServletRequest request
    ) {
        String id = request.getRequestURI().split(request.getContextPath() + "/childConcepts/")[1];
        return ResponseEntity.ok(elasticService.getChildConcepts(id, within, unranked));
    }

    @Tag(name = "Search")
    @Operation(
            operationId = CLASSIFICATION_ID,
            summary = "Get higher classifications of taxon with the supplied GUID",
            description = "Provides a list of higher taxa for the requested taxon. Note, this service does not currently support JSONP (use of callback param) but this is planned for a future release."
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = "/classification/**", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Classification>> classification(
            /* @PathVariable String id, injected into openapi using OpenAPIExampleService */
            HttpServletRequest request
    ) {
        String guid = request.getRequestURI().split(request.getContextPath() + "/classification/")[1];

        List<Classification> classification = elasticService.getClassification(elasticService.getTaxon(elasticService.cleanupId(guid), false, true));

        if (classification.isEmpty()) {
            return ResponseEntity.notFound().build();
        } else {
            return ResponseEntity.ok(classification);
        }
    }

    @Tag(name = "Search")
    @Operation(
            operationId = GUID_BATCH_ID,
            summary = "Batch lookup of multiple taxon names",
            description = "Search for multiple names with individual name queries and return short profiles for each name"
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = "/guid/batch", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, List<Profile>>> guidBatch(
            @Parameter(
                    description = "Query string",
                    example = "[\"kangaroo\"]"
            )
            @RequestParam(name = "q") String[] qs
    ) {
        Map<String, List<Profile>> results = new HashMap<>();

        for (String q : qs) {
            List<SearchItemIndex> items = elasticService.getTaxonsByName(q, 10, true);
            if (items != null) {
                results.put(q, FormatUtil.itemsToProfiles(items));
            }
        }

        return ResponseEntity.ok(results);
    }

    @Tag(name = "Search")
    @Operation(
            operationId = GUID_ID,
            summary = "Look up a taxon guid by name",
            description = "Return a list of taxa which correspond to a specific taxon id and which have images available"
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = "/guid/**", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Profile>> guidName(
            /* @PathVariable String id, injected into openapi using OpenAPIExampleService */
            HttpServletRequest request
    ) {
        String id = request.getRequestURI().split(request.getContextPath() + "/guid/")[1];
        List<SearchItemIndex> items = elasticService.getTaxonsByName(id, 10, true);
        if (items != null && !items.isEmpty()) {
            return ResponseEntity.ok(FormatUtil.itemsToProfiles(items));
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @Tag(name = "Search")
    @Operation(
            operationId = IMAGESEARCH_ID,
            summary = "Search for a taxon with images",
            description = "Return a list of taxa which correspond to a specific taxon id and which have images available"
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = "/imageSearch/**", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> imageSearch(
            /* @PathVariable String id, injected into openapi using OpenAPIExampleService */
            @Parameter(
                    description = "The records offset, to enable paging",
                    example = "0"
            )
            @Nullable @RequestParam(name = "start", required = false, defaultValue = "0") Integer start,
            @Parameter(
                    description = "The number of records to return, to enable paging",
                    example = "5"
            )
            @Nullable @RequestParam(name = "rows", required = false, defaultValue = "10") Integer rows,
            HttpServletRequest request
    ) {
        String id = null;
        if (request.getRequestURI().startsWith(request.getContextPath() + "/imageSearch/")) {
            id = request.getRequestURI().substring((request.getContextPath() + "/imageSearch/").length());
        }

        Map<String, Object> result = elasticService.imageSearch(elasticService.cleanupId(id), start, rows);

        return ResponseEntity.ok(result);
    }

    @Tag(name = "Search")
    @Operation(
            operationId = SPECIES_SHORTPROFILE_ID,
            summary = "Get a short description of a taxon",
            description = "Get a summary of taxon data without details such as variants, additional identifiers, etc."
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = "/species/shortProfile/**", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ShortProfile> shortProfile(
            /* @PathVariable String id, injected into openapi using OpenAPIExampleService */
            HttpServletRequest request
    ) {
        String id = null;
        if (request.getRequestURI().startsWith(request.getContextPath() + "/species/shortProfile/")) {
            id = request.getRequestURI().substring((request.getContextPath() + "/species/shortProfile/").length());
        }

        ShortProfile model = elasticService.getShortProfile(elasticService.cleanupId(id));

        if (model != null) {
            return ResponseEntity.ok(model);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @Tag(name = "Search")
    @Operation(
            operationId = SPECIES_ID,
            summary = "Look up a species by guid for the taxon",
            description = "Return a list of of species matching the provided guid"
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = {"/species/**", "/taxon/**"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> species(
            /* @PathVariable String id, injected into openapi using OpenAPIExampleService */
            HttpServletRequest request
    ) {
        String id;
        if (request.getRequestURI().startsWith(request.getContextPath() + "/species/")) {
            id = request.getRequestURI().substring((request.getContextPath() + "/species/").length());
        } else {
            id = request.getRequestURI().substring((request.getContextPath() + "/taxon/").length());
        }

        Map<String, Object> item = elasticService.getTaxonResponse(id);
        if (item != null) {
            if (item.containsKey("redirect")) {
                HttpHeaders headers = new HttpHeaders();
                headers.add("Location", request.getContextPath() + "/species/" + item.get("redirect"));
                return new ResponseEntity<>(headers, HttpStatus.FOUND);
            }
            return ResponseEntity.ok(item);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @Tag(name = "rank")
    @Operation(
            operationId = "ranks",
            summary = "Gets a description of the ranks used to classify levels of taxa"
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = "/ranks", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Rank>> ranks() {
        return ResponseEntity.ok(legacyService.getRanks(elasticService.indexFields(false)));
    }

    @Operation(
            method = "GET",
            tags = "admin webservices",
            operationId = "setImages",
            summary = "Set the preferred and hidden images for a taxon",
            security = {@SecurityRequirement(name = "openIdConnect")},
            parameters = {
                    @Parameter(name = "Authorization", in = HEADER, schema = @Schema(implementation = String.class), required = true)
            }
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @SecurityRequirement(name = "JWT")
    @GetMapping(path = "/api/setImages")
    public ResponseEntity<String> setImages(
            @Parameter(description = "Scientific Name")
            @RequestParam(name = "name") String name,
            @Parameter(description = "Taxon ID")
            @RequestParam(name = "guid") String guid,
            @Parameter(description = "Comma delimited preferred Image IDs")
            @RequestParam(name = "prefer") String prefer,
            @Parameter(description = "Comma delimited hidden Image IDs")
            @RequestParam(name = "hide") String hide,
            @AuthenticationPrincipal Principal principal
    ) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        boolean preferSuccessful = adminService.setValue(new SetRequest(guid, name, ListBackedFields.IMAGE.name(), prefer));
        boolean hideSuccessful = adminService.setValue(new SetRequest(guid, name, ListBackedFields.HIDDEN.name(), hide));

        if (!preferSuccessful || !hideSuccessful) {
            return ResponseEntity.internalServerError().build();
        }

        return ResponseEntity.ok("ok");
    }

    @Operation(
            method = "GET",
            tags = "admin webservices",
            operationId = "setWikiUrl",
            summary = "Set the preferred wiki URL for a taxon",
            security = {@SecurityRequirement(name = "openIdConnect")},
            parameters = {
                    @Parameter(name = "Authorization", in = HEADER, schema = @Schema(implementation = String.class), required = true)
            }
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @SecurityRequirement(name = "JWT")
    @GetMapping(path = "/api/setUrl")
    public ResponseEntity<String> setWikiUrl(
            @Parameter(description = "Scientific Name")
            @RequestParam(name = "name") String name,
            @Parameter(description = "Taxon ID")
            @RequestParam(name = "guid") String guid,
            @Parameter(description = "URL")
            @RequestParam(name = "url") String url,
            @AuthenticationPrincipal Principal principal

    ) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        adminService.setValue(new SetRequest(guid, name, ListBackedFields.WIKI.name(), url));

        return ResponseEntity.ok("ok");
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
    @GetMapping(path = "/indexFields", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<IndexedField> search() {
        return elasticService.indexFields(true);
    }

    @Tag(name = "Search")
    @Operation(
            operationId = SEARCH_ID,
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
    @GetMapping("/search")
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
            @Nullable @RequestParam(name = "start", required = false, defaultValue = "0") Integer start,

            @Parameter(
                    description = "The number of records to return",
                    example = "5"
            )
            @Nullable @RequestParam(name = "pageSize", required = false, defaultValue = "10") Integer rows,

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
                    description = "Comma separated list of fields to display facets for.",
                    example = "datasetName,commonNameSingle"
            )
            @Nullable @RequestParam(name = "facets", required = false) String facets) {
        if (rows == null) rows = 10;

        int page = 0;
        if (start != null) {
            page = start / rows;
        }

        // species-lists is 1 to n, remain consistent here
        PageRequest pageRequest = PageRequest.of(page, rows);

        // TODO: use op parser util class to construct the query

//        NativeQueryBuilder query =
//                NativeQuery.builder().withQuery(wq -> wq.bool(bq -> {
//                            if (!"*".equals(q)) {
//                                bq.must(m -> m.matchPhrase(mq -> mq.field("all").query(q)));
//                            }
//                            if (fqs != null) {
//                                for (String fq : fqs) {
//                                    String[] fieldValue = fq.split(":");
//                                    bq.filter(f -> f.term(t -> t.field(fieldValue[0]).value(fieldValue[1])));
//                                }
//                            }
//                            return bq;
//                        }))
//                        .withPageable(pageRequest);

//        NativeQueryBuilder query = NativeQuery.builder()
//                .withQuery(wq -> wq.bool(bq -> {
//                    bq.must(q -> formatTerm(q));
//                    for (String fq : fqs) {
//                        bq.must(fq);
//                    }
//                    return bq;
//                }));
//
//        if (StringUtils.isNotEmpty(sort)) {
//            query.withSort(s -> s.field(f -> f.field(sort).order("desc".equalsIgnoreCase(dir) ? SortOrder.Desc : SortOrder.Asc)));
//        }
//
//        if (facets != null) {
//            for (String facet : facets.split(",")) {
//                query.withAggregation(facet, AggregationBuilders.terms(ts -> ts.field(facet).size(100)));
//            }
//        }
//
//        SearchHits<SearchItemIndex> result = elasticsearchOperations.search(query.build(), SearchItemIndex.class);
//        List<SearchItemIndex> hits = (List<SearchItemIndex>) SearchHitSupport.unwrapSearchHits(result);
//
//        Map<String, Object> mapResult = new HashMap<>();
//        mapResult.put("results", hits);
//
//        Map<String, Object> facetMap = new HashMap<>();
//        mapResult.put("facetResults", facetMap);
//        Map<String, ElasticsearchAggregation> aggregations = ((ElasticsearchAggregations) ((SearchHitsImpl) result).getAggregations()).aggregationsAsMap();
//        for (Map.Entry<String, ElasticsearchAggregation> entry : aggregations.entrySet()) {
//            Map<String, Object> facetItemMap = new HashMap<>();
//
//            List<Map<String, Object>> facetItems = new ArrayList<>();
//
//            List<StringTermsBucket> buckets = (List<StringTermsBucket>) ((MultiBucketAggregateBase) entry.getValue().aggregation().getAggregate()._get()).buckets()._get();
//            for (StringTermsBucket bucket : buckets) {
//                Map<String, Object> itemMap = new HashMap<>();
//                itemMap.put("label", bucket.key().stringValue());
//                itemMap.put("count", bucket.docCount());
//                itemMap.put("fieldValue", bucket.key().stringValue());
//                itemMap.put("fq", entry.getKey() + ":\"" + bucket.key().stringValue() + "\"");
//                facetItems.add(itemMap);
//            }
//
//            facetItemMap.put("fieldName", entry.getKey());
//            facetItemMap.put("fieldResult", facetItems);
//            facetMap.put(entry.getKey(), facetItemMap);
//        }
//
//        mapResult.put("queryTitle", q);
//        mapResult.put("totalRecords", result.getTotalHits());

//        return mapResult;
        return null;
    }

    /**
     * supports ops
     *
     * where ops is
     * terms OR terms
     * terms AND terms
     *
     * where terms is
     * (op)
     * term
     *
     * where term is
     * value
     * field:value
     * -field:value
     *
     * where value is
     * string
     * "string"
     *
     * @param q
     * @return
     */

    public class Op {
        public List<Term> terms = new ArrayList<>();
        public boolean andOp = false; // true==AND, false==OR
    }

    public class Term {
        public Op op;
        public boolean negate = false;
        public String field;
        public String value;
    }

    // TODO: move to a util class, include query builder, add unit tests
    private Op parseInput(String input) {
        StringTokenizer tokenizer = new StringTokenizer(input.trim(), " ()\"\\:", true);

        Op parentOp = new Op();
        Op currentOp = parentOp;
        List<Op> opStack = new ArrayList<>();

        boolean allowSingleValue = true;

        boolean inString = false;
        boolean isSingleValue = false;
        int inBracket = 0;
        String prevToken = null;
        Term currentTerm = new Term();
        String currentString = null;
        while (tokenizer.hasMoreTokens()) {
            String token = tokenizer.nextToken();
            if (isSingleValue) {
                // append everything
                currentTerm.value += token;
            } else if (inString) {
                if ("\"".equals(token) && "\\".equals(prevToken)) {
                    currentString += token;
                } else if ("\"".equals(token)) {
                    inString = false;
                    if (!allowSingleValue && currentTerm.field == null) {
                        // quoted value but no field
                        return null;
                    }
                    currentTerm.value = currentString;
                    currentOp.terms.add(currentTerm);
                    currentTerm = new Term();
                } else if ("\\".equals(token)) {
                    // do nothing for this escape character
                } else {
                    currentString += token;
                }
            } else if ("\"".equals(token)) {
                if (!allowSingleValue) {
                    if (!":".equals(prevToken) || currentTerm.field == null) {
                        // field:value separator is missing or field is not set
                        return null;
                    }
                }
                inString = true;
                currentString = "";
            } else if ("(".equals(token)) {
                // start new op
                inBracket++;
                currentOp = new Op();
                opStack.add(currentOp);
            } else if (")".equals(token)) {
                // push current op to parent
                if (inBracket == 0) {
                    return null;
                }
                inBracket--;
                Term newTerm = new Term();
                newTerm.op = currentOp;
                currentOp = opStack.get(inBracket);
                currentOp.terms.add(newTerm);
            } else if (" ".equals(token)) {
                // do nothing
            } else if ("OR".equals(token)) {
                currentOp.andOp = false;
            } else if ("AND".equals(token)) {
                currentOp.andOp = true;
            } else {
                if (currentTerm.field == null && (":".equals(prevToken) || ":".equals(token))) {
                    // field cannot equal ':' or appear immediately after ':'
                    return null;
                } else if (currentTerm.field == null) {
                    if (currentTerm.value != null) {
                        // this is an instance of allowSingleValue:true and an invalid field copied to the value
                        return null;
                    }
                    if (token.startsWith("-")) {
                        currentTerm.negate = true;
                        currentTerm.field = token.substring(1);
                    } else {
                        currentTerm.field = token;
                    }
                    if (!allowSingleValue) {
                        if (!isValidField(currentTerm.field)) {
                            // field is not valid
                            return null;
                        }
                    } else {
                        if (!isValidField(currentTerm.field)) {
                            // must be a single value when it is not a valid field
                            currentTerm.value = currentTerm.field;
                            currentTerm.field = null;
                            isSingleValue = true;
                            currentOp.terms.add(currentTerm);
                        }
                    }
                } else if (!":".equals(token) && ":".equals(prevToken)){ // ':' must appear before a value
                    currentTerm.value = token;
                    currentOp.terms.add(currentTerm);
                    currentTerm = new Term();
                }
            }
            prevToken = token;
        }
        return parentOp;
    }

    private boolean isValidField(String field) {
        return elasticService.validFields(false).contains(field) || "*".equals(field);
    }

    private ObjectBuilder<Query> formatTerm(Query.Builder q, String input) {


//            // TODO: when a field is not 'keyword' term queries cannot be used.
//            // TODO: when using a nested field, do so correctly for exists, no exists, comparison
//            if (item.getValue() instanceof List) {
//                // TODO: I think there is a specific query type for this so there is no need to use bool
//                bq.must(
//                        q2 -> q2.bool(bq2 -> {
//                            for (Object v : (List) item.getValue()) {
//                                if (item.getKey().startsWith("-")) {
//                                    bq2.mustNot(q3 -> q3.term(t -> t.field(fieldMapping(item.getKey())).value((String) v)));
//                                } else {
//                                    bq2.should(q3 -> q3.term(t -> t.field(fieldMapping(item.getKey())).value((String) v)));
//                                }
//                            }
//                            return bq2;
//                        }));
//            } else if (item.getKey().startsWith("not exists ")) {
//                bq.mustNot(q3 -> q3.exists(eq -> eq.field(fieldMapping(item.getKey().substring("not exists ".length())))));
//            } else if (item.getKey().startsWith("exists ")) {
//                bq.must(q3 -> q3.exists(eq -> eq.field(fieldMapping(item.getKey().substring("exists ".length())))));
//            } else if (item.getKey().startsWith("-")) {
//                bq.mustNot(f -> f.term(t -> t.field(fieldMapping(item.getKey().substring(1))).value((String) item.getValue())));
//            } else {
//                bq.filter(f -> f.term(t -> t.field(fieldMapping(item.getKey())).value((String) item.getValue())));
//            }
//        }
        return null;
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
    @GetMapping(path = {"/search/auto", "/search/auto.json"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> searchAuto(
            @Parameter(
                    description = "The value to auto complete e.g. q=Mac",
                    example = "Mac")
            @RequestParam(name = "q") String q,
            @Parameter(
                    description = "The index type to limit. One of TAXON, TAXONVARIANT, COMMON, IDENTIFIER, REGION, COLLECTION, INSTITUTION, DATAPROVIDER, DATASET, LOCALITY, WORDPRESS, LAYER, SPECIESLIST, KNOWLEDGEBASE, BIOCOLLECT.",
                    example = "TAXON")
            @Nullable @RequestParam(name = "idxType", required = false) String idxType,
            @Parameter(
                    description = "The higher-order taxonomic rank to limit the result",
                    example = "plantae")
            @Nullable @RequestParam(name = "kingdom", required = false) String kingdom,
            @Parameter(
                    description = "The maximum number of results to return (default = 10)",
                    example = "10")
            @Nullable @RequestParam(name = "limit", required = false, defaultValue = "10") Integer limit
    ) {
        Map<String, Object> payload = new HashMap<>();

        List<SearchItemIndex> autoCompleteList = elasticService.autocomplete(q, idxType, kingdom, limit);

        List<Map<String, Object>> formatted = new ArrayList<>();
        for (SearchItemIndex item : autoCompleteList) {
            Map<String, Object> map = new HashMap<>();
            map.put("guid", StringUtils.isNotEmpty(item.acceptedConceptID) ? item.acceptedConceptID : item.guid);
            map.put("name", item.scientificName);
            map.put("commonName", item.commonNameSingle);
            map.put("rankString", item.rank);
            map.put("rankID", item.rankID);

            Set<String> matchedNames = new HashSet<>();
            map.put("matchedNames", matchedNames);

            if (item.commonName != null) {
                for (String name : item.commonName) {
                    String str = FormatUtil.getHighlightedName(name, q);
                    matchedNames.add(str);
                }
                map.put("commonNameMatches", new ArrayList<>(matchedNames)); // clone of matchedNames
            }

            if (StringUtils.isNotEmpty(item.scientificName)) {
                String str = FormatUtil.getHighlightedName(item.scientificName, q);
                map.put("scientificNameMatches", Collections.singletonList(str));
                matchedNames.add(str);
            }

            if (StringUtils.isNotEmpty(item.name)) {
                String str = FormatUtil.getHighlightedName(item.name, q);
                matchedNames.add(str);
            }

            if (matchedNames.isEmpty()) {
                matchedNames.add(item.name);
            }

            formatted.add(map);
        }
        payload.put("autoCompleteList", formatted);

        return ResponseEntity.ok(payload);
    }

    @Tag(name = "bulk")
    @Operation(
            operationId = DOWNLOAD_ID,
            summary = "Download the results of a species search",
            description = "Search the BIE and return the taxonomic results of the search in tabular form"
    )
    @ApiResponse(description = "Search results", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @GetMapping(path = "/download", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> download(
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
                    description = "Override the default field list with a comma separated list of fields to include in the download. Fields can be included in the download if they have been stored.",
                    example = "taxonConceptID,rank"
            )
            @Nullable @RequestParam(name = "fields", required = false) String fields,

            @Parameter(
                    description = "The name of the file to be downloaded.",
                    example = "myFile.csv"
            )
            @Nullable @RequestParam(name = "file", required = false, defaultValue = "species.csv") String file
    ) {
        // TODO: support the whole range of queries expected

        if (StringUtils.isEmpty(q)) {
            return ResponseEntity.badRequest().build();
        } else {
            try {
                return ResponseEntity.ok()
                        .contentType(new MediaType("text", "csv"))
                        .header("Content-Disposition", "attachment;file=" + file)
                        .body(elasticService.download(q, fqs, fields));
            } catch (Exception e) {
                logger.error("download failed: " + e.getMessage());
                return ResponseEntity.internalServerError().build();
            }
        }
    }

    private String fieldMapping(String key) {
        if (key.startsWith("rk") || key.startsWith("conservation_")) {
            return "data." + key;
        }
        // TODO: other data.* fields, if they are in use

        return key;
    }
}
