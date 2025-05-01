/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.cache;

import au.org.ala.search.model.dto.DatasetInfo;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.Map;

@AllArgsConstructor
@NoArgsConstructor
public class DenormalCache {
    public DenormalTaxon[] cacheTaxon;
    public DenormalIdentifier[] cacheIdentifier;
    public DenormalVariant[] cacheVariant;
    public DenormalVernacular[] cacheVernacular;
    public Map<String, DatasetInfo> attributionMap;
}
