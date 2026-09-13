/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.remote.ElasticService;
import com.github.tomakehurst.wiremock.WireMockServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end coverage of {@link LayerImportService#run()} against a WireMock-stubbed spatial
 * portal API and a real (Testcontainers) Elasticsearch instance, exercising the actual HTTP
 * fetch, ES document diffing (including the {@code enabled} filter and the private
 * {@code stringEquals}/{@code arrayEquals} comparison helpers already unit-tested in
 * {@link LayerImportServiceTest}), and deletion of stale layer documents.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LayerImportServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static final WireMockServer wireMockServer = new WireMockServer(0);

    @Autowired
    private LayerImportService layerImportService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;

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
        registry.add("spatial.url", () -> "http://localhost:" + wireMockServer.port());
    }

    @Test
    void run_importsEnabledLayerSkipsDisabledAndRemovesStaleOne() {
        String spatialUrl = "http://localhost:" + wireMockServer.port();
        String staleLayerUrl = spatialUrl + "/layers/view/more/stale_layer";

        SearchItemIndex stale = SearchItemIndex.builder()
                .id(staleLayerUrl)
                .guid(staleLayerUrl)
                .idxtype("LAYER")
                .name("Stale Layer")
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(elasticService.buildIndexQuery(stale))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        wireMockServer.stubFor(get(urlEqualTo("/layers"))
                .willReturn(okJson("""
                        [
                          {
                            "name": "new_layer",
                            "displayname": "New Layer",
                            "enabled": true,
                            "description": "A layer description",
                            "classification1": "Climate",
                            "dt_added": 1700000000000
                          },
                          {
                            "name": "disabled_layer",
                            "displayname": "Disabled Layer",
                            "enabled": false,
                            "description": "Should not be imported"
                          }
                        ]
                        """)));

        layerImportService.run().join();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        String newLayerUrl = spatialUrl + "/layers/view/more/new_layer";
        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            SearchItemIndex indexed = elasticService.getDocument(newLayerUrl);
            assertThat(indexed).isNotNull();
            assertThat(indexed.getName()).isEqualTo("New Layer");
            assertThat(indexed.getDescription()).isEqualTo("A layer description");
            assertThat(indexed.getClassification1()).containsExactly("Climate");
            assertThat(indexed.getIdxtype()).isEqualTo("LAYER");
        });

        String disabledLayerUrl = spatialUrl + "/layers/view/more/disabled_layer";
        assertThat(elasticService.getDocument(disabledLayerUrl)).isNull();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() ->
                assertThat(elasticService.getDocument(staleLayerUrl)).isNull());

        wireMockServer.verify(getRequestedFor(urlEqualTo("/layers")));
    }
}
