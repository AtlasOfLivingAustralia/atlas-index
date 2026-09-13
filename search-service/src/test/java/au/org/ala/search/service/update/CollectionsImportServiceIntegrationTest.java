/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.remote.BiocacheApiService;
import au.org.ala.search.service.remote.ElasticService;
import com.github.tomakehurst.wiremock.WireMockServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * End-to-end coverage of {@link CollectionsImportService#run()} against a WireMock-stubbed
 * Collectory API and a real (Testcontainers) Elasticsearch instance. {@link BiocacheApiService}
 * is mocked via {@code @MockBean} (light-mocking style, consistent with the controller
 * integration tests) since its own HTTP boundary (biocache) is orthogonal to what this test is
 * verifying — the Collectory fetch/batch-lookup/index/delete flow across all four entity types
 * (dataResource, dataProvider, institution, collection).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CollectionsImportServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static final WireMockServer wireMockServer = new WireMockServer(0);

    @Autowired
    private CollectionsImportService collectionsImportService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;

    @MockBean
    private BiocacheApiService biocacheApiService;

    @BeforeAll
    static void startWireMock() {
        wireMockServer.start();
    }

    @AfterAll
    static void stopWireMock() {
        wireMockServer.stop();
    }

    @DynamicPropertySource
    static void wireMockProperties(DynamicPropertyRegistry registry) {
        registry.add("collections.url", () -> "http://localhost:" + wireMockServer.port());
    }

    @BeforeEach
    void configureMocksAndStubs() {
        when(biocacheApiService.entityCounts(anyString())).thenReturn(Collections.emptyMap());
        when(biocacheApiService.entityCounts("collectionUid")).thenReturn(Map.of("co1", 5));

        // no entities for the other three types
        wireMockServer.stubFor(get(urlEqualTo("/ws/dataResource")).willReturn(okJson("[]")));
        wireMockServer.stubFor(get(urlEqualTo("/ws/dataProvider")).willReturn(okJson("[]")));
        wireMockServer.stubFor(get(urlEqualTo("/ws/institution")).willReturn(okJson("[]")));

        wireMockServer.stubFor(get(urlEqualTo("/ws/collection"))
                .willReturn(okJson("""
                        [ { "uid": "co1" } ]
                        """)));

        String collectionJson = """
                {"uid":"co1","alaPublicUrl":"https://collections.ala.org.au/public/show/co1",
                 "name":"Test Collection","pubDescription":"A test collection","rights":"CC-BY",
                 "licenseType":"CC-BY","acronym":"TC","state":"ACT",
                 "provider":{"name":"Test Provider"},"logoRef":{"uri":"https://example.org/logo.png"},
                 "lastUpdated":"2024-01-01T10:00:00Z","dateCreated":"2020-01-01T10:00:00Z"}
                """.replace("\n", " ");

        wireMockServer.stubFor(post(urlEqualTo("/ws/find/collection"))
                .willReturn(okJson("[" + toJsonStringLiteral(collectionJson) + "]")));
    }

    private static String toJsonStringLiteral(String raw) {
        return "\"" + raw.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    @Test
    void run_importsCollectionAndRemovesStaleOne() {
        String staleId = "co-stale";
        SearchItemIndex stale = SearchItemIndex.builder()
                .id(staleId)
                .guid(staleId)
                .idxtype("COLLECTION")
                .name("Stale Collection")
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(elasticService.buildIndexQuery(stale))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        collectionsImportService.run().join();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            SearchItemIndex indexed = elasticService.getDocument("co1");
            assertThat(indexed).isNotNull();
            assertThat(indexed.getName()).isEqualTo("Test Collection");
            assertThat(indexed.getDescription()).isEqualTo("A test collection");
            assertThat(indexed.getAcronym()).isEqualTo("TC");
            assertThat(indexed.getDataProvider()).isEqualTo("Test Provider");
            assertThat(indexed.getOccurrenceCount()).isEqualTo(5);
            assertThat(indexed.getIdxtype()).isEqualTo("COLLECTION");
        });

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() ->
                assertThat(elasticService.getDocument(staleId)).isNull());

        wireMockServer.verify(getRequestedFor(urlEqualTo("/ws/collection")));
        wireMockServer.verify(postRequestedFor(urlEqualTo("/ws/find/collection")));
    }
}
