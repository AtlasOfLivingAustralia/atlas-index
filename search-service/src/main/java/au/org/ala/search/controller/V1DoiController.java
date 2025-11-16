/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.model.doi.*;
import au.org.ala.search.model.url.UrlType;
import au.org.ala.search.repo.DoiDataPostgresRepository;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.remote.DoiFileStoreService;
import au.org.ala.search.service.remote.DoiService;
import au.org.ala.search.service.remote.SignedUrlService;
import au.org.ala.search.util.doi.exceptions.DoiNotFoundException;
import au.org.ala.search.util.doi.exceptions.DoiUpdateException;
import au.org.ala.search.util.doi.exceptions.DoiValidationException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.links.Link;
import io.swagger.v3.oas.annotations.links.LinkParameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.*;

import static io.swagger.v3.oas.annotations.enums.ParameterIn.*;

/**
 * Controller for DOI operations
 * <p>
 * Requests are expected to be quick operations, so no queuing is implemented.
 */
@Slf4j
@RestController
@Tag(name = "DOI", description = "DOI and metadata APIs")
@CrossOrigin(origins = "*", maxAge = 3600)
// /api/doi is for some legacy clients and is hidden by the OpenapiService customizer
@RequestMapping(path = {"/v1/doi", "/api/doi"}, produces = "application/json")
public class V1DoiController {

    public static final String DOI_ID = "doi";
    public static final String PUT_DOI = "putDoi";
    public static final String PATCH_DOI = "patchDoi";
    public static final String POST_DOI = "postDoi";

    final DoiDataPostgresRepository doiDataPostgresRepository;
    final AuthService authService;
    final DoiFileStoreService doiFileStoreService;
    final DoiService doiService;
    private final SignedUrlService signedUrlService;

    @Value("${doi.baseUrl}")
    protected String doiBaseUrl;

    @Value("${doi.s3.duration}")
    protected Integer doiS3Duration;

    public V1DoiController(DoiDataPostgresRepository doiDataPostgresRepository, AuthService authService, DoiFileStoreService doiFileStoreService, DoiService doiService, SignedUrlService signedUrlService) {
        this.doiDataPostgresRepository = doiDataPostgresRepository;
        this.authService = authService;
        this.doiFileStoreService = doiFileStoreService;
        this.doiService = doiService;
        this.signedUrlService = signedUrlService;
    }

    /**
     * Retrieve the file for a doi by either UUID or DOI
     *
     * @param id Either the local UUID or the DOI identifier
     * @return the file associated with the DOI
     */
    @Operation(
            summary = "Download the file associated with a DOI",
            description = "Download the file associated with a DOI",
            parameters = {
                    @Parameter(name = "id", in = PATH, required = true, description = "Either the DOI (encoded or unencoded) or the UUID", schema = @Schema(implementation = String.class))
            },
            responses = {
                    @ApiResponse(responseCode = "200",
                            description = "Success",
                            content = @Content(
                                    mediaType = "application/octet-stream",
                                    schema = @Schema(type = "string", format = "binary")
                            ),
                            headers = {
                                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
                            }
                    ),
                    @ApiResponse(responseCode = "404", description = "DOI or UUID not found in this system"),
                    @ApiResponse(responseCode = "302", description = "Redirect to file")
            }
    )
    @SecurityRequirement(name = "JWT")
    @SecurityRequirement(name = "openIdConnect")
    @GetMapping(path = "/{id}/download", produces = {"application/octet-stream", "application/json"})
    public ResponseEntity<?> download(
            @PathVariable("id") String id,
            @Parameter(hidden = true, description = "return JSON response containing the location instead of redirecting")
            @RequestParam(name = "redirect", defaultValue = "true") Boolean redirect,
            @AuthenticationPrincipal Principal principal) {
        if (id == null) {
            return ResponseEntity.badRequest().body("id is null");
        }

        String decodedId = URLDecoder.decode(id, StandardCharsets.UTF_8);
        Doi doi = doiDataPostgresRepository.findByIdNative(UUID.fromString(decodedId));
        if (doi == null) {
            doi = doiDataPostgresRepository.findByDoiNative(decodedId);
        }

        if (doi == null) {
            return ResponseEntity.status(404).body("No doi was found for " + id);
        } else if (!authService.isAdmin(principal) && !isAuthorisedToDownload(doi, authService.getRoles(principal))) {
            return ResponseEntity.status(403).body("You are not authorised to access the file for DOI " + doi.getDoi() + " (uuid = " + doi.getUuid() + ")");
        } else {
            String url = null;
            if (doiFileStoreService.isS3()) {
                url = doiFileStoreService.createPresignedGetUrl(doi);
            } else {
                if (doi.getFilename() == null) {
                    return ResponseEntity.status(404).body("No file was found for DOI " + doi.getDoi() + " (uuid = " + doi.getUuid() + ")");
                }

                // check if file exists
                File filePath = new File(doiFileStoreService.getFilePath(doi));
                if (!filePath.exists()) {
                    return ResponseEntity.status(404).body("No file was found for DOI " + doi.getDoi() + " (uuid = " + doi.getUuid() + ")");
                }

                Map<String, Object> params = new HashMap<>();
                params.put("uuid", doi.getUuid().toString());
                params.put("filename", doi.getFilename());
                long duration = doiS3Duration * 60 * 1000; // doiS3Duration is in minutes
                url = signedUrlService.createUrl(UrlType.DOI_DOWNLOAD, System.currentTimeMillis() + duration, params);
            }
            if (url != null) {
                if (!redirect) {
                    // for clients that cannot handle redirects
                    return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(Collections.singletonMap("url", url));
                }
                return ResponseEntity.status(HttpStatus.FOUND).header("Location", url).build();
            }
            return ResponseEntity.status(404).body("No file was found for DOI " + doi.getDoi() + " (uuid = " + doi.getUuid() + ")");
        }
    }

