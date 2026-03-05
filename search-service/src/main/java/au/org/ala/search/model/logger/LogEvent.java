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

import java.util.Date;
import java.util.List;

@NoArgsConstructor
@SuperBuilder
@Data
@Entity
@Table(name = "log_event")
public class LogEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(nullable = false)
    private Long id;

    @Column
    private String comment;

    @Column
    private Date created;

    @Column(name = "log_event_type_id")
    private Integer logEventTypeId;

    @Column
    private String month;

    @Column(name = "user_email")
    private String userEmail;

    @Column(name = "user_ip")
    private String userIp;

    @Column
    private String source;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "log_reason_type_id")
    private Integer logReasonTypeId;

    @Column(name = "log_source_type_id")
    private Integer logSourceTypeId;

    @Column(name = "source_url")
    private String sourceUrl;

    @OneToMany(mappedBy = "logEvent", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<LogDetail> logDetails;
}

