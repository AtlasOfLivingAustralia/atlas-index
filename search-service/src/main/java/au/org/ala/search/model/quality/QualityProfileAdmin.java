/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.quality;

import au.org.ala.search.serializer.QualityProfileAdminSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import org.springframework.data.annotation.Id;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Same as QualityProfile but with the default marshaller
 */
@NoArgsConstructor
@SuperBuilder
@Jacksonized
@Data
@JsonSerialize(using = QualityProfileAdminSerializer.class)
public class QualityProfileAdmin {
    @Id
    Long id;
    String name = "";
    String shortName = "";
    String description;
    String contactName;
    String contactEmail;
    boolean enabled = false;
    boolean isDefault = false;
    Long displayOrder = 0L;
    Date dateCreated = new Date();
    Date lastUpdated = new Date();
    List<QualityCategoryAdmin> categories;

    public QualityProfileAdmin(QualityProfile qualityProfile) {
        this.id = qualityProfile.id;
        this.name = qualityProfile.name;
        this.shortName = qualityProfile.data.shortName;
        this.description = qualityProfile.data.description;
        this.contactName = qualityProfile.data.contactName;
        this.contactEmail = qualityProfile.data.contactEmail;
        this.enabled = qualityProfile.data.enabled;
        this.isDefault = qualityProfile.data.isDefault;
        this.displayOrder = qualityProfile.data.displayOrder;
        this.dateCreated = qualityProfile.data.dateCreated;
        this.lastUpdated = qualityProfile.data.lastUpdated;
        this.categories = new ArrayList<>();
        if (qualityProfile.data.categories != null) {
            for (QualityCategory category : qualityProfile.data.categories) {
                this.categories.add(new QualityCategoryAdmin(category));
            }
        }
    }

    public QualityProfile toQualityProfile() {
        QualityProfile qualityProfile = new QualityProfile();
        qualityProfile.id = this.id;
        qualityProfile.name = this.name;
        qualityProfile.data = new QualityProfileData();
        qualityProfile.data.shortName = this.shortName;
        qualityProfile.data.description = this.description;
        qualityProfile.data.contactName = this.contactName;
        qualityProfile.data.contactEmail = this.contactEmail;
        qualityProfile.data.enabled = this.enabled;
        qualityProfile.data.isDefault = this.isDefault;
        qualityProfile.data.displayOrder = this.displayOrder;
        qualityProfile.data.dateCreated = this.dateCreated;
        qualityProfile.data.lastUpdated = this.lastUpdated;
        qualityProfile.data.categories = new ArrayList<>();
        if (this.categories != null) {
            for (QualityCategoryAdmin categoryAdmin : this.categories) {
                qualityProfile.data.categories.add(categoryAdmin.toQualityCategory());
            }
        }
        return qualityProfile;
    }
}
