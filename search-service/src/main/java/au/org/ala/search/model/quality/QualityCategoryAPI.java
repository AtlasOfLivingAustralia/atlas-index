/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.quality;

import java.util.List;

/**
 * for OpenAPI anntotations
 */
public class QualityCategoryAPI {
    Long id;
    boolean enabled;
    String name;
    String label;
    String description;
    Long displayOrder;
    String inverseFilter;
    List<QualityFilterAPI> qualityFilters;
}
