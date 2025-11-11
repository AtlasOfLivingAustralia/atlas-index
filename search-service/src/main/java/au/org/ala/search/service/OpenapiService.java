/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.controller.V1DoiController;
import au.org.ala.search.controller.V1SearchController;
import au.org.ala.search.controller.V2Controller;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.doi.Doi;
import au.org.ala.search.model.query.Op;
import au.org.ala.search.repo.DoiDataPostgresRepository;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.util.QueryParserUtil;
import co.elastic.clients.elasticsearch._types.query_dsl.FieldAndFormat;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.security.SecurityScheme;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;

@Slf4j
@Service
public class OpenapiService {
    protected final ElasticService elasticService;
    protected final DoiDataPostgresRepository doiDataPostgresRepository;

    @Value("${openapi.title}")
    private String openapiTitle;

    @Value("${openapi.description}")
    private String openapiDescription;

    @Value("${openapi.terms}")
    private String openapiTerms;

    @Value("${openapi.contact.name}")
    private String openapiContactName;

    @Value("${openapi.contact.email}")
    private String openapiContactEmail;

    @Value("${openapi.license.name}")
    private String openapiLicenseName;

    @Value("${openapi.license.url}")
    private String openapiLicenseUrl;

    @Value("${openapi.version}")
    private String openapiVersion;

    @Value("${openapi.servers}")
    private String openapiServers;

    @Value("${downloadMaxRows}")
    private Integer downloadMaxRows;

    @Value("${security.oidc.discovery-uri}")
    private String oidcDiscoveryUri;

    public OpenapiService(ElasticService elasticService, DoiDataPostgresRepository doiDataPostgresRepository) {
        this.elasticService = elasticService;
        this.doiDataPostgresRepository = doiDataPostgresRepository;
    }

    /**
     * Update annotated openapi examples with working examples.
     *
     * @param operationId    ID of the operation for this example
     * @param defaultExample Default example
     * @return an example relevant to this operationId or the default
     */
    public Object updateExample(String operationId, Object defaultExample) {
        if (defaultExample != null) {
            try {
                return switch (operationId) {
                    case V1SearchController.SPECIES_GUIDS_BULKLOOKUP_ID, V2Controller.SPECIES_ID -> listOfGuids();
                    case V1SearchController.SPECIES_IMAGE_BULK_ID -> listOfGuidsWithAnImage();
                    case V1SearchController.SPECIES_LOOKUP_BULK_ID -> listOfNamesWrapped();
                    case V2Controller.DOWNLOAD_FIELDGUIDE -> fieldguideExample();
                    default -> defaultExample;
                };
            } catch (IOException e) {
                log.warn("failed to update openapi example for: {}, {}", operationId, e.getMessage());
            }
        }
        return defaultExample;
    }

