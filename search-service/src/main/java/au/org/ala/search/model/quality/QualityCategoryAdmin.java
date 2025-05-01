/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.quality;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;

/**
 * Same as QualityCategory but with the default marshaller
 */
@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
public class QualityCategoryAdmin {
    Long id;
    boolean enabled;
    String name;
    String label;
    String description;
    Long displayOrder;
    String inverseFilter;
    List<QualityFilterAdmin> qualityFilters;

    public QualityCategoryAdmin(QualityCategory qualityCategory) {
        this.id = qualityCategory.id;
        this.enabled = qualityCategory.enabled;
        this.name = qualityCategory.name;
        this.label = qualityCategory.label;
        this.description = qualityCategory.description;
        this.displayOrder = qualityCategory.displayOrder;
        this.inverseFilter = qualityCategory.inverseFilter;
        this.qualityFilters = new ArrayList();
        if (qualityCategory.getQualityFilters() != null) {
            for (QualityFilter qualityFilter : qualityCategory.getQualityFilters()) {
                this.qualityFilters.add(new QualityFilterAdmin(qualityFilter));
            }
        }
    }
}
