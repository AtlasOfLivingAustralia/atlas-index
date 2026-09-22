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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import au.org.ala.search.RestTestClientConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;

import java.security.Principal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;

/**
 * Integration tests for V1LoggerController.
 * <p>
 * Tests cover creating log events, querying event/reason/source type lists,
 * and verifying breakdown and totals endpoints after summary processing.
 * <p>
 * Lookup types are seeded via the AdminController scaffold. Events are created
 * via the V1 logger endpoint using localhost IP (permitted without auth via test
 * properties: logger.permitted.ips=127.0.0.1).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Import(RestTestClientConfiguration.class)
public class LoggerControllerIntegrationTest extends AbstractIntegrationTestContainers {

    // Lookup IDs used across all tests.
    // Declared as Integer so .equals() works against Map.get() returning Object.
    static final Integer EVENT_TYPE_ID = 1002;
    static final Integer REASON_TYPE_ID_RESEARCH = 4;
    static final Integer REASON_TYPE_ID_EDUCATION = 3;
    static final Integer SOURCE_TYPE_ID = 0;
    static final String ENTITY_UID = "dr100";

    @Autowired
    private RestTestClient restTestClient;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private AuthService authService;

    @BeforeEach
    void configureMockAuth() {
        when(authService.isAdmin(any(Principal.class))).thenReturn(true);
        when(authService.isAdmin(any())).thenReturn(true);
        when(authService.getActor(any(), any(), any())).thenReturn("test-actor");
    }

    @BeforeAll
    static void seedLookupTypes(@Autowired RestTestClient restTestClient,
                                @Autowired AuthService authService) {
        // Configure the mock for this static lifecycle method — @BeforeEach hasn't run yet.
        when(authService.isAdmin(any())).thenReturn(true);
        when(authService.getActor(any(), any(), any())).thenReturn("test-actor");

        // Seed a minimal set of lookup types used by the tests.
        // Uses high IDs to avoid clashing with production data seeded by Flyway.
        // The AdminController scaffold is used so we test via the real API surface.
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(APPLICATION_JSON);

        postScaffold(restTestClient, headers, "log_event_type",
                Map.of("id", EVENT_TYPE_ID, "name", "OCCURRENCE_RECORDS_DOWNLOADED"));
        postScaffold(restTestClient, headers, "log_reason_type",
                Map.of("id", REASON_TYPE_ID_RESEARCH, "rkey", "logger.download.reason.research",
                        "name", "scientific research", "defaultOrder", 1000, "deprecated", false));
        postScaffold(restTestClient, headers, "log_reason_type",
                Map.of("id", REASON_TYPE_ID_EDUCATION, "rkey", "logger.download.reason.education",
                        "name", "education", "defaultOrder", 600, "deprecated", false));
        postScaffold(restTestClient, headers, "log_source_type",
                Map.of("id", SOURCE_TYPE_ID, "name", "ALA"));
    }

    private static void postScaffold(RestTestClient restTestClient, HttpHeaders headers,
                                     String table, Map<String, Object> body) {
        restTestClient.post()
                .uri("/admin/scaffold?table=" + table)
                .headers(h -> h.addAll(headers))
                .body(body)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();
    }

    @Test
    @Order(1)
    void listEventTypes_returnsSeededType() {
        EntityExchangeResult<List<Map<String, Object>>> response = restTestClient.get()
                .uri("/v1/service/logger/events")
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> types = response.getResponseBody();
        assertThat(types).isNotNull().isNotEmpty();
        assertThat(types).anyMatch(t ->
                EVENT_TYPE_ID.equals(t.get("id")) && "OCCURRENCE_RECORDS_DOWNLOADED".equals(t.get("name")));
    }

    @Test
    @Order(2)
    void listReasonTypes_returnsSeededTypesWithCorrectFields() {
        EntityExchangeResult<List<Map<String, Object>>> response = restTestClient.get()
                .uri("/v1/service/logger/reasons")
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> reasons = response.getResponseBody();
        assertThat(reasons).isNotNull().isNotEmpty();

        // Verify expected fields are present
        Map<String, Object> research = reasons.stream()
                .filter(r -> REASON_TYPE_ID_RESEARCH.equals(r.get("id")))
                .findFirst().orElse(null);
        assertThat(research).isNotNull();
        assertThat(research.get("name")).isEqualTo("scientific research");
        assertThat(research.get("rkey")).isEqualTo("logger.download.reason.research");
        assertThat(research.get("deprecated")).isEqualTo(false);
    }

    @Test
    @Order(3)
    void listSourceTypes_returnsSeededType() {
        EntityExchangeResult<List<Map<String, Object>>> response = restTestClient.get()
                .uri("/v1/service/logger/sources")
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> sources = response.getResponseBody();
        assertThat(sources).isNotNull().isNotEmpty();
        assertThat(sources).anyMatch(s ->
                SOURCE_TYPE_ID.equals(s.get("id")) && "ALA".equals(s.get("name")));
    }

    @Test
    @Order(10)
    void createLogEvent_validPayload_returns200WithId() {
        Map<String, Object> payload = buildLogEvent(EVENT_TYPE_ID, REASON_TYPE_ID_RESEARCH, SOURCE_TYPE_ID,
                "user@example.com", Map.of(ENTITY_UID, 100));

        EntityExchangeResult<Map<String, Object>> response = postLogEvent(payload);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getResponseBody();
        assertThat(body).isNotNull();
        assertThat(body).containsKey("id");
        assertThat(((Number) body.get("id")).longValue()).isGreaterThan(0L);
    }

    @Test
    @Order(11)
    void createLogEvent_multipleRecordCounts_returnsId() {
        // Multiple entities in recordCounts — each becomes a log_detail row.
        // Correctness of detail creation is verified indirectly via breakdown endpoints after summary processing.
        Map<String, Object> payload = buildLogEvent(EVENT_TYPE_ID, REASON_TYPE_ID_RESEARCH, SOURCE_TYPE_ID,
                "researcher@university.edu.au",
                Map.of("dr200", 50, "dr201", 75));

        EntityExchangeResult<Map<String, Object>> response = postLogEvent(payload);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(response.getResponseBody()).containsKey("id");
    }

    @Test
    @Order(12)
    void createLogEvent_invalidEventType_returns400() {
        Map<String, Object> payload = buildLogEvent(99999, REASON_TYPE_ID_RESEARCH, SOURCE_TYPE_ID,
                "user@example.com", Map.of(ENTITY_UID, 10));

        EntityExchangeResult<Map<String, Object>> response = postLogEvent(payload);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @Order(13)
    void createLogEvent_invalidReasonType_returns400() {
        Map<String, Object> payload = buildLogEvent(EVENT_TYPE_ID, 99999, SOURCE_TYPE_ID,
                "user@example.com", Map.of(ENTITY_UID, 10));

        EntityExchangeResult<Map<String, Object>> response = postLogEvent(payload);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @Order(14)
    void createLogEvent_invalidSourceType_returns400() {
        Map<String, Object> payload = buildLogEvent(EVENT_TYPE_ID, REASON_TYPE_ID_RESEARCH, 99999,
                "user@example.com", Map.of(ENTITY_UID, 10));

        EntityExchangeResult<Map<String, Object>> response = postLogEvent(payload);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    /**
     * Seeds additional log events and runs processNewEvents to populate summary tables
     * before testing the breakdown endpoints.
     */
    @BeforeAll
    static void seedEventsAndRunSummary(@Autowired RestTestClient restTestClient,
                                        @Autowired JdbcTemplate jdbcTemplate,
                                        @Autowired AuthService authService) {
        when(authService.isAdmin(any())).thenReturn(true);
        when(authService.getActor(any(), any(), any())).thenReturn("test-actor");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(APPLICATION_JSON);

        String currentMonth = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMM"));

        // Create events with varied emails for email breakdown testing
        postLogEventDirect(restTestClient, headers, buildLogEventStatic(EVENT_TYPE_ID, REASON_TYPE_ID_RESEARCH,
                SOURCE_TYPE_ID, "researcher@csiro.au", Map.of(ENTITY_UID, 500), currentMonth));
        postLogEventDirect(restTestClient, headers, buildLogEventStatic(EVENT_TYPE_ID, REASON_TYPE_ID_EDUCATION,
                SOURCE_TYPE_ID, "student@university.edu.au", Map.of(ENTITY_UID, 200), currentMonth));
        postLogEventDirect(restTestClient, headers, buildLogEventStatic(EVENT_TYPE_ID, REASON_TYPE_ID_RESEARCH,
                SOURCE_TYPE_ID, "user@gmail.com", Map.of(ENTITY_UID, 100), currentMonth));

        // Trigger summary table update via JdbcTemplate — bypasses JPA transaction
        // requirement so the stored procedure's internal COMMITs are allowed.
        jdbcTemplate.execute("CALL process_new_events()");
    }

    @Test
    @Order(50)
    void totalsByType_afterProcessing_containsEventTypeWithCounts() {
        EntityExchangeResult<Map<String, Object>> response = restTestClient.get()
                .uri("/v1/service/totalsByType")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getResponseBody();
        assertThat(body).containsKey("totals");

        Map<String, Object> totals = (Map<String, Object>) body.get("totals");
        // Event type 1002 should have been summarised
        assertThat(totals).containsKey(String.valueOf(EVENT_TYPE_ID));
    }

    @Test
    @Order(51)
    void emailBreakdown_afterProcessing_containsEmailCategories() {
        EntityExchangeResult<Map<String, Object>> response = restTestClient.get()
                .uri("/v1/service/emailBreakdown?eventId=" + EVENT_TYPE_ID + "&entityUid=" + ENTITY_UID)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getResponseBody();
        assertThat(body).containsKeys("all", "thisMonth", "last3Months", "lastYear");

        // The "all" window should contain an emailBreakdown with categories
        Map<String, Object> all = (Map<String, Object>) body.get("all");
        assertThat(all).containsKey("emailBreakdown");

        Map<String, Object> emailBreakdown = (Map<String, Object>) all.get("emailBreakdown");
        // csiro.au maps to "gov", edu.au maps to "edu", gmail.com maps to "other"
        assertThat(emailBreakdown).containsKeys("gov", "edu", "other");

        // Total events across all categories should be > 0
        Number totalEvents = (Number) all.get("events");
        assertThat(totalEvents.longValue()).isGreaterThan(0L);
    }

    @Test
    @Order(52)
    void reasonBreakdown_afterProcessing_containsReasonCategories() {
        EntityExchangeResult<Map<String, Object>> response = restTestClient.get()
                .uri("/v1/service/reasonBreakdown?eventId=" + EVENT_TYPE_ID + "&entityUid=" + ENTITY_UID)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getResponseBody();
        assertThat(body).containsKeys("all", "thisMonth", "last3Months", "lastYear");

        Map<String, Object> all = (Map<String, Object>) body.get("all");
        assertThat(all).containsKey("reasonBreakdown");

        Map<String, Object> reasonBreakdown = (Map<String, Object>) all.get("reasonBreakdown");
        // Both reason types should appear (their names are the keys)
        assertThat(reasonBreakdown).containsKeys("scientific research", "education");

        // scientific research had 2 events, education had 1 — verify research > education in event count
        Number researchEvents = (Number) ((Map<String, Object>) reasonBreakdown.get("scientific research")).get("events");
        Number educationEvents = (Number) ((Map<String, Object>) reasonBreakdown.get("education")).get("events");
        assertThat(researchEvents.longValue()).isGreaterThan(educationEvents.longValue());
    }

    @Test
    @Order(53)
    void reasonBreakdownMonthly_afterProcessing_containsMonthlyData() {
        EntityExchangeResult<Map<String, Object>> response = restTestClient.get()
                .uri("/v1/service/reasonBreakdownMonthly?eventId=" + EVENT_TYPE_ID + "&entityUid=" + ENTITY_UID)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getResponseBody();
        assertThat(body).containsKey("temporalBreakdown");

        Map<String, Object> temporalBreakdown = (Map<String, Object>) body.get("temporalBreakdown");
        assertThat(temporalBreakdown).isNotEmpty();
    }

    @Test
    @Order(54)
    void sourceBreakdown_afterProcessing_containsSourceCategories() {
        EntityExchangeResult<Map<String, Object>> response = restTestClient.get()
                .uri("/v1/service/sourceBreakdown?eventId=" + EVENT_TYPE_ID + "&entityUid=" + ENTITY_UID)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getResponseBody();
        assertThat(body).containsKeys("all", "thisMonth", "last3Months", "lastYear");

        Map<String, Object> all = (Map<String, Object>) body.get("all");
        assertThat(all).containsKey("sourceBreakdown");
        // ALA source (id=0) should be present
        Map<String, Object> sourceBreakdown = (Map<String, Object>) all.get("sourceBreakdown");
        assertThat(sourceBreakdown).containsKey("ALA");
    }

    @Test
    @Order(55)
    void monthlyBreakdown_afterProcessing_containsMonthData() {
        String currentYear = String.valueOf(LocalDate.now().getYear());
        EntityExchangeResult<Map<String, Object>> response = restTestClient.get()
                .uri("/v1/service/logger/get.json?eventTypeId=" + EVENT_TYPE_ID + "&q=" + ENTITY_UID + "&year=" + currentYear)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getResponseBody();
        assertThat(body).containsKey("months");

        List<Object> months = (List<Object>) body.get("months");
        assertThat(months).isNotEmpty();
    }

    @Test
    @Order(56)
    void emailBreakdownCSV_returnsValidCsvContentType() {
        EntityExchangeResult<String> response = restTestClient.get()
                .uri("/v1/service/emailBreakdownCSV?eventId=" + EVENT_TYPE_ID + "&entityUid=" + ENTITY_UID)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(response.getResponseHeaders().getContentType()).isNotNull();
        assertThat(response.getResponseHeaders().getContentType().toString()).contains("text/csv");
        assertThat(response.getResponseBody()).isNotNull();
        // Check CSV header row
        assertThat(response.getResponseBody()).contains("year,month,user category,number of events,number of records");
    }

    @Test
    @Order(57)
    void reasonBreakdownCSV_returnsValidCsvContentType() {
        EntityExchangeResult<String> response = restTestClient.get()
                .uri("/v1/service/reasonBreakdownCSV?eventId=" + EVENT_TYPE_ID + "&entityUid=" + ENTITY_UID)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(response.getResponseHeaders().getContentType()).isNotNull();
        assertThat(response.getResponseHeaders().getContentType().toString()).contains("text/csv");
        assertThat(response.getResponseBody()).contains("year,month,reason,number of events,number of records");
    }

    private EntityExchangeResult<Map<String, Object>> postLogEvent(Map<String, Object> payload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(APPLICATION_JSON);
        return restTestClient.post()
                .uri("/v1/service/logger")
                .headers(h -> h.addAll(headers))
                .body(payload)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();
    }

    private static void postLogEventDirect(RestTestClient restTestClient, HttpHeaders headers,
                                           Map<String, Object> payload) {
        restTestClient.post()
                .uri("/v1/service/logger")
                .headers(h -> h.addAll(headers))
                .body(payload)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();
    }

    private Map<String, Object> buildLogEvent(int eventTypeId, int reasonTypeId, int sourceTypeId,
                                              String email, Map<String, Integer> recordCounts) {
        return buildLogEventStatic(eventTypeId, reasonTypeId, sourceTypeId, email, recordCounts, null);
    }

    private static Map<String, Object> buildLogEventStatic(int eventTypeId, int reasonTypeId, int sourceTypeId,
                                                           String email, Map<String, Integer> recordCounts,
                                                           String month) {
        java.util.LinkedHashMap<String, Object> map = new java.util.LinkedHashMap<>();
        map.put("eventTypeId", eventTypeId);
        map.put("reasonTypeId", reasonTypeId);
        map.put("sourceTypeId", sourceTypeId);
        map.put("userEmail", email);
        map.put("recordCounts", recordCounts);
        if (month != null) map.put("month", month);
        return map;
    }
}
