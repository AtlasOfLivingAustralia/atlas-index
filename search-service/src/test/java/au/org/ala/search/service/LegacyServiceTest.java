/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.model.dto.IndexedField;
import au.org.ala.search.model.dto.Rank;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link LegacyService#getRanks(List)}. No Spring context, no containers, no
 * file I/O — the public {@code taxonRanks} field is populated directly with fixture data
 * instead of going through {@code init()}/{@code initTaxonRanks()}.
 */
class LegacyServiceTest {

    private Rank rank(String rank, Integer rankId) {
        return Rank.builder().rank(rank).rankID(rankId).build();
    }

    private IndexedField field(String name) {
        return new IndexedField(name, "string", true, true, null);
    }

    private LegacyService serviceWithRanks(Rank... ranks) {
        LegacyService service = new LegacyService();
        Map<String, Rank> taxonRanks = new LinkedHashMap<>();
        for (Rank r : ranks) {
            taxonRanks.put(r.getRank(), r);
        }
        service.taxonRanks = taxonRanks;
        return service;
    }

    @Test
    void getRanks_onlyIncludesRanksWithMatchingIndexedField() {
        LegacyService service = serviceWithRanks(
                rank("species", 7000),
                rank("genus", 6000));

        Map<String, Rank> result = service.getRanks(List.of(field("rk_species")));

        assertThat(result).containsOnlyKeys("species");
    }

    @Test
    void getRanks_noMatchingIndexedFields_returnsEmptyMap() {
        LegacyService service = serviceWithRanks(rank("species", 7000));

        Map<String, Rank> result = service.getRanks(List.of(field("some_other_field")));

        assertThat(result).isEmpty();
    }

    @Test
    void getRanks_sortedByRankIdAscending() {
        LegacyService service = serviceWithRanks(
                rank("species", 7000),
                rank("genus", 6000),
                rank("family", 5000));

        Map<String, Rank> result = service.getRanks(List.of(
                field("rk_species"), field("rk_genus"), field("rk_family")));

        assertThat(result.keySet()).containsExactly("family", "genus", "species");
    }

    @Test
    void getRanks_emptyIndexedFieldList_returnsEmptyMap() {
        LegacyService service = serviceWithRanks(rank("species", 7000));

        Map<String, Rank> result = service.getRanks(List.of());

        assertThat(result).isEmpty();
    }

    @Test
    void getRanks_requiresRkPrefixMatch() {
        LegacyService service = serviceWithRanks(rank("species", 7000));

        // field name "species" (without the "rk_" prefix) should not match
        Map<String, Rank> result = service.getRanks(List.of(field("species")));

        assertThat(result).isEmpty();
    }
}
