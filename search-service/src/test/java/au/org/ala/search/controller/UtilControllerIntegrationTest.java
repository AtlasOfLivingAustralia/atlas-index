/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.service.auth.WebService;
import org.apache.hc.core5.http.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import au.org.ala.search.RestTestClientConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Integration test for {@link UtilController} — the deprecated, non-versioned "austraits"
 * proxy endpoints. {@link WebService} is mocked so no real HTTP call to the austraits
 * service is made; the controller's response-shaping logic (status code passthrough,
 * headers, filename generation) is what's under test.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(RestTestClientConfiguration.class)
public class UtilControllerIntegrationTest extends AbstractIntegrationTestContainers {

    @MockitoBean
    private WebService webService;

    @Autowired
    private RestTestClient restTestClient;

    @BeforeEach
    void resetMocks() {
        org.mockito.Mockito.reset(webService);
    }

    private Map<String, Object> okResponse(Object body) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("statusCode", 200);
        resp.put("resp", body);
        return resp;
    }

    private Map<String, Object> errorResponse(int statusCode, Object body) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("statusCode", statusCode);
        resp.put("resp", body);
        return resp;
    }

    @Test
    void traitCount_happyPath_returnsUpstreamBody() {
        Map<String, Object> upstreamBody = Map.of("count", 42);
        when(webService.get(contains("/trait-count?taxon=Macropus"), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(okResponse(upstreamBody));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/trait-count?taxon=Macropus")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsEntry("count", 42);
    }

    @Test
    void traitCount_withApniId_encodesTaxonAndAppendsId() {
        when(webService.get(contains("/trait-count?taxon=Macropus&APNI_ID=123"), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(okResponse(Map.of("count", 1)));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/trait-count?taxon=Macropus&APNI_ID=123")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsEntry("count", 1);
    }

    @Test
    void traitCount_upstreamError_passesThroughStatusAndBody() {
        when(webService.get(contains("/trait-count"), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(errorResponse(404, "not found"));

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/trait-count?taxon=Unknown")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getResponseBody()).contains("not found");
    }

    @Test
    void traitSummary_happyPath_returnsUpstreamBody() {
        when(webService.get(contains("/trait-summary?taxon=Macropus"), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(okResponse(Map.of("summary", "some traits")));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/trait-summary?taxon=Macropus")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsEntry("summary", "some traits");
    }

    @Test
    void traitSummary_upstreamError_passesThroughStatus() {
        when(webService.get(contains("/trait-summary"), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(errorResponse(500, "upstream failure"));

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/trait-summary?taxon=Macropus")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Test
    void downloadTaxonData_happyPath_setsCsvHeadersAndFilename() {
        when(webService.get(contains("/download-taxon-data?taxon=Macropus+rufus"), isNull(), eq(ContentType.TEXT_PLAIN), eq(false), eq(false), isNull()))
                .thenReturn(okResponse("col1,col2\nval1,val2"));

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/download-taxon-data?taxon=Macropus rufus")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseHeaders().getFirst("content-type")).isEqualTo("text/csv");
        assertThat(resp.getResponseHeaders().getFirst("content-disposition"))
                .isEqualTo("attachment;filename=Macropus_rufus.csv");
        assertThat(resp.getResponseBody()).isEqualTo("col1,col2\nval1,val2");
    }

    @Test
    void downloadTaxonData_upstreamError_passesThroughStatus() {
        when(webService.get(contains("/download-taxon-data"), isNull(), eq(ContentType.TEXT_PLAIN), eq(false), eq(false), isNull()))
                .thenReturn(errorResponse(400, "bad request"));

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/download-taxon-data?taxon=Bad")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
