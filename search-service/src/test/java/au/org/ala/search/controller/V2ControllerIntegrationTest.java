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
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Integration test for {@link V2Controller} endpoints not covered elsewhere.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(RestTestClientConfiguration.class)
public class V2ControllerIntegrationTest extends AbstractIntegrationTestContainers {

    @MockitoBean
    private ElasticService elasticService;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private ConsumerQueue consumerQueue;

    @MockitoBean
    private QueueDataService queueDataService;

    @MockitoBean
    private DownloadFileStoreService downloadFileStoreService;

    @MockitoBean
    private BroadcastQueue broadcastQueue;

    @MockitoBean
    private BannerService bannerService;

    @MockitoBean
    private UserDataService userDataService;

    @MockitoBean
    private CollectoryCache collectoryCache;

    @MockitoBean
    private ListCache listCache;

    @Autowired
    private RestTestClient restTestClient;

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

        EntityExchangeResult<List<Map<String, Object>>> resp = restTestClient.get()
                .uri("/v2/indexFields")
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).hasSize(1);
        assertThat(resp.getResponseBody().get(0).get("name")).isEqualTo("guid");
    }

    @Test
    void banner_returnsBannerServiceResultWithCacheHeaders() {
        when(bannerService.getAll()).thenReturn(Map.of("global", "Some banner text"));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v2/banner")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsEntry("global", "Some banner text");
        assertThat(resp.getResponseHeaders().getCacheControl()).isNotNull();
    }

    @Test
    void species_blankRequestList_returnsBadRequest() {
        EntityExchangeResult<String> resp = restTestClient.post()
                .uri("/v2/species")
                .body(List.of())
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void species_foundTaxon_returnsMappedResult() {
        when(elasticService.cleanupId("Macropus")).thenReturn("Macropus");
        when(elasticService.getTaxonMap(eq("Macropus"), eq(true), eq(true)))
                .thenReturn(new java.util.HashMap<>(Map.of("guid", "urn:lsid:macropus", "scientificName", "Macropus")));

        EntityExchangeResult<List<Map<String, Object>>> resp = restTestClient.post()
                .uri("/v2/species")
                .body(List.of("Macropus"))
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).hasSize(1);
        assertThat(resp.getResponseBody().get(0).get("guid")).isEqualTo("urn:lsid:macropus");
    }

    @Test
    void species_notFoundAfterAllFallbacks_returnsNotFound() {
        when(elasticService.cleanupId("Unknown")).thenReturn("Unknown");
        when(elasticService.getTaxonMap(eq("Unknown"), eq(true), eq(true))).thenReturn(null);
        when(elasticService.getTaxonVariantByNameMap(eq("Unknown"), eq(true))).thenReturn(null);
        when(elasticService.getTaxonByPreviousIdentifierMap(eq("Unknown"), eq(true))).thenReturn(null);

        EntityExchangeResult<String> resp = restTestClient.post()
                .uri("/v2/species")
                .body(List.of("Unknown"))
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void queueDownload_missingRequiredFields_returnsBadRequest() {
        SearchQueueRequest request = new SearchQueueRequest();
        // filename, q, fl all missing

        EntityExchangeResult<String> resp = restTestClient.post()
                .uri("/v2/download/search")
                .body(request)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
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

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.post()
                .uri("/v2/download/search")
                .body(request)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsKey("statusUrl");
    }

    @Test
    void queueDownload_queueRejects_returnsBadRequest() {
        when(authService.getUserId(any())).thenReturn("-1");
        when(consumerQueue.add(any(QueueRequest.class), eq("-1"))).thenReturn(null);

        SearchQueueRequest request = new SearchQueueRequest();
        request.filename = "results";
        request.q = new String[]{"kangaroo"};
        request.fl = new String[]{"guid"};

        EntityExchangeResult<String> resp = restTestClient.post()
                .uri("/v2/download/search")
                .body(request)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
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

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.post()
                .uri("/v2/download/fieldguide")
                .body(request)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsKey("statusUrl");
    }

    @Test
    void download_unknownUserAndNotDownload_returnsUnauthorized() {
        when(authService.getUserId(any())).thenReturn(null);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v2/download?id=" + UUID.randomUUID())
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void download_unknownQueueItem_returnsNotFound() {
        UUID id = UUID.randomUUID();
        when(authService.getUserId(any())).thenReturn("-1");
        when(queueDataService.get(id)).thenReturn(null);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v2/download?id=" + id)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void download_differentUserNotAdminNotDownload_returnsUnauthorized() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.RUNNING, "other-user");
        when(authService.getUserId(any())).thenReturn("-1");
        when(authService.isAdmin(any())).thenReturn(false);
        when(queueDataService.get(id)).thenReturn(item);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v2/download?id=" + id)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void download_statusCheckByOwner_returnsStatusResponse() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.RUNNING, "-1");
        when(authService.getUserId(any())).thenReturn("-1");
        when(authService.isAdmin(any())).thenReturn(false);
        when(queueDataService.get(id)).thenReturn(item);

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v2/download?id=" + id)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody().get("statusCode")).isEqualTo("RUNNING");
    }

    @Test
    void download_cancel_sendsCancelBroadcastMessage() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.RUNNING, "-1");
        when(authService.getUserId(any())).thenReturn("-1");
        when(queueDataService.get(id)).thenReturn(item);

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v2/download?id=" + id + "&cancel=true")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
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

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v2/download?id=" + id + "&download=true")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getResponseHeaders().getFirst("Location")).isEqualTo("https://s3.example.com/presigned");
    }

    @Test
    void userProperty_noPrincipal_returnsUnauthorized() {
        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v2/user/property?key=foo")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void createOrUpdateUserData_noPrincipal_returnsUnauthorized() {
        EntityExchangeResult<String> resp = restTestClient.post()
                .uri("/v2/user/property")
                .body(Map.of("k", "v"))
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