    String listOfGuids() throws IOException {
        Op op = QueryParserUtil.parse("idxtype:\"TAXON\" AND -acceptedConceptID:*", null, elasticService::isValidField);
        if (op == null) {
            throw new IOException("Failed to parse query for listOfGuids, Elasticsearch index may be empty.");
        }
        co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 5,
                queryOp, Collections.singletonList(new FieldAndFormat.Builder().field("guid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return new ObjectMapper().writeValueAsString(result.hits().hits().stream().map(item -> item.fields().get("guid").to(List.class).getFirst()).toList());
    }

    String fieldguideExample() throws IOException {
        // get 5 "idxtype:TAXON and -acceptedConceptID:* and image:*" guids
        Op op = QueryParserUtil.parse("idxtype:\"TAXON\" AND -acceptedConceptID:* AND image:*", null, elasticService::isValidField);
        if (op == null) {
            throw new IOException("Failed to parse query for listOfGuids, Elasticsearch index may be empty.");
        }
        co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 5,
                queryOp, Collections.singletonList(new FieldAndFormat.Builder().field("guid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        Map example = new HashMap();
        example.put("id", result.hits().hits().stream().map(item -> item.fields().get("guid").to(List.class).getFirst()).toList());
        example.put("filename", "test-fieldguide");
        example.put("title", "Example fieldguide title");
        example.put("sourceUrl", "an example source url");

        return new ObjectMapper().writeValueAsString(example);
    }

    String listOfGuidsWithAnImage() throws IOException {
        // get 5 "idxtype:TAXON and -acceptedConceptID:* and image:*" guids
        Op op = QueryParserUtil.parse("idxtype:\"TAXON\" AND -acceptedConceptID:* AND image:*", null, elasticService::isValidField);
        if (op == null) {
            throw new IOException("Failed to parse query for listOfGuids, Elasticsearch index may be empty.");
        }
        co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 5,
                queryOp, Collections.singletonList(new FieldAndFormat.Builder().field("guid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return new ObjectMapper().writeValueAsString(result.hits().hits().stream().map(item -> item.fields().get("guid").to(List.class).getFirst()).toList());
    }

    String guidWithAnImage() throws IOException {
        // get 1 "idxtype:TAXON and -acceptedConceptID:* and image:* and rank:species" guids
        Op op = QueryParserUtil.parse("idxtype:\"TAXON\" AND -acceptedConceptID:* AND image:* AND rank:\"species\"", null, elasticService::isValidField);
        if (op == null) {
            throw new IOException("Failed to parse query for listOfGuids, Elasticsearch index may be empty.");
        }
        co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 1,
                queryOp, Collections.singletonList(new FieldAndFormat.Builder().field("guid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return result.hits().hits().getFirst().fields().get("guid").to(List.class).getFirst().toString();
    }

    String oneDoi() throws IOException {
        PageRequest pageable = PageRequest.of(1, 1);

        Page<Doi> list = doiDataPostgresRepository.listDoisNative(null, null, "all", pageable);
        if (list.isEmpty()) {
            throw new IOException("no records found");
        }

        return list.getContent().get(0).getDoi();
    }

    String listOfNamesWrapped() throws IOException {
        // get 5 "idxtype:TAXON and -acceptedConceptID:*" names
        Op op = QueryParserUtil.parse("idxtype:\"TAXON\" AND -acceptedConceptID:*", null, elasticService::isValidField);
        if (op == null) {
            throw new IOException("Failed to parse query for listOfGuids, Elasticsearch index may be empty.");
        }
        co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 5,
                queryOp, Collections.singletonList(new FieldAndFormat.Builder().field("scientificName").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        Map<String, Object> wrapper = new HashMap<>();
        wrapper.put("vernacular", true);
        wrapper.put("names", result.hits().hits().stream().map(item -> item.fields().get("scientificName").to(List.class).getFirst()).toList());

        return new ObjectMapper().writeValueAsString(wrapper);
    }

    /**
     * Adds a path parameter to an openapi operation spec. It is intended for use with services annotated with the path
     * suffix "/**" that are actually "/{id}". Where {id} is a guid.
     *
     * @param op Operation to check for a path update
     * @return true if a path update was applied
     */
    public boolean updatePaths(Operation op) {
        try {
            if (op.getOperationId().equals(V1SearchController.CHILD_CONCEPTS_ID) ||
                    op.getOperationId().equals(V1SearchController.SPECIES_SHORTPROFILE_ID) ||
                    op.getOperationId().equals(V1SearchController.SPECIES_ID) ||
                    op.getOperationId().equals(V1SearchController.SPECIES_ID + "_1") /* "/taxon/**" path */) {
                String guid = parentGuid();
                io.swagger.v3.oas.models.parameters.Parameter pathParam = new io.swagger.v3.oas.models.parameters.Parameter();
                pathParam.setName("id");
                pathParam.setIn("path");
                pathParam.setDescription("The guid of a specific taxon");
                pathParam.setSchema(new StringSchema());
                pathParam.setExample(guid);
                pathParam.setRequired(true);

                op.setParameters(prependParameter(pathParam, op.getParameters()));
            } else if (op.getOperationId().equals(V1SearchController.CLASSIFICATION_ID)) {
                String guid = guidWithRkGenus();
                io.swagger.v3.oas.models.parameters.Parameter pathParam = new io.swagger.v3.oas.models.parameters.Parameter();
                pathParam.setName("id");
                pathParam.setIn("path");
                pathParam.setDescription("The guid of a specific taxon");
                pathParam.setSchema(new StringSchema());
                pathParam.setExample(guid);
                pathParam.setRequired(true);

                op.setParameters(prependParameter(pathParam, op.getParameters()));
            } else if (op.getOperationId().equals(V1SearchController.GUID_ID)) {
                String guid = acceptedName();
                io.swagger.v3.oas.models.parameters.Parameter pathParam = new io.swagger.v3.oas.models.parameters.Parameter();
                pathParam.setName("id");
                pathParam.setIn("path");
                pathParam.setDescription("The name of a specific taxon");
                pathParam.setSchema(new StringSchema());
                pathParam.setExample(guid);
                pathParam.setRequired(true);

                op.setParameters(prependParameter(pathParam, op.getParameters()));
            } else if (op.getOperationId().equals(V1SearchController.IMAGESEARCH_ID)) {
                String guid = guidWithAnImage();
                io.swagger.v3.oas.models.parameters.Parameter pathParam = new io.swagger.v3.oas.models.parameters.Parameter();
                pathParam.setName("id");
                pathParam.setIn("path");
                pathParam.setDescription("The guid of a specific taxon");
                pathParam.setSchema(new StringSchema());
                pathParam.setExample(guid);
                pathParam.setRequired(true);

                op.setParameters(prependParameter(pathParam, op.getParameters()));
            } else if (op.getOperationId().equals(V1DoiController.DOI_ID)
                    || op.getOperationId().equals(V1DoiController.POST_DOI)
                    || op.getOperationId().equals(V1DoiController.PUT_DOI)
                    || op.getOperationId().equals(V1DoiController.PATCH_DOI)) {
                String doi = oneDoi();
                io.swagger.v3.oas.models.parameters.Parameter pathParam = new io.swagger.v3.oas.models.parameters.Parameter();
                pathParam.setName("id");
                pathParam.setIn("path");
                pathParam.setDescription("Either the DOI (encoded or unencoded) or the UUID");
                pathParam.setSchema(new StringSchema());
                pathParam.setExample(doi);
                pathParam.setRequired(true);

                op.setParameters(prependParameter(pathParam, op.getParameters()));

                // only need to replace the path of one of these operations
                if (!op.getOperationId().equals(V1DoiController.DOI_ID)) {
                    return false;
                }
            } else {
                return false;
            }
        } catch (Exception e) {
            log.warn("failed to update openapi example for: {}, {}", op.getOperationId(), e.getMessage());
        }

        // return true because when the op does not require an update false has already been returned
        return true;
    }

    String parentGuid() throws IOException {
        // get 1 "idxtype:TAXON and parentGuid:*" guids
        Op op = QueryParserUtil.parse("idxtype:\"TAXON\" AND parentGuid:*", null, elasticService::isValidField);
        if (op == null) {
            throw new IOException("Failed to parse query for listOfGuids, Elasticsearch index may be empty.");
        }
        co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 1,
                queryOp, Collections.singletonList(new FieldAndFormat.Builder().field("parentGuid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return result.hits().hits().getFirst().fields().get("parentGuid").to(List.class).getFirst().toString();
    }

    String guidWithRkGenus() throws IOException {
        // get 1 "idxtype:TAXON and parentGuid:* and rank:species" guids
        Op op = QueryParserUtil.parse("idxtype:\"TAXON\" AND parentGuid:* AND rank:\"species\"", null, elasticService::isValidField);
        if (op == null) {
            throw new IOException("Failed to parse query for listOfGuids, Elasticsearch index may be empty.");
        }
        co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 1,
                queryOp, Collections.singletonList(new FieldAndFormat.Builder().field("guid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return result.hits().hits().getFirst().fields().get("guid").to(List.class).getFirst().toString();
    }

    String acceptedName() throws IOException {
        // get 1 "idxtype:TAXON and parentGuid:* and rank:species" name
        Op op = QueryParserUtil.parse("idxtype:\"TAXON\" AND parentGuid:* AND rank:\"species\"", null, elasticService::isValidField);
        if (op == null) {
            throw new IOException("Failed to parse query for listOfGuids, Elasticsearch index may be empty.");
        }
        co.elastic.clients.elasticsearch._types.query_dsl.Query queryOp = elasticService.opToQuery(op);

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 1,
                queryOp, Collections.singletonList(new FieldAndFormat.Builder().field("scientificName").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return result.hits().hits().getFirst().fields().get("scientificName").to(List.class).getFirst().toString();
    }

    List<Parameter> prependParameter(Parameter head, List<Parameter> tail) {
        if (tail == null || tail.isEmpty()) {
            return Collections.singletonList(head);
        }

        List<Parameter> params = new ArrayList<>(tail.size() + 1);
        params.add(head);
        params.addAll(tail);

        return params;
    }

    public String updateDescription(String operationId, String description) {
        return switch (operationId) {
            case V2Controller.DOWNLOAD_ID ->
                    "The maximum number of results that can be downloaded is " + downloadMaxRows + ".";
            default -> description;
        };
    }

    public void updateTags(OpenAPI openApi) {
        Info info = new Info()
                .title(openapiTitle)
                .description(openapiDescription)
                .termsOfService(openapiTerms)
                .contact(new Contact()
                        .name(openapiContactName)
                        .email(openapiContactEmail))
                .license(new License()
                        .name(openapiLicenseName)
                        .url(openapiLicenseUrl))
                .version(openapiVersion);

        openApi.getComponents().addSecuritySchemes("JWT", new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .bearerFormat("JWT")
                .scheme("bearer"));

        if (StringUtils.isNotEmpty(openapiLicenseUrl)) {
            openApi.getComponents().addSecuritySchemes("openIdConnect", new SecurityScheme()
                    .type(SecurityScheme.Type.OPENIDCONNECT)
                    .openIdConnectUrl(oidcDiscoveryUri));
        }

        openApi.info(info);
        openApi.servers(Arrays.stream(openapiServers.split(",")).map(s -> new io.swagger.v3.oas.models.servers.Server().url(s)).toList());
        List<String> pathsToUpdate = new ArrayList<>();
        openApi.getPaths().forEach((pathKey, path) -> path.readOperationsMap().forEach((opKey, op) -> {
            // inject path variables otherwise unsupported
            if (updatePaths(op)) {
                pathsToUpdate.add(pathKey);
            }

            // replace default examples with real examples
            if (op.getRequestBody() != null && op.getRequestBody().getContent() != null) {
                op.getRequestBody().getContent().forEach((cKey, c) -> c.setExample(updateExample(op.getOperationId(), c.getExample())));
            }

            // update description
            if (op.getDescription() != null) {
                op.setDescription(updateDescription(op.getOperationId(), op.getDescription()));
            }
        }));

        // convert /** paths to /{id} for openapi
        pathsToUpdate.forEach(path -> {
            PathItem pathItem = openApi.getPaths().remove(path);
            openApi.getPaths().addPathItem(path.replace("**", "{id}"), pathItem);
        });
    }
}
