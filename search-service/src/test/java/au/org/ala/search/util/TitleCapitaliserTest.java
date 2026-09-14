/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic unit tests for {@link TitleCapitaliser}. No Spring context, no containers.
 *
 * <p>Uses {@code messages.properties} (the default/"en" bundle) values:
 * <ul>
 *   <li>conjunctions: and, or, nor, but, for, yet, so
 *   <li>articles: a, an, the
 *   <li>prepositions: to, for, by, at, in, on, per, of, from
 *   <li>initials: d', O'
 * </ul>
 */
class TitleCapitaliserTest {

    private final TitleCapitaliser capitaliser = TitleCapitaliser.create("en");

    @Test
    void create_returnsSameInstanceForSameLanguage() {
        TitleCapitaliser second = TitleCapitaliser.create("en");
        assertThat(second).isSameAs(capitaliser);
    }

    @Test
    void capitalise_simpleTitle_capitalisesEachWord() {
        assertThat(capitaliser.capitalise("hello world")).isEqualTo("Hello World");
    }

    @Test
    void capitalise_firstAndLastWordAlwaysCapitalised() {
        // "the" is normally lower case, but here it's the first word so it's capitalised
        assertThat(capitaliser.capitalise("the quick brown fox"))
                .isEqualTo("The Quick Brown Fox");
    }

    @Test
    void capitalise_articleInMiddle_lowercased() {
        assertThat(capitaliser.capitalise("Lord of the Rings")).isEqualTo("Lord of the Rings");
    }

    @Test
    void capitalise_conjunctionInMiddle_lowercased() {
        assertThat(capitaliser.capitalise("Fire and Ice")).isEqualTo("Fire and Ice");
    }

    @Test
    void capitalise_prepositionInMiddle_lowercased() {
        assertThat(capitaliser.capitalise("Gone to Ground")).isEqualTo("Gone to Ground");
    }

    @Test
    void capitalise_lastWordConjunction_stillCapitalised() {
        // "for" is a conjunction/preposition, but as the last word it must be capitalised
        assertThat(capitaliser.capitalise("What Is It For")).isEqualTo("What Is It For");
    }

    @Test
    void capitalise_hyphenatedWord_capitalisesAfterHyphen() {
        assertThat(capitaliser.capitalise("indo-pacific")).isEqualTo("Indo-Pacific");
    }

    @Test
    void capitalise_abbreviationWithDots_capitalisesAfterEachDot() {
        assertThat(capitaliser.capitalise("a.j.p.")).isEqualTo("A.J.P.");
    }

    @Test
    void capitalise_initialApostropheD_recognisedAndCapitalisedAfter() {
        // "d'" keeps its lower case (not a recognised uppercase form of the initial), but the
        // letter after the apostrophe is capitalised.
        assertThat(capitaliser.capitalise("d'artagnan")).isEqualTo("d'Artagnan");
    }

    @Test
    void capitalise_initialApostropheO_recognisedAndCapitalisedAfter() {
        assertThat(capitaliser.capitalise("o'brien")).isEqualTo("O'Brien");
    }

    @Test
    void capitalise_unrecognisedApostropheInitial_fallsBackToNormalCapitalisation() {
        // "x'" is not a recognised initial (only "d'"/"O'" are), so ordinary capitalisation
        // applies: capitalise the first letter, then continue lower case after the apostrophe
        // (apostrophe does not reset the capitalisation flag).
        assertThat(capitaliser.capitalise("x'ray")).isEqualTo("X'ray");
    }

    @Test
    void capitalise_singleWordTitle_capitalised() {
        assertThat(capitaliser.capitalise("hello")).isEqualTo("Hello");
    }

    @Test
    void capitalise_allCapsInput_normalisedToTitleCase() {
        assertThat(capitaliser.capitalise("THE QUICK BROWN FOX")).isEqualTo("The Quick Brown Fox");
    }

    @Test
    void capitalise_multipleSpacesBetweenWords_collapsedToSingleSpace() {
        assertThat(capitaliser.capitalise("hello   world")).isEqualTo("Hello World");
    }
}
