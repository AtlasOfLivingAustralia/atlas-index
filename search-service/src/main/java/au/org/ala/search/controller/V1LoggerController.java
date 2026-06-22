/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.model.logger.*;
import au.org.ala.search.repo.LoggerPostgresRepository;
import au.org.ala.search.service.AuthService;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Logger REST services - V1 API
 */
@Slf4j
@RestController
@CrossOrigin(origins = "*", maxAge = 3600)
@RequestMapping(path = "/v1/service", produces = MediaType.APPLICATION_JSON_VALUE)
public class V1LoggerController {

    final LoggerPostgresRepository loggerPostgresRepository;
    final AuthService authService;

    public V1LoggerController(LoggerPostgresRepository loggerPostgresRepository, AuthService authService) {
        this.loggerPostgresRepository = loggerPostgresRepository;
        this.authService = authService;
    }

    @Tag(name = "Logger", description = "Logger REST services")
    @Operation(summary = "Get Email Breakdown", description = "Get Email Breakdown",
            responses = @ApiResponse(responseCode = "200", description = "Get Email Breakdown"))
    @GetMapping("/emailBreakdown")
    public ResponseEntity<Map<String, Object>> getEmailBreakdown(
            @Parameter(description = "Event ID", required = true) @RequestParam Integer eventId,
            @Parameter(description = "EntityUID", required = true) @RequestParam String entityUid) {

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMM");
        LocalDate now = LocalDate.now();
        String thisMonth = now.format(fmt);

        // Build month sets for each time window
        Set<String> thisMonthSet = Set.of(thisMonth);

        Set<String> last3MonthsSet = new LinkedHashSet<>();
        for (int i = 0; i < 3; i++) {
            last3MonthsSet.add(now.minusMonths(i).format(fmt));
        }

        Set<String> lastYearSet = new LinkedHashSet<>();
        LocalDate startOfLastYear = LocalDate.of(now.getYear() - 1, 1, 1);
        for (int i = 0; i < 12; i++) {
            lastYearSet.add(startOfLastYear.plusMonths(i).format(fmt));
        }

        // Fetch data — entity-level rows for email category breakdown
        List<EventSummaryBreakdownEmailEntity> allEntityRows =
                loggerPostgresRepository.findEmailBreakdownByEventAndEntity(eventId, entityUid);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("last3Months", buildEmailWindow(allEntityRows, last3MonthsSet));
        result.put("all", buildEmailWindow(allEntityRows, null));
        result.put("thisMonth", buildEmailWindow(allEntityRows, thisMonthSet));
        result.put("lastYear", buildEmailWindow(allEntityRows, lastYearSet));
        return ResponseEntity.ok(result);
    }

