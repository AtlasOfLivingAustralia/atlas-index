/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.cache;

import au.org.ala.search.model.SearchItemIndex;
import lombok.experimental.SuperBuilder;

/*
Subset of SearchItemIndex for caching
 */
@SuperBuilder
public class DenormalVernacular extends Denormal {
    public String guid;
    public String name;
    public String source; // source URL
    public String datasetID; // collectory dataResourceUid
    public String status; // status of the vernacular name, e.g. "traditionalKnowledge"
    public String language; // language code of the vernacular name, e.g. "N90"

    public DenormalVernacular(SearchItemIndex item) {
        super(item.taxonGuid);
        this.guid = item.guid;
        this.name = item.name;
        this.source = item.source;
        this.datasetID = item.datasetID;
        this.status = item.status;
        this.language = item.language;
    }
}
