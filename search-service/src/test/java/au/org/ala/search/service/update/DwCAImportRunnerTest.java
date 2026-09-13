/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.dto.Rank;
import au.org.ala.search.service.LanguageService;
import au.org.ala.search.service.LegacyService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Pure-logic unit tests for {@link DwCAImportRunner#buildNameFormatted}. No Spring context, no
 * containers — constructor dependencies are Mockito mocks (never invoked by this method, except
 * {@link LegacyService#taxonRanks}, which is a plain public field stubbed directly since {@code
 * LegacyService} is a concrete class, not an interface). {@code buildNameFormatted} is
 * package-private, so this test (same package) calls it directly without reflection.
 */
class DwCAImportRunnerTest {

    private DwCAImportRunner runner;
    private LegacyService legacyService;

    @BeforeEach
    void setUp() {
        legacyService = new LegacyService();
        legacyService.taxonRanks = Map.of(
                "species", Rank.builder().rank("species").rankGroup("species").rankID(7000).build(),
                "genus", Rank.builder().rank("genus").rankGroup("genus").rankID(6000).build()
        );
        runner = new DwCAImportRunner(
                mock(ElasticService.class), mock(LogService.class),
                mock(DwCADenormaliseImportService.class), legacyService, mock(LanguageService.class));
    }

    @Test
    void nameFormattedSupplied_returnedVerbatim_noEscapingOrWrapping() {
        String result = runner.buildNameFormatted(
                "<span class=\"custom\">already formatted <b>&</b></span>",
                "Macropus rufus (Desmarest, 1822)",
                "Macropus rufus",
                "(Desmarest, 1822)",
                "species");

        assertThat(result).isEqualTo("<span class=\"custom\">already formatted <b>&</b></span>");
    }

    @Test
    void noNameFormatted_authorNotFoundInNameComplete_wrapsWholeNameComplete() {
        String result = runner.buildNameFormatted(
                null,
                "Macropus rufus Smith",
                "Macropus rufus",
                "(Desmarest, 1822)", // not a substring of nameComplete -> indexOf == -1
                "species");

        assertThat(result).isEqualTo(
                "<span class=\"scientific-name rank-species\">Macropus rufus Smith</span>");
    }

    @Test
    void noNameFormatted_authorAtStartOfNameComplete_treatedSameAsNotFound() {
        // authorIndex == 0 (author is a prefix of nameComplete) hits the same "<= 0" branch as
        // not-found, an easy-to-miss boundary in the implementation.
        String result = runner.buildNameFormatted(
                null,
                "(Desmarest, 1822) trailing text",
                "Macropus rufus",
                "(Desmarest, 1822)",
                "species");

        assertThat(result).isEqualTo(
                "<span class=\"scientific-name rank-species\">(Desmarest, 1822) trailing text</span>");
    }

    @Test
    void noNameFormatted_authorFoundMidNameComplete_splitsIntoPreAuthorAuthorPostAuthorSpans() {
        String result = runner.buildNameFormatted(
                null,
                "Macropus rufus (Desmarest, 1822) subsp. foo",
                "Macropus rufus",
                "(Desmarest, 1822)",
                "species");

        assertThat(result).isEqualTo(
                "<span class=\"scientific-name rank-species\">"
                        + "<span class=\"name\">Macropus rufus</span> "
                        + "<span class=\"author\">(Desmarest, 1822)</span> "
                        + "<span class=\"name\">subsp. foo</span>"
                        + "</span>");
    }

    @Test
    void noNameFormatted_authorAtEndOfNameComplete_omitsEmptyPostAuthorSpan() {
        String result = runner.buildNameFormatted(
                null,
                "Macropus rufus (Desmarest, 1822)",
                "Macropus rufus",
                "(Desmarest, 1822)",
                "species");

        assertThat(result).isEqualTo(
                "<span class=\"scientific-name rank-species\">"
                        + "<span class=\"name\">Macropus rufus</span> "
                        + "<span class=\"author\">(Desmarest, 1822)</span>"
                        + "</span>");
    }

    @Test
    void noNameFormattedNoNameComplete_authorshipPresent_buildsFromScientificNameAndAuthorship() {
        String result = runner.buildNameFormatted(
                null,
                null,
                "Macropus rufus",
                "(Desmarest, 1822)",
                "species");

        assertThat(result).isEqualTo(
                "<span class=\"scientific-name rank-species\">"
                        + "<span class=\"name\">Macropus rufus</span> "
                        + "<span class=\"author\">(Desmarest, 1822)</span>"
                        + "</span>");
    }

    @Test
    void noNameFormattedNoNameCompleteNoAuthorship_buildsFromScientificNameOnly() {
        String result = runner.buildNameFormatted(
                null,
                null,
                "Macropus rufus",
                null,
                "species");

        assertThat(result).isEqualTo(
                "<span class=\"scientific-name rank-species\">"
                        + "<span class=\"name\">Macropus rufus</span>"
                        + "</span>");
    }

    @Test
    void unrecognisedRank_fallsBackToUnknownRankGroup() {
        String result = runner.buildNameFormatted(
                null, null, "Macropus rufus", null, "not-a-real-rank");

        assertThat(result).isEqualTo(
                "<span class=\"scientific-name rank-unknown\">"
                        + "<span class=\"name\">Macropus rufus</span>"
                        + "</span>");
    }

    @Test
    void htmlSpecialCharactersInNames_areEscaped() {
        String result = runner.buildNameFormatted(
                null, null, "Rock & Roll <genus>", null, "genus");

        assertThat(result).isEqualTo(
                "<span class=\"scientific-name rank-genus\">"
                        + "<span class=\"name\">Rock &amp; Roll &lt;genus&gt;</span>"
                        + "</span>");
    }

    @Test
    void emptyStringNameFormatted_treatedAsNotSupplied_fallsThroughToNameComplete() {
        String result = runner.buildNameFormatted(
                "", "Macropus rufus Smith", "Macropus rufus", null, "species");

        assertThat(result).isEqualTo(
                "<span class=\"scientific-name rank-species\">Macropus rufus Smith</span>");
    }

    @Test
    void emptyStringRank_omitsRankSuffixButStillReachesTaxonRanksLookup() {
        // An empty (but non-null) rank is the real-world "unknown rank" case produced by every
        // actual call site — reaches taxonRanks.containsKey("") safely (unlike a literal null).
        String result = runner.buildNameFormatted(
                null, null, "Macropus rufus", null, "");

        assertThat(result).isEqualTo(
                "<span class=\"scientific-name\">"
                        + "<span class=\"name\">Macropus rufus</span>"
                        + "</span>");
    }
}
