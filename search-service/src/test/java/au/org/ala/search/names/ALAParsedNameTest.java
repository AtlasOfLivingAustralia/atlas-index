/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.names;

import org.gbif.nameparser.api.Rank;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic unit tests for {@link ALAParsedName}. No Spring context, no containers.
 */
class ALAParsedNameTest {

    @Test
    void setLocationPhraseDescription_speciesRank_setsSpecificEpithet() {
        ALAParsedName name = new ALAParsedName();
        name.setRank(Rank.SPECIES);

        name.setLocationPhraseDescription("regnans");

        assertThat(name.getSpecificEpithet()).isEqualTo("regnans");
        assertThat(name.getLocationPhraseDescription()).isEqualTo("regnans");
    }

    @Test
    void setLocationPhraseDescription_cultivarRank_setsCultivarEpithet() {
        ALAParsedName name = new ALAParsedName();
        name.setRank(Rank.CULTIVAR);

        name.setLocationPhraseDescription("Golden Delicious");

        assertThat(name.getCultivarEpithet()).isEqualTo("Golden Delicious");
    }

    @Test
    void setLocationPhraseDescription_otherRank_setsInfraspecificEpithet() {
        ALAParsedName name = new ALAParsedName();
        name.setRank(Rank.SUBSPECIES);

        name.setLocationPhraseDescription("tasmaniensis");

        assertThat(name.getInfraspecificEpithet()).isEqualTo("tasmaniensis");
    }

    @Test
    void getLocationPhraseDesciption_deprecatedAlias_returnsSameValue() {
        ALAParsedName name = new ALAParsedName();
        name.setRank(Rank.SPECIES);
        name.setLocationPhraseDescription("regnans");

        assertThat(name.getLocationPhraseDesciption()).isEqualTo("regnans");
    }

    @Test
    void setLocationPhraseDescription_null_doesNotBuildCleanPhrase() {
        ALAParsedName name = new ALAParsedName();
        name.setRank(Rank.SPECIES);

        name.setLocationPhraseDescription(null);

        assertThat(name.getLocationPhraseDescription()).isNull();
        assertThat(name.cleanPhrase).isNull();
    }

    @Test
    void setLocationPhraseDescription_collapsesMultipleSpaces() {
        ALAParsedName name = new ALAParsedName();
        name.setRank(Rank.SPECIES);

        name.setLocationPhraseDescription("Mount   Wellington");

        // "Mt " and "Mount" are blacklisted terms and get replaced with a space, then multiple
        // spaces collapse into one
        assertThat(name.cleanPhrase).doesNotContain("  ");
    }

    @Test
    void setLocationPhraseDescription_removesQuotesFromCleanPhrase() {
        ALAParsedName name = new ALAParsedName();
        name.setRank(Rank.SPECIES);

        name.setLocationPhraseDescription("some \"quoted\" phrase");

        assertThat(name.cleanPhrase).doesNotContain("\"");
    }

    @Test
    void setPhraseVoucher_null_doesNotBuildCleanVoucher() {
        ALAParsedName name = new ALAParsedName();

        name.setPhraseVoucher(null);

        assertThat(name.getPhraseVoucher()).isNull();
        assertThat(name.cleanVoucher).isNull();
    }

    @Test
    void setPhraseVoucher_simpleVoucher_producesCleanVoucher() {
        ALAParsedName name = new ALAParsedName();

        name.setPhraseVoucher("Smith 1234");

        assertThat(name.getPhraseVoucher()).isEqualTo("Smith 1234");
        assertThat(name.cleanVoucher).isNotNull();
    }

    @Test
    void setPhraseVoucher_removesNonWordCharactersFromCleanVoucher() {
        ALAParsedName name = new ALAParsedName();

        name.setPhraseVoucher("Smith-1234 (holotype)");

        assertThat(name.cleanVoucher).doesNotContain("-", "(", ")", " ");
    }

    @Test
    void phraseNominatingParty_getterSetterRoundTrip() {
        ALAParsedName name = new ALAParsedName();

        name.setPhraseNominatingParty("J.Smith");

        assertThat(name.getPhraseNominatingParty()).isEqualTo("J.Smith");
    }

    @Test
    void copyConstructor_copiesFromParsedName() {
        org.gbif.nameparser.api.ParsedName base = new org.gbif.nameparser.api.ParsedName();
        base.setGenus("Eucalyptus");
        base.setSpecificEpithet("regnans");

        ALAParsedName copy = new ALAParsedName(base);

        assertThat(copy.getGenus()).isEqualTo("Eucalyptus");
        assertThat(copy.getSpecificEpithet()).isEqualTo("regnans");
    }
}
