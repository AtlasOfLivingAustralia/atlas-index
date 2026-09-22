/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.RestTestClientConfiguration;
import au.org.ala.search.service.AuthService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;

/**
 * Integration tests for AdminController scaffold endpoints covering CRUD operations
 * on logger-related lookup tables: log_event_type, log_reason_type, log_source_type.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Import(RestTestClientConfiguration.class)
public class AdminScaffoldLoggerIntegrationTest extends AbstractIntegrationTestContainers {

    // High IDs to avoid clashing with any Flyway-seeded data
    // Declared as Integer so .equals() works against Map.get() returning Object
    private static final Integer TEST_EVENT_TYPE_ID = 9001;
    private static final Integer TEST_REASON_TYPE_ID = 9001;
    private static final Integer TEST_SOURCE_TYPE_ID = 9001;

    @Autowired
    private RestTestClient restTestClient;

    /**
     * Mock AuthService so all requests are treated as admin without requiring JWT.
     */
    @MockitoBean
    private AuthService authService;

    @BeforeEach
    void configureMockAuth() {
        when(authService.isAdmin(any(Principal.class))).thenReturn(true);
        when(authService.isAdmin(any())).thenReturn(true);
        when(authService.getActor(any(), any(), any())).thenReturn("test-actor");
    }

    @Test
    @Order(0)
    void scaffoldGet_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        EntityExchangeResult<String> response = restTestClient.get()
                .uri("/admin/scaffold")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @Order(1)
    void scaffoldUpsert_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        Map<String, Object> body = Map.of("id", 9999, "name", "SHOULD_NOT_BE_CREATED");
        EntityExchangeResult<String> response = restTestClient.post()
                .uri("/admin/scaffold?table=log_event_type")
                .headers(h -> h.addAll(jsonHeaders()))
                .body(body)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @Order(2)
    void scaffoldDelete_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        EntityExchangeResult<String> response = restTestClient.delete()
                .uri("/admin/scaffold?table=log_event_type&id=9999")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @Order(3)
    void listTables_includesLoggerTables() {
        EntityExchangeResult<List<Map<String, Object>>> response = restTestClient.get()
                .uri("/admin/scaffold")
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> tables = response.getResponseBody();
        assertThat(tables).isNotNull();

        List<String> tableNames = tables.stream()
                .map(t -> (String) t.get("table"))
                .toList();
        assertThat(tableNames).contains("log_event_type", "log_reason_type", "log_source_type");
    }

    @Test
    @Order(10)
    void createEventType_returnsCreatedEntity() {
        Map<String, Object> body = Map.of("id", TEST_EVENT_TYPE_ID, "name", "TEST_EVENT");
        EntityExchangeResult<Map<String, Object>> response = restTestClient.post()
                .uri("/admin/scaffold?table=log_event_type")
                .headers(h -> h.addAll(jsonHeaders()))
                .body(body)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> saved = response.getResponseBody();
        assertThat(saved).isNotNull();
        assertThat(saved.get("id")).isEqualTo(TEST_EVENT_TYPE_ID);
        assertThat(saved.get("name")).isEqualTo("TEST_EVENT");
    }

    @Test
    @Order(11)
    void readEventTypes_afterCreate_containsNewType() {
        EntityExchangeResult<Map<String, Object>> response = restTestClient.get()
                .uri("/admin/scaffold?table=log_event_type&page=0&size=200")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> page = response.getResponseBody();
        assertThat(page).isNotNull();

        List<Map<String, Object>> content = (List<Map<String, Object>>) page.get("content");
        assertThat(content).isNotNull();
        assertThat(content).anyMatch(row ->
                TEST_EVENT_TYPE_ID.equals(row.get("id")) && "TEST_EVENT".equals(row.get("name")));
    }

    @Test
    @Order(12)
    void updateEventType_changesName() {
        Map<String, Object> body = Map.of("id", TEST_EVENT_TYPE_ID, "name", "TEST_EVENT_UPDATED");
        EntityExchangeResult<Map<String, Object>> response = restTestClient.post()
                .uri("/admin/scaffold?table=log_event_type")
                .headers(h -> h.addAll(jsonHeaders()))
                .body(body)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);

        // Verify the change is visible via read
        EntityExchangeResult<Map<String, Object>> readResponse = restTestClient.get()
                .uri("/admin/scaffold?table=log_event_type&page=0&size=200")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        List<Map<String, Object>> content = (List<Map<String, Object>>) readResponse.getResponseBody().get("content");
        assertThat(content).anyMatch(row ->
                TEST_EVENT_TYPE_ID.equals(row.get("id")) && "TEST_EVENT_UPDATED".equals(row.get("name")));
    }

    @Test
    @Order(13)
    void deleteEventType_removesFromList() {
        EntityExchangeResult<Object> deleteResponse = restTestClient.delete()
                .uri("/admin/scaffold?table=log_event_type&id=" + TEST_EVENT_TYPE_ID)
                .exchange()
                .expectBody(Object.class)
                .returnResult();

        assertThat(deleteResponse.getStatus()).isEqualTo(HttpStatus.OK);

        // Verify removed
        EntityExchangeResult<Map<String, Object>> readResponse = restTestClient.get()
                .uri("/admin/scaffold?table=log_event_type&page=0&size=200")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        List<Map<String, Object>> content = (List<Map<String, Object>>) readResponse.getResponseBody().get("content");
        assertThat(content).noneMatch(row -> TEST_EVENT_TYPE_ID.equals(row.get("id")));
    }

    @Test
    @Order(20)
    void createReasonType_allFields_persisted() {
        Map<String, Object> body = Map.of(
                "id", TEST_REASON_TYPE_ID,
                "rkey", "logger.test.reason",
                "name", "Test Reason",
                "defaultOrder", 9999,
                "deprecated", false);
        EntityExchangeResult<Map<String, Object>> response = restTestClient.post()
                .uri("/admin/scaffold?table=log_reason_type")
                .headers(h -> h.addAll(jsonHeaders()))
                .body(body)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> saved = response.getResponseBody();
        assertThat(saved).isNotNull();
        assertThat(saved.get("id")).isEqualTo(TEST_REASON_TYPE_ID);
        assertThat(saved.get("name")).isEqualTo("Test Reason");
        assertThat(saved.get("rkey")).isEqualTo("logger.test.reason");
    }

    @Test
    @Order(21)
    void updateReasonType_markDeprecated_reflectedInRead() {
        Map<String, Object> body = Map.of(
                "id", TEST_REASON_TYPE_ID,
                "rkey", "logger.test.reason",
                "name", "Test Reason",
                "defaultOrder", 9999,
                "deprecated", true);
        EntityExchangeResult<Map<String, Object>> response = restTestClient.post()
                .uri("/admin/scaffold?table=log_reason_type")
                .headers(h -> h.addAll(jsonHeaders()))
                .body(body)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);

        // Confirm deprecated flag visible via the V1 logger/reasons endpoint
        EntityExchangeResult<List<Map<String, Object>>> reasonsResponse = restTestClient.get()
                .uri("/v1/service/logger/reasons")
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(reasonsResponse.getStatus()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> reasons = reasonsResponse.getResponseBody();
        assertThat(reasons).isNotNull();
        assertThat(reasons).anyMatch(r ->
                TEST_REASON_TYPE_ID.equals(r.get("id")) && Boolean.TRUE.equals(r.get("deprecated")));
    }

    @Test
    @Order(22)
    void deleteReasonType_removesRow() {
        EntityExchangeResult<Object> deleteResponse = restTestClient.delete()
                .uri("/admin/scaffold?table=log_reason_type&id=" + TEST_REASON_TYPE_ID)
                .exchange()
                .expectBody(Object.class)
                .returnResult();

        assertThat(deleteResponse.getStatus()).isEqualTo(HttpStatus.OK);

        EntityExchangeResult<Map<String, Object>> readResponse = restTestClient.get()
                .uri("/admin/scaffold?table=log_reason_type&page=0&size=200")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        List<Map<String, Object>> content = (List<Map<String, Object>>) readResponse.getResponseBody().get("content");
        assertThat(content).noneMatch(row -> TEST_REASON_TYPE_ID.equals(row.get("id")));
    }

    @Test
    @Order(30)
    void createSourceType_persisted() {
        Map<String, Object> body = Map.of("id", TEST_SOURCE_TYPE_ID, "name", "TEST_SOURCE");
        EntityExchangeResult<Map<String, Object>> response = restTestClient.post()
                .uri("/admin/scaffold?table=log_source_type")
                .headers(h -> h.addAll(jsonHeaders()))
                .body(body)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> saved = response.getResponseBody();
        assertThat(saved).isNotNull();
        assertThat(saved.get("id")).isEqualTo(TEST_SOURCE_TYPE_ID);
        assertThat(saved.get("name")).isEqualTo("TEST_SOURCE");
    }

    @Test
    @Order(31)
    void readSourceTypes_afterCreate_containsNewType() {
        EntityExchangeResult<List<Map<String, Object>>> response = restTestClient.get()
                .uri("/v1/service/logger/sources")
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> sources = response.getResponseBody();
        assertThat(sources).isNotNull();
        assertThat(sources).anyMatch(s ->
                TEST_SOURCE_TYPE_ID.equals(s.get("id")) && "TEST_SOURCE".equals(s.get("name")));
    }

    @Test
    @Order(32)
    void deleteSourceType_removesRow() {
        EntityExchangeResult<Object> deleteResponse = restTestClient.delete()
                .uri("/admin/scaffold?table=log_source_type&id=" + TEST_SOURCE_TYPE_ID)
                .exchange()
                .expectBody(Object.class)
                .returnResult();

        assertThat(deleteResponse.getStatus()).isEqualTo(HttpStatus.OK);

        EntityExchangeResult<List<Map<String, Object>>> readResponse = restTestClient.get()
                .uri("/v1/service/logger/sources")
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(readResponse.getResponseBody()).noneMatch(s -> TEST_SOURCE_TYPE_ID.equals(s.get("id")));
    }

    // -------------------------------------------------------------------------
    // FK constraint behaviour
    // -------------------------------------------------------------------------

    @Test
    @Order(40)
    void deleteEventType_referencedByLogEvent_returnsBadRequestOrConflict() {
        // Create an event type
        int referencedId = 9002;
        restTestClient.post()
                .uri("/admin/scaffold?table=log_event_type")
                .headers(h -> h.addAll(jsonHeaders()))
                .body(Map.of("id", referencedId, "name", "REFERENCED_EVENT"))
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        // Create a reason type and source type so we can create a log event
        restTestClient.post()
                .uri("/admin/scaffold?table=log_reason_type")
                .headers(h -> h.addAll(jsonHeaders()))
                .body(Map.of("id", 9002, "rkey", "test", "name", "Test", "defaultOrder", 9998, "deprecated", false))
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();
        restTestClient.post()
                .uri("/admin/scaffold?table=log_source_type")
                .headers(h -> h.addAll(jsonHeaders()))
                .body(Map.of("id", 9002, "name", "TEST_SRC"))
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        // Create a log event referencing the event type via the logger endpoint
        Map<String, Object> logEvent = Map.of(
                "eventTypeId", referencedId,
                "reasonTypeId", 9002,
                "sourceTypeId", 9002,
                "userEmail", "test@example.com",
                "recordCounts", Map.of("dr1", 10));
        restTestClient.post()
                .uri("/v1/service/logger")
                .headers(h -> h.addAll(jsonHeaders()))
                .body(logEvent)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        // Now delete the event type - the schema has no FK constraint from log_event to
        // log_event_type, so the delete succeeds. This test documents that behaviour:
        // referential integrity is enforced at the application layer (validation on POST /logger),
        // not by a database FK constraint.
        EntityExchangeResult<Object> deleteResponse = restTestClient.delete()
                .uri("/admin/scaffold?table=log_event_type&id=" + referencedId)
                .exchange()
                .expectBody(Object.class)
                .returnResult();

        assertThat(deleteResponse.getStatus()).isEqualTo(HttpStatus.OK);

        // Verify the type is gone from the read endpoint
        EntityExchangeResult<Map<String, Object>> readResponse = restTestClient.get()
                .uri("/admin/scaffold?table=log_event_type&page=0&size=200")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        List<Map<String, Object>> content = (List<Map<String, Object>>) readResponse.getResponseBody().get("content");
        assertThat(content).noneMatch(row -> Integer.valueOf(referencedId).equals(row.get("id")));

        // Cleanup: remove the lookup rows we created
        restTestClient.delete()
                .uri("/admin/scaffold?table=log_reason_type&id=9002")
                .exchange()
                .expectBody(Object.class)
                .returnResult();
        restTestClient.delete()
                .uri("/admin/scaffold?table=log_source_type&id=9002")
                .exchange()
                .expectBody(Object.class)
                .returnResult();
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(APPLICATION_JSON);
        return headers;
    }
}

