/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.audit.AuditEntry;
import au.org.ala.search.model.banner.BannerRequest;
import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.model.dto.IndexedField;
import au.org.ala.search.model.quality.QualityProfile;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.QueueRequest;
import au.org.ala.search.model.queue.SearchQueueRequest;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.queue.BroadcastQueue;
import au.org.ala.search.service.queue.LeaderQueue;
import au.org.ala.search.service.remote.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Integration test for the {@link AdminController} endpoints not already covered elsewhere.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class AdminControllerIntegrationTest extends AbstractIntegrationTestContainers {

    @MockBean
    private AuthService authService;

    @MockBean
    private QualityDataService qualityDataService;

    @MockBean
    private LeaderQueue leaderQueue;

    @MockBean
    private ConfigService configService;

    @MockBean
    private BannerService bannerService;

    @MockBean
    private AuditService auditService;

    @MockBean
    private QueueDataService queueDataService;

    @MockBean
    private BroadcastQueue broadcastQueue;

    @MockBean
    private ElasticService elasticService;

    @MockBean
    private TaxonDataService taxonDataService;

    @MockBean
    private UserDataService userDataService;

    @MockBean
    private ScaffoldService scaffoldService;

    @MockBean
    private RabbitTemplate rabbitTemplate;

    @MockBean
    private CollectoryCache collectoryCache;

    @MockBean
    private ListCache listCache;

    @Autowired
    private TestRestTemplate restTemplate;

    @BeforeEach
    void resetMocks() {
        reset(authService, qualityDataService, leaderQueue, configService, bannerService, auditService,
                queueDataService, broadcastQueue, elasticService, taxonDataService, userDataService,
                scaffoldService, rabbitTemplate, collectoryCache, listCache);
        when(authService.isAdmin(any())).thenReturn(true);
    }

    private QualityProfile profile(long id, String shortName) {
        return QualityProfile.builder().id(id).shortName(shortName).name("ALA General").enabled(true).build();
    }

    @Test
    void dqGet_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/dq", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void dqGet_admin_returnsAllProfiles() {
        when(qualityDataService.getProfiles()).thenReturn(List.of(profile(441L, "ALA")));

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/admin/dq", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).get("shortName")).isEqualTo("ALA");
    }

    @Test
    void dqDelete_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/dq?id=441", HttpMethod.DELETE, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void dqDelete_unknownProfile_returnsNotFound() {
        when(qualityDataService.getProfile("999")).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/dq?id=999", HttpMethod.DELETE, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void dqDelete_success_returnsOk() throws Exception {
        when(qualityDataService.getProfile("441")).thenReturn(profile(441L, "ALA"));
        when(qualityDataService.getCacheRefreshLatch()).thenReturn(new CountDownLatch(0));
        when(leaderQueue.sendRpcMessage(eq(TaskType.DATA_QUALITY_DELETE), any())).thenReturn(Map.of("status", "success"));
        when(qualityDataService.getProfileNow("ALA")).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/dq?id=441", HttpMethod.DELETE, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void dqDelete_rpcError_returnsInternalServerError() throws Exception {
        when(qualityDataService.getProfile("441")).thenReturn(profile(441L, "ALA"));
        when(qualityDataService.getCacheRefreshLatch()).thenReturn(new CountDownLatch(0));
        when(leaderQueue.sendRpcMessage(eq(TaskType.DATA_QUALITY_DELETE), any())).thenReturn(Map.of("status", "error"));

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/dq?id=441", HttpMethod.DELETE, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Test
    void dqDelete_rpcTimeout_returnsAccepted() throws Exception {
        when(qualityDataService.getProfile("441")).thenReturn(profile(441L, "ALA"));
        when(qualityDataService.getCacheRefreshLatch()).thenReturn(new CountDownLatch(0));
        when(leaderQueue.sendRpcMessage(eq(TaskType.DATA_QUALITY_DELETE), any())).thenReturn(Map.of("status", "timeout"));

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/dq?id=441", HttpMethod.DELETE, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
    }

    @Test
    void dqPost_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/dq", HttpMethod.POST, new HttpEntity<>(profile(0L, "NEW")), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void dqPost_success_returnsSavedProfile() throws Exception {
        QualityProfile toSave = profile(0L, "NEW");
        QualityProfile saved = profile(500L, "NEW");
        when(leaderQueue.sendRpcMessage(eq(TaskType.DATA_QUALITY_SAVE), any())).thenReturn(Map.of("status", "success"));
        when(qualityDataService.getProfileNow("NEW")).thenReturn(saved);

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/admin/dq", HttpMethod.POST, new HttpEntity<>(toSave), new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().get("shortName")).isEqualTo("NEW");
    }

    @Test
    void dqPost_rpcError_returnsInternalServerError() throws Exception {
        QualityProfile toSave = profile(0L, "NEW");
        when(leaderQueue.sendRpcMessage(eq(TaskType.DATA_QUALITY_SAVE), any())).thenReturn(Map.of("status", "error"));

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/dq", HttpMethod.POST, new HttpEntity<>(toSave), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Test
    void configGet_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/config", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void configPost_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ConfigData cd = new ConfigData();
        cd.id = "some.key";
        cd.value = "true";

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/config", HttpMethod.POST, new HttpEntity<>(cd), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void configGet_returnsAllConfig() {
        ConfigData cd = new ConfigData();
        cd.id = "some.key";
        cd.value = "true";
        when(configService.getAll()).thenReturn(List.of(cd));

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/admin/config", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).get("id")).isEqualTo("some.key");
    }

    @Test
    void configPost_success_returnsOk() {
        ConfigData cd = new ConfigData();
        cd.id = "some.key";
        cd.value = "true";

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/config", HttpMethod.POST, new HttpEntity<>(cd), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(configService).save(any(ConfigData.class), any());
    }

    @Test
    void configPost_serviceThrows_returnsBadRequest() {
        ConfigData cd = new ConfigData();
        cd.id = "some.key";
        doThrow(new RuntimeException("bad value")).when(configService).save(any(ConfigData.class), any());

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/config", HttpMethod.POST, new HttpEntity<>(cd), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void bannerUpdate_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        BannerRequest request = new BannerRequest();
        request.setSection("global");
        request.setMessage("Should not be saved");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/banner", HttpMethod.POST, new HttpEntity<>(request), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verifyNoInteractions(bannerService);
    }

    @Test
    void bannerUpdate_success_returnsOk() {
        BannerRequest request = new BannerRequest();
        request.setSection("global");
        request.setMessage("Scheduled maintenance");
        request.setSeverity("WARNING");
        request.setClosable(true);

        ResponseEntity<Void> resp = restTemplate.exchange(
                "/admin/banner", HttpMethod.POST, new HttpEntity<>(request), Void.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(bannerService).save(eq("global"), eq("Scheduled maintenance"), eq("WARNING"), eq(true), any());
    }

    @Test
    void bannerUpdate_invalidSection_returnsBadRequest() {
        doThrow(new IllegalArgumentException("invalid section")).when(bannerService)
                .save(anyString(), any(), any(), anyBoolean(), any());

        BannerRequest request = new BannerRequest();
        request.setSection("not-a-real-section");
        request.setMessage("test");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/banner", HttpMethod.POST, new HttpEntity<>(request), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void auditHistory_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/audit?entityTable=config", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void auditHistory_returnsPagedResults() {
        AuditEntry entry = new AuditEntry();
        entry.setEntityTable("config");
        entry.setActor("test-actor");
        when(auditService.search(any(), any(), any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(new PageImpl<>(new java.util.ArrayList<>(List.of(entry)), PageRequest.of(0, 20), 1));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/admin/audit?entityTable=config", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsKey("content");
    }

    @Test
    void tasks_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/tasks", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void tasks_returnsPagedQueueItems() {
        QueueItem item = new QueueItem();
        item.id = UUID.randomUUID();
        item.status = StatusCode.FINISHED;
        item.created = new Date();
        item.queueRequest = QueueRequest.builder().taskType(TaskType.SEARCH_DOWNLOAD)
                .searchQueueRequest(new SearchQueueRequest()).build();
        when(queueDataService.list(isNull(), any(), any(), any(), any(), anyLong(), anyLong()))
                .thenReturn(new PageImpl<>(new java.util.ArrayList<>(List.of(item)), PageRequest.of(0, 20), 1));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/admin/tasks", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsKey("content");
    }

    @Test
    void cancelTask_sendsCancelBroadcastMessage() {
        ResponseEntity<Void> resp = restTemplate.exchange(
                "/admin/task?id=123", HttpMethod.DELETE, null, Void.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(broadcastQueue).sendMessage(TaskType.CANCEL_CONSUMER, "123");
    }

    @Test
    void cancelTask_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/task?id=123", HttpMethod.DELETE, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void dashboard_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/admin/info", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void dashboard_admin_returnsTablesAndElasticsearchInfo() {
        when(elasticService.indexFields(true)).thenReturn(List.of(
                new IndexedField("guid", "string", true, true, null)));
        when(elasticService.queryCount(eq("idxtype"), any())).thenReturn(0L);
        when(taxonDataService.count()).thenReturn(10L);
        when(configService.count()).thenReturn(5L);
        when(qualityDataService.count()).thenReturn(1L);
        when(queueDataService.count()).thenReturn(2L);
        when(userDataService.count()).thenReturn(3L);
        when(scaffoldService.count(any())).thenReturn(0L);

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/admin/info", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsKey("elasticsearch");
        assertThat(resp.getBody()).containsKey("tables");

        Map<String, Object> tables = (Map<String, Object>) resp.getBody().get("tables");
        assertThat(((Number) tables.get("taxon_data")).longValue()).isEqualTo(10L);
    }
}
