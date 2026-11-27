/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.dto.IndexedField;
import au.org.ala.search.model.queue.*;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.remote.*;
import au.org.ala.search.service.queue.BroadcastQueue;
import au.org.ala.search.service.queue.ConsumerQueue;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.GZIPOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Integration test for {@link V2Controller} endpoints not covered elsewhere.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "collections.sourceUrl=https://collections-source.example.org")
public class V2ControllerIntegrationTest extends AbstractIntegrationTestContainers {

    @MockBean
    private ElasticService elasticService;

    @MockBean
    private AuthService authService;

    @MockBean
    private ConsumerQueue consumerQueue;

    @MockBean
    private QueueDataService queueDataService;

    @MockBean
    private DownloadFileStoreService downloadFileStoreService;

    @MockBean
    private BroadcastQueue broadcastQueue;

    @MockBean
    private BannerService bannerService;

    @MockBean
    private UserDataService userDataService;

    @MockBean
    private CollectoryCache collectoryCache;

    @MockBean
    private ListCache listCache;

    @Autowired
    private TestRestTemplate restTemplate;

    @Value("${collections.sourceUrl}")
    private String collectionsSourceUrl;

    @BeforeEach
    void resetMocks() {
        reset(elasticService, authService, consumerQueue, queueDataService, downloadFileStoreService,
                broadcastQueue, bannerService, userDataService, collectoryCache, listCache);
    }

    private QueueItem queueItem(UUID id, StatusCode status, String userId) {
        QueueItem item = new QueueItem();
        item.id = id;
        item.userId = userId;
        item.created = new Date();
        item.status = status;
        SearchQueueRequest searchQueueRequest = new SearchQueueRequest();
        searchQueueRequest.filename = "results";
        searchQueueRequest.q = new String[]{"kangaroo"};
        searchQueueRequest.fl = new String[]{"guid"};
        item.queueRequest = QueueRequest.builder()
                .taskType(TaskType.SEARCH_DOWNLOAD)
                .searchQueueRequest(searchQueueRequest)
                .build();
        return item;
    }

    @Test
    void indexFields_delegatesToElasticService() {
        when(elasticService.indexFields(true)).thenReturn(List.of(
                new IndexedField("guid", "string", true, true, null)));

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/v2/indexFields", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).get("name")).isEqualTo("guid");
    }

    @Test
    void banner_returnsBannerServiceResultWithCacheHeaders() {
        when(bannerService.getAll()).thenReturn(Map.of("global", "Some banner text"));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v2/banner", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("global", "Some banner text");
        assertThat(resp.getHeaders().getCacheControl()).isNotNull();
    }

    @Test
    void species_blankRequestList_returnsBadRequest() {
        ResponseEntity<String> resp = restTemplate.exchange(
                "/v2/species", HttpMethod.POST, new HttpEntity<>(List.of()), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void species_foundTaxon_returnsMappedResult() {
        when(elasticService.cleanupId("Macropus")).thenReturn("Macropus");
        when(elasticService.getTaxonMap(eq("Macropus"), eq(true), eq(true)))
                .thenReturn(new java.util.HashMap<>(Map.of("guid", "urn:lsid:macropus", "scientificName", "Macropus")));

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/v2/species", HttpMethod.POST, new HttpEntity<>(List.of("Macropus")), new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).get("guid")).isEqualTo("urn:lsid:macropus");
    }

    @Test
    void species_nonUrlSource_linksToCollectoryOnlyWhenDataResourceExists() throws Exception {
        Map<String, Object> taxon = new HashMap<>(Map.of(
                "guid", "ALA_DR31252_106", "datasetID", "dr31252", "source", "Other",
                "variantData", namesData(List.of(Map.of("datasetID", "dr3", "source", "Other"))),
                "synonymData", namesData(List.of(Map.of("datasetID", "dr2", "source", "https://example.org/original"))),
                "identifierData", namesData(List.of(Map.of("datasetID", "dr4", "source", "Other")))));
        when(elasticService.cleanupId("ALA_DR31252_106")).thenReturn("ALA_DR31252_106");
        when(elasticService.getTaxonMap(eq("ALA_DR31252_106"), eq(true), eq(true))).thenReturn(taxon);
        when(collectoryCache.hasDataResource("dr31252")).thenReturn(true);
        when(collectoryCache.hasDataResource("dr3")).thenReturn(true);
        // dr4 is not in the configured Collectory, e.g. a production-only list viewed on test

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/v2/species", HttpMethod.POST, new HttpEntity<>(List.of("ALA_DR31252_106")), new ParameterizedTypeReference<>() {
                });

        Map<String, Object> result = resp.getBody().get(0);
        assertThat(result.get("source")).isEqualTo(collectionsSourceUrl + "/public/show/dr31252");
        assertThat(((List<Map<String, Object>>) result.get("variantData")).get(0).get("source"))
                .isEqualTo(collectionsSourceUrl + "/public/show/dr3");
        assertThat(((List<Map<String, Object>>) result.get("synonymData")).get(0).get("source"))
                .isEqualTo("https://example.org/original");
        assertThat(((List<Map<String, Object>>) result.get("identifierData")).get(0)).doesNotContainKey("source");
    }

