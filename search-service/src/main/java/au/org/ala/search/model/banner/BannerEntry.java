/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.banner;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.OffsetDateTime;

/**
 * A banner message displayed in a named UI section (e.g. "global", "regions", "search").
 */
@NoArgsConstructor
@SuperBuilder
@Data
@Entity
@Table(name = "banner")
public class BannerEntry {

    /** Logical name of the UI section, e.g. "global", "regions", "search" */
    @Id
    @Column(nullable = false)
    private String section;

    /** The banner message text (empty string means no active banner) */
    @Column(nullable = false)
    private String message;

    /** Severity level: INFO, WARNING, ERROR */
    @Column(nullable = false)
    private String severity;

    /** Whether users can dismiss/close the banner */
    @Column(nullable = false)
    private boolean closable;

    /** Timestamp of the last update */
    @Column(nullable = false)
    private OffsetDateTime updated;
}
