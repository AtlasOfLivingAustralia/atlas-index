/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.dto.*;
import au.org.ala.search.service.AdminService;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.LegacyService;
import au.org.ala.search.service.remote.ElasticService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import au.org.ala.search.RestTestClientConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.net.URI;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Integration test for the legacy {@link V1SearchController} (bie-index compatible API).
 * {@link ElasticService} and {@link LegacyService} are mocked so the test focuses purely on
 * the controller's request parsing / response-shaping logic.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(RestTestClientConfiguration.class)
public class V1SearchControllerIntegrationTest extends AbstractIntegrationTestContainers {

    static final String MACROPUS_GUID = "urn:lsid:biodiversity.org.au:afd.taxon:macropus";

    @MockitoBean
    private ElasticService elasticService;

    @MockitoBean
    private LegacyService legacyService;

    @MockitoBean
    private AdminService adminService;

    @MockitoBean
    private AuthService authService;

    @Autowired
    private RestTestClient restTestClient;

    @BeforeEach
    void resetMocks() {
        reset(elasticService, legacyService, adminService, authService);
    }

    private SearchItemIndex macropusTaxon() {
        SearchItemIndex item = new SearchItemIndex();
        item.id = "1";
        item.guid = MACROPUS_GUID;
        item.idxtype = "TAXON";
        item.name = "Macropus";
        item.scientificName = "Macropus";
        item.rank = "genus";
        item.rankID = 6000;
        item.taxonomicStatus = "accepted";
        item.commonNameSingle = "Kangaroo";
        return item;
    }

    @Test
    void ranks_delegatesToLegacyServiceWithIndexFields() {
        when(elasticService.indexFields(false)).thenReturn(List.of());
        when(legacyService.getRanks(anyList())).thenReturn(Map.of(
                "genus", Rank.builder().rank("genus").rankID(6000).build(),
                "species", Rank.builder().rank("species").rankID(7000).build()));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v1/bie/ranks")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsKeys("genus", "species");
        verify(legacyService).getRanks(anyList());
    }

