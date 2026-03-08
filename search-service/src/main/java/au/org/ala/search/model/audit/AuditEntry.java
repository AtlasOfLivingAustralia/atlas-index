/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.audit;

import co.elastic.clients.util.DateTime;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Date;

/**
 * Audit history entry for admin-mutated entities: dynamic config, data quality profiles and banner messages.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "audit_history",
        indexes = {
                @Index(name = "idx_audit_entity_table", columnList = "entity_table"),
                @Index(name = "idx_audit_entity_id", columnList = "entity_id"),
                @Index(name = "idx_audit_created_at", columnList = "created_at"),
        })
public class AuditEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Logical table/domain name, e.g. "config", "banner", "dq" */
    @Column(name = "entity_table", nullable = false, length = 64)
    private String entityTable;

    /** Primary key / identifier of the changed record, e.g. config id, banner section, dq shortName */
    @Column(name = "entity_id", nullable = false, length = 255)
    private String entityId;

    /** Human-readable display name of the entity (may equal entityId). */
    @Column(name = "entity_name", length = 255)
    private String entityName;

    /** Timestamp of the change */
    @Column(name = "created_at", nullable = false)
    private Date createdAt;

    /** User id from JWT, or application/scope name for machine clients, e.g. "ala/internal" */
    @Column(name = "actor", length = 255)
    private String actor;

    /** "UPDATE" or "DELETE" */
    @Column(name = "action", nullable = false, length = 16)
    private String action;

    /**
     * JSON diff of what changed. For UPDATE records this is a JSON object of the form:
     * { "field": { "from": "old", "to": "new" } }
     * May be null for DELETE actions where the entity is gone.
     */
    @Column(name = "diff", columnDefinition = "TEXT")
    private String diff;
}

