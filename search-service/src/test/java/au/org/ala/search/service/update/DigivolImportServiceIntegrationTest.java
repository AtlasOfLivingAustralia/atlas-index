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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.concurrent.TimeUnit;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end coverage of {@link DigivolImportService#run()} against a WireMock-stubbed Digivol
 * API and a real (Testcontainers) Elasticsearch instance, exercising the actual HTTP fetch, ES
 * document diffing, and delete-of-stale-items behaviour rather than only the private
 * {@code hasChanges} helper (see {@link DigivolImportServiceTest} for that unit coverage).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DigivolImportServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static final WireMockServer wireMockServer = new WireMockServer(0);

    static {
        wireMockServer.start();
    }

    @Autowired
    private DigivolImportService digivolImportService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;


    @AfterAll
    static void stopWireMock() {
        wireMockServer.stop();
    }

    @DynamicPropertySource
    static void wireMockProperties(DynamicPropertyRegistry registry) {
        registry.add("digivol.url", () -> "http://localhost:" + wireMockServer.port());
    }

    @Test
    void run_importsNewExpeditionAndRemovesStaleOne() {
        // seed a stale item that should be removed since it will not be present in the fetched list
        SearchItemIndex stale = SearchItemIndex.builder()
                .id("https://volunteer.ala.org.au/expedition/stale")
                .guid("https://volunteer.ala.org.au/expedition/stale")
                .idxtype("DIGIVOL")
                .name("Stale Expedition")
                .modified(new java.util.Date())
                .build();
        elasticService.flushImmediately(new java.util.ArrayList<>(java.util.List.of(elasticService.buildIndexQuery(stale))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        wireMockServer.stubFor(get(urlEqualTo("/ws/expeditionInfo"))
                .willReturn(okJson("""
                        [
                          {
                            "expeditionPageURL": "https://volunteer.ala.org.au/expedition/new-one",
                            "name": "New Expedition",
                            "description": "<p>An expedition description</p>"
                          }
                        ]
                        """)));

        digivolImportService.run().join();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            SearchItemIndex indexed = elasticService.getDocument("https://volunteer.ala.org.au/expedition/new-one");
            assertThat(indexed).isNotNull();
            assertThat(indexed.getName()).isEqualTo("New Expedition");
            assertThat(indexed.getDescription()).contains("An expedition description");
            assertThat(indexed.getIdxtype()).isEqualTo("DIGIVOL");
        });

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() ->
                assertThat(elasticService.getDocument("https://volunteer.ala.org.au/expedition/stale")).isNull());

        wireMockServer.verify(getRequestedFor(urlEqualTo("/ws/expeditionInfo")));
    }
}
