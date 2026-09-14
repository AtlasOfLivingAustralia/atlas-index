/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.model.dto.RankedName;
import au.org.ala.search.model.dto.SpeciesGroup;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link SpeciesGroupService#groupsFor(List)} and
 * {@link SpeciesGroupService#normaliseRank(String)}. No Spring context, no containers — the
 * package-private {@code groupByRank} map is populated directly with fixture data instead of
 * going through {@code init()}/file loading, avoiding any file I/O.
 */
class SpeciesGroupServiceTest {

    private SpeciesGroup group(String name, String rank, Set<String> included, Set<String> excluded) {
        SpeciesGroup g = new SpeciesGroup();
        g.name = name;
        g.rank = rank;
        g.included = included;
        g.excluded = excluded;
        return g;
    }

    private SpeciesGroupService serviceWithGroups(String rank, SpeciesGroup... groups) {
        SpeciesGroupService service = new SpeciesGroupService();
        service.groupByRank.put(rank, List.of(groups));
        return service;
    }

    @Test
    void normaliseRank_lowercasesAndReplacesNonLetters() {
        assertThat(SpeciesGroupService.normaliseRank("Sub-Class")).isEqualTo("sub_class");
        assertThat(SpeciesGroupService.normaliseRank("phylum")).isEqualTo("phylum");
    }

    @Test
    void normaliseRank_null_returnsNull() {
        assertThat(SpeciesGroupService.normaliseRank(null)).isNull();
    }

    @Test
    void groupsFor_nullInput_returnsNull() {
        SpeciesGroupService service = new SpeciesGroupService();

        assertThat(service.groupsFor(null)).isNull();
    }

    @Test
    void groupsFor_emptyInput_returnsNull() {
        SpeciesGroupService service = new SpeciesGroupService();

        assertThat(service.groupsFor(List.of())).isNull();
    }

    @Test
    void groupsFor_matchingIncludedName_returnsGroup() {
        SpeciesGroupService service = serviceWithGroups("phylum",
                group("Animals", "phylum", Set.of("chordata"), null));

        List<String> result = service.groupsFor(List.of(new RankedName("chordata", "phylum")));

        assertThat(result).containsExactly("Animals");
    }

    @Test
    void groupsFor_noMatchingRank_returnsEmptyList() {
        SpeciesGroupService service = serviceWithGroups("phylum",
                group("Animals", "phylum", Set.of("chordata"), null));

        List<String> result = service.groupsFor(List.of(new RankedName("chordata", "class")));

        assertThat(result).isEmpty();
    }

    @Test
    void groupsFor_nameNotInIncludedSet_returnsEmptyList() {
        SpeciesGroupService service = serviceWithGroups("phylum",
                group("Animals", "phylum", Set.of("chordata"), null));

        List<String> result = service.groupsFor(List.of(new RankedName("mollusca", "phylum")));

        assertThat(result).isEmpty();
    }

    @Test
    void groupsFor_excludedNameElsewhereInList_excludesGroup() {
        SpeciesGroupService service = serviceWithGroups("phylum",
                group("Animals", "phylum", Set.of("chordata"), Set.of("mammalia")));

        List<String> result = service.groupsFor(List.of(
                new RankedName("chordata", "phylum"),
                new RankedName("mammalia", "class")));

        assertThat(result).isEmpty();
    }

    @Test
    void groupsFor_excludedNameNotPresent_includesGroup() {
        SpeciesGroupService service = serviceWithGroups("phylum",
                group("Animals", "phylum", Set.of("chordata"), Set.of("mammalia")));

        List<String> result = service.groupsFor(List.of(
                new RankedName("chordata", "phylum"),
                new RankedName("aves", "class")));

        assertThat(result).containsExactly("Animals");
    }

    @Test
    void groupsFor_multipleMatchingGroups_returnsAll() {
        SpeciesGroupService service = new SpeciesGroupService();
        service.groupByRank.put("phylum", List.of(
                group("Animals", "phylum", Set.of("chordata"), null),
                group("Vertebrates", "phylum", Set.of("chordata"), null)));

        List<String> result = service.groupsFor(List.of(new RankedName("chordata", "phylum")));

        assertThat(result).containsExactlyInAnyOrder("Animals", "Vertebrates");
    }

    @Test
    void groupsFor_rankCaseInsensitiveViaNormalisation() {
        SpeciesGroupService service = serviceWithGroups("phylum",
                group("Animals", "phylum", Set.of("chordata"), null));

        // rank in input differs in case, normaliseRank lower-cases it before lookup
        List<String> result = service.groupsFor(List.of(new RankedName("chordata", "PHYLUM")));

        assertThat(result).containsExactly("Animals");
    }

    @Test
    void groupsFor_groupWithNullIncludedSet_neverMatches() {
        SpeciesGroupService service = serviceWithGroups("phylum",
                group("Animals", "phylum", null, null));

        List<String> result = service.groupsFor(List.of(new RankedName("chordata", "phylum")));

        assertThat(result).isEmpty();
    }
}
