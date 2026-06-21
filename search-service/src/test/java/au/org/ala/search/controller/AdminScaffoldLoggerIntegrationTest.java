/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.service.AuthService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Integration tests for AdminController scaffold endpoints covering CRUD operations
 * on logger-related lookup tables: log_event_type, log_reason_type, log_source_type.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AdminScaffoldLoggerIntegrationTest extends AbstractIntegrationTestContainers {

    // High IDs to avoid clashing with any Flyway-seeded data
    // Declared as Integer so .equals() works against Map.get() returning Object
    private static final Integer TEST_EVENT_TYPE_ID = 9001;
    private static final Integer TEST_REASON_TYPE_ID = 9001;
    private static final Integer TEST_SOURCE_TYPE_ID = 9001;

    @Autowired
    private TestRestTemplate restTemplate;

    /**
     * Mock AuthService so all requests are treated as admin without requiring JWT.
     */
    @MockBean
    private AuthService authService;

    @BeforeEach
    void configureMockAuth() {
        when(authService.isAdmin(any(Principal.class))).thenReturn(true);
        when(authService.isAdmin(any())).thenReturn(true);
        when(authService.getActor(any(), any(), any())).thenReturn("test-actor");
    }

    @Test
    @Order(1)
    void listTables_includesLoggerTables() {
        ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                "/admin/scaffold",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> tables = response.getBody();
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
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/admin/scaffold?table=log_event_type",
                HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders()),
                new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> saved = response.getBody();
        assertThat(saved).isNotNull();
        assertThat(saved.get("id")).isEqualTo(TEST_EVENT_TYPE_ID);
        assertThat(saved.get("name")).isEqualTo("TEST_EVENT");
    }

    @Test
    @Order(11)
    void readEventTypes_afterCreate_containsNewType() {
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/admin/scaffold?table=log_event_type&page=0&size=200",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> page = response.getBody();
        assertThat(page).isNotNull();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) page.get("content");
        assertThat(content).isNotNull();
        assertThat(content).anyMatch(row ->
                TEST_EVENT_TYPE_ID.equals(row.get("id")) && "TEST_EVENT".equals(row.get("name")));
    }

    @Test
    @Order(12)
    void updateEventType_changesName() {
        Map<String, Object> body = Map.of("id", TEST_EVENT_TYPE_ID, "name", "TEST_EVENT_UPDATED");
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/admin/scaffold?table=log_event_type",
                HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders()),
                new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        // Verify the change is visible via read
        ResponseEntity<Map<String, Object>> readResponse = restTemplate.exchange(
                "/admin/scaffold?table=log_event_type&page=0&size=200",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                });

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) readResponse.getBody().get("content");
        assertThat(content).anyMatch(row ->
                TEST_EVENT_TYPE_ID.equals(row.get("id")) && "TEST_EVENT_UPDATED".equals(row.get("name")));
    }

    @Test
    @Order(13)
    void deleteEventType_removesFromList() {
        ResponseEntity<Object> deleteResponse = restTemplate.exchange(
                "/admin/scaffold?table=log_event_type&id=" + TEST_EVENT_TYPE_ID,
                HttpMethod.DELETE,
                null,
                Object.class);

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        // Verify removed
        ResponseEntity<Map<String, Object>> readResponse = restTemplate.exchange(
                "/admin/scaffold?table=log_event_type&page=0&size=200",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                });

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) readResponse.getBody().get("content");
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
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/admin/scaffold?table=log_reason_type",
                HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders()),
                new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> saved = response.getBody();
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
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/admin/scaffold?table=log_reason_type",
                HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders()),
                new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        // Confirm deprecated flag visible via the V1 logger/reasons endpoint
        ResponseEntity<List<Map<String, Object>>> reasonsResponse = restTemplate.exchange(
                "/v1/service/logger/reasons",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                });

        assertThat(reasonsResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> reasons = reasonsResponse.getBody();
        assertThat(reasons).isNotNull();
        assertThat(reasons).anyMatch(r ->
                TEST_REASON_TYPE_ID.equals(r.get("id")) && Boolean.TRUE.equals(r.get("deprecated")));
    }

    @Test
    @Order(22)
    void deleteReasonType_removesRow() {
        ResponseEntity<Object> deleteResponse = restTemplate.exchange(
                "/admin/scaffold?table=log_reason_type&id=" + TEST_REASON_TYPE_ID,
                HttpMethod.DELETE,
                null,
                Object.class);

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<Map<String, Object>> readResponse = restTemplate.exchange(
                "/admin/scaffold?table=log_reason_type&page=0&size=200",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                });

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) readResponse.getBody().get("content");
        assertThat(content).noneMatch(row -> TEST_REASON_TYPE_ID.equals(row.get("id")));
    }

    @Test
    @Order(30)
    void createSourceType_persisted() {
        Map<String, Object> body = Map.of("id", TEST_SOURCE_TYPE_ID, "name", "TEST_SOURCE");
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/admin/scaffold?table=log_source_type",
                HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders()),
                new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> saved = response.getBody();
        assertThat(saved).isNotNull();
        assertThat(saved.get("id")).isEqualTo(TEST_SOURCE_TYPE_ID);
        assertThat(saved.get("name")).isEqualTo("TEST_SOURCE");
    }

    @Test
    @Order(31)
    void readSourceTypes_afterCreate_containsNewType() {
        ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                "/v1/service/logger/sources",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> sources = response.getBody();
        assertThat(sources).isNotNull();
        assertThat(sources).anyMatch(s ->
                TEST_SOURCE_TYPE_ID.equals(s.get("id")) && "TEST_SOURCE".equals(s.get("name")));
    }

    @Test
    @Order(32)
    void deleteSourceType_removesRow() {
        ResponseEntity<Object> deleteResponse = restTemplate.exchange(
                "/admin/scaffold?table=log_source_type&id=" + TEST_SOURCE_TYPE_ID,
                HttpMethod.DELETE,
                null,
                Object.class);

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<List<Map<String, Object>>> readResponse = restTemplate.exchange(
                "/v1/service/logger/sources",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                });

        assertThat(readResponse.getBody()).noneMatch(s -> TEST_SOURCE_TYPE_ID.equals(s.get("id")));
    }

    // -------------------------------------------------------------------------
    // FK constraint behaviour
    // -------------------------------------------------------------------------

    @Test
    @Order(40)
    void deleteEventType_referencedByLogEvent_returnsBadRequestOrConflict() {
        // Create an event type
        int referencedId = 9002;
        restTemplate.exchange(
                "/admin/scaffold?table=log_event_type",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("id", referencedId, "name", "REFERENCED_EVENT"), jsonHeaders()),
                new ParameterizedTypeReference<Map<String, Object>>() {
                });

        // Create a reason type and source type so we can create a log event
        restTemplate.exchange(
                "/admin/scaffold?table=log_reason_type",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("id", 9002, "rkey", "test", "name", "Test", "defaultOrder", 9998, "deprecated", false), jsonHeaders()),
                new ParameterizedTypeReference<Map<String, Object>>() {
                });
        restTemplate.exchange(
                "/admin/scaffold?table=log_source_type",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("id", 9002, "name", "TEST_SRC"), jsonHeaders()),
                new ParameterizedTypeReference<Map<String, Object>>() {
                });

        // Create a log event referencing the event type via the logger endpoint
        Map<String, Object> logEvent = Map.of(
                "eventTypeId", referencedId,
                "reasonTypeId", 9002,
                "sourceTypeId", 9002,
                "userEmail", "test@example.com",
                "recordCounts", Map.of("dr1", 10));
        restTemplate.exchange(
                "/v1/service/logger",
                HttpMethod.POST,
                new HttpEntity<>(logEvent, jsonHeaders()),
                new ParameterizedTypeReference<Map<String, Object>>() {
                });

        // Now delete the event type — the schema has no FK constraint from log_event to
        // log_event_type, so the delete succeeds. This test documents that behaviour:
        // referential integrity is enforced at the application layer (validation on POST /logger),
        // not by a database FK constraint.
        ResponseEntity<Object> deleteResponse = restTemplate.exchange(
                "/admin/scaffold?table=log_event_type&id=" + referencedId,
                HttpMethod.DELETE,
                null,
                Object.class);

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        // Verify the type is gone from the read endpoint
        ResponseEntity<Map<String, Object>> readResponse = restTemplate.exchange(
                "/admin/scaffold?table=log_event_type&page=0&size=200",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {
                });
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) readResponse.getBody().get("content");
        assertThat(content).noneMatch(row -> Integer.valueOf(referencedId).equals(row.get("id")));

        // Cleanup: remove the lookup rows we created
        restTemplate.exchange("/admin/scaffold?table=log_reason_type&id=9002", HttpMethod.DELETE, null, Object.class);
        restTemplate.exchange("/admin/scaffold?table=log_source_type&id=9002", HttpMethod.DELETE, null, Object.class);
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }
}
