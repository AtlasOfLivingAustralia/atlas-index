/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.repo.DataQualityPostgresRepository;
import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Pure-logic unit tests for {@link QualityDataService}'s {@code invert} and {@code nextId}
 * helpers. No Spring context, no containers — constructor dependencies are Mockito mocks that
 * are never invoked (the {@code @PostConstruct init()} method only runs under a real Spring
 * container, so plain {@code new QualityDataService(...)} does not trigger it), and the private
 * methods are exercised via reflection.
 */
class QualityDataServiceTest {

    private final QualityDataService qualityDataService = new QualityDataService(
            mock(DataQualityPostgresRepository.class),
            mock(CacheManager.class),
            null,
            new AuditService(null));

    private String invert(String query) throws Exception {
        Method m = QualityDataService.class.getDeclaredMethod("invert", String.class);
        m.setAccessible(true);
        return (String) m.invoke(qualityDataService, query);
    }

    private Long nextId() throws Exception {
        Method m = QualityDataService.class.getDeclaredMethod("nextId");
        m.setAccessible(true);
        return (Long) m.invoke(qualityDataService);
    }

    @Test
    void invert_plainQuery_prefixedWithMinus() throws Exception {
        assertThat(invert("state:Victoria")).isEqualTo("-state:Victoria");
    }

    @Test
    void invert_negatedQuery_stripsLeadingMinus() throws Exception {
        assertThat(invert("-state:Victoria")).isEqualTo("state:Victoria");
    }

    @Test
    void invert_doubleInvert_returnsOriginal() throws Exception {
        String original = "kingdom:Animalia";
        assertThat(invert(invert(original))).isEqualTo(original);
    }

    @Test
    void invert_emptyString_wrappedInNegatedParens() throws Exception {
        // StringUtils.isNotEmpty("") is false, so falls through to the final branch
        assertThat(invert("")).isEqualTo("-()");
    }

    @Test
    void invert_null_wrappedInNegatedParensWithNullLiteral() throws Exception {
        // StringUtils.isNotEmpty(null) is false, falls through; string concatenation renders "null"
        assertThat(invert(null)).isEqualTo("-(null)");
    }

    @Test
    void nextId_incrementsOnEachCall() throws Exception {
        long first = nextId();
        long second = nextId();
        long third = nextId();

        assertThat(second).isEqualTo(first + 1);
        assertThat(third).isEqualTo(second + 1);
    }

    @Test
    void nextId_startsFromOne() throws Exception {
        // freshly constructed service, uniqueId starts at 1 and getAndAdd returns pre-increment value
        assertThat(nextId()).isEqualTo(1L);
    }
}
