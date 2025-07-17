/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.quality;

// for OpenAPI anntotations
public class QualityFilterAPI {
    Long id;
    boolean enabled;
    String description;
    String filter;
    Long displayOrder;
    String inverseFilter;
}