    private static String namesData(List<Map<String, String>> rows) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(bytes)) {
            gzip.write(new ObjectMapper().writeValueAsBytes(rows));
        }
        return Base64.getEncoder().encodeToString(bytes.toByteArray());
    }

    @Test
    void species_notFoundAfterAllFallbacks_returnsNotFound() {
        when(elasticService.cleanupId("Unknown")).thenReturn("Unknown");
        when(elasticService.getTaxonMap(eq("Unknown"), eq(true), eq(true))).thenReturn(null);
        when(elasticService.getTaxonVariantByNameMap(eq("Unknown"), eq(true))).thenReturn(null);
        when(elasticService.getTaxonByPreviousIdentifierMap(eq("Unknown"), eq(true))).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v2/species", HttpMethod.POST, new HttpEntity<>(List.of("Unknown")), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void queueDownload_missingRequiredFields_returnsBadRequest() {
        SearchQueueRequest request = new SearchQueueRequest();
        // filename, q, fl all missing

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v2/download/search", HttpMethod.POST, new HttpEntity<>(request), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void queueDownload_validRequest_returnsStatusResponse() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.QUEUED, "-1");
        when(authService.getUserId(any())).thenReturn("-1");
        when(consumerQueue.add(any(QueueRequest.class), eq("-1"))).thenReturn(item);

        SearchQueueRequest request = new SearchQueueRequest();
        request.filename = "results";
        request.q = new String[]{"kangaroo"};
        request.fl = new String[]{"guid", "name"};

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v2/download/search", HttpMethod.POST, new HttpEntity<>(request), new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsKey("statusUrl");
    }

    @Test
    void queueDownload_queueRejects_returnsBadRequest() {
        when(authService.getUserId(any())).thenReturn("-1");
        when(consumerQueue.add(any(QueueRequest.class), eq("-1"))).thenReturn(null);

        SearchQueueRequest request = new SearchQueueRequest();
        request.filename = "results";
        request.q = new String[]{"kangaroo"};
        request.fl = new String[]{"guid"};

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v2/download/search", HttpMethod.POST, new HttpEntity<>(request), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void queueFieldguide_validRequest_returnsStatusResponse() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.QUEUED, "-1");
        when(authService.getUserId(any())).thenReturn("-1");
        when(authService.getEmail(any())).thenReturn("user@example.com");
        when(consumerQueue.add(any(QueueRequest.class), eq("-1"))).thenReturn(item);

        FieldguideQueueRequest request = FieldguideQueueRequest.builder()
                .filename("fieldguide")
                .title("My field guide")
                .id(new String[]{"guid1"})
                .build();

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v2/download/fieldguide", HttpMethod.POST, new HttpEntity<>(request), new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsKey("statusUrl");
    }

    @Test
    void download_unknownUserAndNotDownload_returnsUnauthorized() {
        when(authService.getUserId(any())).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v2/download?id=" + UUID.randomUUID(), HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void download_unknownQueueItem_returnsNotFound() {
        UUID id = UUID.randomUUID();
        when(authService.getUserId(any())).thenReturn("-1");
        when(queueDataService.get(id)).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v2/download?id=" + id, HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void download_differentUserNotAdminNotDownload_returnsUnauthorized() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.RUNNING, "other-user");
        when(authService.getUserId(any())).thenReturn("-1");
        when(authService.isAdmin(any())).thenReturn(false);
        when(queueDataService.get(id)).thenReturn(item);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v2/download?id=" + id, HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void download_statusCheckByOwner_returnsStatusResponse() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.RUNNING, "-1");
        when(authService.getUserId(any())).thenReturn("-1");
        when(authService.isAdmin(any())).thenReturn(false);
        when(queueDataService.get(id)).thenReturn(item);

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v2/download?id=" + id, HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().get("statusCode")).isEqualTo("RUNNING");
    }

    @Test
    void download_cancel_sendsCancelBroadcastMessage() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.RUNNING, "-1");
        when(authService.getUserId(any())).thenReturn("-1");
        when(queueDataService.get(id)).thenReturn(item);

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v2/download?id=" + id + "&cancel=true", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(broadcastQueue).sendMessage(eq(TaskType.CANCEL_CONSUMER), any(QueueCancel.class));
    }

    @Test
    void download_s3ModeFinished_redirectsToPresignedUrl() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.FINISHED, "-1");
        when(authService.getUserId(any())).thenReturn("-1");
        when(queueDataService.get(id)).thenReturn(item);
        when(downloadFileStoreService.isS3()).thenReturn(true);
        when(downloadFileStoreService.createPresignedGetUrl(item)).thenReturn("https://s3.example.com/presigned");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v2/download?id=" + id + "&download=true", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getHeaders().getFirst("Location")).isEqualTo("https://s3.example.com/presigned");
    }

    @Test
    void userProperty_noPrincipal_returnsUnauthorized() {
        ResponseEntity<String> resp = restTemplate.exchange(
                "/v2/user/property?key=foo", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void createOrUpdateUserData_noPrincipal_returnsUnauthorized() {
        ResponseEntity<String> resp = restTemplate.exchange(
                "/v2/user/property", HttpMethod.POST, new HttpEntity<>(Map.of("k", "v")), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
