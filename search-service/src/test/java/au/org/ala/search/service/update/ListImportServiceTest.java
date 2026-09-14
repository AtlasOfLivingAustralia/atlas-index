/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.service.auth.WebService;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.ListApiService;
import au.org.ala.search.service.remote.LogService;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Pure-logic unit tests for {@link ListImportService}'s {@code arraysEqual} comparison helper.
 * No Spring context, no containers — constructor dependencies are Mockito mocks that are never
 * invoked, and the private method is exercised via reflection.
 */
class ListImportServiceTest {

    private final ListImportService listImportService = new ListImportService(
            mock(ElasticService.class), mock(ListApiService.class), mock(LogService.class), mock(ListCache.class));

    private boolean arraysEqual(String a, List<String> b) throws Exception {
        Method m = ListImportService.class.getDeclaredMethod("arraysEqual", String.class, List.class);
        m.setAccessible(true);
        return (boolean) m.invoke(listImportService, a, b);
    }

    @Test
    void arraysEqual_emptyStringAndEmptyList_returnsTrue() throws Exception {
        assertThat(arraysEqual("", List.of())).isTrue();
    }

    @Test
    void arraysEqual_nullStringAndEmptyList_returnsTrue() throws Exception {
        assertThat(arraysEqual(null, List.of())).isTrue();
    }

    @Test
    void arraysEqual_emptyStringAndNonEmptyList_returnsFalse() throws Exception {
        assertThat(arraysEqual("", List.of("a"))).isFalse();
    }

    @Test
    void arraysEqual_matchingCommaSeparatedValues_returnsTrue() throws Exception {
        assertThat(arraysEqual("a,b,c", List.of("a", "b", "c"))).isTrue();
    }

    @Test
    void arraysEqual_matchingValuesDifferentOrder_returnsTrue() throws Exception {
        // comparison uses List.contains, so order doesn't matter
        assertThat(arraysEqual("a,b,c", List.of("c", "b", "a"))).isTrue();
    }

    @Test
    void arraysEqual_differentSizes_returnsFalse() throws Exception {
        assertThat(arraysEqual("a,b", List.of("a", "b", "c"))).isFalse();
    }

    @Test
    void arraysEqual_sameSizeDifferentValues_returnsFalse() throws Exception {
        assertThat(arraysEqual("a,b", List.of("a", "c"))).isFalse();
    }

    @Test
    void arraysEqual_singleValueNoComma_matchesSingleElementList() throws Exception {
        assertThat(arraysEqual("a", List.of("a"))).isTrue();
    }
}
