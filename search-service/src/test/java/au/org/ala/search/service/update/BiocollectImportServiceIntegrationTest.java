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
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end coverage of {@link BiocollectImportService#run()} against a WireMock-stubbed
 * Biocollect search API (paged via {@code max}/{@code offset}) and a real (Testcontainers)
 * Elasticsearch instance: verifies a single-page project response is indexed with expected
 * fields, and that a stale existing document not present in the fetched page is deleted.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BiocollectImportServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static final WireMockServer wireMockServer = new WireMockServer(0);

    @Autowired
    private BiocollectImportService biocollectImportService;

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
        registry.add("biocollect.url", () -> "http://localhost:" + wireMockServer.port());
        registry.add("biocollect.search", () -> "/ws/project/search?initiator=scistarter");
    }

    @Test
    void run_importsProjectAndRemovesStaleOne() {
        String projectUrl = "http://localhost:" + wireMockServer.port() + "/project/1234";
        String staleId = "https://biocollect.ala.org.au/project/stale";

        SearchItemIndex stale = SearchItemIndex.builder()
                .id(staleId)
                .guid(staleId)
                .idxtype("BIOCOLLECT")
                .name("Stale Project")
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(elasticService.buildIndexQuery(stale))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        // single, less-than-a-full-page response so the paging loop terminates after one call
        wireMockServer.stubFor(get(urlEqualTo("/ws/project/search?initiator=scistarter&max=100&offset=0"))
                .willReturn(okJson("""
                        {
                          "projects": [
                            {
                              "url": "%s",
                              "name": "Test Project",
                              "description": "A test biocollect project",
                              "lastUpdated": "2024-01-01T10:00:00Z",
                              "dateCreated": "2020-01-01T10:00:00Z",
                              "projectType": "citizenScience",
                              "containsActivity": true,
                              "publicParticipation": true
                            }
                          ]
                        }
                        """.formatted(projectUrl))));

        biocollectImportService.run().join();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            // Use getDocumentMap (raw map, no SearchItemIndex conversion) here: the ES client
            // library deserialises small whole-number JSON values as Integer regardless of the
            // Java model's Long field type, and ElasticService's SearchItemIndex converter uses
            // reflection to set fields by exact type, so getDocument() throws
            // IllegalArgumentException for any doc where a Long field (e.g. numberOfRecords,
            // always populated by BiocollectImportService, defaulting to 0) round-trips as an
            // Integer. This is a pre-existing quirk unrelated to what this test verifies.
            Map<?, ?> indexed = elasticService.getDocumentMap(projectUrl);
            assertThat(indexed).isNotNull();
            assertThat(indexed.get("name")).isEqualTo("Test Project");
            assertThat(indexed.get("description")).isEqualTo("A test biocollect project");
            assertThat(indexed.get("projectType")).isEqualTo("citizenScience");
            assertThat(indexed.get("idxtype")).isEqualTo("BIOCOLLECT");
        });

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() ->
                assertThat(elasticService.getDocumentMap(staleId)).isNull());

        wireMockServer.verify(getRequestedFor(urlEqualTo("/ws/project/search?initiator=scistarter&max=100&offset=0")));
    }
}
