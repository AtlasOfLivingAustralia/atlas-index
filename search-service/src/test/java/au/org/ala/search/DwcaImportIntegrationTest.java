/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.update.DwCAImportService;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URL;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test for TaskType.DWCA — imports a small DwC-Archive containing the
 * Macropus (kangaroo) genus subtree (37 taxa) and then exercises the v2/search API
 * against the live Testcontainers Elasticsearch instance.
 *
 * <p>Test data was extracted from /data/bie/2025/ by the script at
 * search-service/scripts/extract_test_data.py.
 * The archive lives in src/test/resources/dwca-test/dwca-index/ (a subdirectory, as
 * required by DwCAImportService which iterates subdirectories of dwca.dir).
 * Supplemental CSVs (lsid-vernacularName.csv, lsid-left-right.csv) are in the same
 * classpath directory (src/test/resources/dwca-test/).
 *
 * <p>Test stages:
 * <ol>
 *   <li>BeforeAll: run the DwCA import synchronously and wait for completion.</li>
 *   <li>Individual tests: query v2/search with various parameters and assert results.</li>
 * </ol>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class DwcaImportIntegrationTest extends AbstractIntegrationTestContainers {

    /**
     * Resolve all three DwCA-related paths from the classpath so the test is
     * fully self-contained within the project and works without any local /data
     * directory.
     *
     * <ul>
     *   <li>{@code dwca.dir} — parent of dwca-index/; the importer lists subdirs</li>
     *   <li>{@code dwca.extract.commonNamePath} — lsid-vernacularName.csv</li>
     *   <li>{@code dwca.extract.leftRightCsvPath} — lsid-left-right.csv</li>
     * </ul>
     */
    @DynamicPropertySource
    static void dwcaTestProperties(DynamicPropertyRegistry registry) {
        ClassLoader cl = DwcaImportIntegrationTest.class.getClassLoader();
        // dwca.dir must point at the parent directory that contains dwca-index/ as a subdir
        URL dwcaParent = cl.getResource("dwca-test/dwca-index");
        if (dwcaParent == null) throw new IllegalStateException(
                "Classpath resource dwca-test/dwca-index not found — run mvn test-compile first");
        String dwcaDir = Paths.get(dwcaParent.getPath()).getParent().toString();
        registry.add("dwca.dir", () -> dwcaDir);
        registry.add("dwca.extract.commonNamePath",
                () -> cl.getResource("dwca-test/lsid-vernacularName.csv").getPath());
        registry.add("dwca.extract.leftRightCsvPath",
                () -> cl.getResource("dwca-test/lsid-left-right.csv").getPath());
    }

    // Guids used across assertions
    static final String MACROPUS_GUID =
            "https://biodiversity.org.au/afd/taxa/501c3628-1686-40b0-b291-2c09422c787b";
    static final String M_FULIGINOSUS_GUID =
            "https://biodiversity.org.au/afd/taxa/e9b141fb-9c47-46a3-b631-39b175a2cd74";
    static final String M_GIGANTEUS_GUID =
            "https://biodiversity.org.au/afd/taxa/f2f43ef9-89fd-4f89-8b06-0842e86cfe06";

    @MockBean
    private CollectoryCache collectoryCache;

    @MockBean
    private ListCache listCache;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ElasticService elasticService;

    @BeforeAll
    static void runImport(@Autowired DwCAImportService dwcaImportService,
                          @Autowired ElasticsearchOperations elasticsearchOperations,
                          @Autowired ElasticService elasticService) throws Exception {
        // DwCAImportService.run() is @Async — get() blocks until the orchestration completes.
        // However, the individual flush() calls within importDwcARowType are also @Async
        // ("elasticSearchUpdate" executor) and may still be in-flight after run().get() returns.
        // We must wait until documents are actually written to ES before running queries.
        dwcaImportService.run().get();

        // Poll until TAXON documents appear in the index (max 30s)
        Awaitility.await()
                .atMost(30, TimeUnit.SECONDS)
                .pollInterval(500, TimeUnit.MILLISECONDS)
                .until(() -> {
                    elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();
                    return elasticService.queryCount("idxtype", "TAXON") > 0;
                });

        // Ensure the field list (including dynamic rk_* fields) is refreshed
        elasticService.indexFields(true);
    }

    @Test
    @Order(10)
    void searchFreeText_kangaroo_returnsResults() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b.queryParam("q", "kangaroo"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        long total = totalRecords(resp.getBody());
        assertThat(total).isGreaterThan(0);
    }

    @Test
    @Order(11)
    void searchFreeText_kangaroo_withTaxonFilter_returnsTaxonRecords() {
        // Use a free-text term that matches via the 'all' field, combined with idxtype filter
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "50"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).isNotEmpty();
        // All returned records must be TAXON
        results.forEach(r -> assertThat(r.get("idxtype")).isEqualTo("TAXON"));
        // The Macropus genus record should be among them
        boolean hasMacropus = results.stream()
                .anyMatch(r -> MACROPUS_GUID.equals(r.get("guid")));
        assertThat(hasMacropus).isTrue();
    }

    @Test
    @Order(20)
    void searchByGuid_macropus_returnsTaxonRecord() {
        // Searching by guid returns all idxtypes sharing that guid (TAXON, TAXONVARIANT, IDENTIFIER)
        // Add idxtype filter to get just the TAXON record
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "guid:\"" + MACROPUS_GUID + "\"")
                .queryParam("fq", "idxtype:TAXON"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).hasSize(1);
        Map<String, Object> rec = results.get(0);
        assertThat(rec.get("guid")).isEqualTo(MACROPUS_GUID);
        assertThat(rec.get("rank")).isEqualTo("genus");
        assertThat(rec.get("taxonomicStatus")).isEqualTo("accepted");
        assertThat(rec.get("scientificName")).isEqualTo("Macropus");
    }

    @Test
    @Order(21)
    void searchByScientificName_fuliginosus_returnsSpecies() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "scientificName:\"Macropus fuliginosus\"")
                .queryParam("fq", "idxtype:TAXON"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).isNotEmpty();
        assertThat(results.get(0).get("guid")).isEqualTo(M_FULIGINOSUS_GUID);
        assertThat(results.get(0).get("rank")).isEqualTo("species");
    }

    @Test
    @Order(22)
    void searchByTaxonomicStatus_accepted_onlyAcceptedReturned() {
        // Use scientificName field query + idxtype filter to get accepted Macropus taxa
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "scientificName:Macropus")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("fq", "taxonomicStatus:accepted")
                .queryParam("pageSize", "50"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).isNotEmpty();
        results.forEach(r ->
                assertThat(r.get("taxonomicStatus")).isEqualTo("accepted"));
    }

    @Test
    @Order(30)
    void searchIdxtypeTaxon_returnsOnlyTaxonRecords() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "50"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).isNotEmpty();
        results.forEach(r -> assertThat(r.get("idxtype")).isEqualTo("TAXON"));
    }

    @Test
    @Order(31)
    void searchIdxtypeCommon_returnsVernacularRecords() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:COMMON")
                .queryParam("pageSize", "50"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).isNotEmpty();
        results.forEach(r -> assertThat(r.get("idxtype")).isEqualTo("COMMON"));
    }

    @Test
    @Order(32)
    void identifierRecords_indexedInElasticsearch() {
        // The v2/search endpoint deliberately excludes IDENTIFIER records (it adds
        // "-idxtype:IDENTIFIER" to every query).  Verify IDENTIFIER records were
        // imported by querying ES directly via the ElasticService count method.
        // This is injected in @BeforeAll — re-use the count here to assert > 0.
        long identifierCount = elasticService.queryCount("idxtype", "IDENTIFIER");
        assertThat(identifierCount).isGreaterThan(0);
    }

    @Test
    @Order(40)
    void macropusGenus_hasFullHierarchyFields() {
        // Get the Macropus TAXON record and verify rk_* hierarchy fields are populated
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "guid:\"" + MACROPUS_GUID + "\"")
                .queryParam("fq", "idxtype:TAXON"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).hasSize(1);
        Map<String, Object> rec = results.get(0);
        // Hierarchy fields from ancestor denormalization
        assertThat(rec.get("rk_class")).isEqualTo("MAMMALIA");
        assertThat(rec.get("rk_family")).isEqualTo("MACROPODIDAE");
        assertThat(rec.get("rk_kingdom")).isEqualTo("ANIMALIA");
        assertThat(rec.get("rk_phylum")).isEqualTo("CHORDATA");
        assertThat(rec.get("rk_order")).isEqualTo("DIPROTODONTIA");
    }

    @Test
    @Order(41)
    void macropusGenus_hasParentGuid() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "guid:\"" + MACROPUS_GUID + "\"")
                .queryParam("fq", "idxtype:TAXON"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).hasSize(1);
        // parentGuid should be set to the subfamily above Macropus (MACROPODINAE)
        assertThat(results.get(0).get("parentGuid")).isEqualTo(
                "https://biodiversity.org.au/afd/taxa/b07804d2-d068-48d8-8c06-f87cc2620d87");
    }

    @Test
    @Order(42)
    void macropusGenus_hasCommonNameKangaroo() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "guid:\"" + MACROPUS_GUID + "\"")
                .queryParam("fq", "idxtype:TAXON"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).hasSize(1);
        Map<String, Object> macropus = results.get(0);
        // commonNameSingle comes from lsid-vernacularName.csv (name-matching service CSV)
        assertThat(macropus.get("commonNameSingle")).isEqualTo("Kangaroo");
        // commonName array should also include "Kangaroo"
        Object commonName = macropus.get("commonName");
        assertThat(commonName).isNotNull();
        assertThat(commonName.toString()).containsIgnoringCase("Kangaroo");
    }

    @Test
    @Order(43)
    void macropusGenus_hasSpeciesGroups() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "guid:\"" + MACROPUS_GUID + "\"")
                .queryParam("fq", "idxtype:TAXON"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).hasSize(1);
        Object sg = results.get(0).get("speciesGroup");
        assertThat(sg).isNotNull();
        // Should include Mammals, Vertebrates, Animals
        assertThat(sg.toString()).contains("Mammals");
        assertThat(sg.toString()).contains("Animals");
    }

    @Test
    @Order(44)
    void macropusGenus_hasSynonymData() {
        // synonymData is base64+gzip encoded JSON of synonym names
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "guid:\"" + MACROPUS_GUID + "\"")
                .queryParam("fq", "idxtype:TAXON"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).hasSize(1);
        // synonymData is populated (base64 gzip string, non-null and non-empty)
        assertThat(results.get(0).get("synonymData")).isNotNull();
        assertThat(results.get(0).get("synonymData").toString()).isNotEmpty();
        // additionalNames_m_s contains synonym scientific names
        Object addNames = results.get(0).get("additionalNames_m_s");
        assertThat(addNames).isNotNull();
        // Should include known Macropus synonym genera like Kangurus, Halmaturus
        assertThat(addNames.toString()).containsAnyOf("Kangurus", "Halmaturus", "Halmatopus");
    }

    @Test
    @Order(50)
    void searchCommonName_westernGrey_returnsFuliginosus() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "scientificName:\"Macropus fuliginosus\"")
                .queryParam("fq", "idxtype:TAXON"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).isNotEmpty();
        boolean hasFuliginosus = results.stream()
                .anyMatch(r -> M_FULIGINOSUS_GUID.equals(r.get("guid")));
        assertThat(hasFuliginosus).isTrue();
        // The taxon should have a Western Grey Kangaroo common name
        Map<String, Object> rec = results.stream()
                .filter(r -> M_FULIGINOSUS_GUID.equals(r.get("guid")))
                .findFirst().orElseThrow();
        Object commonName = rec.get("commonName");
        if (commonName != null) {
            assertThat(commonName.toString()).containsIgnoringCase("Western Grey Kangaroo");
        }
    }

    @Test
    @Order(51)
    void searchVernacularCommonRecord_kangaroo_linksMacropus() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:COMMON"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).isNotEmpty();
        // At least one COMMON record should link back to the Macropus guid
        boolean linksMacropus = results.stream()
                .anyMatch(r -> MACROPUS_GUID.equals(r.get("taxonGuid")));
        assertThat(linksMacropus).isTrue();
    }

    @Test
    @Order(60)
    void pagination_page0_and_page1_returnDifferentRecords() {
        ResponseEntity<Map<String, Object>> page0 = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "2")
                .queryParam("page", "0"));
        ResponseEntity<Map<String, Object>> page1 = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "2")
                .queryParam("page", "1"));
        assertThat(page0.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(page1.getStatusCode()).isEqualTo(HttpStatus.OK);

        List<Map<String, Object>> results0 = searchResults(page0.getBody());
        List<Map<String, Object>> results1 = searchResults(page1.getBody());

        assertThat(results0).isNotEmpty();
        assertThat(results1).isNotEmpty();
        List<String> ids0 = results0.stream().map(r -> (String) r.get("id")).toList();
        List<String> ids1 = results1.stream().map(r -> (String) r.get("id")).toList();
        assertThat(ids0).doesNotContainAnyElementsOf(ids1);
    }

    @Test
    @Order(61)
    void sort_byScientificName_asc_returnsSortedResults() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "20")
                .queryParam("sort", "scientificName")
                .queryParam("dir", "asc"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).isNotEmpty();
        List<String> names = results.stream()
                .map(r -> (String) r.get("scientificName"))
                .filter(n -> n != null)
                .toList();
        for (int i = 1; i < names.size(); i++) {
            assertThat(names.get(i).compareToIgnoreCase(names.get(i - 1))).isGreaterThanOrEqualTo(0);
        }
    }

    @Test
    @Order(62)
    void sort_byScientificName_desc_firstGreaterThanAscFirst() {
        ResponseEntity<Map<String, Object>> asc = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "20")
                .queryParam("sort", "scientificName")
                .queryParam("dir", "asc"));
        ResponseEntity<Map<String, Object>> desc = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "20")
                .queryParam("sort", "scientificName")
                .queryParam("dir", "desc"));
        List<String> namesAsc = searchResults(asc.getBody()).stream()
                .map(r -> (String) r.get("scientificName")).filter(n -> n != null).toList();
        List<String> namesDesc = searchResults(desc.getBody()).stream()
                .map(r -> (String) r.get("scientificName")).filter(n -> n != null).toList();

        assertThat(namesAsc).isNotEmpty();
        assertThat(namesDesc).isNotEmpty();
        // First result of desc sort should be >= first result of asc sort
        assertThat(namesDesc.get(0).compareToIgnoreCase(namesAsc.get(0))).isGreaterThanOrEqualTo(0);
    }

    @Test
    @Order(70)
    void facet_byRank_returnsRankBuckets() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("facets", "rank")
                .queryParam("pageSize", "0"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = resp.getBody();
        assertThat(body).isNotNull();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> facetResults = (List<Map<String, Object>>) body.get("facetResults");
        assertThat(facetResults).isNotNull().isNotEmpty();

        Map<String, Object> rankFacet = facetResults.stream()
                .filter(f -> "rank".equals(f.get("fieldName")))
                .findFirst().orElse(null);
        assertThat(rankFacet).isNotNull();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldResult = (List<Map<String, Object>>) rankFacet.get("fieldResult");
        assertThat(fieldResult).isNotEmpty();

        List<String> rankLabels = fieldResult.stream()
                .map(r -> (String) r.get("label")).toList();
        assertThat(rankLabels).containsAnyOf("genus", "species");
    }

    @Test
    @Order(71)
    void facet_byDatasetName_returnsAtLeastOneDataset() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("facets", "datasetName")
                .queryParam("pageSize", "0"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = resp.getBody();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> facetResults = (List<Map<String, Object>>) body.get("facetResults");
        assertThat(facetResults).isNotNull().isNotEmpty();

        Map<String, Object> datasetFacet = facetResults.stream()
                .filter(f -> "datasetName".equals(f.get("fieldName")))
                .findFirst().orElse(null);
        assertThat(datasetFacet).isNotNull();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldResult = (List<Map<String, Object>>) datasetFacet.get("fieldResult");
        assertThat(fieldResult).isNotEmpty();
        // AFD dataset should appear
        List<String> datasetLabels = fieldResult.stream()
                .map(r -> (String) r.get("label")).toList();
        assertThat(datasetLabels).contains("AFD");
    }

    @Test
    @Order(80)
    void fieldList_fl_restrictsReturnedFields() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "guid:\"" + MACROPUS_GUID + "\"")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("fl", "guid,name,idxtype"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).hasSize(1);
        Map<String, Object> rec = results.get(0);
        assertThat(rec).containsKey("guid");
        assertThat(rec).containsKey("name");
        assertThat(rec).containsKey("idxtype");
        assertThat(rec.get("guid")).isEqualTo(MACROPUS_GUID);
        assertThat(rec.get("name")).isEqualTo("Macropus");
        // Fields not in fl should not be present
        assertThat(rec).doesNotContainKey("scientificName");
        assertThat(rec).doesNotContainKey("rank");
    }

    @Test
    @Order(90)
    void totalRecords_kangaroo_taxon_isPositive() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "0"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        long total = totalRecords(resp.getBody());
        // At minimum the genus + 2 accepted species = 3 results, likely more via hierarchy terms
        assertThat(total).isGreaterThanOrEqualTo(3L);
    }

    @Test
    @Order(91)
    void totalRecords_allIdxtypes_greaterThanTaxonAlone() {
        long taxonTotal = totalRecords(search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "0")).getBody());
        long allTotal = totalRecords(search(b -> b
                .queryParam("q", "kangaroo")
                .queryParam("pageSize", "0")).getBody());
        // COMMON and IDENTIFIER records also match "kangaroo"
        assertThat(allTotal).isGreaterThanOrEqualTo(taxonTotal);
    }

    @Test
    @Order(100)
    void invalidQuery_returnsErrorResponse() {
        // The invalid query is parsed by QueryParserUtil, which throws QueryParseException.
        // V2Controller catches it and returns 400. TestRestTemplate returns the raw response.
        // Since the 400 may return an empty body or different content type, use exchange
        // with String type to avoid converter errors.
        ResponseEntity<String> resp = restTemplate.exchange(
                URI.create("/v2/search?q=field%3A%5BINVALID"),
                HttpMethod.GET,
                null,
                String.class);
        assertThat(resp.getStatusCode().is4xxClientError()).isTrue();
    }

    @FunctionalInterface
    interface QueryBuilder {
        UriComponentsBuilder apply(UriComponentsBuilder builder);
    }

    private ResponseEntity<Map<String, Object>> search(QueryBuilder queryBuilder) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromPath("/v2/search");
        builder = queryBuilder.apply(builder);
        URI uri = builder.build().toUri();
        return restTemplate.exchange(
                uri,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                }
        );
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> searchResults(Map<String, Object> body) {
        assertThat(body).isNotNull();
        return (List<Map<String, Object>>) body.get("searchResults");
    }

    private long totalRecords(Map<String, Object> body) {
        assertThat(body).isNotNull();
        Number n = (Number) body.get("totalRecords");
        assertThat(n).isNotNull();
        return n.longValue();
    }
}
