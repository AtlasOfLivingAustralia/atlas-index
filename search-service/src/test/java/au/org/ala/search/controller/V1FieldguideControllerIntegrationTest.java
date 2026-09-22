/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.dto.FieldguideRequest;
import au.org.ala.search.model.queue.FieldguideQueueRequest;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.QueueRequest;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.queue.ConsumerQueue;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.QueueDataService;
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
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.security.Principal;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Integration test for {@link V1FieldguideController}. Downstream collaborators
 * ({@link ConsumerQueue}, {@link QueueDataService}, {@link DownloadFileStoreService}) are
 * mocked so the actual PDF/email generation is not exercised here — only controller-level request
 * validation, auth-email resolution, and response mapping.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(RestTestClientConfiguration.class)
public class V1FieldguideControllerIntegrationTest extends AbstractIntegrationTestContainers {

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private ConsumerQueue consumerQueue;

    @MockitoBean
    private QueueDataService queueDataService;

    @MockitoBean
    private DownloadFileStoreService downloadFileStoreService;

    @Autowired
    private RestTestClient restTestClient;

    @BeforeEach
    void resetMocks() {
        reset(authService, consumerQueue, queueDataService, downloadFileStoreService);
    }

    private QueueItem queueItem(UUID id, StatusCode status) {
        QueueItem item = new QueueItem();
        item.id = id;
        item.userId = "-1";
        item.created = new Date();
        item.status = status;
        item.statusMessage = null;
        item.queueRequest = QueueRequest.builder()
                .taskType(TaskType.FIELDGUIDE)
                .email("user@example.com")
                .fieldguideQueueRequest(FieldguideQueueRequest.builder()
                        .filename("myfile.pdf")
                        .title("My field guide")
                        .id(new String[]{"guid1", "guid2"})
                        .build())
                .build();
        return item;
    }

    @Test
    void generate_queuedRequest_returnsInQueueStatusAndStatusUrl() {
        UUID id = UUID.randomUUID();
        when(authService.getEmail(any())).thenReturn(null);
        when(authService.getUserId(any())).thenReturn(null);
        when(consumerQueue.add(any(QueueRequest.class), any())).thenReturn(queueItem(id, StatusCode.QUEUED));

        FieldguideRequest request = new FieldguideRequest();
        request.setTitle("My field guide");
        request.setGuids(List.of("guid1", "guid2"));
        request.setLink("http://example.org/species");

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.post()
                .uri("/v1/fieldguide/generate?email=user@example.com")
                .body(request)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody().get("status")).isEqualTo("inQueue");
        assertThat((String) resp.getResponseBody().get("statusUrl")).contains("/v1/fieldguide/status/" + id);
    }

    @Test
    void generate_errorStatus_returnsBadRequest() {
        UUID id = UUID.randomUUID();
        when(authService.getEmail(any())).thenReturn(null);
        when(authService.getUserId(any())).thenReturn(null);
        when(consumerQueue.add(any(QueueRequest.class), any())).thenReturn(queueItem(id, StatusCode.ERROR));

        FieldguideRequest request = new FieldguideRequest();
        request.setTitle("My field guide");
        request.setGuids(List.of("guid1"));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.post()
                .uri("/v1/fieldguide/generate?email=user@example.com")
                .body(request)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void status_existingQueueItem_returnsFieldguideResponse() {
        UUID id = UUID.randomUUID();
        when(queueDataService.get(id)).thenReturn(queueItem(id, StatusCode.RUNNING));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v1/fieldguide/status/" + id)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody().get("status")).isEqualTo("running");
    }

    @Test
    void status_queuedItem_remapsToInQueue() {
        UUID id = UUID.randomUUID();
        when(queueDataService.get(id)).thenReturn(queueItem(id, StatusCode.QUEUED));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v1/fieldguide/status/" + id)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody().get("status")).isEqualTo("inQueue");
    }

    @Test
    void status_finishedQueueItem_returnsDownloadUrl() {
        UUID id = UUID.randomUUID();
        when(queueDataService.get(id)).thenReturn(queueItem(id, StatusCode.FINISHED));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v1/fieldguide/status/" + id)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody().get("status")).isEqualTo("finished");
        assertThat((String) resp.getResponseBody().get("downloadUrl")).contains("/v1/fieldguide/download/" + id);
    }

    @Test
    void status_unknownId_returnsNotFound() {
        UUID id = UUID.randomUUID();
        when(queueDataService.get(id)).thenReturn(null);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v1/fieldguide/status/" + id)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void download_unknownId_returnsNotFound() {
        UUID id = UUID.randomUUID();
        when(queueDataService.get(id)).thenReturn(null);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v1/fieldguide/download/" + id)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void download_s3Mode_returnsTemporaryRedirectWithPresignedUrl() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.FINISHED);
        when(queueDataService.get(id)).thenReturn(item);
        when(downloadFileStoreService.isS3()).thenReturn(true);
        when(downloadFileStoreService.createPresignedGetUrl(item)).thenReturn("https://s3.example.com/presigned-url");

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v1/fieldguide/download/" + id)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.TEMPORARY_REDIRECT);
        assertThat(resp.getResponseHeaders().getFirst("Location")).isEqualTo("https://s3.example.com/presigned-url");
    }

    @Test
    void download_localFileMissing_returnsNotFound() {
        UUID id = UUID.randomUUID();
        QueueItem item = queueItem(id, StatusCode.FINISHED);
        when(queueDataService.get(id)).thenReturn(item);
        when(downloadFileStoreService.isS3()).thenReturn(false);
        when(downloadFileStoreService.getFilePath(item)).thenReturn("/tmp/does-not-exist-" + id + ".pdf");

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v1/fieldguide/download/" + id)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
