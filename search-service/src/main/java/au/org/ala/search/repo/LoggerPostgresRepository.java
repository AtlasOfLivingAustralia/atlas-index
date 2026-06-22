/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.logger.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface LoggerPostgresRepository extends JpaRepository<LogEvent, Long> {

    // --- Event types, reason types, source types ---

    @Query("SELECT e FROM LogEventType e ORDER BY e.id")
    List<LogEventType> findAllEventTypes();

    @Query("SELECT r FROM LogReasonType r ORDER BY r.defaultOrder")
    List<LogReasonType> findAllReasonTypes();

    @Query("SELECT s FROM LogSourceType s ORDER BY s.id")
    List<LogSourceType> findAllSourceTypes();

    // --- Totals by event type ---

    @Query("SELECT new au.org.ala.search.model.logger.EventSummaryTotalsDto(e.logEventTypeId, sum(e.numberOfEvents), sum(e.recordCount)) FROM EventSummaryTotals e GROUP BY e.logEventTypeId")
    List<EventSummaryTotalsDto> findTotalsByEventType();

    // --- Email breakdown ---

    @Query("""
            SELECT e FROM EventSummaryBreakdownEmailEntity e
            WHERE e.logEventTypeId = :eventId
              AND e.entityUid = :entityUid
            ORDER BY e.month
            """)
    List<EventSummaryBreakdownEmailEntity> findEmailBreakdownByEventAndEntity(
            @Param("eventId") Integer eventId,
            @Param("entityUid") String entityUid);

    @Query("""
            SELECT e FROM EventSummaryBreakdownEmailEntity e
            WHERE e.logEventTypeId = :eventId
              AND e.entityUid = :entityUid
              AND e.month IN :months
            """)
    List<EventSummaryBreakdownEmailEntity> findEmailBreakdownByEventAndEntityAndMonths(
            @Param("eventId") Integer eventId,
            @Param("entityUid") String entityUid,
            @Param("months") Collection<String> months);

    @Query("""
            SELECT e FROM EventSummaryBreakdownEmail e
            WHERE e.logEventTypeId = :eventId
              AND e.month IN :months
            """)
    List<EventSummaryBreakdownEmail> findEmailTotalsByEventAndMonths(
            @Param("eventId") Integer eventId,
            @Param("months") Collection<String> months);

    @Query("""
            SELECT e FROM EventSummaryBreakdownEmail e
            WHERE e.logEventTypeId = :eventId
            """)
    List<EventSummaryBreakdownEmail> findEmailTotalsByEvent(
            @Param("eventId") Integer eventId);

    // --- Reason breakdown ---

    @Query("""
            SELECT e FROM EventSummaryBreakdownReasonEntity e
            WHERE e.logEventTypeId = :eventId
              AND e.entityUid = :entityUid
            ORDER BY e.month
            """)
    List<EventSummaryBreakdownReasonEntity> findReasonBreakdownByEventAndEntity(
            @Param("eventId") Integer eventId,
            @Param("entityUid") String entityUid);

    @Query("""
            SELECT e FROM EventSummaryBreakdownReason e
            WHERE e.logEventTypeId = :eventId
            """)
    List<EventSummaryBreakdownReason> findReasonTotalsByEvent(
            @Param("eventId") Integer eventId);

    // --- Reason breakdown monthly (with optional filters) ---

    @Query("""
            SELECT e FROM EventSummaryBreakdownReasonEntitySource e
            WHERE e.logEventTypeId = :eventId
              AND e.entityUid = :entityUid
              AND (:reasonId IS NULL OR e.logReasonTypeId = :reasonId)
              AND (:sourceId IS NULL OR e.logSourceTypeId = :sourceId)
              AND (:excludeReasonTypeId IS NULL OR e.logReasonTypeId <> :excludeReasonTypeId)
            ORDER BY e.month
            """)
    List<EventSummaryBreakdownReasonEntitySource> findReasonBreakdownMonthly(
            @Param("eventId") Integer eventId,
            @Param("entityUid") String entityUid,
            @Param("reasonId") Integer reasonId,
            @Param("sourceId") Integer sourceId,
            @Param("excludeReasonTypeId") Integer excludeReasonTypeId);

    // --- Source breakdown ---

    @Query("""
            SELECT e FROM EventSummaryBreakdownReasonEntitySource e
            WHERE e.logEventTypeId = :eventId
              AND e.entityUid = :entityUid
              AND (:excludeReasonTypeId IS NULL OR e.logReasonTypeId <> :excludeReasonTypeId)
            ORDER BY e.month
            """)
    List<EventSummaryBreakdownReasonEntitySource> findSourceBreakdown(
            @Param("eventId") Integer eventId,
            @Param("entityUid") String entityUid,
            @Param("excludeReasonTypeId") Integer excludeReasonTypeId);

    // --- Monthly breakdown (get.json) ---

    @Query("""
            SELECT e FROM EventSummaryBreakdownReasonEntity e
            WHERE e.logEventTypeId = :eventTypeId
              AND e.entityUid = :entityUid
              AND (:year IS NULL OR e.month LIKE CONCAT(:year, '%'))
            ORDER BY e.month
            """)
    List<EventSummaryBreakdownReasonEntity> findMonthlyBreakdown(
            @Param("eventTypeId") Integer eventTypeId,
            @Param("entityUid") String entityUid,
            @Param("year") String year);

    // --- Summary table update ---

    @org.springframework.data.jpa.repository.Modifying
    @Query(value = "CALL process_new_events()", nativeQuery = true)
    void processNewEvents();

    // --- Lookup types by ID ---
    @Query("SELECT r FROM LogReasonType r WHERE r.id = :reasonTypeId")
    LogReasonType findReasonTypeById(@Param("reasonTypeId") Integer reasonTypeId);

    @Query("SELECT r FROM LogEventType r WHERE r.id = :eventTypeId")
    LogEventType findEventTypeById(@Param("eventTypeId") Integer eventTypeId);

    @Query("SELECT r FROM LogSourceType r WHERE r.id = :sourceTypeId")
    LogSourceType findSourceTypeById(@Param("sourceTypeId") Integer sourceTypeId);
}
