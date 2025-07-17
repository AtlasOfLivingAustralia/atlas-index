/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.quality;

import java.util.List;

/**
 * For OpenAPI annotations.
 */
public class QualityProfileAPI {
    Long id;
    String name = "";
    String shortName = "";
    String description;
    String contactName;
    String contactEmail;
    List<QualityCategoryAPI> categories;
}
