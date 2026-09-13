/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.doi.Doi;
import au.org.ala.search.model.doi.DoiProvider;
import au.org.ala.search.model.doi.MintResponse;
import au.org.ala.search.repo.DoiDataPostgresRepository;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.remote.DoiFileStoreService;
import au.org.ala.search.service.remote.DoiService;
import au.org.ala.search.service.remote.SignedUrlService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Integration test for {@link V1DoiController}. {@link DoiDataPostgresRepository} and
 * {@link DoiService} are mocked so this test focuses on request validation, auth/authorisation branching, and
 * response-shaping logic.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class V1DoiControllerIntegrationTest extends AbstractIntegrationTestContainers {

    @MockBean
    private DoiDataPostgresRepository doiDataPostgresRepository;

    @MockBean
    private AuthService authService;

    @MockBean
    private DoiFileStoreService doiFileStoreService;

    @MockBean
    private DoiService doiService;

    @MockBean
    private SignedUrlService signedUrlService;

    @Autowired
    private TestRestTemplate restTemplate;

    @BeforeEach
    void resetMocks() {
        reset(doiDataPostgresRepository, authService, doiFileStoreService, doiService, signedUrlService);
    }

    private HttpEntity<MultiValueMap<String, Object>> multipartEntity(MultiValueMap<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        return new HttpEntity<>(body, headers);
    }

    private Doi doi(UUID uuid, String doiStr, List<String> authorisedRoles) {
        return Doi.builder()
                .id(1L)
                .uuid(uuid)
                .doi(doiStr)
                .title("Test title")
                .authors("Test authors")
                .description("Test description")
                .dateMinted(new Date())
                .provider(DoiProvider.DATACITE)
                .authorisedRoles(authorisedRoles)
                .active(true)
                .build();
    }

    @Test
    void getDoi_byDoiString_returnsDoi() {
        Doi item = doi(UUID.randomUUID(), "10.1234/test-doi", null);
        when(doiDataPostgresRepository.findByDoiNative("10.1234/test-doi")).thenReturn(item);

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/doi/10.1234/test-doi", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("doi", "10.1234/test-doi");
    }

    @Test
    void getDoi_byUuid_returnsDoi() {
        UUID uuid = UUID.randomUUID();
        when(doiDataPostgresRepository.findByDoiNative(uuid.toString())).thenReturn(null);
        when(doiDataPostgresRepository.findByIdNative(uuid)).thenReturn(doi(uuid, "10.1234/test-doi", null));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/doi/" + uuid, HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("uuid", uuid.toString());
    }

    @Test
    void getDoi_unknown_returnsNotFound() {
        when(doiDataPostgresRepository.findByDoiNative("unknown")).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/doi/unknown", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void listDois_returnsResultsWithTotalCountHeader() {
        Doi item = doi(UUID.randomUUID(), "10.1234/test-doi", null);
        when(doiDataPostgresRepository.listDoisNative(any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(item)));

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/v1/doi?max=10&offset=0", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getHeaders().getFirst("X-Total-Count")).isEqualTo("1");
        assertThat(resp.getBody()).hasSize(1);
    }

    @Test
    void download_unknownId_returnsNotFound() {
        UUID uuid = UUID.randomUUID();
        when(doiDataPostgresRepository.findByIdNative(uuid)).thenReturn(null);
        when(doiDataPostgresRepository.findByDoiNative(uuid.toString())).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/doi/" + uuid + "/download", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void download_unauthorisedRole_returnsForbidden() {
        UUID uuid = UUID.randomUUID();
        Doi item = doi(uuid, "10.1234/test-doi", List.of("restricted-role"));
        when(doiDataPostgresRepository.findByIdNative(uuid)).thenReturn(item);
        when(authService.isAdmin(any())).thenReturn(false);
        when(authService.getRoles(any())).thenReturn(Set.of());

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/doi/" + uuid + "/download", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void download_s3Mode_redirectsToPresignedUrl() {
        UUID uuid = UUID.randomUUID();
        Doi item = doi(uuid, "10.1234/test-doi", null);
        when(doiDataPostgresRepository.findByIdNative(uuid)).thenReturn(item);
        when(authService.isAdmin(any())).thenReturn(true);
        when(doiFileStoreService.isS3()).thenReturn(true);
        when(doiFileStoreService.createPresignedGetUrl(item)).thenReturn("https://s3.example.com/presigned-doi");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/doi/" + uuid + "/download", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getHeaders().getFirst("Location")).isEqualTo("https://s3.example.com/presigned-doi");
    }

    @Test
    void download_noRedirect_returnsJsonUrl() {
        UUID uuid = UUID.randomUUID();
        Doi item = doi(uuid, "10.1234/test-doi", null);
        when(doiDataPostgresRepository.findByIdNative(uuid)).thenReturn(item);
        when(authService.isAdmin(any())).thenReturn(true);
        when(doiFileStoreService.isS3()).thenReturn(true);
        when(doiFileStoreService.createPresignedGetUrl(item)).thenReturn("https://s3.example.com/presigned-doi");

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/doi/" + uuid + "/download?redirect=false", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("url", "https://s3.example.com/presigned-doi");
    }

    @Test
    void mint_missingMandatoryFields_returnsBadRequest() {
        when(authService.isAdmin(any())).thenReturn(true);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("json", "{\"title\":\"Only title provided\"}");

        ResponseEntity<String> resp = restTemplate.postForEntity("/v1/doi", multipartEntity(body), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void mint_notAuthorised_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);
        when(authService.getRoles(any())).thenReturn(Set.of());

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("json", "{\"title\":\"t\"}");

        ResponseEntity<String> resp = restTemplate.postForEntity("/v1/doi", multipartEntity(body), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void mint_validRequest_returnsCreatedWithDoiIdHeader() throws Exception {
        when(authService.isAdmin(any())).thenReturn(true);
        when(doiService.mintDoi(any(), any(), anyString(), anyString(), anyString(), any(), anyString(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new MintResponse(UUID.randomUUID().toString(), "10.1234/new-doi", null, "http://landing", null, "success"));

        String json = "{"
                + "\"provider\":\"DATACITE\","
                + "\"title\":\"My dataset\","
                + "\"authors\":\"Someone\","
                + "\"description\":\"A description\","
                + "\"applicationUrl\":\"http://example.org\","
                + "\"providerMetadata\":{\"title\":\"My dataset\"}"
                + "}";

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("json", json);

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/doi", HttpMethod.POST, multipartEntity(body), new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getHeaders().getFirst("X-DOI-ID")).isEqualTo("10.1234/new-doi");
        assertThat(resp.getBody()).containsEntry("doi", "10.1234/new-doi");
    }
}
