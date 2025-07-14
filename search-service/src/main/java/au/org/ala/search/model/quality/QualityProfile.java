/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.quality;

import au.org.ala.search.serializer.QualityProfileSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Type;
import org.hibernate.type.SqlTypes;

/**
 * Schema
 *
 * CREATE TABLE dqprofile (
 *     id BIGSERIAL PRIMARY KEY,
 *     name VARCHAR(255) NOT NULL,
 *     data JSONB NOT NULL
 * );
 *
 * CREATE INDEX idx_dqprofile_name ON dqprofile(name);
 */
@NoArgsConstructor
@SuperBuilder
@Jacksonized
@Data
@JsonSerialize(using = QualityProfileSerializer.class)
@Entity
@Table(name = "dqprofile")
public class QualityProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(nullable = false)
    String name = "";

    @Type(JsonBinaryType.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    QualityProfileData data;
}
