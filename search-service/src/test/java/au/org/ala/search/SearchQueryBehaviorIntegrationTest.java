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
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end coverage of wildcard/range/negated query behaviour and weight-driven default sort
 * order against a real (Testcontainers) Elasticsearch instance, exercised through the real
 * {@code /v2/search} and {@code /v1/bie/search/auto}/{@code /v1/bie/download} REST endpoints
 * (i.e. {@link ElasticService} is NOT mocked — only {@link CollectoryCache}/{@link ListCache}
 * are, matching {@code DwcaImportIntegrationTest}'s pattern).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class SearchQueryBehaviorIntegrationTest extends AbstractIntegrationTestContainers {

    @MockBean
    private CollectoryCache collectoryCache;

    @MockBean
    private ListCache listCache;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;

    @BeforeAll
    static void seedDocuments(@Autowired ElasticService elasticService,
                              @Autowired ElasticsearchOperations elasticsearchOperations) {
        List<SearchItemIndex> docs = new ArrayList<>();

        // rank/range/wildcard/negation fixture: 5 TAXON docs sharing the "Zzyzxus" stem
        docs.add(taxon("wq:zzyzxus-kingdom", "Zzyzxus kingdomus", "kingdom", 1000, "accepted"));
        docs.add(taxon("wq:zzyzxus-family", "Zzyzxus familia", "family", 5000, "accepted"));
        docs.add(taxon("wq:zzyzxus-genus", "Zzyzxus genus", "genus", 6000, "accepted"));
        docs.add(taxon("wq:zzyzxus-species", "Zzyzxus species", "species", 7000, "accepted"));
        docs.add(taxon("wq:zzyzxus-excluded", "Zzyzxus excludedspecies", "species", 7000, "excluded"));

        // weight-ordering fixture: 2 TAXON docs with IDENTICAL scientificName (same term-match
        // relevance/_score) but different taxonomicStatus, so only the searchWeight
        // field-value-factor (accepted x2 vs excluded x0.3, see util.Weight.calcGlobal)
        // should determine their relative order in the default (no explicit sort) response.
        docs.add(taxon("wq:weight-accepted", "Weighttestus alpha", "species", 7000, "accepted"));
        docs.add(taxon("wq:weight-excluded", "Weighttestus alpha", "species", 7000, "excluded"));

        // hierarchical facet fixture: 5 TAXON docs sharing the "Hierfacetus" stem
        docs.add(taxonWithRk("wq:hf-mammal-1", "Hierfacetus koala", "ANIMALIA", "MAMMALIA", "DIPROTODONTIA"));
        docs.add(taxonWithRk("wq:hf-mammal-2", "Hierfacetus wombat", "ANIMALIA", "MAMMALIA", "DIPROTODONTIA"));
        docs.add(taxonWithRk("wq:hf-insect-1", "Hierfacetus beetle", "ANIMALIA", "INSECTA", "COLEOPTERA"));
        docs.add(taxonWithRk("wq:hf-noclass-1", "Hierfacetus noclass", "ANIMALIA", null, "ORPHANORDER"));
        docs.add(taxonWithRk("wq:hf-plant-1", "Hierfacetus acacia", "Plantae", "Equisetopsida", "Fabales"));

        List<org.springframework.data.elasticsearch.core.query.IndexQuery> buffer = new ArrayList<>();
        for (SearchItemIndex doc : docs) {
            buffer.add(elasticService.buildIndexQuery(doc));
        }
        elasticService.flushImmediately(buffer);
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();
    }

    private static SearchItemIndex taxon(String guid, String scientificName, String rank, int rankID, String taxonomicStatus) {
        return SearchItemIndex.builder()
                .id(guid)
                .guid(guid)
                .idxtype("TAXON")
                .name(scientificName)
                .scientificName(scientificName)
                .rank(rank)
                .rankID(rankID)
                .taxonomicStatus(taxonomicStatus)
                // Required: SitemapService.buildSitemapPages() scans ALL accepted-status TAXON
                // documents in the (shared, singleton-container) index and calls
                // date.compareTo(...)/simpleDateFormat.format(date) on each document's
                // "modified" field unconditionally — a null value throws an uncaught
                // NullPointerException there, silently aborting that unrelated test's sitemap
                // generation for the whole index. Every TAXON fixture doc must set this.
                .modified(new java.util.Date())
                .build();
    }

    private static SearchItemIndex taxonWithRk(String guid, String scientificName,
                                               String kingdom, String clazz, String order) {
        Map<String, String> rkFields = new java.util.HashMap<>();
        if (kingdom != null) rkFields.put("rk_kingdom", kingdom);
        if (clazz != null) rkFields.put("rk_class", clazz);
        if (order != null) rkFields.put("rk_order", order);
        SearchItemIndex item = taxon(guid, scientificName, "species", 7000, "accepted");
        item.setRkFields(rkFields);
        return item;
    }

    @Test
    void wildcardFreeText_zzyzxusStar_matchesAllFixtureDocs() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "zzyzxus*")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "50"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        List<String> guids = results.stream().map(r -> (String) r.get("guid")).toList();
        assertThat(guids).contains(
                "wq:zzyzxus-kingdom", "wq:zzyzxus-family", "wq:zzyzxus-genus",
                "wq:zzyzxus-species", "wq:zzyzxus-excluded");
    }

    @Test
    void wildcardFieldScoped_scientificNamePrefix_matchesFixtureDocs() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "scientificName:Zzyzxus*")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("pageSize", "50"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        List<String> guids = results.stream().map(r -> (String) r.get("guid")).toList();
        assertThat(guids).contains(
                "wq:zzyzxus-kingdom", "wq:zzyzxus-family", "wq:zzyzxus-genus",
                "wq:zzyzxus-species", "wq:zzyzxus-excluded");
    }

    @Test
    void rangeQuery_rankIdBetweenGenusAndSpecies_excludesKingdomAndFamily() {
        // Note: QueryParserUtil's grammar does not support combining a bare free-text term with
        // AND/field:value terms within a single query string (a bare term switches the parser
        // into "single value" mode that swallows the remainder of the string — see
        // QueryParserUtil.parse). Instead, use a field-scoped wildcard fq to scope down to the
        // fixture docs, ANDed at the top level with the range query (top-level q/fq combination
        // is always ANDed regardless of this restriction).
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "rankID:[6000 TO 7000]")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("fq", "scientificName:Zzyzxus*")
                .queryParam("pageSize", "50"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        List<String> guids = results.stream().map(r -> (String) r.get("guid")).toList();

        assertThat(guids).contains("wq:zzyzxus-genus", "wq:zzyzxus-species", "wq:zzyzxus-excluded");
        assertThat(guids).doesNotContain("wq:zzyzxus-kingdom", "wq:zzyzxus-family");
    }

    @Test
    void negatedQuery_excludingTaxonomicStatus_omitsExcludedRecord() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "scientificName:Zzyzxus*")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("fq", "-taxonomicStatus:excluded")
                .queryParam("pageSize", "50"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        List<String> guids = results.stream().map(r -> (String) r.get("guid")).toList();

        assertThat(guids).contains("wq:zzyzxus-kingdom", "wq:zzyzxus-family",
                "wq:zzyzxus-genus", "wq:zzyzxus-species");
        assertThat(guids).doesNotContain("wq:zzyzxus-excluded");
        results.forEach(r -> assertThat(r.get("taxonomicStatus")).isNotEqualTo("excluded"));
    }

    @Test
    void defaultSort_noExplicitSortParam_ordersByWeightNotJustRelevance() {
        // Both documents share an identical scientificName (equal term-match relevance), so
        // without an explicit sort/dir param, ElasticService.search()'s functionScore wrapper
        // (fieldValueFactor on "searchWeight") should rank the "accepted" doc (weight x2) ahead
        // of the "excluded" doc (weight x0.3, see util.Weight.calcGlobal).
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "scientificName:\"Weighttestus alpha\"")
                .queryParam("fq", "idxtype:TAXON"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> results = searchResults(resp.getBody());
        assertThat(results).hasSize(2);
        assertThat(results.get(0).get("guid")).isEqualTo("wq:weight-accepted");
        assertThat(results.get(1).get("guid")).isEqualTo("wq:weight-excluded");
    }

    @Test
    void autocomplete_prefixMatch_returnsFixtureDoc() {
        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                URI.create("/v1/bie/search/auto?q=Zzyzxus+spe"),
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                });
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = resp.getBody();
        assertThat(body).isNotNull();

        
        List<Map<String, Object>> autoCompleteList = (List<Map<String, Object>>) body.get("autoCompleteList");
        assertThat(autoCompleteList).isNotNull();
        List<String> names = autoCompleteList.stream().map(r -> (String) r.get("name")).toList();
        assertThat(names).anyMatch(n -> n != null && n.startsWith("Zzyzxus"));
    }

    @Test
    void download_csvContainsFixtureRecord() {
        ResponseEntity<String> resp = restTemplate.exchange(
                URI.create("/v1/bie/download?q=zzyzxus&fq=idxtype:TAXON&fields=guid,scientificName"),
                HttpMethod.GET,
                null,
                String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody()).contains("wq:zzyzxus-genus");
    }

    @Test
    @SuppressWarnings("unchecked")
    void hierarchicalFacet_taxonomicTree_returnsNestedCountsAndFiltersByCompoundFq() {
        ResponseEntity<Map<String, Object>> resp = search(b -> b
                .queryParam("q", "hierfacetus")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("facets", "rk_kingdom>rk_class>rk_order,rank")
                .queryParam("pageSize", "10"));
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = resp.getBody();
        assertThat(body).isNotNull();

        List<Map<String, Object>> facetResults = (List<Map<String, Object>>) body.get("facetResults");
        assertThat(facetResults).isNotNull();

        // Flat facet still works alongside hierarchical facet
        Map<String, Object> rankFacet = facetResults.stream()
                .filter(f -> "rank".equals(f.get("fieldName")))
                .findFirst()
                .orElseThrow();
        List<Map<String, Object>> rankItems = (List<Map<String, Object>>) rankFacet.get("fieldResult");
        assertThat(rankItems).hasSize(1);
        assertThat(rankItems.get(0).get("label")).isEqualTo("species");
        assertThat(((Number) rankItems.get(0).get("count")).intValue()).isEqualTo(5);

        // Hierarchical facet returns Kingdom -> Class -> Order sorted by descending count
        Map<String, Object> treeFacet = facetResults.stream()
                .filter(f -> "rk_kingdom>rk_class>rk_order".equals(f.get("fieldName")))
                .findFirst()
                .orElseThrow();
        List<Map<String, Object>> kingdoms = (List<Map<String, Object>>) treeFacet.get("fieldResult");
        assertThat(kingdoms).hasSize(2);

        Map<String, Object> animalia = kingdoms.get(0);
        assertThat(animalia.get("label")).isEqualTo("ANIMALIA");
        assertThat(((Number) animalia.get("count")).intValue()).isEqualTo(4);
        assertThat(animalia.get("fq")).isEqualTo("rk_kingdom:\"ANIMALIA\"");

        List<Map<String, Object>> animaliaChildren = (List<Map<String, Object>>) animalia.get("children");
        assertThat(animaliaChildren).hasSize(3);
        // MAMMALIA (2) first by count
        Map<String, Object> mammalia = animaliaChildren.get(0);
        assertThat(mammalia.get("label")).isEqualTo("MAMMALIA");
        assertThat(((Number) mammalia.get("count")).intValue()).isEqualTo(2);
        assertThat(mammalia.get("fq")).isEqualTo("rk_kingdom:\"ANIMALIA\" AND rk_class:\"MAMMALIA\"");

        List<Map<String, Object>> mammaliaOrders = (List<Map<String, Object>>) mammalia.get("children");
        assertThat(mammaliaOrders).hasSize(1);
        assertThat(mammaliaOrders.get(0).get("label")).isEqualTo("DIPROTODONTIA");
        assertThat(((Number) mammaliaOrders.get(0).get("count")).intValue()).isEqualTo(2);
        assertThat(mammaliaOrders.get(0).get("fq"))
                .isEqualTo("rk_kingdom:\"ANIMALIA\" AND rk_class:\"MAMMALIA\" AND rk_order:\"DIPROTODONTIA\"");

        // Promoted order without an intermediate rk_class
        Map<String, Object> orphanOrder = animaliaChildren.stream()
                .filter(c -> "ORPHANORDER".equals(c.get("label")))
                .findFirst()
                .orElseThrow();
        assertThat(((Number) orphanOrder.get("count")).intValue()).isEqualTo(1);
        assertThat(orphanOrder.get("fq"))
                .isEqualTo("rk_kingdom:\"ANIMALIA\" AND -rk_class:* AND rk_order:\"ORPHANORDER\"");

        // Plantae (1) -> Equisetopsida (1) -> Fabales (1)
        Map<String, Object> plantae = kingdoms.get(1);
        assertThat(plantae.get("label")).isEqualTo("Plantae");
        assertThat(((Number) plantae.get("count")).intValue()).isEqualTo(1);

        // Filtering with the returned compound fq matches only the 2 MAMMALIA docs
        String mammaliaFq = (String) mammalia.get("fq");
        ResponseEntity<Map<String, Object>> filtered = search(b -> b
                .queryParam("q", "hierfacetus")
                .queryParam("fq", "idxtype:TAXON")
                .queryParam("fq", mammaliaFq)
                .queryParam("pageSize", "10"));
        assertThat(filtered.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> filteredResults = searchResults(filtered.getBody());
        assertThat(filteredResults).hasSize(2);
        assertThat(filteredResults.stream().map(r -> (String) r.get("guid")).toList())
                .containsExactlyInAnyOrder("wq:hf-mammal-1", "wq:hf-mammal-2");
    }

    @FunctionalInterface
    interface QueryBuilder {
        UriComponentsBuilder apply(UriComponentsBuilder builder);
    }

    private ResponseEntity<Map<String, Object>> search(QueryBuilder queryBuilder) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromPath("/v2/search");
        builder = queryBuilder.apply(builder);
        // .encode() is required here (unlike DwcaImportIntegrationTest's equivalent helper,
        // whose query strings never contain characters like '[', ']', or ' ' that are illegal
        // in a raw java.net.URI) since range queries (e.g. "rankID:[6000 TO 7000]") contain
        // spaces and brackets that must be percent-encoded before constructing the URI.
        URI uri = builder.build().encode().toUri();
        return restTemplate.exchange(
                uri,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {
                }
        );
    }

    
    private List<Map<String, Object>> searchResults(Map<String, Object> body) {
        assertThat(body).isNotNull();
        return (List<Map<String, Object>>) body.get("searchResults");
    }
}
