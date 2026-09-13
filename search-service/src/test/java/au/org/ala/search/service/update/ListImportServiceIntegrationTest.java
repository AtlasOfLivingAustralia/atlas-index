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
 * End-to-end coverage of {@link ListImportService#run()} against a WireMock-stubbed
 * lists.ala.org.au API and a real (Testcontainers) Elasticsearch instance.
 * <p>
 * Deliberately configures {@code lists.favourite.config} to point at a list ("dr0000") that
 * always returns zero items, and {@code lists.native-introduced} to blank — both to keep the
 * fixture small, and critically to avoid {@code ListImportService.run()}'s "favourites changed"
 * branch, which spawns a real (non-daemon) background {@code Thread} that sleeps for 5 minutes
 * before calling {@code updateWeights(...)}. That thread would otherwise keep this test class's
 * forked JVM alive for 5 minutes after the test completes (a non-daemon thread blocks JVM exit).
 * <p>
 * The authoritative list "dr9999" (with one item, lsid {@code urn:lsid:test:1}) exercises the
 * SPECIESLIST document creation (`processLists`) and the "speciesList" field aggregation
 * (`setFieldValues`) against a pre-seeded TAXON document sharing that guid.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ListImportServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static final WireMockServer wireMockServer = new WireMockServer(0);

    @Autowired
    private ListImportService listImportService;

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
        registry.add("lists.url", () -> "http://localhost:" + wireMockServer.port());
        registry.add("lists.favourite.config", () -> "dr0000,interest");
        registry.add("lists.native-introduced", () -> "");
    }

    @Test
    void run_importsAuthoritativeListAndSetsSpeciesListFieldOnMatchingTaxon() {
        // Pre-seed a TAXON document with the guid referenced by the "dr9999" list item, so
        // queryTaxonId(...) can resolve it during the "speciesList" field aggregation step.
        SearchItemIndex taxon = SearchItemIndex.builder()
                .id("taxon-1")
                .guid("urn:lsid:test:1")
                .idxtype("TAXON")
                .scientificName("Testus scientificus")
                .name("Testus scientificus")
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(elasticService.buildIndexQuery(taxon))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesList?isAuthoritative=eq:true&max=500&offset=0"))
                .willReturn(okJson("""
                        {
                          "lists": [
                            {
                              "dataResourceUid": "dr9999",
                              "listName": "Test List",
                              "description": "A test list",
                              "lastUpdated": "2024-01-01T10:00:00Z",
                              "dateCreated": "2024-01-01T10:00:00Z",
                              "itemCount": 1,
                              "isAuthoritative": true,
                              "isInvasive": false,
                              "isThreatened": false,
                              "isBIE": false,
                              "isSDS": false,
                              "region": "AUS",
                              "listType": "TEST"
                            }
                          ]
                        }
                        """)));

        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesList?isSDS=eq:true&max=500&offset=0"))
                .willReturn(okJson("""
                        { "lists": [] }
                        """)));

        // favourite list — always empty, avoids the background weight-update Thread (see class javadoc)
        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesListItems/dr0000?includeKVP=true&max=500&offset=0"))
                .willReturn(okJson("[]")));

        // authoritative list's items — used for the final "speciesList" field aggregation
        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesListItems/dr9999?includeKVP=true&max=500&offset=0"))
                .willReturn(okJson("""
                        [ { "lsid": "urn:lsid:test:1", "kvpValues": [] } ]
                        """)));

        Boolean result = listImportService.run().join();
        assertThat(result).isTrue();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            Map<?, ?> speciesList = elasticService.getDocumentMap("dr9999");
            assertThat(speciesList).isNotNull();
            assertThat(speciesList.get("name")).isEqualTo("Test List");
            assertThat(speciesList.get("description")).isEqualTo("A test list");
            assertThat(speciesList.get("idxtype")).isEqualTo("SPECIESLIST");
        });

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            Map<?, ?> taxonDoc = elasticService.getDocumentMap("taxon-1");
            assertThat(taxonDoc).isNotNull();
            
            List<String> speciesLists = (List<String>) taxonDoc.get("speciesList");
            assertThat(speciesLists).containsExactly("dr9999");
        });

        wireMockServer.verify(getRequestedFor(urlEqualTo("/ws/speciesList?isAuthoritative=eq:true&max=500&offset=0")));
        wireMockServer.verify(getRequestedFor(urlEqualTo("/ws/speciesList?isSDS=eq:true&max=500&offset=0")));
        wireMockServer.verify(getRequestedFor(urlEqualTo("/ws/speciesListItems/dr9999?includeKVP=true&max=500&offset=0")));
    }
}
