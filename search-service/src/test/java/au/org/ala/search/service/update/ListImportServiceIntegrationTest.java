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
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
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

    static {
        wireMockServer.start();
    }

    @Autowired
    private ListImportService listImportService;

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
        registry.add("lists.url", () -> "http://localhost:" + wireMockServer.port());
        registry.add("lists.v2.url", () -> "http://localhost:" + wireMockServer.port());
        registry.add("lists.favourite.config", () -> "dr0000,interest");
        registry.add("lists.native-introduced", () -> "dr23424,dr9884");
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

        // These list IDs are not needed by this authoritative-list-only fixture.
        // Supply a single valid item for each so reconciliation does not abort.
        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesListItems/dr23424?includeKVP=true&max=500&offset=0"))
                .willReturn(okJson("[{\"lsid\":\"urn:lsid:test:native\",\"kvpValues\":[{\"key\":\"Queensland Status\",\"value\":\"introduced\"}]}]")));
        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesListItems/dr9884?includeKVP=true&max=500&offset=0"))
                .willReturn(okJson("[{\"lsid\":\"urn:lsid:test:griis\",\"kvpValues\":[{\"key\":\"rank\",\"value\":\"SPECIES\"}]}]")));
        wireMockServer.stubFor(get(urlEqualTo("/v2/speciesListItems/dr9884?page=1&pageSize=500"))
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

    @Test
    void run_mergesJurisdictionAndGriisNativeIntroducedLists() {
        SearchItemIndex jurisdictionTaxon = SearchItemIndex.builder()
                .id("native-taxon")
                .guid("urn:lsid:test:native")
                .idxtype("TAXON")
                .scientificName("Nativeus statusus")
                .name("Nativeus statusus")
                .modified(new Date())
                .build();
        SearchItemIndex griisTaxon = SearchItemIndex.builder()
                .id("griis-taxon")
                .guid("urn:lsid:test:griis")
                .idxtype("TAXON")
                .scientificName("Griisus invasivus")
                .name("Griisus invasivus")
                .modified(new Date())
                .build();
        SearchItemIndex griisChild = SearchItemIndex.builder()
                .id("griis-child")
                .guid("urn:lsid:test:griis-child")
                .idxtype("TAXON")
                .scientificName("Griisus invasivus subspecies")
                .name("Griisus invasivus subspecies")
                .rank("subspecies")
                .rankID(8000)
                .modified(new Date())
                .build();
        SearchItemIndex genusTaxon = SearchItemIndex.builder()
                .id("griis-genus")
                .guid("urn:lsid:test:griis-genus")
                .idxtype("TAXON")
                .scientificName("Griisgenus")
                .name("Griisgenus")
                .rank("genus")
                .rankID(6000)
                .modified(new Date())
                .build();
        SearchItemIndex genusChild = SearchItemIndex.builder()
                .id("griis-genus-child")
                .guid("urn:lsid:test:griis-genus-child")
                .idxtype("TAXON")
                .scientificName("Griisgenus example")
                .name("Griisgenus example")
                .rank("species")
                .rankID(7000)
                .modified(new Date())
                .build();
        SearchItemIndex subgenusTaxon = SearchItemIndex.builder()
                .id("griis-subgenus")
                .guid("urn:lsid:test:griis-subgenus")
                .idxtype("TAXON")
                .scientificName("Griisgenus subgenus")
                .name("Griisgenus subgenus")
                .rank("subgenus")
                .rankID(6400)
                .modified(new Date())
                .build();
        SearchItemIndex subgenusChild = SearchItemIndex.builder()
                .id("griis-subgenus-child")
                .guid("urn:lsid:test:griis-subgenus-child")
                .idxtype("TAXON")
                .scientificName("Griisgenus subgenus species")
                .name("Griisgenus subgenus species")
                .rank("species")
                .rankID(7000)
                .modified(new Date())
                .build();
        SearchItemIndex excludedHigherMatchChild = SearchItemIndex.builder()
                .id("excluded-higher-match-child")
                .guid("urn:lsid:test:excluded-higher-match-child")
                .idxtype("TAXON")
                .scientificName("Excludedus childus")
                .name("Excludedus childus")
                .rank("species")
                .rankID(7000)
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(
                elasticService.buildIndexQuery(jurisdictionTaxon),
                elasticService.buildIndexQuery(griisTaxon),
                elasticService.buildIndexQuery(griisChild),
                elasticService.buildIndexQuery(genusTaxon),
                elasticService.buildIndexQuery(genusChild),
                elasticService.buildIndexQuery(subgenusTaxon),
                elasticService.buildIndexQuery(subgenusChild),
                elasticService.buildIndexQuery(excludedHigherMatchChild))));
        elasticService.updateImmediately(List.of(
                UpdateQuery.builder("griis-child").withDocument(Document.create().append("rkid_species", "urn:lsid:test:griis")).build(),
                UpdateQuery.builder("griis-genus-child").withDocument(Document.create().append("rkid_genus", "urn:lsid:test:griis-genus")).build(),
                UpdateQuery.builder("griis-subgenus-child").withDocument(Document.create().append("rkid_subgenus", "urn:lsid:test:griis-subgenus")).build(),
                UpdateQuery.builder("excluded-higher-match-child").withDocument(Document.create().append("rkid_genus", "urn:lsid:test:excluded-higher-genus")).build()));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesList?isAuthoritative=eq:true&max=500&offset=0"))
                .willReturn(okJson("{ \"lists\": [] }")));
        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesList?isSDS=eq:true&max=500&offset=0"))
                .willReturn(okJson("{ \"lists\": [] }")));
        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesListItems/dr0000?includeKVP=true&max=500&offset=0"))
                .willReturn(okJson("[]")));
        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesListItems/dr23424?includeKVP=true&max=500&offset=0"))
                .willReturn(okJson("""
                        [
                          {
                            "lsid": "urn:lsid:test:native",
                            "kvpValues": [
                              { "key": "Queensland_Status", "value": "native, introduced" },
                              { "key": "Queensland Status", "value": "native, introduced" }
                            ]
                          }
                        ]
                        """)));
        wireMockServer.stubFor(get(urlEqualTo("/ws/speciesListItems/dr9884?includeKVP=true&max=500&offset=0"))
                .willReturn(okJson("""
                        [
                          {
                            "lsid": "urn:lsid:test:griis",
                            "kvpValues": [
                              { "key": "identifier", "value": "123" },
                              { "key": "rawKingdom", "value": "Animalia" },
                              { "key": "rank", "value": "SPECIES" },
                              { "key": "taxonomicStatus", "value": "ACCEPTED" }
                            ]
                          }
                        ]
                        """)));
        wireMockServer.stubFor(get(urlEqualTo("/v2/speciesListItems/dr9884?page=1&pageSize=500"))
                .willReturn(okJson("""
                        [
                          {
                            "classification": {
                              "taxonConceptID": "urn:lsid:test:griis",
                              "rank": "species",
                              "rankID": 7000,
                              "matchType": "exactMatch"
                            }
                          },
                          {
                            "classification": {
                              "taxonConceptID": "urn:lsid:test:griis",
                              "rank": "species",
                              "rankID": 7000,
                              "matchType": "canonicalMatch"
                            }
                          },
                          {
                            "classification": {
                              "taxonConceptID": "urn:lsid:test:griis-genus",
                              "rank": "genus",
                              "rankID": 6000,
                              "matchType": "exactMatch"
                            }
                          },
                          {
                            "classification": {
                              "taxonConceptID": "urn:lsid:test:griis-subgenus",
                              "rank": "subgenus",
                              "rankID": 6400,
                              "matchType": "exactMatch"
                            }
                          },
                          {
                            "classification": {
                              "taxonConceptID": "urn:lsid:test:excluded-higher-genus",
                              "rank": "genus",
                              "rankID": 6000,
                              "matchType": "higherMatch"
                            }
                          },
                          {
                            "classification": {
                              "taxonConceptID": "urn:lsid:test:excluded-species",
                              "rank": "species",
                              "rankID": 7000,
                              "matchType": "higherMatch"
                            }
                          },
                          {
                            "classification": {
                              "taxonConceptID": "urn:lsid:test:excluded-order",
                              "rank": "order",
                              "rankID": 4000,
                              "matchType": "higherMatch"
                            }
                          }
                        ]
                        """)));

        Boolean result = listImportService.run().join();
        assertThat(result).isTrue();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            Map<?, ?> jurisdictionDoc = elasticService.getDocumentMap("native-taxon");
            assertThat(jurisdictionDoc).isNotNull();
            assertThat(jurisdictionDoc.get("nativeIntroduced").toString())
                    .isEqualTo("{\"Queensland\":\"native, introduced\"}");

            Map<?, ?> griisDoc = elasticService.getDocumentMap("griis-taxon");
            assertThat(griisDoc).isNotNull();
            assertThat(griisDoc.get("nativeIntroduced").toString())
                    .contains("Australia")
                    .contains("Introduced and invasive");

            Map<?, ?> childDoc = elasticService.getDocumentMap("griis-child");
            assertThat(childDoc).isNotNull();
            assertThat(childDoc.get("nativeIntroduced").toString())
                    .contains("Australia")
                    .contains("Introduced and invasive");

            Map<?, ?> genusDoc = elasticService.getDocumentMap("griis-genus");
            assertThat(genusDoc).isNotNull();
            assertThat(genusDoc.get("nativeIntroduced").toString())
                    .contains("Australia")
                    .contains("Introduced and invasive");

            Map<?, ?> genusChildDoc = elasticService.getDocumentMap("griis-genus-child");
            assertThat(genusChildDoc).isNotNull();
            assertThat(genusChildDoc.get("nativeIntroduced").toString())
                    .contains("Australia")
                    .contains("Introduced and invasive");

            Map<?, ?> subgenusDoc = elasticService.getDocumentMap("griis-subgenus");
            assertThat(subgenusDoc).isNotNull();
            assertThat(subgenusDoc.get("nativeIntroduced").toString())
                    .contains("Australia")
                    .contains("Introduced and invasive");

            Map<?, ?> subgenusChildDoc = elasticService.getDocumentMap("griis-subgenus-child");
            assertThat(subgenusChildDoc).isNotNull();
            assertThat(subgenusChildDoc.get("nativeIntroduced").toString())
                    .contains("Australia")
                    .contains("Introduced and invasive");

            Map<?, ?> excludedChildDoc = elasticService.getDocumentMap("excluded-higher-match-child");
            assertThat(excludedChildDoc).isNotNull();
            assertThat(excludedChildDoc.containsKey("nativeIntroduced")).isFalse();
        });

        wireMockServer.verify(getRequestedFor(urlEqualTo("/ws/speciesListItems/dr23424?includeKVP=true&max=500&offset=0")));
        wireMockServer.verify(getRequestedFor(urlEqualTo("/ws/speciesListItems/dr9884?includeKVP=true&max=500&offset=0")));
        wireMockServer.verify(getRequestedFor(urlEqualTo("/v2/speciesListItems/dr9884?page=1&pageSize=500")));
    }

}
