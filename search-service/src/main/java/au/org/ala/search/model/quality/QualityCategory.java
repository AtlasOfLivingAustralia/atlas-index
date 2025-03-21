/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.quality;

import au.org.ala.search.serializer.QualityCategorySerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.util.List;

@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
@JsonSerialize(using = QualityCategorySerializer.class)
public class QualityCategory {
    Long id;
    boolean enabled;
    String name;
    String label;
    String description;
    Long displayOrder;
    String inverseFilter;
    List<QualityFilter> qualityFilters;
}
