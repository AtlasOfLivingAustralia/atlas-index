/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.doi;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Type;
import org.hibernate.type.SqlTypes;

import java.util.*;

@ToString
@EqualsAndHashCode
@JsonIgnoreProperties(ignoreUnknown = true)
@NoArgsConstructor
@Data
@SuperBuilder
@Entity
@Table(name = "doi")
public class Doi {

    public static final Set<String> ALLOWED_UPDATABLE_PROPERTIES = Set.of(
            "providerMetadata", "customLandingPageUrl", "title", "authors", "description", "licence",
            "applicationUrl", "applicationMetadata", "active"
    );

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(nullable = false)
    private Long id;

    @Column(nullable = false, unique = true)
    private UUID uuid;

    @Column(nullable = false, columnDefinition = "citext")
    private String doi;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String authors;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "authorised_roles", columnDefinition = "text[]")
    private List<String> authorisedRoles;

    @Column(name = "licence", columnDefinition = "text[]")
    private List<String> licence;

    @Column(nullable = false)
    private String description;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    @Column(name = "date_minted", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date dateMinted;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DoiProvider provider;

    private String filename;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "file_hash")
    private byte[] fileHash;

    @Column(name = "file_size")
    private Long fileSize;

    @Type(JsonBinaryType.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "provider_metadata", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> providerMetadata;

    @Type(JsonBinaryType.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "application_metadata", columnDefinition = "jsonb")
    private Map<String, Object> applicationMetadata;

    @Column(name = "custom_landing_page_url")
    private String customLandingPageUrl;

    @Column(name = "application_url")
    private String applicationUrl;

    @Column(nullable = false)
    private Boolean active = true;

    @Version
    @Column(nullable = false)
    private Long version;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    @Column(name = "date_created", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date dateCreated;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    @Column(name = "last_updated", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date lastUpdated;

    @Column(name = "display_template")
    private String displayTemplate;

    @PrePersist
    public void beforeValidate() {
        if (uuid == null) {
            uuid = UUID.randomUUID();
        }
        if (active == null) {
            active = true;
        }
    }
}
