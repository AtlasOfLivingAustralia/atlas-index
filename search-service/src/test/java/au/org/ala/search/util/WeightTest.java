/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import au.org.ala.search.model.IndexDocType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Pure-logic unit tests for {@link Weight}. No Spring context, no containers.
 */
class WeightTest {

    private static final double WEIGHT_MIN = 0.1;
    private static final double WEIGHT_MAX = 10.0;
    private static final double WEIGHT_NORM = 1000.0;
    private static final double COMMON_STATUS_PRIORITY = 100.0;

    @Test
    void calcSearchWeight_taxonPriority_clampedBetweenMinAndMax() {
        // priority / weightNorm = 5000 / 1000 = 5.0, within [0.1, 10.0], then *2 for TAXON global
        float w = Weight.calcSearchWeight(
                IndexDocType.TAXON.name(), 5000, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(10.0f, within(0.0001f)); // 5.0 * 2 (TAXON global multiplier)
    }

    @Test
    void calcSearchWeight_taxonPriority_clampedToMax() {
        // priority / weightNorm = 100000 / 1000 = 100.0, clamped to weightMax = 10.0, then *2
        float w = Weight.calcSearchWeight(
                IndexDocType.TAXON.name(), 100000, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(20.0f, within(0.0001f)); // 10.0 * 2
    }

    @Test
    void calcSearchWeight_taxonPriority_clampedToMin() {
        // priority / weightNorm = 1 / 1000 = 0.001, clamped to weightMin = 0.1, then *2
        float w = Weight.calcSearchWeight(
                IndexDocType.TAXON.name(), 1, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(0.2f, within(0.0001f)); // 0.1 * 2
    }

    @Test
    void calcSearchWeight_commonPriority_dividedByCommonStatusPriority() {
        // priority / commonStatusPriority = 50 / 100 = 0.5, then *1.5 for COMMON global
        float w = Weight.calcSearchWeight(
                IndexDocType.COMMON.name(), 50, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(0.75f, within(0.0001f)); // 0.5 * 1.5
    }

    @Test
    void calcSearchWeight_nullPriority_usesInitialWeightOfOne() {
        // priority == null => initialWeight stays 1.0, then TAXON global *2
        float w = Weight.calcSearchWeight(
                IndexDocType.TAXON.name(), null, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(2.0f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_otherIdxType_priorityIgnored() {
        // priority set but idxtype not TAXON/COMMON => initialWeight stays 1.0 (default branch)
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), 5000, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.0f, within(0.0001f)); // REGION has no global multiplier case
    }

    @Test
    void calcSearchWeight_taxonVariantAndIdentifier_stronglyDownweighted() {
        float wVariant = Weight.calcSearchWeight(
                IndexDocType.TAXONVARIANT.name(), null, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);
        float wIdentifier = Weight.calcSearchWeight(
                IndexDocType.IDENTIFIER.name(), null, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(wVariant).isEqualTo(0.01f, within(0.0001f));
        assertThat(wIdentifier).isEqualTo(0.01f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_taxonomicStatus_accepted_doublesWeight() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, "accepted", null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(2.0f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_taxonomicStatus_misapplied_halvesWeight() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, "misapplied", null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(0.5f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_taxonomicStatus_excludedInvalidInferredExcluded_downweighted() {
        for (String status : new String[] {"excluded", "invalid", "inferredExcluded"}) {
            float w = Weight.calcSearchWeight(
                    IndexDocType.REGION.name(), null, status, null, null, null,
                    WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

            assertThat(w).as("status=%s", status).isEqualTo(0.3f, within(0.0001f));
        }
    }

    @Test
    void calcSearchWeight_taxonomicStatus_inferredSynonym_slightlyDownweighted() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, "inferredSynonym", null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(0.8f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_taxonomicStatus_inferredInvalid_heavilyDownweighted() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, "inferredInvalid", null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(0.1f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_taxonomicStatus_unknown_noChange() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, "somethingElse", null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.0f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_taxonomicStatus_null_noChange() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.0f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_rankId6000_boostedByTwoPointFive() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, null, 6000, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(2.5f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_rankId7000_boostedByOnePointEight() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, null, 7000, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.8f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_rankIdAbove8001_halved() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, null, 8002, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(0.5f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_rankIdAt8001_notHalved() {
        // boundary: rankID > 8001, so exactly 8001 should not trigger the multiplier
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, null, 8001, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.0f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_rankIdNull_noChange() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.0f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_hybridNameType_heavilyDownweighted() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, null, null, "hybrid", null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(0.2f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_nonHybridNameType_noChange() {
        float w = Weight.calcSearchWeight(
                IndexDocType.REGION.name(), null, null, null, "scientific", null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.0f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_commonFavourite_interest() {
        float w = Weight.calcSearchWeight(
                IndexDocType.COMMON.name(), null, null, null, null, "interest",
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        // COMMON global *1.5, then favourite "interest" *1.1
        assertThat(w).isEqualTo(1.65f, within(0.0001f));
    }

    @Test
    void calcSearchWeight_commonFavourite_preferred() {
        float w = Weight.calcSearchWeight(
                IndexDocType.COMMON.name(), null, null, null, null, "preferred",
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(2.25f, within(0.0001f)); // 1.5 * 1.5
    }

    @Test
    void calcSearchWeight_commonFavourite_favourite() {
        float w = Weight.calcSearchWeight(
                IndexDocType.COMMON.name(), null, null, null, null, "favourite",
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(3.75f, within(0.0001f)); // 1.5 * 2.5
    }

    @Test
    void calcSearchWeight_commonFavourite_iconic() {
        float w = Weight.calcSearchWeight(
                IndexDocType.COMMON.name(), null, null, null, null, "iconic",
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(15.0f, within(0.0001f)); // 1.5 * 10
    }

    @Test
    void calcSearchWeight_taxonFavourite_favourite() {
        float w = Weight.calcSearchWeight(
                IndexDocType.TAXON.name(), null, null, null, null, "favourite",
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(2.2f, within(0.0001f)); // TAXON global *2, then *1.1
    }

    @Test
    void calcSearchWeight_taxonFavourite_iconic() {
        float w = Weight.calcSearchWeight(
                IndexDocType.TAXON.name(), null, null, null, null, "iconic",
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(3.0f, within(0.0001f)); // TAXON global *2, then *1.5
    }

    @Test
    void calcSearchWeight_commonFavourite_notAppliedToTaxon() {
        // "iconic" for COMMON is *10, but this is TAXON so a different case applies (*1.5)
        float w = Weight.calcSearchWeight(
                IndexDocType.TAXON.name(), null, null, null, null, "interest",
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        // "interest" is not a recognised favourite value for TAXON, so no multiplier applied
        assertThat(w).isEqualTo(2.0f, within(0.0001f)); // just TAXON global *2
    }

    @Test
    void calcSearchWeight_favouriteNull_noChange() {
        float w = Weight.calcSearchWeight(
                IndexDocType.COMMON.name(), null, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.5f, within(0.0001f)); // COMMON global only
    }

    @Test
    void calcSuggestWeight_shortScientificName_noDampening() {
        // length <= 4 => no dampening applied
        float w = Weight.calcSuggestWeight(
                IndexDocType.REGION.name(), null, null, null, null, "Abcd",
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.0f, within(0.0001f));
    }

    @Test
    void calcSuggestWeight_longScientificName_dampened() {
        String scientificName = "Eucalyptus regnans";
        float w = Weight.calcSuggestWeight(
                IndexDocType.REGION.name(), null, null, null, null, scientificName,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        // w = 1.0 / (1.0 + ln(length * 0.01 + 1.0))
        double expected = 1.0 / (1.0 + Math.log(scientificName.length() * 0.01 + 1.0));
        assertThat(w).isEqualTo((float) expected, within(0.0001f));
        assertThat(w).isLessThan(1.0f);
    }

    @Test
    void calcSuggestWeight_nullScientificName_noDampening() {
        float w = Weight.calcSuggestWeight(
                IndexDocType.REGION.name(), null, null, null, null, null,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.0f, within(0.0001f));
    }

    @Test
    void calcSuggestWeight_emptyScientificName_noDampening() {
        float w = Weight.calcSuggestWeight(
                IndexDocType.REGION.name(), null, null, null, null, "",
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        assertThat(w).isEqualTo(1.0f, within(0.0001f));
    }

    @Test
    void calcSuggestWeight_combinesGlobalAndDampening() {
        // TAXON global *2, then dampened by scientific name length
        String scientificName = "Eucalyptus regnans";
        float w = Weight.calcSuggestWeight(
                IndexDocType.TAXON.name(), null, "accepted", null, null, scientificName,
                WEIGHT_MIN, WEIGHT_MAX, WEIGHT_NORM, COMMON_STATUS_PRIORITY);

        double globalWeight = 1.0 * 2 * 2; // TAXON *2, accepted *2
        double expected = globalWeight / (1.0 + Math.log(scientificName.length() * 0.01 + 1.0));
        assertThat(w).isEqualTo((float) expected, within(0.0001f));
    }
}
