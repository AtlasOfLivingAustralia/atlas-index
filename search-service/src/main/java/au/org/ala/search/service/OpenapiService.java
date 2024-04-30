package au.org.ala.search.service;

import au.org.ala.search.controller.V1Controller;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.remote.ElasticService;
import co.elastic.clients.elasticsearch._types.query_dsl.FieldAndFormat;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.Parameter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;

@Service
public class OpenapiService {
    private static final Logger logger = LoggerFactory.getLogger(OpenapiService.class);
    protected final ElasticService elasticService;

    public OpenapiService(ElasticService elasticService) {
        this.elasticService = elasticService;
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
                    case V1Controller.SPECIES_GUIDS_BULKLOOKUP_ID -> listOfGuids();
                    case V1Controller.SPECIES_IMAGE_BULK_ID -> listOfGuidsWithAnImage();
                    case V1Controller.SPECIES_LOOKUP_BULK_ID -> listOfNamesWrapped();
                    default -> defaultExample;
                };
            } catch (IOException e) {
                logger.warn("failed to update openapi example for: " + operationId + ", " + e.getMessage());
            }
        }
        return defaultExample;
    }

    String listOfGuids() throws IOException {
        // get 5 "idxtype:TAXON and -acceptedConceptID:*" guids
        Map<String, Object> query = new HashMap<>();
        query.put("idxtype", "TAXON");
        query.put("not exists acceptedConceptID", "");

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 5,
                query, Collections.singletonList(new FieldAndFormat.Builder().field("guid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return new ObjectMapper().writeValueAsString(result.hits().hits().stream().map(item -> item.fields().get("guid").to(List.class).getFirst()).toList());
    }

    String listOfGuidsWithAnImage() throws IOException {
        // get 5 "idxtype:TAXON and -acceptedConceptID:* and image:*" guids
        Map<String, Object> query = new HashMap<>();
        query.put("idxtype", "TAXON");
        query.put("not exists acceptedConceptID", "");

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 5,
                query, Collections.singletonList(new FieldAndFormat.Builder().field("guid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return new ObjectMapper().writeValueAsString(result.hits().hits().stream().map(item -> item.fields().get("guid").to(List.class).getFirst()).toList());
    }

    String guidWithAnImage() throws IOException {
        // get 1 "idxtype:TAXON and -acceptedConceptID:* and image:* and rank:species" guids
        Map<String, Object> query = new HashMap<>();
        query.put("idxtype", "TAXON");
        query.put("not exists acceptedConceptID", "");
        query.put("exists image", "");
        query.put("rank", "species");

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 1,
                query, Collections.singletonList(new FieldAndFormat.Builder().field("guid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return result.hits().hits().getFirst().fields().get("guid").to(List.class).getFirst().toString();
    }

    String listOfNamesWrapped() throws IOException {
        // get 5 "idxtype:TAXON and -acceptedConceptID:*" names
        Map<String, Object> query = new HashMap<>();
        query.put("idxtype", "TAXON");
        query.put("not exists acceptedConceptID", "");

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 5,
                query, Collections.singletonList(new FieldAndFormat.Builder().field("scientificName").build()), null, false);

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
            if (op.getOperationId().equals(V1Controller.CHILD_CONCEPTS_ID) ||
                    op.getOperationId().equals(V1Controller.SPECIES_SHORTPROFILE_ID) ||
                    op.getOperationId().equals(V1Controller.SPECIES_ID) ||
                    op.getOperationId().equals(V1Controller.SPECIES_ID + "_1") /* "/taxon/**" path */) {
                String guid = parentGuid();
                io.swagger.v3.oas.models.parameters.Parameter pathParam = new io.swagger.v3.oas.models.parameters.Parameter();
                pathParam.setName("id");
                pathParam.setIn("path");
                pathParam.setDescription("The guid of a specific taxon");
                pathParam.setSchema(new StringSchema());
                pathParam.setExample(guid);
                pathParam.setRequired(true);

                op.setParameters(prependParameter(pathParam, op.getParameters()));
            } else if (op.getOperationId().equals(V1Controller.CLASSIFICATION_ID)) {
                String guid = guidWithRkGenus();
                io.swagger.v3.oas.models.parameters.Parameter pathParam = new io.swagger.v3.oas.models.parameters.Parameter();
                pathParam.setName("id");
                pathParam.setIn("path");
                pathParam.setDescription("The guid of a specific taxon");
                pathParam.setSchema(new StringSchema());
                pathParam.setExample(guid);
                pathParam.setRequired(true);

                op.setParameters(prependParameter(pathParam, op.getParameters()));
            } else if (op.getOperationId().equals(V1Controller.GUID_ID)) {
                String guid = acceptedName();
                io.swagger.v3.oas.models.parameters.Parameter pathParam = new io.swagger.v3.oas.models.parameters.Parameter();
                pathParam.setName("id");
                pathParam.setIn("path");
                pathParam.setDescription("The name of a specific taxon");
                pathParam.setSchema(new StringSchema());
                pathParam.setExample(guid);
                pathParam.setRequired(true);

                op.setParameters(prependParameter(pathParam, op.getParameters()));
            } else if (op.getOperationId().equals(V1Controller.IMAGESEARCH_ID)) {
                String guid = guidWithAnImage();
                io.swagger.v3.oas.models.parameters.Parameter pathParam = new io.swagger.v3.oas.models.parameters.Parameter();
                pathParam.setName("id");
                pathParam.setIn("path");
                pathParam.setDescription("The guid of a specific taxon");
                pathParam.setSchema(new StringSchema());
                pathParam.setExample(guid);
                pathParam.setRequired(true);

                op.setParameters(prependParameter(pathParam, op.getParameters()));
            } else {
                return false;
            }
        } catch (Exception e) {
            logger.warn("failed to update openapi example for: " + op.getOperationId() + ", " + e.getMessage());
        }

        // return true because when the op does not require an update false has already been returned
        return true;
    }

    String parentGuid() throws IOException {
        // get 1 "idxtype:TAXON and parentGuid:*" guids
        Map<String, Object> query = new HashMap<>();
        query.put("idxtype", "TAXON");
        query.put("exists parentGuid", "");

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 1,
                query, Collections.singletonList(new FieldAndFormat.Builder().field("parentGuid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return result.hits().hits().getFirst().fields().get("parentGuid").to(List.class).getFirst().toString();
    }

    String guidWithRkGenus() throws IOException {
        // get 1 "idxtype:TAXON and parentGuid:* and rank:species" guids
        Map<String, Object> query = new HashMap<>();
        query.put("idxtype", "TAXON");
        query.put("exists parentGuid", "");
        query.put("rank", "species");

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 1,
                query, Collections.singletonList(new FieldAndFormat.Builder().field("guid").build()), null, false);

        if (result.hits().hits().isEmpty()) {
            throw new IOException("no records found");
        }

        return result.hits().hits().getFirst().fields().get("guid").to(List.class).getFirst().toString();
    }

    String acceptedName() throws IOException {
        // get 1 "idxtype:TAXON and parentGuid:* and rank:species" name
        Map<String, Object> query = new HashMap<>();
        query.put("idxtype", "TAXON");
        query.put("exists parentGuid", "");
        query.put("rank", "species");

        SearchResponse<SearchItemIndex> result = elasticService.queryPointInTimeAfter(null, null, 1,
                query, Collections.singletonList(new FieldAndFormat.Builder().field("scientificName").build()), null, false);

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
}
