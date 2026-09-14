/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.controller.V1SearchController;
import au.org.ala.search.controller.V2Controller;
import au.org.ala.search.repo.DoiDataPostgresRepository;
import au.org.ala.search.service.remote.ElasticService;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.Operation;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Pure-logic unit tests for {@link OpenapiService}'s object-manipulation helpers
 * ({@code updateDescription}, {@code prependParameter}, and the fallback/passthrough branches
 * of {@code updateExample}/{@code updatePaths}). No Spring context, no containers —
 * {@link ElasticService} is a Mockito mock (never contacts a real Elasticsearch cluster), and
 * {@code @Value}-annotated private fields are set directly via reflection to simulate property
 * injection.
 */
class OpenapiServiceTest {

    private final ElasticService elasticService = mock(ElasticService.class);
    private final OpenapiService openapiService = new OpenapiService(
            elasticService, mock(DoiDataPostgresRepository.class));

    private void setField(String name, Object value) throws Exception {
        Field f = OpenapiService.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(openapiService, value);
    }

    @Test
    void updateDescription_downloadOperation_appendsMaxRows() throws Exception {
        setField("downloadMaxRows", 500);

        String result = openapiService.updateDescription(V2Controller.DOWNLOAD_ID, "Download records.");

        assertThat(result).isEqualTo("The maximum number of results that can be downloaded is 500.");
    }

    @Test
    void updateDescription_otherOperation_returnsUnchanged() {
        String result = openapiService.updateDescription("someOtherOperation", "Original description.");

        assertThat(result).isEqualTo("Original description.");
    }

    @Test
    void prependParameter_emptyTail_returnsSingletonList() {
        Parameter head = new Parameter().name("id");

        List<Parameter> result = openapiService.prependParameter(head, List.of());

        assertThat(result).containsExactly(head);
    }

    @Test
    void prependParameter_nullTail_returnsSingletonList() {
        Parameter head = new Parameter().name("id");

        List<Parameter> result = openapiService.prependParameter(head, null);

        assertThat(result).containsExactly(head);
    }

    @Test
    void prependParameter_nonEmptyTail_prependsHeadPreservingOrder() {
        Parameter head = new Parameter().name("id");
        Parameter existing1 = new Parameter().name("page");
        Parameter existing2 = new Parameter().name("size");

        List<Parameter> result = openapiService.prependParameter(head, List.of(existing1, existing2));

        assertThat(result).containsExactly(head, existing1, existing2);
    }

    @Test
    void updateExample_nullDefault_returnsNull() {
        Object result = openapiService.updateExample(V2Controller.SPECIES_ID, null);

        assertThat(result).isNull();
    }

    @Test
    void updateExample_unmatchedOperationId_returnsDefaultUnchanged() {
        String defaultExample = "default-example-value";

        Object result = openapiService.updateExample("someUnrelatedOperation", defaultExample);

        assertThat(result).isSameAs(defaultExample);
    }

    @Test
    void updateExample_matchedOperationButQueryParseFails_fallsBackToDefault() throws Exception {
        // isValidField accepts all fields so QueryParserUtil.parse succeeds, but the downstream
        // Elasticsearch query throws IOException, which updateExample catches internally,
        // logs a warning, and falls back to returning the original defaultExample.
        when(elasticService.isValidField(anyString())).thenReturn(true);
        when(elasticService.queryPointInTimeAfter(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new java.io.IOException("simulated ES failure"));
        String defaultExample = "default-example-value";

        Object result = openapiService.updateExample(V2Controller.SPECIES_ID, defaultExample);

        assertThat(result).isEqualTo(defaultExample);
    }

    @Test
    void updatePaths_unmatchedOperationId_returnsFalseWithoutTouchingParameters() {
        Operation op = new Operation();
        op.setOperationId("someUnrelatedOperation");

        boolean updated = openapiService.updatePaths(op);

        assertThat(updated).isFalse();
        assertThat(op.getParameters()).isNull();
    }

    @Test
    void updatePaths_matchedOperationButLookupFails_returnsTrueAnyway() throws Exception {
        // isValidField accepts all fields, but the downstream Elasticsearch query throws
        // IOException; updatePaths catches this internally and logs a warning. The method
        // still returns true because the operationId matched one of the known cases.
        when(elasticService.isValidField(anyString())).thenReturn(true);
        when(elasticService.queryPointInTimeAfter(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new java.io.IOException("simulated ES failure"));
        Operation op = new Operation();
        op.setOperationId(V1SearchController.SPECIES_ID);

        boolean updated = openapiService.updatePaths(op);

        assertThat(updated).isTrue();
    }
}
