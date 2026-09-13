/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.service.auth.WebService;
import org.apache.http.entity.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
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
public class UtilControllerIntegrationTest extends AbstractIntegrationTestContainers {

    @MockBean
    private WebService webService;

    @Autowired
    private TestRestTemplate restTemplate;

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

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/trait-count?taxon=Macropus", org.springframework.http.HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("count", 42);
    }

    @Test
    void traitCount_withApniId_encodesTaxonAndAppendsId() {
        when(webService.get(contains("/trait-count?taxon=Macropus&APNI_ID=123"), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(okResponse(Map.of("count", 1)));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/trait-count?taxon=Macropus&APNI_ID=123", org.springframework.http.HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("count", 1);
    }

    @Test
    void traitCount_upstreamError_passesThroughStatusAndBody() {
        when(webService.get(contains("/trait-count"), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(errorResponse(404, "not found"));

        ResponseEntity<String> resp = restTemplate.exchange(
                "/trait-count?taxon=Unknown", org.springframework.http.HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).contains("not found");
    }

    @Test
    void traitSummary_happyPath_returnsUpstreamBody() {
        when(webService.get(contains("/trait-summary?taxon=Macropus"), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(okResponse(Map.of("summary", "some traits")));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/trait-summary?taxon=Macropus", org.springframework.http.HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("summary", "some traits");
    }

    @Test
    void traitSummary_upstreamError_passesThroughStatus() {
        when(webService.get(contains("/trait-summary"), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(errorResponse(500, "upstream failure"));

        ResponseEntity<String> resp = restTemplate.exchange(
                "/trait-summary?taxon=Macropus", org.springframework.http.HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Test
    void downloadTaxonData_happyPath_setsCsvHeadersAndFilename() {
        when(webService.get(contains("/download-taxon-data?taxon=Macropus+rufus"), isNull(), eq(ContentType.TEXT_PLAIN), eq(false), eq(false), isNull()))
                .thenReturn(okResponse("col1,col2\nval1,val2"));

        ResponseEntity<String> resp = restTemplate.exchange(
                "/download-taxon-data?taxon=Macropus rufus", org.springframework.http.HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getHeaders().getFirst("content-type")).isEqualTo("text/csv");
        assertThat(resp.getHeaders().getFirst("content-disposition"))
                .isEqualTo("attachment;filename=Macropus_rufus.csv");
        assertThat(resp.getBody()).isEqualTo("col1,col2\nval1,val2");
    }

    @Test
    void downloadTaxonData_upstreamError_passesThroughStatus() {
        when(webService.get(contains("/download-taxon-data"), isNull(), eq(ContentType.TEXT_PLAIN), eq(false), eq(false), isNull()))
                .thenReturn(errorResponse(400, "bad request"));

        ResponseEntity<String> resp = restTemplate.exchange(
                "/download-taxon-data?taxon=Bad", org.springframework.http.HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
