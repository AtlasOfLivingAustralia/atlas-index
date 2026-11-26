/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.service.auth.WebService;
import org.apache.http.entity.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BiocacheApiServiceTest {

    private WebService webService;
    private BiocacheApiService service;

    @BeforeEach
    void setUp() throws Exception {
        webService = mock(WebService.class);
        service = new BiocacheApiService(webService);
        setField("biocacheWsUrl", "https://biocache-ws.example.org/ws");
        setField("biocacheCountsFq", "&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue&qualityProfile=ALA");
    }

    private void setField(String name, Object value) throws Exception {
        Field f = BiocacheApiService.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(service, value);
    }

    @Test
    void getLftCounts_appliesConfiguredFqAndParsesPositiveCounts() {
        String expectedUrl = "https://biocache-ws.example.org/ws/occurrences/search?q=lft:*"
                + "&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue&qualityProfile=ALA"
                + "&facets=lft&pageSize=0&flimit=-1";

        Map<String, Object> body = Map.of(
                "facetResults", List.of(
                        Map.of("fieldResult", List.of(
                                Map.of("label", "100", "count", 30),
                                Map.of("label", "150", "count", 12L),
                                Map.of("label", "200", "count", 0),
                                Map.of("label", "not-a-number", "count", 5)
                        ))
                )
        );
        when(webService.get(eq(expectedUrl), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(Map.of("statusCode", 200, "resp", body));

        Map<Integer, Long> result = service.getLftCounts();

        assertThat(result).containsExactlyInAnyOrderEntriesOf(Map.of(100, 30L, 150, 12L));
        verify(webService).get(eq(expectedUrl), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull());
    }

    @Test
    void getLftCounts_emptyFq_omitsExtraParams() throws Exception {
        setField("biocacheCountsFq", "");
        String expectedUrl = "https://biocache-ws.example.org/ws/occurrences/search?q=lft:*&facets=lft&pageSize=0&flimit=-1";

        when(webService.get(eq(expectedUrl), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(Map.of("statusCode", 200, "resp", Map.of("totalRecords", 0, "facetResults", List.of())));

        Map<Integer, Long> result = service.getLftCounts();

        assertThat(result).isEmpty();
        verify(webService).get(eq(expectedUrl), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull());
    }

    @Test
    void getLftCounts_positiveTotalRecordsWithoutFacets_returnsNull() {
        String expectedUrl = "https://biocache-ws.example.org/ws/occurrences/search?q=lft:*"
                + "&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue&qualityProfile=ALA"
                + "&facets=lft&pageSize=0&flimit=-1";

        when(webService.get(eq(expectedUrl), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(Map.of("statusCode", 200, "resp", Map.of("totalRecords", 100, "facetResults", List.of())));

        assertThat(service.getLftCounts()).isNull();
    }

    @Test
    void getLftCounts_missingFieldResultWithPositiveTotal_returnsNull() {
        String expectedUrl = "https://biocache-ws.example.org/ws/occurrences/search?q=lft:*"
                + "&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue&qualityProfile=ALA"
                + "&facets=lft&pageSize=0&flimit=-1";

        when(webService.get(eq(expectedUrl), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(Map.of("statusCode", 200, "resp", Map.of(
                        "totalRecords", 50,
                        "facetResults", List.of(Map.of("fieldName", "lft"))
                )));

        assertThat(service.getLftCounts()).isNull();
    }

    @Test
    void getLftCounts_non200Response_returnsNull() {
        String expectedUrl = "https://biocache-ws.example.org/ws/occurrences/search?q=lft:*"
                + "&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue&qualityProfile=ALA"
                + "&facets=lft&pageSize=0&flimit=-1";

        when(webService.get(eq(expectedUrl), isNull(), eq(ContentType.APPLICATION_JSON), eq(false), eq(false), isNull()))
                .thenReturn(Map.of("statusCode", 500));

        assertThat(service.getLftCounts()).isNull();
    }
}
