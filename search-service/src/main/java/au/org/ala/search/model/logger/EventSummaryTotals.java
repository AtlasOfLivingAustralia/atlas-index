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
@Table(name = "event_summary_totals")
@IdClass(EventSummaryTotals.EventSummaryTotalsId.class)
public class EventSummaryTotals {
    @Id
    @Column(nullable = false)
    private String month;

    @Id
    @Column(name = "log_event_type_id", nullable = false)
    private Integer logEventTypeId;

    @Column(name = "number_of_events")
    private Long numberOfEvents;

    @Column(name = "record_count")
    private Long recordCount;

    @Data
    @NoArgsConstructor
    public static class EventSummaryTotalsId implements Serializable {
        private String month;
        private Integer logEventTypeId;
    }
}