    @Tag(name = "Logger", description = "Logger REST services")
    // unpublished legacy endpoint
    @Hidden
    @Operation(summary = "Get Email Breakdown as CSV", description = "Get Email Breakdown as CSV",
            responses = @ApiResponse(responseCode = "200", description = "Get Email Breakdown as CSV"))
    @GetMapping(value = "/emailBreakdownCSV", produces = "text/csv")
    public ResponseEntity<String> getEmailBreakdownCsv(
            @Parameter(description = "Event ID", required = true) @RequestParam Integer eventId,
            @Parameter(description = "EntityUID", required = true) @RequestParam String entityUid) {

        List<EventSummaryBreakdownEmailEntity> allEntityRows =
                loggerPostgresRepository.findEmailBreakdownByEventAndEntity(eventId, entityUid);

        StringBuilder csv = new StringBuilder();
        csv.append("year,month,user category,number of events,number of records\n");
        for (EventSummaryBreakdownEmailEntity row : allEntityRows) {
            String monthStr = row.getMonth();
            String year = monthStr != null && monthStr.length() >= 6 ? monthStr.substring(0, 4) : "";
            String month = monthStr != null && monthStr.length() >= 6 ? monthStr.substring(4, 6) : "";
            String userCategory = escapeCsv(row.getUserEmailCategory());
            csv.append(year).append(",")
               .append(month).append(",")
               .append(userCategory).append(",")
               .append(row.getNumberOfEvents() != null ? row.getNumberOfEvents() : 0L).append(",")
               .append(row.getRecordCount() != null ? row.getRecordCount() : 0L).append("\n");
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header("Content-Disposition", "attachment; filename=\"downloads-by-email-" + entityUid + ".csv\"")
                .body(csv.toString());
    }

    /**
     * Aggregates email breakdown rows into a single time-window summary.
     */
    private Map<String, Object> buildEmailWindow(
            List<EventSummaryBreakdownEmailEntity> entityRows,
            Set<String> months) {

        // Sum events and records per email category from the entity rows
        Map<String, long[]> categoryTotals = new LinkedHashMap<>();
        for (EventSummaryBreakdownEmailEntity row : entityRows) {
            if (months != null && !months.contains(row.getMonth())) continue;
            long[] acc = categoryTotals.computeIfAbsent(row.getUserEmailCategory(), k -> new long[2]);
            acc[0] += row.getNumberOfEvents() != null ? row.getNumberOfEvents() : 0L;
            acc[1] += row.getRecordCount() != null ? row.getRecordCount() : 0L;
        }

        long totalEvents = 0L, totalRecords = 0L;
        Map<String, Object> emailBreakdown = new LinkedHashMap<>();
        for (Map.Entry<String, long[]> entry : categoryTotals.entrySet()) {
            Map<String, Long> cat = new LinkedHashMap<>();
            cat.put("events", entry.getValue()[0]);
            cat.put("records", entry.getValue()[1]);
            emailBreakdown.put(entry.getKey(), cat);

            totalEvents += entry.getValue()[0];
            totalRecords += entry.getValue()[1];
        }

        Map<String, Object> window = new LinkedHashMap<>();
        window.put("events", totalEvents);
        window.put("records", totalRecords);
        window.put("emailBreakdown", emailBreakdown);
        return window;
    }

    @Tag(name = "Logger", description = "Logger REST services")
    @Operation(summary = "Get Event Types", description = "Get Event Types",
            responses = @ApiResponse(responseCode = "200", description = "Get Event Types"))
    @GetMapping("/logger/events")
    public ResponseEntity<List<LogEventType>> getEventTypes() {
        return ResponseEntity.ok(loggerPostgresRepository.findAllEventTypes());
    }

    @Tag(name = "Logger", description = "Logger REST services")
    @Operation(summary = "Get Reason Types", description = "Get Reason Types",
            responses = @ApiResponse(responseCode = "200", description = "Get Reason Types"))
    @GetMapping("/logger/reasons")
    public ResponseEntity<List<LogReasonType>> getReasonTypes() {
        return ResponseEntity.ok(loggerPostgresRepository.findAllReasonTypes());
    }

    @Tag(name = "Logger", description = "Logger REST services")
    @Operation(summary = "Get Source Types", description = "Get Source Types",
            responses = @ApiResponse(responseCode = "200", description = "Get Source Types"))
    @GetMapping("/logger/sources")
    public ResponseEntity<List<LogSourceType>> getSourceTypes() {
        return ResponseEntity.ok(loggerPostgresRepository.findAllSourceTypes());
    }

    // unpublished legacy endpoint for backward compatibility with existing clients - prefer /reasonBreakdown going forward
    @Tag(name = "Logger", description = "Logger REST services")
    @Hidden
    @GetMapping(value = "/reasonBreakdown.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getReasonBreakdownJson(
            @RequestParam Integer eventId,
            @RequestParam String entityUid) {
        return getReasonBreakdown(eventId, entityUid);
    }

    @Tag(name = "Logger", description = "Logger REST services")
    @Operation(summary = "Get Reason Breakdown", description = "Get Reason Breakdown",
            responses = @ApiResponse(responseCode = "200", description = "Get Reason Breakdown"))
    @GetMapping(value = "/reasonBreakdown", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getReasonBreakdown(
            @Parameter(description = "Event ID", required = true) @RequestParam Integer eventId,
            @Parameter(description = "EntityUID", required = true) @RequestParam String entityUid) {

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMM");
        LocalDate now = LocalDate.now();

        Set<String> thisMonthSet = Set.of(now.format(fmt));

        Set<String> last3MonthsSet = new LinkedHashSet<>();
        for (int i = 0; i < 3; i++) last3MonthsSet.add(now.minusMonths(i).format(fmt));

        Set<String> lastYearSet = new LinkedHashSet<>();
        LocalDate startOfLastYear = LocalDate.of(now.getYear() - 1, 1, 1);
        for (int i = 0; i < 12; i++) lastYearSet.add(startOfLastYear.plusMonths(i).format(fmt));

        Map<Integer, String> reasonNames = new LinkedHashMap<>();
        reasonNames.put(-1, "unclassified");
        for (LogReasonType r : loggerPostgresRepository.findAllReasonTypes()) {
            reasonNames.put(r.getId(), r.getName());
        }

        List<EventSummaryBreakdownReasonEntity> entityRows =
                loggerPostgresRepository.findReasonBreakdownByEventAndEntity(eventId, entityUid);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("thisMonth", buildReasonWindow(entityRows, thisMonthSet, reasonNames));
        result.put("last3Months", buildReasonWindow(entityRows, last3MonthsSet, reasonNames));
        result.put("lastYear", buildReasonWindow(entityRows, lastYearSet, reasonNames));
        result.put("all", buildReasonWindow(entityRows, null, reasonNames));
        return ResponseEntity.ok(result);
    }

    private static String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    // unpublished legacy endpoint
    @Tag(name = "Logger", description = "Logger REST services")
    @Hidden
    @Operation(summary = "Get Reason Breakdown as CSV", description = "Get Reason Breakdown as CSV",
            responses = @ApiResponse(responseCode = "200", description = "Get Reason Breakdown as CSV"))
    @GetMapping(value = "/reasonBreakdownCSV", produces = "text/csv")
    public ResponseEntity<String> getReasonBreakdownCsv(
            @Parameter(description = "Event ID", required = true) @RequestParam Integer eventId,
            @Parameter(description = "EntityUID", required = true) @RequestParam String entityUid) {

        Map<Integer, String> reasonNames = new LinkedHashMap<>();
        reasonNames.put(-1, "unclassified");
        for (LogReasonType r : loggerPostgresRepository.findAllReasonTypes()) {
            reasonNames.put(r.getId(), r.getName());
        }

        List<EventSummaryBreakdownReasonEntity> entityRows =
                loggerPostgresRepository.findReasonBreakdownByEventAndEntity(eventId, entityUid);

        StringBuilder csv = new StringBuilder();
        csv.append("year,month,reason,number of events,number of records\n");
        for (EventSummaryBreakdownReasonEntity row : entityRows) {
            String monthStr = row.getMonth();
            String year = monthStr != null && monthStr.length() >= 6 ? monthStr.substring(0, 4) : "";
            String month = monthStr != null && monthStr.length() >= 6 ? monthStr.substring(4, 6) : "";
            String reason = reasonNames.getOrDefault(row.getLogReasonTypeId(), "unclassified");
            csv.append(year).append(",")
                    .append(month).append(",")
                    .append(escapeCsv(reason)).append(",")
                    .append(row.getNumberOfEvents() != null ? row.getNumberOfEvents() : 0L).append(",")
                    .append(row.getRecordCount() != null ? row.getRecordCount() : 0L).append("\n");
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header("Content-Disposition", "attachment; filename=\"downloads-by-reason-" + entityUid + ".csv\"")
                .body(csv.toString());
    }

    /**
     * Aggregates reason breakdown rows into a single time-window summary.
     */
    private Map<String, Object> buildReasonWindow(
            List<EventSummaryBreakdownReasonEntity> entityRows,
            Set<String> months,
            Map<Integer, String> reasonNames) {

        // Per-reason events + records from entity rows (scoped to this entityUid)
        Map<Integer, long[]> byReasonId = new LinkedHashMap<>();
        for (EventSummaryBreakdownReasonEntity row : entityRows) {
            if (months != null && !months.contains(row.getMonth())) continue;
            long[] acc = byReasonId.computeIfAbsent(row.getLogReasonTypeId(), k -> new long[2]);
            acc[0] += row.getNumberOfEvents() != null ? row.getNumberOfEvents() : 0L;
            acc[1] += row.getRecordCount() != null ? row.getRecordCount() : 0L;
        }

        // Grand totals across all entities (for top-level events + records)
        long totalEvents = 0L, totalRecords = 0L;

        // Build reasonBreakdown keyed by name, preserving reason order from reasonNames
        Map<String, Object> reasonBreakdown = new LinkedHashMap<>();
        for (Map.Entry<Integer, String> entry : reasonNames.entrySet()) {
            long[] acc = byReasonId.getOrDefault(entry.getKey(), new long[2]);
            Map<String, Long> cat = new LinkedHashMap<>();
            cat.put("events", acc[0]);
            cat.put("records", acc[1]);
            reasonBreakdown.put(entry.getValue(), cat);

            totalEvents += acc[0];
            totalRecords += acc[1];
        }

        Map<String, Object> window = new LinkedHashMap<>();
        window.put("events", totalEvents);
        window.put("records", totalRecords);
        window.put("reasonBreakdown", reasonBreakdown);
        return window;
    }

    @Tag(name = "Logger", description = "Logger REST services")
    @Operation(summary = "Get Reason Breakdown by Month", description = "Get Reason Breakdown by Month",
            responses = @ApiResponse(responseCode = "200", description = "Get Reason Breakdown by Month"))
    @GetMapping("/reasonBreakdownMonthly")
    public ResponseEntity<Map<String, Object>> getReasonBreakdownMonthly(
            @Parameter(description = "Event ID", required = true) @RequestParam Integer eventId,
            @Parameter(description = "EntityUID", required = true) @RequestParam String entityUid,
            @Parameter(description = "Reason ID") @RequestParam(required = false) Integer reasonId,
            @Parameter(description = "Source ID") @RequestParam(required = false) Integer sourceId,
            @Parameter(description = "Exclude Reason Type ID") @RequestParam(required = false) Integer excludeReasonTypeId) {

        List<EventSummaryBreakdownReasonEntitySource> rows =
                loggerPostgresRepository.findReasonBreakdownMonthly(eventId, entityUid, reasonId, sourceId, excludeReasonTypeId);

        Map<String, Map<String, Long>> byMonth = new LinkedHashMap<>();
        for (EventSummaryBreakdownReasonEntitySource row : rows) {
            Map<String, Long> month = byMonth.get(row.getMonth());
            long existingRecords = month != null && month.get("records") != null ? month.get("records") : 0L;
            long existingEvents = month != null && month.get("events") != null ? month.get("events") : 0L;
            byMonth.put(row.getMonth(), Map.of("records", row.getRecordCount() + existingRecords, "events", row.getNumberOfEvents() + existingEvents));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("temporalBreakdown", byMonth);
        return ResponseEntity.ok(result);
    }

    @Tag(name = "Logger", description = "Logger REST services")
    @Operation(summary = "Get Source Breakdown", description = "Get Source Breakdown",
            responses = @ApiResponse(responseCode = "200", description = "Get Source Breakdown"))
    @GetMapping("/sourceBreakdown")
    public ResponseEntity<Map<String, Object>> getSourceBreakdown(
            @Parameter(description = "Event ID", required = true) @RequestParam Integer eventId,
            @Parameter(description = "EntityUID", required = true) @RequestParam String entityUid,
            @Parameter(description = "Exclude Reason Type ID") @RequestParam(required = false) Integer excludeReasonTypeId) {

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMM");
        LocalDate now = LocalDate.now();

        Set<String> thisMonthSet = Set.of(now.format(fmt));
        Set<String> last3MonthsSet = new LinkedHashSet<>();
        for (int i = 0; i < 3; i++) last3MonthsSet.add(now.minusMonths(i).format(fmt));
        Set<String> lastYearSet = new LinkedHashSet<>();
        LocalDate startOfLastYear = LocalDate.of(now.getYear() - 1, 1, 1);
        for (int i = 0; i < 12; i++) lastYearSet.add(startOfLastYear.plusMonths(i).format(fmt));

        // Build id -> name lookup from log_source_type (id=-1 maps to "unclassified")
        Map<Integer, String> sourceNames = new LinkedHashMap<>();
        sourceNames.put(-1, "unclassified");
        for (LogSourceType s : loggerPostgresRepository.findAllSourceTypes()) {
            sourceNames.put(s.getId(), s.getName());
        }

        List<EventSummaryBreakdownReasonEntitySource> rows =
                loggerPostgresRepository.findSourceBreakdown(eventId, entityUid, excludeReasonTypeId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("thisMonth", buildSourceWindow(rows, thisMonthSet, sourceNames));
        result.put("last3Months", buildSourceWindow(rows, last3MonthsSet, sourceNames));
        result.put("lastYear", buildSourceWindow(rows, lastYearSet, sourceNames));
        result.put("all", buildSourceWindow(rows, null, sourceNames));
        return ResponseEntity.ok(result);
    }

    // unpublished legacy endpoint
    @Tag(name = "Logger", description = "Logger REST services")
    @Hidden
    @Operation(summary = "Get Source Breakdown as CSV", description = "Get Source Breakdown as CSV",
            responses = @ApiResponse(responseCode = "200", description = "Get Source Breakdown as CSV"))
    @GetMapping(value = "/sourceBreakdownCSV", produces = "text/csv")
    public ResponseEntity<String> getSourceBreakdownCsv(
            @Parameter(description = "Event ID", required = true) @RequestParam Integer eventId,
            @Parameter(description = "EntityUID", required = true) @RequestParam String entityUid,
            @Parameter(description = "Exclude Reason Type ID") @RequestParam(required = false) Integer excludeReasonTypeId) {

        // Build id -> name lookup for reasons and sources
        Map<Integer, String> reasonNames = new LinkedHashMap<>();
        reasonNames.put(-1, "unclassified");
        for (LogReasonType r : loggerPostgresRepository.findAllReasonTypes()) {
            reasonNames.put(r.getId(), r.getName());
        }
        Map<Integer, String> sourceNames = new LinkedHashMap<>();
        sourceNames.put(-1, "unclassified");
        for (LogSourceType s : loggerPostgresRepository.findAllSourceTypes()) {
            sourceNames.put(s.getId(), s.getName());
        }

        List<EventSummaryBreakdownReasonEntitySource> rows =
                loggerPostgresRepository.findSourceBreakdown(eventId, entityUid, excludeReasonTypeId);

        StringBuilder csv = new StringBuilder();
        csv.append("year,month,reason,source,number of events,number of records\n");
        for (EventSummaryBreakdownReasonEntitySource row : rows) {
            String monthStr = row.getMonth();
            String year = monthStr != null && monthStr.length() >= 6 ? monthStr.substring(0, 4) : "";
            String month = monthStr != null && monthStr.length() >= 6 ? monthStr.substring(4, 6) : "";
            String reason = reasonNames.getOrDefault(row.getLogReasonTypeId(), "unclassified");
            String source = sourceNames.getOrDefault(row.getLogSourceTypeId(), "unclassified");
            csv.append(year).append(",")
               .append(month).append(",")
               .append(escapeCsv(reason)).append(",")
               .append(escapeCsv(source)).append(",")
               .append(row.getNumberOfEvents() != null ? row.getNumberOfEvents() : 0L).append(",")
               .append(row.getRecordCount() != null ? row.getRecordCount() : 0L).append("\n");
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header("Content-Disposition", "attachment; filename=\"downloads-by-source-" + entityUid + ".csv\"")
                .body(csv.toString());
    }

    private Map<String, Object> buildSourceWindow(
            List<EventSummaryBreakdownReasonEntitySource> rows,
            Set<String> months,
            Map<Integer, String> sourceNames) {

        // Per-source events + records
        Map<Integer, long[]> bySourceId = new LinkedHashMap<>();
        for (EventSummaryBreakdownReasonEntitySource row : rows) {
            if (months != null && !months.contains(row.getMonth())) continue;
            long[] acc = bySourceId.computeIfAbsent(row.getLogSourceTypeId(), k -> new long[2]);
            acc[0] += row.getNumberOfEvents() != null ? row.getNumberOfEvents() : 0L;
            acc[1] += row.getRecordCount() != null ? row.getRecordCount() : 0L;
        }

        long totalEvents = 0L, totalRecords = 0L;
        Map<String, Object> sourceBreakdown = new LinkedHashMap<>();
        for (Map.Entry<Integer, String> entry : sourceNames.entrySet()) {
            long[] acc = bySourceId.getOrDefault(entry.getKey(), new long[2]);
            Map<String, Long> cat = new LinkedHashMap<>();
            cat.put("events", acc[0]);
            cat.put("records", acc[1]);
            sourceBreakdown.put(entry.getValue(), cat);

            totalEvents += acc[0];
            totalRecords += acc[1];
        }

        Map<String, Object> window = new LinkedHashMap<>();
        window.put("events", totalEvents);
        window.put("records", totalRecords);
        window.put("sourceBreakdown", sourceBreakdown);
        return window;
    }

    @Tag(name = "Logger", description = "Logger REST services")
    @Operation(summary = "Get Totals by Event Type", description = "Get Totals by Event Type",
            responses = @ApiResponse(responseCode = "200", description = "Get Totals by Event Type"))
    @GetMapping("/totalsByType")
    public ResponseEntity<Map<String, Map<Integer, Map<String, Long>>>> getTotalsByType() {
        List<EventSummaryTotalsDto> rows = loggerPostgresRepository.findTotalsByEventType();

        // Group and sum records/events by event type
        Map<Integer, Map<String, Long>> totals = new LinkedHashMap<>();
        for (EventSummaryTotalsDto row : rows) {
            Map<String, Long> typeTotals = totals.computeIfAbsent(row.logEventTypeId(), k -> {
                Map<String, Long> m = new LinkedHashMap<>();
                m.put("records", 0L);
                m.put("events", 0L);
                return m;
            });
            typeTotals.put("records", typeTotals.get("records") + row.recordCount());
            typeTotals.put("events", typeTotals.get("events") + row.numberOfEvents());
        }

        Map result = new LinkedHashMap<>();
        result.put("totals", totals);
        return ResponseEntity.ok(result);
    }

    @Tag(name = "Logger", description = "Logger REST services")
    @Operation(summary = "Get Monthly Breakdown", description = "Get Monthly Breakdown",
            responses = @ApiResponse(responseCode = "200", description = "Get Monthly Breakdown"))
    @GetMapping("/logger/get.json")
    public ResponseEntity<Map<String, Object>> getMonthlyBreakdown(
            @Parameter(description = "Event Type ID", required = true) @RequestParam Integer eventTypeId,
            @Parameter(description = "The entityUid to query on", required = true) @RequestParam String q,
            @Parameter(description = "year, default is current year") @RequestParam(required = false) String year) {

        // use current year if not supplied
        if (year == null || year.isBlank()) {
            year = String.valueOf(LocalDate.now().getYear());
        }
        List<EventSummaryBreakdownReasonEntity> rows =
                loggerPostgresRepository.findMonthlyBreakdown(eventTypeId, q, year);

        // Aggregate records by month
        Map<String, Long> byMonth = new LinkedHashMap<>();
        for (EventSummaryBreakdownReasonEntity row : rows) {
            byMonth.merge(row.getMonth(), row.getRecordCount(), Long::sum);
        }

        // Convert to array of arrays for the response
        List<Object[]> months = new ArrayList<>();
        for (Map.Entry<String, Long> entry : byMonth.entrySet()) {
            months.add(new Object[] { entry.getKey(), entry.getValue() });
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("months", months);
        return ResponseEntity.ok(result);
    }

    @Tag(name = "Admin", description = "Internal use only")
    // required for legacy biocache-service configuration
    @Hidden
    @PostMapping("/logger/")
    public ResponseEntity<Map<String, Object>> createLogEventHidden(
            @RequestBody LogEventVO vo,
            @AuthenticationPrincipal Principal principal,
            HttpServletRequest request) {
        // Delegate to the main /logger endpoint
        return createLogEvent(vo, principal, request);
    }

    @Tag(name = "Admin", description = "Internal use only")
    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @Operation(summary = "Create a new Event log", description = "Create a new Event log",
            responses = @ApiResponse(responseCode = "200", description = "Create a new Event log"))
    @PostMapping("/logger")
    public ResponseEntity<Map<String, Object>> createLogEvent(@RequestBody LogEventVO vo,
                                                              @AuthenticationPrincipal Principal principal,
                                                              HttpServletRequest request) {
        // Extract IP address
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }
        ip = ip.split(",")[0].trim();

        log.debug("Received createLogEvent from ip={}, requestURI={}", ip, request.getRequestURI());

        if (!authService.isAdmin(principal) && !authService.isPermittedIp(ip)) {
            throw new AccessDeniedException("Not authorised");
        }

        // Validate event/reason/source types
        if (vo.getEventTypeId() == null || loggerPostgresRepository.findEventTypeById(vo.getEventTypeId()) == null) {
            throw new IllegalArgumentException("Invalid or missing eventTypeId");
        }
        if (vo.getReasonTypeId() == null || loggerPostgresRepository.findReasonTypeById(vo.getReasonTypeId()) == null) {
            throw new IllegalArgumentException("Invalid or missing reasonTypeId");
        }
        if (vo.getSourceTypeId() == null || loggerPostgresRepository.findSourceTypeById(vo.getSourceTypeId()) == null) {
            throw new IllegalArgumentException("Invalid or missing sourceTypeId");
        }


        // Extract User-Agent
        String userAgent = request.getHeader("User-Agent");
        if (userAgent == null || userAgent.isBlank()) {
            userAgent = "MOZILLA 5.0";
        }

        LogEvent event = new LogEvent();
        event.setComment(vo.getComment());
        event.setLogEventTypeId(vo.getEventTypeId());
        event.setUserIp(ip);
        event.setUserAgent(userAgent);
        event.setUserEmail(vo.getUserEmail());
        event.setLogReasonTypeId(vo.getReasonTypeId());
        event.setLogSourceTypeId(vo.getSourceTypeId());
        event.setSourceUrl(vo.getSourceUrl());
        event.setCreated(new Date());

        event.setMonth(determineMonth(vo.getMonth()));

        // Build log details from recordCounts map
        if (vo.getRecordCounts() != null && !vo.getRecordCounts().isEmpty()) {
            List<LogDetail> details = new ArrayList<>();
            for (Map.Entry<String, Integer> entry : vo.getRecordCounts().entrySet()) {
                LogDetail detail = new LogDetail();
                detail.setEntityUid(entry.getKey());
                detail.setRecordCount(entry.getValue() != null ? entry.getValue().longValue() : 0L);
                detail.setLogEvent(event);
                details.add(detail);
            }
            event.setLogDetails(details);
        }

        LogEvent saved = loggerPostgresRepository.save(event);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", saved.getId());
        return ResponseEntity.ok(response);
    }

    private static String determineMonth(String month) {
        if (month != null) {
            String trimmed = month.trim();
            if (trimmed.length() > 3) {
                try {
                    Integer.parseInt(trimmed);
                    return trimmed;
                } catch (NumberFormatException ignored) {}
            }
        }
        return new SimpleDateFormat("yyyyMM").format(new Date());
    }
}

