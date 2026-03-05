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

@NoArgsConstructor
@SuperBuilder
@Data
@Entity
@Table(name = "log_detail")
public class LogDetail {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(nullable = false)
    private Long id;

    @Column(name = "entity_type")
    private String entityType;

    @Column(name = "entity_uid")
    private String entityUid;

    @Column(name = "record_count")
    private Long recordCount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "log_event_id")
    private LogEvent logEvent;
}