    /**
     * Retrieve the metadata for a doi by either UUID or DOI
     */
    @Operation(
            operationId = DOI_ID,
            summary = "Get a stored DOI and its metadata",
            method = "GET",
            description = "Get a stored DOI and its metadata",
            parameters = {
                    @Parameter(
                            name = "id",
                            in = PATH,
                            required = true,
                            description = "Either the DOI (encoded or unencoded) or the UUID",
                            schema = @Schema(implementation = String.class)
                    )
            },
            responses = {
                    @ApiResponse(
                            responseCode = "200",
                            description = "Success",
                            content = @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = Doi.class)
                            ),
                            headers = {
                                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
                            }
                    ),
                    @ApiResponse(responseCode = "404", description = "DOI or UUID not found in this system")
            }
    )
    @RequestMapping(value = "/**", method = RequestMethod.GET, produces = "application/json")
    public Object getDoi(
            HttpServletRequest request
    ) {
        String doi = request.getRequestURI().substring((request.getContextPath() + "/v1/doi/").length());

        String decodedDoi = URLDecoder.decode(doi, StandardCharsets.UTF_8);
        Doi list = doiDataPostgresRepository.findByDoiNative(decodedDoi);
        if (list == null) {
            try {
                list = doiDataPostgresRepository.findByIdNative(UUID.fromString(doi));
            } catch (IllegalArgumentException e) {
                throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Not found: " + doi);
            }
        }
        if (list == null) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Not found: " + doi);
        } else {
            return list;
        }
    }

    @Operation(
            summary = "List DOIs",
            description = "List DOIs",
            parameters = {
                    @Parameter(name = "max", in = QUERY, description = "max number of dois to return", schema = @Schema(type = "integer", defaultValue = "10")),
                    @Parameter(name = "offset", in = QUERY, description = "index of the first record to return", schema = @Schema(type = "integer", defaultValue = "0")),
                    @Parameter(name = "sort", in = QUERY, description = "the field to sort the results by", schema = @Schema(type = "string", defaultValue = "dateMinted", allowableValues = {"dateMinted", "dateCreated", "lastUpdated", "title"})),
                    @Parameter(name = "order", in = QUERY, description = "the direction to sort the results by", schema = @Schema(type = "string", defaultValue = "asc", allowableValues = {"asc", "desc"})),
                    @Parameter(name = "userId", in = QUERY, description = "Add a userid filter, userid should be the user's numeric user id", schema = @Schema(type = "string")),
                    @Parameter(name = "activeStatus", in = QUERY, description = "Filters DOIs returned based on active flag. Valid values are 'all', 'active' or 'inactive'. If omitted it defaults to 'active'", schema = @Schema(type = "string"))
            },
            responses = {
                    @ApiResponse(responseCode = "200", description = "Success",
                            content = @Content(
                                    mediaType = "application/json",
                                    array = @ArraySchema(schema = @Schema(implementation = Doi.class))
                            ),
                            headers = {
                                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Link", description = "Pagination links", schema = @Schema(type = "string")),
                                    @Header(name = "X-Total-Count", description = "Total count of search results available", schema = @Schema(type = "string"))
                            }
                    )
            }
    )
    @GetMapping
    public ResponseEntity<List<Doi>> listDois(
            @RequestParam(name = "max", defaultValue = "10") Integer max,
            @RequestParam(name = "offset", defaultValue = "0") Integer offset,
            @RequestParam(name = "sort", defaultValue = "dateMinted") String sort,
            @RequestParam(name = "order", defaultValue = "desc") String order,
            @RequestParam(name = "userId", required = false) String userId,
            @RequestParam(name = "title", required = false) String title,
            @RequestParam(name = "activeStatus", required = false) String activeStatus
    ) {
        max = Math.min(max != null ? max : 10, 100);
        offset = offset != null ? offset : 0;

        // Build filter parameters
        Map<String, Object> eqParams = new HashMap<>();
        if (userId != null) eqParams.put("userId", userId);
        if (title != null) eqParams.put("title", title);

        if (activeStatus != null) {
            if ("inactive".equalsIgnoreCase(activeStatus)) {
                eqParams.put("active", false);
            } else if ("all".equalsIgnoreCase(activeStatus)) {
                // skip filter
            } else {
                eqParams.put("active", true);
            }
        } else {
            eqParams.put("active", true);
        }

        String sortField = sort.replaceAll("([a-z])([A-Z]+)", "$1_$2").toLowerCase();
        Sort.Direction direction = "asc".equalsIgnoreCase(order) ? Sort.Direction.ASC : Sort.Direction.DESC;

        PageRequest pageable = PageRequest.of(
                offset != null && max != null ? offset / max : 0,
                max != null ? max : 20,
                Sort.by(direction, sortField)
        );

        // Call service/repository to get results
        Page<Doi> list = doiDataPostgresRepository.listDoisNative(
                userId,
                title,
                activeStatus,
                pageable
        );

        // return items with total count header
        return ResponseEntity.ok().header("X-Total-Count", String.valueOf(list.getTotalElements())).body(list.stream().toList());
    }

    private boolean isAuthorisedToDownload(Doi doi, Set<String> roles) {
        // always authorised to access if no authorised roles
        if (doi.getAuthorisedRoles() == null || doi.getAuthorisedRoles().isEmpty()) {
            return true;
        }

        // if user has no roles, they cannot be authorised
        if (roles == null || roles.isEmpty()) {
            return false;
        }

        // confirm that all user roles are present in authorised roles
        for (String role : doi.getAuthorisedRoles()) {
            if (!roles.contains(role)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Mint a new DOI. POST only. Must have an ALA API Key.
     * <p>
     * This endpoint accepts 2 formats:
     * <ol>
     *     <li>A Multipart Request, where the metadata is in a parameter called 'json' and the file associated with the DOI is provided in the request; or
     *     <li>A standard post with a JSON body, with a mandatory 'fileUrl' property containing a URL where the file for the DOI can be downloaded from.
     * </ol>
     * <p>
     * The request must have JSON object with the following structure:
     * <pre>
     * {
     *     provider: "ANDS", // the doi provider to use (see {@link DoiProvider} for a list of supported providers)
     *     applicationUrl: "http://....", // the url to the relevant page on the source application. This is NOT the landing page: it is used to provide a link ON the landing page back to the original source of the publication/data/etc for the DOI.
     *     providerMetadata: { // the provider-specific metadata to be sent with the DOI minting request
     *         ...
     *     },
     *     title: "...", // title to be displayed on the landing page
     *     authors: "...", // author(s) to be displayed on the landing page
     *     description: "...", // description to be displayed on the landing page
     *
     *
     *     // the following are optional
     *     fileUrl: "http://....", // the url to use to download the file for the DOI (use this, or send the file as a multipart request)
     *     customLandingPageUrl: "http://...", // an application-specific landing page that you want the DOI to resolve to. If not provided, the default ALA-DOI landing page will be used.
     *     applicationMetadata: { // any application-specific metadata you want to display on the landing page in ALA-DOI
     *         ...
     *     }
     * }
     * </pre>
     * <p>
     * If "fileUrl" is not provided, then you must send the file in a multipart request with the metadata as a JSON string in a form part called 'json'.
     *
     * @return JSON response containing the DOI and the landing page on success, HTTP 500 on failure
     */
    @Operation(
            summary = "Mint / Register / Reserve a DOI",
            description = "Mint / Register / Reserve a DOI. Required scopes: 'doi/write'.",
            requestBody = @RequestBody(
                    description = "JSON request body. The metadata for the mint request, may include a fileUrl that this service will fetch and use as the file for the DOI. Provider metadata is provider specific.",
                    required = true,
                    content = {
                            @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = MintRequest.class)
                            ),
                            @Content(
                                    mediaType = "multipart/form-data",
                                    schema = @Schema(type = "object") // TODO: Complete this
                            )
                    }
            ),
            responses = {
                    @ApiResponse(responseCode = "201",
                            description = "Success",
                            links = {
                                    @Link(
                                            name = "Location",
                                            description = "URL for minted / registered / reserved DOI",
                                            operationId = "GetDoi",
                                            parameters = {
                                                    @LinkParameter(name = "uuid", expression = "$response.header.X-DOI-ID")
                                            }
                                    )
                            },
                            headers = {
                                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
                            }
                    )
            }
    )
    @SecurityRequirement(name = "JWT")
    @SecurityRequirement(name = "openIdConnect")
    @PostMapping(consumes = {"application/json", "multipart/form-data"}, produces = "application/json")
    public ResponseEntity<?> save(
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestPart(value = "json", required = false) String mintRequestPart,
            HttpServletRequest request, @AuthenticationPrincipal Principal principal
    ) throws Exception {
        // authorised when ADMIN or has doi/write scope
        if (!authService.isAdmin(principal) && !authService.getRoles(principal).contains("doi/write")) {
            return ResponseEntity.status(403).body("You are not authorised to mint DOIs");
        }

        ObjectMapper mapper = new ObjectMapper();
        MintRequest mintRequest;

        try {
            if (mintRequestPart != null) {
                // For multipart requests, read 'json' part, which may be missing a content type specified
                mintRequest = mapper.readValue(mintRequestPart, MintRequest.class);
            } else {
                // For application/json, read raw body
                mintRequest = mapper.readValue(request.getInputStream(), MintRequest.class);
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error parsing mint request: " + e.getMessage());
        }

        // legacy translations
        if (mintRequest.provider == DoiProvider.ALA) {
            mintRequest.provider = DoiProvider.DATACITE;
        }

        // Validate request
        String errorMessage = validateMintRequest(mintRequest);
        if (errorMessage != null) {
            return ResponseEntity.badRequest().body(errorMessage);
        }

        List<String> licence;
        if (mintRequest.licence == null) {
            licence = Collections.emptyList();
        } else if (mintRequest.licence instanceof List<?>) {
            licence = ((List<?>) mintRequest.licence).stream().map(Object::toString).toList();
        } else {
            licence = Collections.singletonList(mintRequest.licence.toString());
        }

        // Call service to mint DOI
        MintResponse result = doiService.mintDoi(
                mintRequest.provider,
                mintRequest.providerMetadata,
                mintRequest.title,
                mintRequest.authors,
                mintRequest.description,
                licence,
                mintRequest.applicationUrl,
                mintRequest.fileUrl,
                file,
                mintRequest.applicationMetadata,
                mintRequest.customLandingPageUrl,
                null,
                mintRequest.userId,
                mintRequest.active,
                mintRequest.authorisedRoles,
                mintRequest.displayTemplate
        );

        if (result != null && result.uuid != null) {
            return ResponseEntity.created(URI.create(doiBaseUrl + "/doi/" + result.uuid)).header("X-DOI-ID", result.doi).body(result);
        } else {
            return ResponseEntity.status(500).body("DOI minting failed");
        }
    }

    @Operation(
            operationId = PATCH_DOI,
            summary = "Update the stored metadata or add a file to a DOI",
            description = "Update the stored metadata or add a file to a DOI. Required scopes: 'doi/write'.",
            parameters = {
                    @Parameter(name = "id", in = PATH, required = true, description = "Either the DOI (encoded or unencoded) or the UUID", schema = @Schema(implementation = String.class))
            },
            requestBody = @RequestBody(
                    description = "The values to update the DOI with. Only the following values are accepted: 'providerMetadata', 'customLandingPageUrl', 'title', 'authors', 'description', 'licence', 'applicationUrl','applicationMetadata'",
                    required = true,
                    content = {
                            @Content(mediaType = "application/json", schema = @Schema(implementation = UpdateRequest.class)),
                            @Content(mediaType = "multipart/form-data", schema = @Schema(type = "object"))
                    }
            ),
            responses = {
                    @ApiResponse(responseCode = "200",
                            description = "Success",
                            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Doi.class)),
                            headers = {
                                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
                            }
                    ),
                    @ApiResponse(responseCode = "400", description = "Attempting to update the file when there is already an existing file"),
                    @ApiResponse(responseCode = "404", description = "DOI or UUID not found in this system"),
                    @ApiResponse(responseCode = "422", description = "If the request body creates an invalid DOI entry"),
                    @ApiResponse(responseCode = "500", description = "There is an error while storing the file or contacting the DOI service")
            }
    )
    @SecurityRequirement(name = "JWT", scopes = "admin")
    @SecurityRequirement(name = "openIdConnect", scopes = {"doi/write"})
    @PatchMapping(path = "/**", consumes = "multipart/form-data")
    public ResponseEntity<?> patch(
            @RequestPart(name = "file", required = false) MultipartFile file,
            @RequestPart(name = "json", required = false) String jsonPart,
            HttpServletRequest request,
            @AuthenticationPrincipal Principal principal
    ) {
        return update(file, jsonPart, request, principal);
    }

    @Operation(
            operationId = PUT_DOI,
            summary = "Update the stored metadata or add a file to a DOI",
            description = "Update the stored metadata or add a file to a DOI. Required scopes: 'doi/write'.",
            parameters = {
                    @Parameter(name = "id", in = PATH, required = true, description = "Either the DOI (encoded or unencoded) or the UUID", schema = @Schema(implementation = String.class))
            },
            requestBody = @RequestBody(
                    description = "The values to update the DOI with. Only the following values are accepted: 'providerMetadata', 'customLandingPageUrl', 'title', 'authors', 'description', 'licence', 'applicationUrl','applicationMetadata'",
                    required = true,
                    content = {
                            @Content(mediaType = "application/json", schema = @Schema(implementation = UpdateRequest.class)),
                            @Content(mediaType = "multipart/form-data", schema = @Schema(type = "object"))
                    }
            ),
            responses = {
                    @ApiResponse(responseCode = "200",
                            description = "Success",
                            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Doi.class)),
                            headers = {
                                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
                            }
                    ),
                    @ApiResponse(responseCode = "400", description = "Attempting to update the file when there is already an existing file"),
                    @ApiResponse(responseCode = "404", description = "DOI or UUID not found in this system"),
                    @ApiResponse(responseCode = "422", description = "If the request body creates an invalid DOI entry"),
                    @ApiResponse(responseCode = "500", description = "There is an error while storing the file or contacting the DOI service")
            }
    )
    @SecurityRequirement(name = "JWT", scopes = "admin")
    @SecurityRequirement(name = "openIdConnect", scopes = {"doi/write"})
    @PutMapping(path = "/**", consumes = {"multipart/form-data", "application/json"})
    public ResponseEntity<?> update(
            @RequestPart(name = "file", required = false) MultipartFile file,
            @RequestPart(name = "json", required = false) String jsonPart,
            HttpServletRequest request,
            @AuthenticationPrincipal Principal principal
    ) {
        // authorised when ADMIN or has doi/write scope
        if (!authService.isAdmin(principal) && !authService.getRoles(principal).contains("doi/write")) {
            return ResponseEntity.status(403).body("You are not authorised to mint DOIs");
        }

        String id = request.getRequestURI().substring((request.getContextPath() + "/v1/doi/").length());
        String decodedId = URLDecoder.decode(id, StandardCharsets.UTF_8);

        try {
            ObjectMapper mapper = new ObjectMapper();
            UpdateRequest updateRequest;

            if (jsonPart != null) {
                // For multipart requests, read 'json' part, which may be missing a content type specified
                updateRequest = mapper.readValue(jsonPart, UpdateRequest.class);
            } else {
                // For application/json, read raw body
                updateRequest = mapper.readValue(request.getInputStream(), UpdateRequest.class);
            }

            Doi instance = doiService.updateDoi(decodedId, updateRequest, file);
            // Add location header if needed
            return ResponseEntity.ok().body(instance);
        } catch (DoiNotFoundException e) {
            return ResponseEntity.status(404).body("Not found");
        } catch (DoiUpdateException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (DoiValidationException e) {
            return ResponseEntity.unprocessableEntity().body("Validation error");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Internal server error");
        }
    }

    /**
     * Dummy method for file upload update for Swagger
     */
    @Operation(
            operationId = POST_DOI,
            summary = "Update the stored metadata or add a file to a DOI",
            description = "Update the stored metadata or add a file to a DOI. Required scopes: 'doi/write'.",
            parameters = {
                    @Parameter(name = "id", in = PATH, required = true, description = "Either the DOI (encoded or unencoded) or the UUID", schema = @Schema(implementation = String.class))
            },
            requestBody = @RequestBody(
                    description = "The values to update the DOI with. Only the following values are accepted: 'providerMetadata', 'customLandingPageUrl', 'title', 'authors', 'description', 'licence', 'applicationUrl','applicationMetadata'",
                    required = true,
                    content = {
                            @Content(mediaType = "application/json", schema = @Schema(implementation = UpdateRequest.class)),
                            @Content(mediaType = "application/octet-stream", schema = @Schema(name = "file", title = "The file to upload", type = "string", format = "binary"))
                    }
            ),
            responses = {
                    @ApiResponse(responseCode = "200",
                            description = "Success",
                            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Doi.class)),
                            headers = {
                                    @Header(name = "Access-Control-Allow-Headers", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Methods", description = "CORS header", schema = @Schema(type = "string")),
                                    @Header(name = "Access-Control-Allow-Origin", description = "CORS header", schema = @Schema(type = "string"))
                            }
                    ),
                    @ApiResponse(responseCode = "400", description = "Attempting to update the file when there is already an existing file"),
                    @ApiResponse(responseCode = "404", description = "DOI or UUID not found in this system"),
                    @ApiResponse(responseCode = "422", description = "If the request body creates an invalid DOI entry"),
                    @ApiResponse(responseCode = "500", description = "There is an error while storing the file or contacting the DOI service")
            }
    )
    @SecurityRequirement(name = "JWT", scopes = "admin")
    @SecurityRequirement(name = "openIdConnect", scopes = {"doi/write"})
    @PostMapping(path = "/**", consumes = {"multipart/form-data", "application/json"})
    public ResponseEntity<?> updateUpload(
            @RequestPart(name = "file", required = false) MultipartFile file,
            @RequestPart(name = "json", required = false) String jsonPart, // due to overloading POST minting method, read as string
            HttpServletRequest request,
            @AuthenticationPrincipal Principal principal
    ) {
        return update(file, jsonPart, request, principal);
    }

    /**
     * Returns error message if the mint request is invalid, null otherwise
     *
     * @param mintRequest
     * @return
     */
    private String validateMintRequest(MintRequest mintRequest) {
        if (areMandatoryMetadataFieldsMissing(mintRequest)) {
            log.debug("Rejecting request with missing mandatory parameters. Provided parameters: {}", mintRequest);
            return "provider, title, authors, description, applicationUrl and providerMetadata must be provided in the request's JSON body";
        }

        // return null if no errors
        return null;
    }

    private boolean areMandatoryMetadataFieldsMissing(MintRequest mintRequest) {
        return mintRequest.provider == null
                || mintRequest.applicationUrl == null
                || mintRequest.providerMetadata == null
                || mintRequest.title == null
                || mintRequest.authors == null
                || mintRequest.description == null;
    }

}
