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

/**
 * Same as QualityFilter but with the default marshaller
 */
@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
public class QualityFilterAdmin {
    Long id;
    boolean enabled;
    String description;
    String filter;
    Long displayOrder;
    String inverseFilter;

    public QualityFilterAdmin(QualityFilter qualityFilter) {
        this.id = qualityFilter.id;
        this.enabled = qualityFilter.enabled;
        this.description = qualityFilter.description;
        this.filter = qualityFilter.filter;
        this.displayOrder = qualityFilter.displayOrder;
        this.inverseFilter = qualityFilter.inverseFilter;
    }
}
