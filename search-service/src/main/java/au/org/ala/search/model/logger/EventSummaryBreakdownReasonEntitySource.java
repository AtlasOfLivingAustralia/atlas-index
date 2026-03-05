/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.logger;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.io.Serializable;

@NoArgsConstructor
@SuperBuilder
@Data
@Entity
@Table(name = "event_summary_breakdown_reason_entity_source")
@IdClass(EventSummaryBreakdownReasonEntitySource.EventSummaryBreakdownReasonEntitySourceId.class)
public class EventSummaryBreakdownReasonEntitySource {
    @Id
    @Column(nullable = false)
    private String month;

    @Id
    @Column(name = "log_event_type_id", nullable = false)
    private Integer logEventTypeId;

    @Id
    @Column(name = "log_reason_type_id", nullable = false)
    private Integer logReasonTypeId;

    @Id
    @Column(name = "entity_uid", nullable = false)
    private String entityUid;

    @Id
    @Column(name = "log_source_type_id", nullable = false)
    private Integer logSourceTypeId;

    @Column(name = "number_of_events", nullable = false)
    private Long numberOfEvents;

    @Column(name = "record_count", nullable = false)
    private Long recordCount;

    @Data
    @NoArgsConstructor
    public static class EventSummaryBreakdownReasonEntitySourceId implements Serializable {
        private String month;
        private Integer logEventTypeId;
        private Integer logReasonTypeId;
        private String entityUid;
        private Integer logSourceTypeId;
    }
}

