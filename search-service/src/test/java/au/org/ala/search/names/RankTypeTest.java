/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.names;

import org.gbif.nameparser.api.Rank;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic unit tests for {@link RankType}. No Spring context, no containers.
 */
class RankTypeTest {

    @Test
    void getForId_knownId_returnsMatchingRank() {
        assertThat(RankType.getForId(7000)).isEqualTo(RankType.SPECIES);
        assertThat(RankType.getForId(6000)).isEqualTo(RankType.GENUS);
        assertThat(RankType.getForId(5000)).isEqualTo(RankType.FAMILY);
    }

    @Test
    void getForId_unknownId_returnsNull() {
        assertThat(RankType.getForId(999999)).isNull();
    }

    @Test
    void getForName_knownFieldName_returnsMatchingRank() {
        // multiple RankType entries share the "genus" field name; the last one registered during
        // static init (iteration order of EnumSet, i.e. declaration order) wins the lookup.
        assertThat(RankType.getForName("species")).isEqualTo(RankType.SPECIES);
        assertThat(RankType.getForName("family")).isEqualTo(RankType.FAMILY);
    }

    @Test
    void getForName_unknownFieldName_returnsNull() {
        assertThat(RankType.getForName("not-a-real-rank")).isNull();
    }

    @Test
    void getForCBRank_knownRank_returnsMatchingRankType() {
        assertThat(RankType.getForCBRank(Rank.SPECIES)).isEqualTo(RankType.SPECIES);
        assertThat(RankType.getForCBRank(Rank.GENUS)).isEqualTo(RankType.GENUS);
        assertThat(RankType.getForCBRank(Rank.KINGDOM)).isEqualTo(RankType.KINGDOM);
    }

    @Test
    void getForCBRank_rankWithNoMapping_returnsNull() {
        // SUPERGENUS declares a null cbRank, so no RankType maps to some cbRank values that
        // aren't referenced by any enum constant; use a rank with no explicit mapping in this enum
        assertThat(RankType.getForCBRank(Rank.OTHER)).isNull();
    }

    @Test
    void getForStrRank_matchesFieldNameCaseInsensitively() {
        assertThat(RankType.getForStrRank("SPECIES")).isEqualTo(RankType.SPECIES);
        assertThat(RankType.getForStrRank("species")).isEqualTo(RankType.SPECIES);
    }

    @Test
    void getForStrRank_matchesAlternateStringRankCaseInsensitively() {
        // SUBSPECIES has alternate string ranks: subsp, subsp., ssp, subtaxon, staxon, subsp.., susp
        assertThat(RankType.getForStrRank("ssp")).isEqualTo(RankType.SUBSPECIES);
        assertThat(RankType.getForStrRank("SSP")).isEqualTo(RankType.SUBSPECIES);
        assertThat(RankType.getForStrRank("subsp.")).isEqualTo(RankType.SUBSPECIES);
    }

    @Test
    void getForStrRank_unknownRank_returnsNull() {
        assertThat(RankType.getForStrRank("not-a-real-rank")).isNull();
    }

    @Test
    void getAllRanksBelow_returnsRanksWithIdGreaterOrEqual() {
        Set<RankType> ranksBelowSpecies = RankType.getAllRanksBelow(RankType.SPECIES.getId());

        assertThat(ranksBelowSpecies).contains(RankType.SPECIES, RankType.SUBSPECIES, RankType.VARIETY);
        assertThat(ranksBelowSpecies).doesNotContain(RankType.GENUS, RankType.FAMILY, RankType.KINGDOM);
    }

    @Test
    void isHigherThan_lowerIdIsHigherRank() {
        // Lower numeric id == higher taxonomic rank (e.g. KINGDOM id=1000 is "higher" than
        // SPECIES id=7000)
        assertThat(RankType.KINGDOM.isHigherThan(RankType.SPECIES)).isTrue();
        assertThat(RankType.SPECIES.isHigherThan(RankType.KINGDOM)).isFalse();
    }

    @Test
    void isHigherThan_sameRank_returnsFalse() {
        assertThat(RankType.SPECIES.isHigherThan(RankType.SPECIES)).isFalse();
    }

    @Test
    void isHigherThan_nullOther_returnsFalse() {
        assertThat(RankType.SPECIES.isHigherThan(null)).isFalse();
    }

    @Test
    void isHigherThan_negativeIds_returnsFalse() {
        // CULTIVARGROUP has id = -1
        assertThat(RankType.CULTIVARGROUP.isHigherThan(RankType.SPECIES)).isFalse();
        assertThat(RankType.SPECIES.isHigherThan(RankType.CULTIVARGROUP)).isFalse();
    }

    @Test
    void getBoost_someRanksHaveNoBoost() {
        assertThat(RankType.SPECIES.getBoost()).isEqualTo(2.0F);
        assertThat(RankType.GENUS.getBoost()).isEqualTo(3.0F);
        assertThat(RankType.SUBSPECIES.getBoost()).isNull();
    }

    @Test
    void isLoose_reflectsDeclaredFlag() {
        assertThat(RankType.SPECIES.isLoose()).isFalse();
        assertThat(RankType.HYBRID.isLoose()).isTrue();
        assertThat(RankType.GENUS_GROUP.isLoose()).isTrue();
    }

    @Test
    void getStrRanks_includesDeclaredAlternates() {
        assertThat(RankType.SUBSPECIES.getStrRanks())
                .contains("subsp", "subsp.", "ssp", "subtaxon", "staxon", "subsp..", "susp");
    }

    @Test
    void getSortOrder_isDistinctPerRank() {
        assertThat(RankType.KINGDOM.getSortOrder()).isEqualTo(1000);
        assertThat(RankType.SPECIES.getSortOrder()).isEqualTo(7000);
    }
}
