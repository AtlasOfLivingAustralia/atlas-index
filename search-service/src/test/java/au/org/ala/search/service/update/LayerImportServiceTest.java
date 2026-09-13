/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Pure-logic unit tests for {@link LayerImportService}'s {@code stringEquals}/{@code arrayEquals}
 * comparison helpers. No Spring context, no containers — constructor dependencies are Mockito
 * mocks that are never invoked, and the private methods are exercised via reflection.
 */
class LayerImportServiceTest {

    private final LayerImportService layerImportService = new LayerImportService(
            mock(ElasticService.class), mock(LogService.class));

    private boolean stringEquals(String a, String b) throws Exception {
        Method m = LayerImportService.class.getDeclaredMethod("stringEquals", String.class, String.class);
        m.setAccessible(true);
        return (boolean) m.invoke(layerImportService, a, b);
    }

    private boolean arrayEquals(String[] a, String[] b) throws Exception {
        Method m = LayerImportService.class.getDeclaredMethod("arrayEquals", String[].class, String[].class);
        m.setAccessible(true);
        return (boolean) m.invoke(layerImportService, (Object) a, (Object) b);
    }

    @Test
    void stringEquals_bothNull_returnsTrue() throws Exception {
        assertThat(stringEquals(null, null)).isTrue();
    }

    @Test
    void stringEquals_oneNull_returnsFalse() throws Exception {
        assertThat(stringEquals(null, "a")).isFalse();
        assertThat(stringEquals("a", null)).isFalse();
    }

    @Test
    void stringEquals_equalValues_returnsTrue() throws Exception {
        assertThat(stringEquals("hello", "hello")).isTrue();
    }

    @Test
    void stringEquals_differentValues_returnsFalse() throws Exception {
        assertThat(stringEquals("hello", "world")).isFalse();
    }

    @Test
    void stringEquals_caseSensitive() throws Exception {
        assertThat(stringEquals("Hello", "hello")).isFalse();
    }

    @Test
    void arrayEquals_bothNull_returnsTrue() throws Exception {
        assertThat(arrayEquals(null, null)).isTrue();
    }

    @Test
    void arrayEquals_oneNull_returnsFalse() throws Exception {
        assertThat(arrayEquals(null, new String[]{"a"})).isFalse();
        assertThat(arrayEquals(new String[]{"a"}, null)).isFalse();
    }

    @Test
    void arrayEquals_differentLengths_returnsFalse() throws Exception {
        assertThat(arrayEquals(new String[]{"a"}, new String[]{"a", "b"})).isFalse();
    }

    @Test
    void arrayEquals_sameElementsInOrder_returnsTrue() throws Exception {
        assertThat(arrayEquals(new String[]{"a", "b"}, new String[]{"a", "b"})).isTrue();
    }

    @Test
    void arrayEquals_sameElementsDifferentOrder_returnsFalse() throws Exception {
        // comparison is index-based, not set-based
        assertThat(arrayEquals(new String[]{"a", "b"}, new String[]{"b", "a"})).isFalse();
    }

    @Test
    void arrayEquals_bothEmpty_returnsTrue() throws Exception {
        assertThat(arrayEquals(new String[]{}, new String[]{})).isTrue();
    }

    @Test
    void arrayEquals_containsNullElements_handledSafely() throws Exception {
        assertThat(arrayEquals(new String[]{null, "b"}, new String[]{null, "b"})).isTrue();
        assertThat(arrayEquals(new String[]{null, "b"}, new String[]{"a", "b"})).isFalse();
    }
}
