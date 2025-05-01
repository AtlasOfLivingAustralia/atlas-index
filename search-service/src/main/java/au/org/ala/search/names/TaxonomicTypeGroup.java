/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.names;

/**
 * This is a copy from ala-name-matching-model.
 */
public enum TaxonomicTypeGroup {
    ACCEPTED,
    SYNONYM,
    MISAPPLIED,
    EXCLUDED,
    MISCELLANEOUS,
    INCERTAE_SEDIS,
    SPECIES_INQUIRENDA,
    UNPLACED,
    DOUBTFUL,
    INVALID;

    TaxonomicTypeGroup() {
    }
}
