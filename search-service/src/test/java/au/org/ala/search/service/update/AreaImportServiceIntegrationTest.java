/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.AbstractIntegrationTestContainers;
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

import java.util.Map;
import java.util.concurrent.TimeUnit;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end coverage of {@link AreaImportService#run()} against a WireMock-stubbed spatial
 * portal API and a real (Testcontainers) Elasticsearch instance: a single configured layer
 * ("9999") with a single field ("7001") returning one non-point object is imported as a REGION
 * document, and the (empty) distributions endpoint is exercised without error. Only one layer
 * is configured (via a property override) to keep the fixture small — the multi-endpoint
 * pagination (fields/field/objects/distributions) is otherwise identical for additional layers.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AreaImportServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static final WireMockServer wireMockServer = new WireMockServer(0);

    @Autowired
    private AreaImportService areaImportService;

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
        registry.add("spatial.uiUrl", () -> "http://localhost:" + wireMockServer.port());
        registry.add("spatial.layers", () -> "9999");
        registry.add("exploreYourArea.url", () -> "http://localhost:" + wireMockServer.port() + "/eya?lat=$latitude&lng=$longitude");
    }

    @Test
    void run_importsRegionForConfiguredLayer() {
        wireMockServer.stubFor(get(urlEqualTo("/fields"))
                .willReturn(okJson("""
                        [ { "spid": "9999", "id": "7001" } ]
                        """)));

        wireMockServer.stubFor(get(urlEqualTo("/field/7001?pageSize=0"))
                .willReturn(okJson("""
                        { "last_update": "2024-01-01T10:00:00+10:00" }
                        """)));

        wireMockServer.stubFor(get(urlEqualTo("/objects/7001?pageSize=10000&start=0"))
                .willReturn(okJson("""
                        [
                          {
                            "fid": "7001",
                            "pid": "region-1",
                            "name": "Test Region",
                            "description": "A test region",
                            "bbox": "140,-38,150,-30",
                            "featureType": "REGION",
                            "centroid": "POINT(145.0 -36.0)",
                            "fieldname": "Test Field",
                            "area_km": 123.45
                          }
                        ]
                        """)));

        wireMockServer.stubFor(get(urlEqualTo("/distributions")).willReturn(okJson("[]")));

        areaImportService.run().join();
        elasticsearchOperations.indexOps(au.org.ala.search.model.SearchItemIndex.class).refresh();

        String regionId = "7001-region-1";
        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            Map<?, ?> indexed = elasticService.getDocumentMap(regionId);
            assertThat(indexed).isNotNull();
            assertThat(indexed.get("name")).isEqualTo("Test Region");
            assertThat(indexed.get("description")).isEqualTo("A test region");
            assertThat(indexed.get("idxtype")).isEqualTo("REGION");
            assertThat(indexed.get("layerId")).isEqualTo("9999");
            assertThat(indexed.get("fieldId")).isEqualTo("7001");
            assertThat(indexed.get("fieldName")).isEqualTo("Test Field");
        });

        wireMockServer.verify(getRequestedFor(urlEqualTo("/fields")));
        wireMockServer.verify(getRequestedFor(urlEqualTo("/objects/7001?pageSize=10000&start=0")));
        wireMockServer.verify(getRequestedFor(urlEqualTo("/distributions")));
    }
}
