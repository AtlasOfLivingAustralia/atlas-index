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
