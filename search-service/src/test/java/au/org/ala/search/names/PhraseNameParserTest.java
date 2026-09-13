/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.names;

import org.gbif.nameparser.api.NameType;
import org.gbif.nameparser.api.ParsedName;
import org.gbif.nameparser.api.Rank;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link PhraseNameParser}. No Spring context, no containers — exercises the
 * GBIF-derived parser directly against representative scientific and ALA "phrase" names.
 */
class PhraseNameParserTest {

    private final PhraseNameParser parser = new PhraseNameParser();

    @Test
    void parse_ordinaryBinomial_parsesAsScientificName() throws Exception {
        ParsedName pn = parser.parse("Eucalyptus regnans", null);

        assertThat(pn.getType()).isEqualTo(NameType.SCIENTIFIC);
        assertThat(pn.getGenus()).isEqualTo("Eucalyptus");
        assertThat(pn.getSpecificEpithet()).isEqualTo("regnans");
    }

    @Test
    void parse_binomialWithAuthor_parsesGenusAndEpithetAndAuthorship() throws Exception {
        ParsedName pn = parser.parse("Eucalyptus regnans F.Muell.", null);

        assertThat(pn.getType()).isEqualTo(NameType.SCIENTIFIC);
        assertThat(pn.getGenus()).isEqualTo("Eucalyptus");
        assertThat(pn.getSpecificEpithet()).isEqualTo("regnans");
        assertThat(pn.getCombinationAuthorship().getAuthors()).anyMatch(a -> a.contains("Muell"));
    }

    @Test
    void parse_phraseNameWithVoucher_parsesAsALAParsedNameWithLocationAndVoucher() throws Exception {
        ParsedName pn = parser.parse("Prostanthera sp. Somersby (B.J.Conn 3471)", Rank.SPECIES);

        assertThat(pn).isInstanceOf(ALAParsedName.class);
        ALAParsedName alapn = (ALAParsedName) pn;
        assertThat(alapn.getGenus()).isEqualTo("Prostanthera");
        assertThat(alapn.getLocationPhraseDescription()).isEqualTo("Somersby");
        assertThat(alapn.getPhraseVoucher()).isEqualTo("(B.J.Conn 3471)");
    }

    @Test
    void parse_phraseNameWithoutVoucher_parsesLocationOnly() throws Exception {
        ParsedName pn = parser.parse("Acacia sp. Bygoo", Rank.SPECIES);

        assertThat(pn).isInstanceOf(ALAParsedName.class);
        ALAParsedName alapn = (ALAParsedName) pn;
        assertThat(alapn.getGenus()).isEqualTo("Acacia");
        assertThat(alapn.getLocationPhraseDescription()).isEqualTo("Bygoo");
        assertThat(alapn.getPhraseVoucher()).isNull();
    }

    @Test
    void parse_speciesPlaceholder_noEpithet_stillParsesGenus() throws Exception {
        ParsedName pn = parser.parse("Eucalyptus sp.", Rank.SPECIES);

        assertThat(pn.getGenus()).isEqualTo("Eucalyptus");
    }

    @Test
    void parse_wrongCaseInfrageneric_correctedToProperCase() throws Exception {
        // lower-case infrageneric marker/epithet gets capitalised before re-parsing
        ParsedName pn = parser.parse("Acacia subgen. phyllodineae", null);

        assertThat(pn.getGenus()).isEqualTo("Acacia");
        assertThat(pn.getRank()).isEqualTo(Rank.SUBGENUS);
        assertThat(pn.getInfraspecificEpithet()).isEqualToIgnoringCase("phyllodineae");
    }

    @Test
    void parse_sameSpeciesNameTwice_isConsistent() throws Exception {
        ParsedName pn1 = parser.parse("Eucalyptus regnans", null);
        ParsedName pn2 = parser.parse("Eucalyptus regnans", null);

        assertThat(pn1.getGenus()).isEqualTo(pn2.getGenus());
        assertThat(pn1.getSpecificEpithet()).isEqualTo(pn2.getSpecificEpithet());
        assertThat(pn1.getType()).isEqualTo(pn2.getType());
    }
}
