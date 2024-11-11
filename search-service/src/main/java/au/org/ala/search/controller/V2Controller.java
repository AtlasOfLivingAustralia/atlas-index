package au.org.ala.search.controller;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.cache.LanguageInfo;
import au.org.ala.search.service.LanguageService;
import au.org.ala.search.service.auth.WebService;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.queue.QueueService;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.queue.*;
import au.org.ala.search.model.dto.*;
import au.org.ala.search.service.AdminService;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.LegacyService;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.common.util.StringUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.elasticsearch.core.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Nullable;
import java.io.*;
import java.security.Principal;
import java.util.*;
import java.util.zip.GZIPInputStream;

/**
 * bie-index API services, minus some admin services
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class V2Controller {
    private static final Logger logger = LoggerFactory.getLogger(V2Controller.class);

    public static final String SPECIES_ID = "species_v2";
    public static final String LIST_ID = "list_v2";
    public static final String DOWNLOAD_ID = "download_v2";
    public static final String DOWNLOAD_FIELDGUIDE = "fieldguide_v2";
    private final ListCache listCache;

    @Value("#{'${openapi.servers}'.split(',')[0]}")
    public String baseUrl;

    protected final ElasticService elasticService;
    protected final LegacyService legacyService;
    protected final AdminService adminService;
    protected final AuthService authService;
    protected final ElasticsearchOperations elasticsearchOperations;
    protected final QueueService queueService;
    protected final DownloadFileStoreService downloadFileStoreService;
    protected final WebService webService;
    protected final LanguageService languageService;

    public V2Controller(ElasticService elasticService, LegacyService legacyService, AdminService adminService, AuthService authService, ElasticsearchOperations elasticsearchOperations, QueueService queueService, DownloadFileStoreService downloadFileStoreService, WebService webService, ListCache listCache, LanguageService languageService) {
        this.elasticService = elasticService;
        this.legacyService = legacyService;
        this.adminService = adminService;
        this.authService = authService;
        this.elasticsearchOperations = elasticsearchOperations;
        this.queueService = queueService;
        this.downloadFileStoreService = downloadFileStoreService;
        this.webService = webService;
        this.listCache = listCache;
        this.languageService = languageService;
    }

    @Tag(name = "Search")
    @Operation(
            operationId = SPECIES_ID,
            summary = "Get accepted records for a list of guids and names.",
            description = "For each given guid or name, the following searches will be performed in order,<br/>"
                    + "before returning the accepted identifier:<br/>"
                    + "1. Search for matching TAXON guid or linkIdentifier<br/>"
                    + "2. Search for the first matching TAXON scientificName or nameComplete or commonName<br/>"
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
    public ResponseEntity<List<Map>> species(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "The JSON list of guids or scientificNames to search",
                    content = @Content(
                            // This example is updated by OpenapiService at runtime
                            examples = @ExampleObject(
                                    value = "[\"urn:lsid:biodiversity.org.au:afd.taxon:1\",\"Koala\"]"
                            )))
            @RequestBody
            List<String> qs,
            @Parameter(
                    description = "Comma delimited list of fields to return. If not provided, all fields are returned.",
                    example = "id,scientificName,rank,data.rk_kingdom")
            @RequestParam(name = "fl", required = false) String fl
    ) {
        if (qs == null || qs.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        List<Map> result = new ArrayList<>();
        for (String q : qs) {
            if (StringUtils.isBlank(q)) {
                continue;
            }

            String id = elasticService.cleanupId(q);

            Map taxon = elasticService.getTaxonMap(id, true, true);
            if (taxon == null) {
                taxon = elasticService.getTaxonVariantByNameMap(id, true);
            }
            if (taxon == null) {
                taxon = elasticService.getTaxonByPreviousIdentifierMap(id, true);
            }

            // Inject an object for synonymData, vernacularData, identifierData, variantData.
            // Replaces JSON string with JSON list.
            try {
                ObjectMapper mapper = new ObjectMapper();
                updateNamesData(taxon, mapper, "synonymData");
                updateNamesData(taxon, mapper, "vernacularData");
                updateNamesData(taxon, mapper, "identifierData");
                updateNamesData(taxon, mapper, "variantData");
            } catch (IOException ignored) {
            }

            // Inject listId->name mapping so that it is available to the UI
            Map<String, String> listNamesMap = new HashMap<>();
            for (Object obj : taxon.keySet()) {
                String key = (String) obj;
                if (key.startsWith("iucn_") || key.startsWith("conservation_") || key.startsWith("sds_")) {
                    String listId = key.replaceAll("iucn_|conservation_|sds_", "");
                    String name = listCache.listNames.get(listId);
                    if (StringUtils.isNotEmpty(name)) {
                        listNamesMap.put(listId, name);
                    }
                }
            }
            if (!listNamesMap.isEmpty()) {
                taxon.put("listNames", listNamesMap);
            }

            // Inject vernacular name language info
            if (taxon.containsKey("vernacularData")) {
                List<Map> vernacularData = (List<Map>) taxon.get("vernacularData");
                for (Map vernacular : vernacularData) {
                    String languageCode = (String) vernacular.get("language");
                    if (StringUtils.isNotEmpty(languageCode)) {
                        LanguageInfo languageInfo = languageService.getLanguageInfo(languageCode);
                        if (languageInfo != null) {
                            vernacular.put("languageName", languageInfo.name);
                            vernacular.put("languageURL", languageInfo.uri);
                        }
                    }
                }
            }

            // Remove fields not requested. For better performance incorporate this at the flatten and inject stages.
            if (fl != null) {
                List<String> fields = Arrays.asList(fl.split(","));
                Map filteredTaxon = new HashMap<>();
                for (String field : fields) {
                    if (taxon.containsKey(field)) {
                        filteredTaxon.put(field, taxon.get(field));
                    }
                }
                taxon = filteredTaxon;
            }

            result.add(taxon);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * Update the base64 + compressed JSON with a JSON list for a taxon Map object
     *
     * @param taxon  taxon Map with the object that is a string of JSON
     * @param mapper ObjectMapper so it does not need to be created each time
     * @param name   the name of the object in the taxon Map
     * @throws IOException
     */
    private void updateNamesData(Map taxon, ObjectMapper mapper, String name) throws IOException {
        if (taxon.containsKey(name)) {
            String base64 = taxon.get(name).toString();
            if (base64 != null && !base64.isEmpty()) {
                byte[] compressedBytes = Base64.getDecoder().decode(base64);
                ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(compressedBytes);
                ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();

                try (GZIPInputStream gzipInputStream = new GZIPInputStream(byteArrayInputStream)) {
                    byte[] buffer = new byte[1024];
                    int len;
                    while ((len = gzipInputStream.read(buffer)) != -1) {
                        byteArrayOutputStream.write(buffer, 0, len);
                    }
                }

                List data = mapper.readValue(byteArrayOutputStream.toString("UTF-8"), List.class);
                taxon.put(name, data);
            }
        }
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
    @GetMapping("/v2/search")
    public /*List<SearchItemIndex>*/ Object search(
            @Parameter(
                    description = "Primary search  query for the form field:value e.g. q=rk_genus:Macropus or freee text e.g q=gum",
                    example = "gum"
            )
            @RequestParam(name = "q") String q,

            // TODO: merge q and fq
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
            @Nullable @RequestParam(name = "fl", required = false) String[] fl) {
        Map<String, Object> result = elasticService.search(q, fqs, page, pageSize, sort, dir, facets, fl);
        if (result == null) {
            // Most likely it is a badly formed query
            return ResponseEntity.badRequest().build();
        } else {
            return ResponseEntity.ok(result);
        }
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

    @Tag(name = "Download")
    @Operation(
            operationId = DOWNLOAD_ID,
            summary = "Start a job to create a zipped CSV containing all the records of search result."
            // description is set by the OpenapiService at runtime
    )
    @ApiResponse(description = "Job status", responseCode = "200",
            headers = {
                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
            }
    )
    @PostMapping(path = "/v2/download/search", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StatusResponse> queueDownload(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "A download request. The list of query terms (q), the filename, and the list of fields to return (fl) are mandatory.",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = "{\"q\":[\"Koala\"], \"filename\":\"koala-20240101\", \"fl\":[\"id\",\"scientificName\",\"rank\",\"rk_kingdom\"]}"
                            )))
            @RequestBody
            SearchQueueRequest searchDownloadRequest
    ) {
        if (StringUtils.isEmpty(searchDownloadRequest.filename) ||
                searchDownloadRequest.q == null || searchDownloadRequest.q.length == 0 ||
                searchDownloadRequest.fl == null || searchDownloadRequest.fl.length == 0) {
            return ResponseEntity.badRequest().build();
        }

        searchDownloadRequest.taskType = TaskType.SEARCH_DOWNLOAD;
        return addToQueue(searchDownloadRequest);
    }

    @SecurityRequirement(name = "JWT")
    @Tag(name = "Download")
    @Operation(
            operationId = DOWNLOAD_FIELDGUIDE,
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
    public ResponseEntity<StatusResponse> queueFieldguide(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "The fieldguide download request including a list of id and filename.",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = "{\"id\": [\"urn:lsid:biodiversity.org.au:afd.taxon:1\"], \"filename\":\"fieldguide-20240101\", \"title\":\"Fieldguide Title\", \"sourceUrl\":\"a source url\"}"
                            )))
            @RequestBody
            FieldguideQueueRequest fieldguideDownloadRequest,
            @AuthenticationPrincipal Principal principal) {
        fieldguideDownloadRequest.email = authService.getEmail(principal);

        fieldguideDownloadRequest.taskType = TaskType.FIELDGUIDE;
        return addToQueue(fieldguideDownloadRequest);
    }

    private ResponseEntity<StatusResponse> addToQueue(QueueRequest queueRequest) {
        Status status = queueService.add(queueRequest);

        if (status != null) {
            return ResponseEntity.ok(new StatusResponse(status, baseUrl + "/v2/download"));
        } else {
            return ResponseEntity.badRequest().build();
        }
    }

    @Tag(name = "Download")
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
            @RequestParam(name = "download", required = false, defaultValue = "false") Boolean download) {
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
                        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
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
