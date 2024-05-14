package au.org.ala.search.controller;

import au.org.ala.search.model.quality.QualityCategory;
import au.org.ala.search.model.quality.QualityFilter;
import au.org.ala.search.model.quality.QualityProfile;
import au.org.ala.search.service.remote.DataQualityService;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static io.swagger.v3.oas.annotations.enums.ParameterIn.PATH;
import static io.swagger.v3.oas.annotations.enums.ParameterIn.QUERY;

/**
 * data-quality-service API services, minus some admin services
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class V1DataQualityController {

    private final DataQualityService dataQualityService;

    public V1DataQualityController(DataQualityService dataQualityService) {
        this.dataQualityService = dataQualityService;
    }

    @Operation(
            method = "GET",
            tags = "Profiles",
            operationId = "getQualityProfiles",
            summary = "List all data quality profiles",
            description = "List all available data quality profiles as per applied filters",
            responses = {
                    @ApiResponse(
                            description = "List of quality profiles",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            array = @ArraySchema(schema = @Schema(implementation = QualityProfile.class))
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
    @GetMapping(path = "/v1/data-profiles", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<QualityProfile>> profiles(
            @Parameter(
                    name = "max",
                    in = QUERY,
                    description = "Maximum results to return",
                    schema = @Schema(implementation = Integer.class),
                    example = "2"
            )
            @RequestParam(required = false, defaultValue = "100") Integer max,
            @Parameter(
                    name = "offset",
                    in = QUERY,
                    description = "Offset results by",
                    schema = @Schema(implementation = Integer.class),
                    example = "0"
            )
            @RequestParam(required = false, defaultValue = "0") Integer offset,
            @Parameter(
                    name = "sort",
                    in = QUERY,
                    description = "Property to sort results by",
                    schema = @Schema(implementation = String.class),
                    example = "id"
            )
            @RequestParam(required = false) String sort,
            @Parameter(
                    name = "order",
                    in = QUERY,
                    description = "Direction to sort results by",
                    schema = @Schema(implementation = String.class),
                    example = "desc"
            )
            @RequestParam(required = false) String order,
            @Parameter(
                    name = "enabled",
                    in = QUERY,
                    description = "Only return enabled profiles",
                    schema = @Schema(implementation = Boolean.class),
                    example = "true"
            )
            @RequestParam(required = false) Boolean enabled,
            @Parameter(
                    name = "name",
                    in = QUERY,
                    description = "Search for profiles by name",
                    schema = @Schema(implementation = String.class),
                    example = "ALA General"
            )
            @RequestParam(required = false) String name,
            @Parameter(
                    name = "shortName",
                    in = QUERY,
                    description = "Search for profiles by short name",
                    schema = @Schema(implementation = String.class),
                    example = "ALA"
            )
            @RequestParam(required = false) String shortName
    ) {
        return ResponseEntity.ok().body(dataQualityService.getProfiles(shortName, name, enabled, max, offset, sort, order));
    }

    @Operation(
            method = "GET",
            tags = "Profiles",
            operationId = "getQualityProfile",
            summary = "Retrieve a single quality profile",
            description = "Retrieve a single quality profile based on the specified profile id",
            responses = {
                    @ApiResponse(
                            description = "List of quality profiles",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(implementation = QualityProfile.class)
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
    @GetMapping(path = "/v1/data-profiles/{profileId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<QualityProfile> profile(
            @Parameter(
                    name = "profileId",
                    in = PATH,
                    description = "The id or short name for the quality profile or default for the default profile",
                    schema = @Schema(implementation = String.class),
                    example = "441",
                    required = true
            )
            @PathVariable String profileId
    ) {
        QualityProfile profile = dataQualityService.getProfile(profileId);
        if (profile != null) {
            return ResponseEntity.ok().body(profile);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(
            method = "GET",
            tags = "Filters",
            operationId = "getQualityFilters",
            summary = "List all quality filters from a category",
            description = "List all quality filters for a specified quality profile and quality category",
            responses = {
                    @ApiResponse(
                            description = "List of quality filters",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            array = @ArraySchema(schema = @Schema(implementation = QualityFilter.class))
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
    @GetMapping(path = "/v1/data-profiles/{profileId}/categories/{categoryId}/filters", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<QualityFilter>> qualityFilters(
            @Parameter(
                    name = "profileId",
                    in = PATH,
                    description = "The id or short name for the quality profile or default for the default profile",
                    schema = @Schema(implementation = String.class),
                    example = "ALA",
                    required = true
            )
            @PathVariable String profileId,
            @Parameter(
                    name = "categoryId",
                    in = PATH,
                    description = "The id for the quality category",
                    schema = @Schema(implementation = String.class),
                    example = "444",
                    required = true
            )
            @PathVariable Long categoryId) {
        QualityCategory category = dataQualityService.getCategory(profileId, categoryId);

        if (category != null) {
            return ResponseEntity.ok().body(category.getQualityFilters());
        }
        return ResponseEntity.notFound().build();
    }

    @Operation(
            method = "GET",
            tags = "Filters",
            operationId = "getQualityFilter",
            summary = "Retrieve a single quality filter from a category",
            description = "Retrieve a single quality filter for a specified quality filter id",
            responses = {
                    @ApiResponse(
                            description = "A quality filter",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(implementation = QualityFilter.class)
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
    @GetMapping(path = "/v1/data-profiles/{profileId}/categories/{categoryId}/filters/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<QualityFilter> qualityFilter(
            @Parameter(
                    name = "profileId",
                    in = PATH,
                    description = "The id or short name for the quality profile or default for the default profile",
                    schema = @Schema(implementation = String.class),
                    example = "ALA",
                    required = true
            )
            @PathVariable String profileId,
            @Parameter(
                    name = "categoryId",
                    in = PATH,
                    description = "The id for the quality category",
                    schema = @Schema(implementation = String.class),
                    example = "444",
                    required = true
            )
            @PathVariable Long categoryId,
            @Parameter(
                    name = "id",
                    in = PATH,
                    description = "The id for the quality filter",
                    schema = @Schema(implementation = String.class),
                    example = "445",
                    required = true
            )
            @PathVariable Long id) {
        QualityFilter qualityFilter = dataQualityService.getFilter(profileId, categoryId, id);
        if (qualityFilter != null) {
            return ResponseEntity.ok().body(qualityFilter);
        }
        return ResponseEntity.notFound().build();
    }

    @Operation(
            method = "GET",
            tags = "Filters",
            operationId = "getEnabledFiltersByLabel",
            summary = "Get enabled filters, grouped by category label for a given profile name",
            description = "Get enabled filters, grouped by category label for a given profile name",
            responses = {
                    @ApiResponse(
                            description = "Enabled filters",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(implementation = Map.class)
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
    @GetMapping(path = "/v1/quality/getEnabledFiltersByLabel", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> getEnabledFiltersByLabel(
            @Parameter(
                    name = "profileName",
                    in = QUERY,
                    description = "Profile name",
                    schema = @Schema(implementation = String.class),
                    example = "ALA General"
            )
            @RequestParam(required = false) String profileName) {
        Map<String, String> map = dataQualityService.getEnabledFiltersByLabel(profileName);
        return ResponseEntity.ok().body(map);
    }

    @Operation(
            method = "GET",
            tags = "Filters",
            operationId = "getEnabledQualityFilters",
            summary = "Get Enabled Quality Filters",
            description = "Get Enabled Quality Filters",
            responses = {
                    @ApiResponse(
                            description = "Enabled filters",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            array = @ArraySchema(schema = @Schema(implementation = List.class))
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
    @GetMapping(path = "/v1/quality/getEnabledQualityFilters", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Set<String>> getEnabledQualityFilters(
            @Parameter(
                    name = "profileName",
                    in = QUERY,
                    description = "Profile name",
                    schema = @Schema(implementation = String.class),
                    example = "ALA General"
            )
            @RequestParam(required = false) String profileName) {
        Set<String> set = dataQualityService.getEnabledQualityFilters(profileName);
        return ResponseEntity.ok().body(set);
    }

    @JsonIgnoreProperties("metaClass")
    static class GetGroupedEnabledFiltersResponse extends LinkedHashMap<String, List<QualityFilter>> {
    }

    @Operation(
            method = "GET",
            tags = "Filters",
            operationId = "getGroupedEnabledFilters",
            summary = "Get Grouped Enabled Filters",
            description = "Get Grouped Enabled Filters",
            responses = {
                    @ApiResponse(
                            description = "Group enabled filters",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(implementation = GetGroupedEnabledFiltersResponse.class)
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
    @GetMapping(path = "/v1/quality/getGroupedEnabledFilters", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<LinkedHashMap<String, List<QualityFilter>>> getGroupedEnabledFilters(
            @Parameter(
                    name = "profileName",
                    in = QUERY,
                    description = "Profile name",
                    schema = @Schema(implementation = String.class),
                    example = "ALA General"
            )
            @RequestParam(required = false) String profileName) {
        LinkedHashMap<String, List<QualityFilter>> map = dataQualityService.getGroupedEnabledFilters(profileName);
        return ResponseEntity.ok().body(map);
    }

    @Operation(
            method = "GET",
            tags = "Categories",
            operationId = "findAllEnabledCategories",
            summary = "Find All Enabled Categories",
            description = "Find All Enabled Categories for a specified profile",
            responses = {
                    @ApiResponse(
                            description = "All enabled Categories",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            array = @ArraySchema(schema = @Schema(implementation = QualityCategory.class))
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
    @GetMapping(path = "/v1/quality/findAllEnabledCategories", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<QualityCategory>> findAllEnabledCategories(
            @Parameter(
                    name = "profileName",
                    in = QUERY,
                    description = "Profile name",
                    schema = @Schema(implementation = String.class),
                    example = "ALA General"
            )
            @RequestParam(required = false) String profileName) {
        List<QualityCategory> result = dataQualityService.findAllEnabledCategories(profileName);
        return ResponseEntity.ok().body(result);
    }

    @Operation(
            method = "GET",
            tags = "Profiles",
            operationId = "activeProfile",
            summary = "Retrieve the data profile for a given profile's short name",
            description = "Retrieve the data profile for a given profile's short name. If the profile doesn't exist or the short name is omitted then the default profile is returned instead.",
            responses = {
                    @ApiResponse(
                            description = "Data profile",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(implementation = QualityProfile.class)
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
    @GetMapping(path = "/v1/quality/activeProfile", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<QualityProfile> activeProfile(
            @Parameter(
                    name = "profileName",
                    in = QUERY,
                    description = "Profile name",
                    schema = @Schema(implementation = String.class),
                    example = "ALA"
            )
            @RequestParam(required = false) String profileName) {
        QualityProfile profile = dataQualityService.getProfileOrDefault(profileName);

        if (profile != null) {
            return ResponseEntity.ok().body(profile);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(
            method = "GET",
            tags = "Profiles",
            operationId = "getJoinedQualityFilter",
            summary = "Get the full filter string for a given data profile",
            description = "Get the full filter string for a given data profile",
            responses = {
                    @ApiResponse(
                            description = "Full filter string",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "text/plain",
                                            schema = @Schema(implementation = String.class)
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
    @GetMapping(path = "/v1/quality/getJoinedQualityFilter", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getJoinedQualityFilter(
            @Parameter(
                    name = "profileName",
                    in = QUERY,
                    description = "Profile name",
                    schema = @Schema(implementation = String.class),
                    example = "ALA"
            )
            @RequestParam(required = false) String profileName) {
        String filter = dataQualityService.getJoinedQualityFilter(profileName);

        return ResponseEntity.ok().body(filter);
    }

    @Operation(
            method = "GET",
            tags = "Categories",
            operationId = "getInverseCategoryFilter",
            summary = "Get the full inverse filter string for a given quality category",
            description = "Get the full inverse filter string for a given quality category.",
            responses = {
                    @ApiResponse(
                            description = "Full inverse filter string",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "text/plain",
                                            schema = @Schema(implementation = String.class)
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
    @GetMapping(path = "/v1/quality/getInverseCategoryFilter", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getInverseCategoryFilter(
            @Parameter(
                    name = "qualityCategoryId",
                    in = QUERY,
                    description = "Quality Category Id",
                    schema = @Schema(implementation = String.class),
                    example = "441",
                    required = true
            )
            @RequestParam Long qualityCategoryId) {
        String inverse = dataQualityService.getInverseCategoryFilter(qualityCategoryId);
        return ResponseEntity.ok().body(inverse);
    }

    @Operation(
            method = "GET",
            tags = "Profiles",
            operationId = "getAllInverseCategoryFiltersForProfile",
            summary = "Get all the inverse filter strings for a given data profile",
            description = "Get all the inverse filter strings for a given data profile. Results for the default profile will be returned if qualityProfileId is omitted",
            responses = {
                    @ApiResponse(
                            description = "Full inverse filter string",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(implementation = Map.class)
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
    @GetMapping(path = "/v1/quality/getAllInverseCategoryFiltersForProfile", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> getAllInverseCategoryFiltersForProfile(
            @Parameter(
                    name = "qualityProfileId",
                    in = QUERY,
                    description = "Quality Profile Id",
                    schema = @Schema(implementation = String.class),
                    example = "441"
            )
            @RequestParam(required = false) String qualityProfileId) {
        Map<String, String> result = dataQualityService.getAllInverseCategoryFiltersForProfile(qualityProfileId);
        return ResponseEntity.ok().body(result);
    }

    @Operation(
            method = "GET",
            tags = "Categories",
            operationId = "getQualityCategories",
            summary = "List all quality categories from a profile",
            description = "List all available data quality categories for a specified quality profile",
            responses = {
                    @ApiResponse(
                            description = "List of quality categories",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            array = @ArraySchema(schema = @Schema(implementation = QualityCategory.class))
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
    @GetMapping(path = "/v1/data-profiles/{profileId}/categories", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<QualityCategory>> categories(
            @Parameter(
                    name = "profileId",
                    in = PATH,
                    description = "The id or short name for the quality profile or default for the default profile",
                    schema = @Schema(implementation = String.class),
                    example = "ALA",
                    required = true
            )
            @PathVariable String profileId) {
        QualityProfile profile = dataQualityService.getProfile(profileId);
        if (profile != null) {
            return ResponseEntity.ok().body(profile.getCategories());
        }
        return ResponseEntity.notFound().build();
    }

    @Operation(
            method = "GET",
            tags = "Categories",
            operationId = "getQualityCategory",
            summary = "Retrieve a single quality category form a profile",
            description = "Retrieve a single quality category for a specified quality category id",
            responses = {
                    @ApiResponse(
                            description = "A quality category",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(implementation = QualityProfile.class)
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
    @GetMapping(path = "/v1/data-profiles/{profileId}/categories/{categoryId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<QualityCategory> category(
            @Parameter(
                    name = "profileId",
                    in = PATH,
                    description = "The id or short name for the quality profile or default for the default profile",
                    schema = @Schema(implementation = String.class),
                    example = "ALA",
                    required = true
            )
            @PathVariable String profileId,
            @Parameter(
                    name = "categoryId",
                    in = PATH,
                    description = "The id for the quality category",
                    schema = @Schema(implementation = String.class),
                    example = "442",
                    required = true
            )
            @PathVariable Long categoryId) {
        QualityCategory category = dataQualityService.getCategory(profileId, categoryId);

        if (category != null) {
            return ResponseEntity.ok().body(category);
        }
        return ResponseEntity.notFound().build();
    }
}