    @Test
    void indexFields_returnsFieldList() {
        when(elasticService.indexFields(true)).thenReturn(List.of());

        EntityExchangeResult<List<Object>> resp = restTestClient.get()
                .uri("/v1/bie/indexFields")
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).isEmpty();
    }

    @Test
    void search_delegatesToSearchLegacyAndWrapsResult() {
        when(elasticService.searchLegacy(eq("kangaroo"), any(), eq(0), eq(10), isNull(), isNull(), isNull()))
                .thenReturn(Map.of("totalRecords", 1, "searchResults", List.of()));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v1/bie/search?q=kangaroo")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsKey("searchResults");
    }

    @Test
    void search_scoreSort_mappedToUnderscoreScore() {
        when(elasticService.searchLegacy(eq("kangaroo"), any(), eq(0), eq(10), eq("_score"), eq("desc"), isNull()))
                .thenReturn(Map.of("totalRecords", 0, "searchResults", List.of()));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v1/bie/search?q=kangaroo&sort=score&dir=desc")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        verify(elasticService).searchLegacy(eq("kangaroo"), any(), eq(0), eq(10), eq("_score"), eq("desc"), isNull());
    }

    @Test
    void search_nullResultFromMalformedQuery_returnsBadRequest() {
        when(elasticService.searchLegacy(eq("bad:[query"), any(), eq(0), eq(10), isNull(), isNull(), isNull()))
                .thenReturn(null);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v1/bie/search?q=bad:[query")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void searchAuto_kangaroo_returnsAutoCompleteList() {
        when(elasticService.autocomplete(eq("Mac"), isNull(), isNull(), eq(10)))
                .thenReturn(List.of(macropusTaxon()));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v1/bie/search/auto?q=Mac")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> list = (List<Map<String, Object>>) resp.getResponseBody().get("autoCompleteList");
        assertThat(list).hasSize(1);
        assertThat(list.get(0).get("guid")).isEqualTo(MACROPUS_GUID);
        assertThat(list.get(0).get("commonName")).isEqualTo("Kangaroo");
    }

    @Test
    void guidName_knownName_returnsProfiles() {
        when(elasticService.getTaxonsByName(eq("Macropus"), eq(10), eq(false)))
                .thenReturn(List.of(macropusTaxon()));

        EntityExchangeResult<List<Map<String, Object>>> resp = restTestClient.get()
                .uri("/v1/bie/guid/Macropus")
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).hasSize(1);
        assertThat(resp.getResponseBody().get(0).get("identifier")).isEqualTo(MACROPUS_GUID);
    }

    @Test
    void guidName_unknownName_returnsNotFound() {
        when(elasticService.getTaxonsByName(eq("Unknown"), eq(10), eq(false))).thenReturn(List.of());

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v1/bie/guid/Unknown")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void guidBatch_multipleQueries_returnsMapKeyedByQuery() {
        when(elasticService.getTaxonsByName(eq("Macropus"), eq(10), eq(false))).thenReturn(List.of(macropusTaxon()));
        when(elasticService.getTaxonsByName(eq("NoSuchTaxon"), eq(10), eq(false))).thenReturn(null);

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v1/bie/guid/batch?q=Macropus&q=NoSuchTaxon")
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsKey("Macropus");
        assertThat(resp.getResponseBody()).doesNotContainKey("NoSuchTaxon");
    }

    @Test
    void species_foundTaxon_returnsTaxonResponse() {
        when(elasticService.getTaxonResponse(MACROPUS_GUID)).thenReturn(Map.of("guid", MACROPUS_GUID, "name", "Macropus"));

        // note: bie species/** matches everything after the prefix, so an unencoded guid works directly
        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v1/bie/species/" + MACROPUS_GUID)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();
        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsEntry("guid", MACROPUS_GUID);
    }

    @Test
    void species_redirectResponse_returns302WithLocation() {
        when(elasticService.getTaxonResponse("old-guid")).thenReturn(Map.of("redirect", "new-guid"));

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v1/bie/species/old-guid")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getResponseHeaders().getFirst("Location")).contains("/v1/bie/species/new-guid");
    }

    @Test
    void species_unknownGuid_returnsNotFound() {
        when(elasticService.getTaxonResponse("unknown-guid")).thenReturn(null);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v1/bie/species/unknown-guid")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void shortProfile_foundTaxon_returnsShortProfile() {
        when(elasticService.cleanupId(MACROPUS_GUID)).thenReturn(MACROPUS_GUID);
        when(elasticService.getShortProfile(MACROPUS_GUID)).thenReturn(new ShortProfile(
                MACROPUS_GUID, "Macropus", null, null, "genus", 6000, "Animalia", "Macropodidae", "Kangaroo", null, null));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.get()
                .uri("/v1/bie/species/shortProfile/" + MACROPUS_GUID)
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).containsEntry("scientificName", "Macropus");
    }

    @Test
    void shortProfile_unknownTaxon_returnsNotFound() {
        when(elasticService.cleanupId("unknown")).thenReturn("unknown");
        when(elasticService.getShortProfile("unknown")).thenReturn(null);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v1/bie/species/shortProfile/unknown")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void speciesLookupBulk_returnsProfilesForEachName() {
        LongProfile profile = new LongProfile(
                null, MACROPUS_GUID, null, "Macropus", null, null, null, "genus", 6000,
                null, null, "accepted", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null);
        when(elasticService.getLongProfileForName(eq("Macropus"), eq(false))).thenReturn(profile);

        Map<String, Object> body = Map.of("names", List.of("Macropus"), "vernacular", false);
        EntityExchangeResult<List<Map<String, Object>>> resp = restTestClient.post()
                .uri("/v1/bie/species/lookup/bulk")
                .body(body)
                .exchange()
                .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody()).hasSize(1);
        assertThat(resp.getResponseBody().get(0).get("guid")).isEqualTo(MACROPUS_GUID);
    }

    @Test
    void speciesGuidsBulklookup_returnsTaxaForGuids() {
        TaxaBatchItem item = new TaxaBatchItem(
                MACROPUS_GUID, "Macropus", "Macropus", null, null, "genus", null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null);
        when(elasticService.getTaxa(List.of(MACROPUS_GUID))).thenReturn(List.of(item));

        EntityExchangeResult<Map<String, Object>> resp = restTestClient.post()
                .uri("/v1/bie/species/guids/bulklookup")
                .body(List.of(MACROPUS_GUID))
                .exchange()
                .expectBody(new ParameterizedTypeReference<Map<String, Object>>() {
                })
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void download_blankQuery_returnsBadRequest() {
        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/v1/bie/download?q=")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
