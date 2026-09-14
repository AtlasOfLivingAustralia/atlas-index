/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.names;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic unit tests for {@link VernacularType}. No Spring context, no containers.
 */
class VernacularTypeTest {

    @Test
    void find_byExactTerm_caseSensitiveMatch() {
        assertThat(VernacularType.find("standard")).isEqualTo(VernacularType.STANDARD);
        assertThat(VernacularType.find("preferred")).isEqualTo(VernacularType.PREFERRED);
        assertThat(VernacularType.find("legislated")).isEqualTo(VernacularType.LEGISLATED);
    }

    @Test
    void find_byTerm_caseInsensitive() {
        assertThat(VernacularType.find("STANDARD")).isEqualTo(VernacularType.STANDARD);
        assertThat(VernacularType.find("Common")).isEqualTo(VernacularType.COMMON);
    }

    @Test
    void find_byAlternateTerm_matches() {
        assertThat(VernacularType.find("indigenousKnowledge"))
                .isEqualTo(VernacularType.TRADITIONAL_KNOWLEDGE);
        assertThat(VernacularType.find("INDIGENOUSKNOWLEDGE"))
                .isEqualTo(VernacularType.TRADITIONAL_KNOWLEDGE);
    }

    @Test
    void find_unknownName_returnsNull() {
        assertThat(VernacularType.find("not-a-real-vernacular-type")).isNull();
    }

    @Test
    void find_nullName_returnsNull() {
        assertThat(VernacularType.find(null)).isNull();
    }

    @Test
    void getPriority_reflectsDeclaredValue() {
        assertThat(VernacularType.LEGISLATED.getPriority()).isEqualTo(500);
        assertThat(VernacularType.STANDARD.getPriority()).isEqualTo(400);
        assertThat(VernacularType.PREFERRED.getPriority()).isEqualTo(300);
        assertThat(VernacularType.COMMON.getPriority()).isEqualTo(200);
        assertThat(VernacularType.TRADITIONAL_KNOWLEDGE.getPriority()).isEqualTo(200);
        assertThat(VernacularType.LOCAL.getPriority()).isEqualTo(100);
        assertThat(VernacularType.DEPRECATED.getPriority()).isEqualTo(1);
    }

    @Test
    void getAltTerms_emptyWhenNotDeclared() {
        assertThat(VernacularType.STANDARD.getAltTerms()).isEmpty();
    }

    @Test
    void getAltTerms_populatedWhenDeclared() {
        assertThat(VernacularType.TRADITIONAL_KNOWLEDGE.getAltTerms())
                .containsExactly("indigenousKnowledge");
    }
}
