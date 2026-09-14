/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.names;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic unit tests for {@link TaxonomicType}. No Spring context, no containers.
 */
class TaxonomicTypeTest {

    @Test
    void accepted_classifiedCorrectly() {
        assertThat(TaxonomicType.ACCEPTED.isAccepted()).isTrue();
        assertThat(TaxonomicType.ACCEPTED.isSynonym()).isFalse();
        assertThat(TaxonomicType.ACCEPTED.isPrimary()).isTrue();
        assertThat(TaxonomicType.ACCEPTED.isOutput()).isTrue();
        assertThat(TaxonomicType.ACCEPTED.getGroup()).isEqualTo(TaxonomicTypeGroup.ACCEPTED);
        assertThat(TaxonomicType.ACCEPTED.getTerm()).isEqualTo("accepted");
    }

    @Test
    void inferredAccepted_alsoClassifiedAsAccepted() {
        assertThat(TaxonomicType.INFERRED_ACCEPTED.isAccepted()).isTrue();
        assertThat(TaxonomicType.INFERRED_ACCEPTED.getGroup()).isEqualTo(TaxonomicTypeGroup.ACCEPTED);
    }

    @Test
    void synonym_classifiedCorrectly() {
        assertThat(TaxonomicType.SYNONYM.isSynonym()).isTrue();
        assertThat(TaxonomicType.SYNONYM.isAccepted()).isFalse();
        assertThat(TaxonomicType.SYNONYM.getGroup()).isEqualTo(TaxonomicTypeGroup.SYNONYM);
    }

    @Test
    void synonymVariants_allClassifiedAsSynonym() {
        assertThat(TaxonomicType.HOMOTYPIC_SYNONYM.isSynonym()).isTrue();
        assertThat(TaxonomicType.OBJECTIVE_SYNONYM.isSynonym()).isTrue();
        assertThat(TaxonomicType.HETEROTYPIC_SYNONYM.isSynonym()).isTrue();
        assertThat(TaxonomicType.SUBJECTIVE_SYNONYM.isSynonym()).isTrue();
        assertThat(TaxonomicType.PRO_PARTE_SYNONYM.isSynonym()).isTrue();
        assertThat(TaxonomicType.INFERRED_SYNONYM.isSynonym()).isTrue();
    }

    @Test
    void misapplied_notAcceptedNotSynonymButIsSynonymGroupFlag() {
        assertThat(TaxonomicType.MISAPPLIED.isAccepted()).isFalse();
        assertThat(TaxonomicType.MISAPPLIED.isSynonym()).isTrue();
        assertThat(TaxonomicType.MISAPPLIED.isPrimary()).isFalse();
        assertThat(TaxonomicType.MISAPPLIED.isGeographic()).isTrue();
        assertThat(TaxonomicType.MISAPPLIED.getGroup()).isEqualTo(TaxonomicTypeGroup.MISAPPLIED);
    }

    @Test
    void excluded_notAcceptedNotSynonymNotPrimary() {
        assertThat(TaxonomicType.EXCLUDED.isAccepted()).isFalse();
        assertThat(TaxonomicType.EXCLUDED.isSynonym()).isFalse();
        assertThat(TaxonomicType.EXCLUDED.isPrimary()).isFalse();
        assertThat(TaxonomicType.EXCLUDED.getGroup()).isEqualTo(TaxonomicTypeGroup.EXCLUDED);
    }

    @Test
    void incertaeSedisAndSpeciesInquirenda_unplacedGroup() {
        assertThat(TaxonomicType.INCERTAE_SEDIS.getGroup()).isEqualTo(TaxonomicTypeGroup.INCERTAE_SEDIS);
        assertThat(TaxonomicType.INCERTAE_SEDIS.isPlaceholder()).isTrue();
        assertThat(TaxonomicType.SPECIES_INQUIRENDA.getGroup()).isEqualTo(TaxonomicTypeGroup.INCERTAE_SEDIS);
        assertThat(TaxonomicType.SPECIES_INQUIRENDA.isPlaceholder()).isTrue();
    }

    @Test
    void unplaced_isUnplacedFlagTrueAndHasLabel() {
        assertThat(TaxonomicType.UNPLACED.isUnplaced()).isTrue();
        assertThat(TaxonomicType.UNPLACED.getLabels()).contains("unknown");
        assertThat(TaxonomicType.INFERRED_UNPLACED.isUnplaced()).isTrue();
    }

    @Test
    void invalid_notAcceptedNotSynonymNotOutputOverride() {
        assertThat(TaxonomicType.INVALID.isAccepted()).isFalse();
        assertThat(TaxonomicType.INVALID.isSynonym()).isFalse();
        assertThat(TaxonomicType.INVALID.getGroup()).isEqualTo(TaxonomicTypeGroup.INVALID);
        assertThat(TaxonomicType.INFERRED_INVALID.getGroup()).isEqualTo(TaxonomicTypeGroup.INVALID);
    }

    @Test
    void doubtful_classifiedInDoubtfulGroup() {
        assertThat(TaxonomicType.DOUBTFUL.getGroup()).isEqualTo(TaxonomicTypeGroup.DOUBTFUL);
        assertThat(TaxonomicType.DOUBTFUL.isAccepted()).isFalse();
        assertThat(TaxonomicType.DOUBTFUL.isSynonym()).isFalse();
    }

    @Test
    void miscellaneousLiterature_geographicAndSynonymFlagsSet() {
        assertThat(TaxonomicType.MISCELLANEOUS_LITERATURE.isSynonym()).isTrue();
        assertThat(TaxonomicType.MISCELLANEOUS_LITERATURE.isUnplaced()).isTrue();
        assertThat(TaxonomicType.MISCELLANEOUS_LITERATURE.isGeographic()).isTrue();
        assertThat(TaxonomicType.MISCELLANEOUS_LITERATURE.getGroup())
                .isEqualTo(TaxonomicTypeGroup.MISCELLANEOUS);
    }

    @Test
    void pseudoTaxon_primaryButNotOutput() {
        assertThat(TaxonomicType.PSEUDO_TAXON.isPrimary()).isTrue();
        assertThat(TaxonomicType.PSEUDO_TAXON.isOutput()).isFalse();
        assertThat(TaxonomicType.PSEUDO_TAXON.getLabels()).isEmpty();
    }

    @Test
    void getLabels_defaultsToEmptyArrayWhenNotSpecified() {
        assertThat(TaxonomicType.ACCEPTED.getLabels()).isEmpty();
    }

    @Test
    void valueOf_matchesEnumConstantName() {
        assertThat(TaxonomicType.valueOf("ACCEPTED")).isEqualTo(TaxonomicType.ACCEPTED);
        assertThat(TaxonomicType.valueOf("SYNONYM")).isEqualTo(TaxonomicType.SYNONYM);
    }
}
