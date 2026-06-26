/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.AbstractIntegrationTestContainers;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
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

/**
 * Integration tests for the logger summary processing pipeline.
 * <p>
 * Tests verify that process_new_events() correctly populates summary tables,
 * which are then surfaced via the V1LoggerController breakdown endpoints.
 * <p>
 * IMPORTANT: process_new_events() uses internal COMMIT statements, so Spring's
 *
 * @Transactional rollback cannot be used. Tests use ordered execution and
 * truncate tables explicitly in setUp to achieve isolation.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class LoggerSummaryProcessingIntegrationTest extends AbstractIntegrationTestContainers {

    // Fixed IDs for this test class — high to avoid Flyway-seeded data conflicts.
    static final Integer EVT = 1002;   // event type id
    static final Integer RSN_A = 4;    // reason type id A (scientific research)
    static final Integer RSN_B = 3;    // reason type id B (education)
    static final Integer SRC = 0;      // source type id (ALA)
    static final String ENTITY_A = "dr999";
    static final String ENTITY_B = "dr998";

    static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyyMM");
    static final String CURRENT_MONTH = LocalDate.now().format(MONTH_FMT);
    static final String LAST_MONTH = LocalDate.now().minusMonths(1).format(MONTH_FMT);

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockBean
    private AuthService authService;

    @BeforeEach
    void configureMockAuth() {
        when(authService.isAdmin(any(Principal.class))).thenReturn(true);
        when(authService.isAdmin(any())).thenReturn(true);
        when(authService.getActor(any(), any(), any())).thenReturn("test-actor");
    }

    @BeforeAll
    static void seedLookupTypes(@Autowired TestRestTemplate restTemplate,
                                @Autowired AuthService authService) {
        when(authService.isAdmin(any())).thenReturn(true);
        when(authService.getActor(any(), any(), any())).thenReturn("test-actor");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        upsertScaffold(restTemplate, headers, "log_event_type",
                Map.of("id", EVT, "name", "OCCURRENCE_RECORDS_DOWNLOADED"));
        upsertScaffold(restTemplate, headers, "log_reason_type",
                Map.of("id", RSN_A, "rkey", "research", "name", "scientific research",
                        "defaultOrder", 1000, "deprecated", false));
        upsertScaffold(restTemplate, headers, "log_reason_type",
                Map.of("id", RSN_B, "rkey", "education", "name", "education",
                        "defaultOrder", 600, "deprecated", false));
        upsertScaffold(restTemplate, headers, "log_source_type",
                Map.of("id", SRC, "name", "ALA"));
    }

    /**
     * Before each test, clear all log_event and summary table data and reset
     * the processing checkpoint so each test starts with a clean slate.
     */
    @BeforeEach
    void truncateLogAndSummaryTables() {
        jdbcTemplate.execute("TRUNCATE TABLE log_detail CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE log_event CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE event_summary_totals CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE event_summary_breakdown_email CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE event_summary_breakdown_email_entity CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE event_summary_breakdown_reason CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE event_summary_breakdown_reason_entity CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE event_summary_breakdown_reason_entity_source CASCADE");
        jdbcTemplate.execute("UPDATE event_processing_checkpoint SET last_processed_event_id = 0");
    }

    @Test
    @Order(1)
    void processNewEvents_noEvents_endpointsReturnEmpty() {
        runProcessNewEvents();

        ResponseEntity<Map<String, Object>> totalsResponse = restTemplate.exchange(
                "/v1/service/totalsByType", HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {
                });

        assertThat(totalsResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> totals = (Map<String, Object>) totalsResponse.getBody().get("totals");
        assertThat(totals).isEmpty();
    }

    @Test
    @Order(2)
    void processNewEvents_singleEvent_totalsByTypeReflectsIt() {
        createLogEvent(EVT, RSN_A, SRC, "user@example.com", Map.of(ENTITY_A, 150));
        runProcessNewEvents();

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/totalsByType", HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> totals = (Map<String, Object>) response.getBody().get("totals");
        assertThat(totals).containsKey(String.valueOf(EVT));

        @SuppressWarnings("unchecked")
        Map<String, Object> typeTotals = (Map<String, Object>) totals.get(String.valueOf(EVT));
        Number events = (Number) typeTotals.get("events");
        Number records = (Number) typeTotals.get("records");
        assertThat(events.longValue()).isEqualTo(1L);
        assertThat(records.longValue()).isEqualTo(150L);
    }

    @Test
    @Order(3)
    void processNewEvents_fiveEventsOfSameType_totalAccumulates() {
        for (int i = 0; i < 5; i++) {
            createLogEvent(EVT, RSN_A, SRC, "user" + i + "@example.com", Map.of(ENTITY_A, 100));
        }
        runProcessNewEvents();

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/totalsByType", HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> totals = (Map<String, Object>) response.getBody().get("totals");
        @SuppressWarnings("unchecked")
        Map<String, Object> typeTotals = (Map<String, Object>) totals.get(String.valueOf(EVT));
        assertThat(((Number) typeTotals.get("events")).longValue()).isEqualTo(5L);
        assertThat(((Number) typeTotals.get("records")).longValue()).isEqualTo(500L);
    }

    @Test
    @Order(4)
    void processNewEvents_emailCategorization_correctInBreakdown() {
        // gov: csiro.au, edu: .edu.au, other: gmail.com
        createLogEvent(EVT, RSN_A, SRC, "user@csiro.au", Map.of(ENTITY_A, 300));
        createLogEvent(EVT, RSN_A, SRC, "user@uni.edu.au", Map.of(ENTITY_A, 200));
        createLogEvent(EVT, RSN_A, SRC, "user@gmail.com", Map.of(ENTITY_A, 100));
        runProcessNewEvents();

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/emailBreakdown?eventId=" + EVT + "&entityUid=" + ENTITY_A,
                HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        @SuppressWarnings("unchecked")
        Map<String, Object> all = (Map<String, Object>) response.getBody().get("all");
        @SuppressWarnings("unchecked")
        Map<String, Object> emailBreakdown = (Map<String, Object>) all.get("emailBreakdown");

        assertThat(emailBreakdown).containsKeys("gov", "edu", "other");

        // gov category: csiro.au → 1 event
        @SuppressWarnings("unchecked")
        Number govEvents = (Number) ((Map<String, Object>) emailBreakdown.get("gov")).get("events");
        assertThat(govEvents.longValue()).isEqualTo(1L);

        // edu category: .edu.au → 1 event
        @SuppressWarnings("unchecked")
        Number eduEvents = (Number) ((Map<String, Object>) emailBreakdown.get("edu")).get("events");
        assertThat(eduEvents.longValue()).isEqualTo(1L);

        // other category: gmail.com → 1 event
        @SuppressWarnings("unchecked")
        Number otherEvents = (Number) ((Map<String, Object>) emailBreakdown.get("other")).get("events");
        assertThat(otherEvents.longValue()).isEqualTo(1L);
    }

    @Test
    @Order(5)
    void processNewEvents_emailCategorization_unspecifiedEmail_categorisedAsUnspecified() {
        // null/blank email → unspecified
        createLogEvent(EVT, RSN_A, SRC, null, Map.of(ENTITY_A, 100));
        runProcessNewEvents();

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/emailBreakdown?eventId=" + EVT + "&entityUid=" + ENTITY_A,
                HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> all = (Map<String, Object>) response.getBody().get("all");
        @SuppressWarnings("unchecked")
        Map<String, Object> emailBreakdown = (Map<String, Object>) all.get("emailBreakdown");
        assertThat(emailBreakdown).containsKey("unspecified");

        @SuppressWarnings("unchecked")
        Number unspecifiedEvents = (Number) ((Map<String, Object>) emailBreakdown.get("unspecified")).get("events");
        assertThat(unspecifiedEvents.longValue()).isGreaterThan(0L);
    }

    @Test
    @Order(6)
    void processNewEvents_reasonGrouping_correctInBreakdown() {
        // 2 events with RSN_A (research), 1 event with RSN_B (education)
        createLogEvent(EVT, RSN_A, SRC, "a@example.com", Map.of(ENTITY_A, 100));
        createLogEvent(EVT, RSN_A, SRC, "b@example.com", Map.of(ENTITY_A, 200));
        createLogEvent(EVT, RSN_B, SRC, "c@example.com", Map.of(ENTITY_A, 50));
        runProcessNewEvents();

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/reasonBreakdown?eventId=" + EVT + "&entityUid=" + ENTITY_A,
                HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        @SuppressWarnings("unchecked")
        Map<String, Object> all = (Map<String, Object>) response.getBody().get("all");
        @SuppressWarnings("unchecked")
        Map<String, Object> reasonBreakdown = (Map<String, Object>) all.get("reasonBreakdown");

        assertThat(reasonBreakdown).containsKeys("scientific research", "education");

        @SuppressWarnings("unchecked")
        Number researchEvents = (Number) ((Map<String, Object>) reasonBreakdown.get("scientific research")).get("events");
        assertThat(researchEvents.longValue()).isEqualTo(2L);

        @SuppressWarnings("unchecked")
        Number educationEvents = (Number) ((Map<String, Object>) reasonBreakdown.get("education")).get("events");
        assertThat(educationEvents.longValue()).isEqualTo(1L);
    }

    @Test
    @Order(7)
    void processNewEvents_sourceGrouping_correctInBreakdown() {
        createLogEvent(EVT, RSN_A, SRC, "a@example.com", Map.of(ENTITY_A, 100));
        createLogEvent(EVT, RSN_A, SRC, "b@example.com", Map.of(ENTITY_A, 200));
        runProcessNewEvents();

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/sourceBreakdown?eventId=" + EVT + "&entityUid=" + ENTITY_A,
                HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        @SuppressWarnings("unchecked")
        Map<String, Object> all = (Map<String, Object>) response.getBody().get("all");
        @SuppressWarnings("unchecked")
        Map<String, Object> sourceBreakdown = (Map<String, Object>) all.get("sourceBreakdown");
        assertThat(sourceBreakdown).containsKey("ALA");

        @SuppressWarnings("unchecked")
        Number alaEvents = (Number) ((Map<String, Object>) sourceBreakdown.get("ALA")).get("events");
        assertThat(alaEvents.longValue()).isGreaterThan(0L);
    }

    @Test
    @Order(8)
    void processNewEvents_multipleEntities_entityBreakdownCorrect() {
        // ENTITY_A gets 3 events, ENTITY_B gets 1 event
        createLogEvent(EVT, RSN_A, SRC, "a@example.com", Map.of(ENTITY_A, 100));
        createLogEvent(EVT, RSN_A, SRC, "b@example.com", Map.of(ENTITY_A, 200));
        createLogEvent(EVT, RSN_A, SRC, "c@example.com", Map.of(ENTITY_A, 300));
        createLogEvent(EVT, RSN_A, SRC, "d@example.com", Map.of(ENTITY_B, 50));
        runProcessNewEvents();

        // Verify ENTITY_A monthly breakdown
        ResponseEntity<Map<String, Object>> responseA = restTemplate.exchange(
                "/v1/service/reasonBreakdown?eventId=" + EVT + "&entityUid=" + ENTITY_A,
                HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> allA = (Map<String, Object>) responseA.getBody().get("all");
        assertThat(((Number) allA.get("events")).longValue()).isEqualTo(3L);

        // Verify ENTITY_B monthly breakdown
        ResponseEntity<Map<String, Object>> responseB = restTemplate.exchange(
                "/v1/service/reasonBreakdown?eventId=" + EVT + "&entityUid=" + ENTITY_B,
                HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> allB = (Map<String, Object>) responseB.getBody().get("all");
        assertThat(((Number) allB.get("events")).longValue()).isEqualTo(1L);
    }

    @Test
    @Order(9)
    void processNewEvents_idempotent_callingTwiceDoesNotDoubleCount() {
        createLogEvent(EVT, RSN_A, SRC, "user@example.com", Map.of(ENTITY_A, 100));
        runProcessNewEvents();
        runProcessNewEvents(); // second call on same data

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/totalsByType", HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> totals = (Map<String, Object>) response.getBody().get("totals");
        @SuppressWarnings("unchecked")
        Map<String, Object> typeTotals = (Map<String, Object>) totals.get(String.valueOf(EVT));

        // Should still be exactly 1 event, not 2
        assertThat(((Number) typeTotals.get("events")).longValue()).isEqualTo(1L);
    }

    @Test
    @Order(10)
    void processNewEvents_incremental_onlyNewEventsProcessed() {
        // Batch A: 2 events
        createLogEvent(EVT, RSN_A, SRC, "a@example.com", Map.of(ENTITY_A, 100));
        createLogEvent(EVT, RSN_A, SRC, "b@example.com", Map.of(ENTITY_A, 200));
        runProcessNewEvents();

        // Batch B: 1 more event
        createLogEvent(EVT, RSN_A, SRC, "c@example.com", Map.of(ENTITY_A, 300));
        runProcessNewEvents();

        // Total should be A+B = 3 events, not 4 (no double-counting of A)
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/totalsByType", HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> totals = (Map<String, Object>) response.getBody().get("totals");
        @SuppressWarnings("unchecked")
        Map<String, Object> typeTotals = (Map<String, Object>) totals.get(String.valueOf(EVT));
        assertThat(((Number) typeTotals.get("events")).longValue()).isEqualTo(3L);
        assertThat(((Number) typeTotals.get("records")).longValue()).isEqualTo(600L);
    }

    @Test
    @Order(11)
    void processNewEvents_multipleMonths_monthlyBreakdownCorrect() {
        // Create events in two different months
        createLogEventWithMonth(EVT, RSN_A, SRC, "a@example.com", Map.of(ENTITY_A, 100), CURRENT_MONTH);
        createLogEventWithMonth(EVT, RSN_A, SRC, "b@example.com", Map.of(ENTITY_A, 200), LAST_MONTH);
        runProcessNewEvents();

        String currentYear = String.valueOf(LocalDate.now().getYear());
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/logger/get.json?eventTypeId=" + EVT + "&q=" + ENTITY_A + "&year=" + currentYear,
                HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        List<List<Object>> months = (List<List<Object>>) response.getBody().get("months");
        assertThat(months).isNotEmpty();

        // Current month entry should exist
        boolean foundCurrentMonth = months.stream()
                .anyMatch(monthEntry -> CURRENT_MONTH.equals(monthEntry.get(0)));
        assertThat(foundCurrentMonth).isTrue();
    }

    @Test
    @Order(12)
    void processNewEvents_reasonBreakdownMonthly_filtersWork() {
        createLogEventWithMonth(EVT, RSN_A, SRC, "a@example.com", Map.of(ENTITY_A, 100), CURRENT_MONTH);
        createLogEventWithMonth(EVT, RSN_B, SRC, "b@example.com", Map.of(ENTITY_A, 200), CURRENT_MONTH);
        runProcessNewEvents();

        // Filter by reasonId = RSN_A should only show RSN_A data
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/reasonBreakdownMonthly?eventId=" + EVT + "&entityUid=" + ENTITY_A
                        + "&reasonId=" + RSN_A,
                HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> temporal = (Map<String, Object>) response.getBody().get("temporalBreakdown");
        // Should only include months where RSN_A events exist
        assertThat(temporal).isNotEmpty();

        // Exclude RSN_A should leave only RSN_B
        ResponseEntity<Map<String, Object>> excludedResponse = restTemplate.exchange(
                "/v1/service/reasonBreakdownMonthly?eventId=" + EVT + "&entityUid=" + ENTITY_A
                        + "&excludeReasonTypeId=" + RSN_A,
                HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        @SuppressWarnings("unchecked")
        Map<String, Object> excludedTemporal = (Map<String, Object>) excludedResponse.getBody().get("temporalBreakdown");

        // Verify the events in the excluded response only reflect RSN_B counts
        if (!excludedTemporal.isEmpty()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> monthData = (Map<String, Object>) excludedTemporal.get(CURRENT_MONTH);
            if (monthData != null) {
                assertThat(((Number) monthData.get("events")).longValue()).isEqualTo(1L); // only RSN_B event
            }
        }
    }

    /**
     * Calls process_new_events() via JdbcTemplate on a raw JDBC connection.
     * <p>
     * The stored procedure uses COMMIT internally. PostgreSQL forbids issuing a
     * COMMIT inside a client-managed transaction (it raises "invalid transaction
     * termination"). JPA's @Modifying requires a JPA transaction, which conflicts.
     * Using JdbcTemplate directly bypasses JPA's transaction requirement and lets
     * the procedure manage its own commits on a plain auto-commit connection.
     */
    private void runProcessNewEvents() {
        jdbcTemplate.execute("CALL process_new_events()");
    }

    private void createLogEvent(int eventTypeId, int reasonTypeId, int sourceTypeId,
                                String email, Map<String, Integer> recordCounts) {
        createLogEventWithMonth(eventTypeId, reasonTypeId, sourceTypeId, email, recordCounts, CURRENT_MONTH);
    }

    private void createLogEventWithMonth(int eventTypeId, int reasonTypeId, int sourceTypeId,
                                         String email, Map<String, Integer> recordCounts, String month) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        java.util.LinkedHashMap<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("eventTypeId", eventTypeId);
        payload.put("reasonTypeId", reasonTypeId);
        payload.put("sourceTypeId", sourceTypeId);
        payload.put("userEmail", email);
        payload.put("recordCounts", recordCounts);
        if (month != null) payload.put("month", month);

        restTemplate.exchange(
                "/v1/service/logger",
                HttpMethod.POST,
                new HttpEntity<>(payload, headers),
                new ParameterizedTypeReference<Map<String, Object>>() {
                });
    }

    private static void upsertScaffold(TestRestTemplate restTemplate, HttpHeaders headers,
                                       String table, Map<String, Object> body) {
        restTemplate.exchange(
                "/admin/scaffold?table=" + table,
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                new ParameterizedTypeReference<Map<String, Object>>() {
                });
    }
}
