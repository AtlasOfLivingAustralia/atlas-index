/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.quality;

import au.org.ala.search.serializer.QualityProfileJackson3Serializer;
import au.org.ala.search.serializer.QualityProfileSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Type;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.util.Date;
import java.util.List;

/**
 * For schema see resources/flyway/
 */
@NoArgsConstructor
@SuperBuilder(toBuilder = true)
@Jacksonized
@Data
// Jackson 2 annotation: used by LeaderQueue's Smile ObjectMapper for the leader RPC round trip.
@JsonSerialize(using = QualityProfileSerializer.class)
// Jackson 3 annotation: used by Spring Boot 4's HTTP message converters. Jackson 3 ignores the
// Jackson 2 annotation above, so both are required.
@tools.jackson.databind.annotation.JsonSerialize(using = QualityProfileJackson3Serializer.class)
@Entity
@Table(name = "dqprofile")
public class QualityProfile implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Builder.Default
    @Column(nullable = false)
    String shortName = "";

    String name;
    String description;
    String contactName;
    String contactEmail;
    boolean enabled = false;
    boolean isDefault = false;
    Long displayOrder = 0L;
    Date dateCreated = new Date();
    Date lastUpdated = new Date();

    @Type(JsonBinaryType.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    List<QualityCategory> categories;
    /** Transient — not persisted. Carries the actor identity through the leader RPC for audit logging. */
    @Transient
    @Schema(hidden = true)
    String actor;
}
