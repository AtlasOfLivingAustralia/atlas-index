/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.taxon;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * Represents a composite key for UserData entity.
 */

@Data
@EqualsAndHashCode
@NoArgsConstructor
public class TaxonDataId implements Serializable {
    public String taxonConceptId;
    public String key;

    public TaxonDataId(String taxonConceptId, String id) {
        this.taxonConceptId = taxonConceptId;
        this.key = id;
    }
}
