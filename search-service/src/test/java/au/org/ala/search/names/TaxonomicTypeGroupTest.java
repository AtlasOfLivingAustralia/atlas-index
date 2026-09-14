/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.names;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link TaxonomicTypeGroup}. This is a plain enum with no behaviour of its own;
 * these tests simply guard against accidental renaming/removal of constants that
 * {@link TaxonomicType} and downstream code depend on.
 */
class TaxonomicTypeGroupTest {

    @Test
    void enum_declaresExpectedConstants() {
        assertThat(TaxonomicTypeGroup.values())
                .containsExactly(
                        TaxonomicTypeGroup.ACCEPTED,
                        TaxonomicTypeGroup.SYNONYM,
                        TaxonomicTypeGroup.MISAPPLIED,
                        TaxonomicTypeGroup.EXCLUDED,
                        TaxonomicTypeGroup.MISCELLANEOUS,
                        TaxonomicTypeGroup.INCERTAE_SEDIS,
                        TaxonomicTypeGroup.SPECIES_INQUIRENDA,
                        TaxonomicTypeGroup.UNPLACED,
                        TaxonomicTypeGroup.DOUBTFUL,
                        TaxonomicTypeGroup.INVALID);
    }

    @Test
    void valueOf_matchesConstantName() {
        assertThat(TaxonomicTypeGroup.valueOf("ACCEPTED")).isEqualTo(TaxonomicTypeGroup.ACCEPTED);
        assertThat(TaxonomicTypeGroup.valueOf("SYNONYM")).isEqualTo(TaxonomicTypeGroup.SYNONYM);
    }

    @Test
    void everyTaxonomicType_mapsToADeclaredGroup() {
        for (TaxonomicType type : TaxonomicType.values()) {
            assertThat(type.getGroup()).isIn((Object[]) TaxonomicTypeGroup.values());
        }
    }
}
