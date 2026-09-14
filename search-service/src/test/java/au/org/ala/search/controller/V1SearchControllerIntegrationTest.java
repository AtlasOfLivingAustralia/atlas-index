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
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
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
public class V1SearchControllerIntegrationTest extends AbstractIntegrationTestContainers {

    static final String MACROPUS_GUID = "urn:lsid:biodiversity.org.au:afd.taxon:macropus";

    @MockBean
    private ElasticService elasticService;

    @MockBean
    private LegacyService legacyService;

    @MockBean
    private AdminService adminService;

    @MockBean
    private AuthService authService;

    @Autowired
    private TestRestTemplate restTemplate;

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

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/bie/ranks", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsKeys("genus", "species");
        verify(legacyService).getRanks(anyList());
    }

    @Test
    void indexFields_returnsFieldList() {
        when(elasticService.indexFields(true)).thenReturn(List.of());

        ResponseEntity<List<Object>> resp = restTemplate.exchange(
                "/v1/bie/indexFields", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isEmpty();
    }

    @Test
    void search_delegatesToSearchLegacyAndWrapsResult() {
        when(elasticService.searchLegacy(eq("kangaroo"), any(), eq(0), eq(10), isNull(), isNull(), isNull()))
                .thenReturn(Map.of("totalRecords", 1, "searchResults", List.of()));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/bie/search?q=kangaroo", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsKey("searchResults");
    }

    @Test
    void search_scoreSort_mappedToUnderscoreScore() {
        when(elasticService.searchLegacy(eq("kangaroo"), any(), eq(0), eq(10), eq("_score"), eq("desc"), isNull()))
                .thenReturn(Map.of("totalRecords", 0, "searchResults", List.of()));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/bie/search?q=kangaroo&sort=score&dir=desc", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(elasticService).searchLegacy(eq("kangaroo"), any(), eq(0), eq(10), eq("_score"), eq("desc"), isNull());
    }

    @Test
    void search_nullResultFromMalformedQuery_returnsBadRequest() {
        when(elasticService.searchLegacy(eq("bad:[query"), any(), eq(0), eq(10), isNull(), isNull(), isNull()))
                .thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/bie/search?q=bad:[query", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void searchAuto_kangaroo_returnsAutoCompleteList() {
        when(elasticService.autocomplete(eq("Mac"), isNull(), isNull(), eq(10)))
                .thenReturn(List.of(macropusTaxon()));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/bie/search/auto?q=Mac", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> list = (List<Map<String, Object>>) resp.getBody().get("autoCompleteList");
        assertThat(list).hasSize(1);
        assertThat(list.get(0).get("guid")).isEqualTo(MACROPUS_GUID);
        assertThat(list.get(0).get("commonName")).isEqualTo("Kangaroo");
    }

    @Test
    void guidName_knownName_returnsProfiles() {
        when(elasticService.getTaxonsByName(eq("Macropus"), eq(10), eq(false)))
                .thenReturn(List.of(macropusTaxon()));

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/v1/bie/guid/Macropus", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).get("identifier")).isEqualTo(MACROPUS_GUID);
    }

    @Test
    void guidName_unknownName_returnsNotFound() {
        when(elasticService.getTaxonsByName(eq("Unknown"), eq(10), eq(false))).thenReturn(List.of());

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/bie/guid/Unknown", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void guidBatch_multipleQueries_returnsMapKeyedByQuery() {
        when(elasticService.getTaxonsByName(eq("Macropus"), eq(10), eq(false))).thenReturn(List.of(macropusTaxon()));
        when(elasticService.getTaxonsByName(eq("NoSuchTaxon"), eq(10), eq(false))).thenReturn(null);

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/bie/guid/batch?q=Macropus&q=NoSuchTaxon", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsKey("Macropus");
        assertThat(resp.getBody()).doesNotContainKey("NoSuchTaxon");
    }

    @Test
    void species_foundTaxon_returnsTaxonResponse() {
        when(elasticService.getTaxonResponse(MACROPUS_GUID)).thenReturn(Map.of("guid", MACROPUS_GUID, "name", "Macropus"));

        // note: bie species/** matches everything after the prefix, so an unencoded guid works directly
        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/bie/species/" + MACROPUS_GUID, HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("guid", MACROPUS_GUID);
    }

    @Test
    void species_redirectResponse_returns302WithLocation() {
        when(elasticService.getTaxonResponse("old-guid")).thenReturn(Map.of("redirect", "new-guid"));

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/bie/species/old-guid", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getHeaders().getFirst("Location")).contains("/v1/bie/species/new-guid");
    }

    @Test
    void species_unknownGuid_returnsNotFound() {
        when(elasticService.getTaxonResponse("unknown-guid")).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/bie/species/unknown-guid", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void shortProfile_foundTaxon_returnsShortProfile() {
        when(elasticService.cleanupId(MACROPUS_GUID)).thenReturn(MACROPUS_GUID);
        when(elasticService.getShortProfile(MACROPUS_GUID)).thenReturn(new ShortProfile(
                MACROPUS_GUID, "Macropus", null, null, "genus", 6000, "Animalia", "Macropodidae", "Kangaroo", null, null));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/bie/species/shortProfile/" + MACROPUS_GUID, HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("scientificName", "Macropus");
    }

    @Test
    void shortProfile_unknownTaxon_returnsNotFound() {
        when(elasticService.cleanupId("unknown")).thenReturn("unknown");
        when(elasticService.getShortProfile("unknown")).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/bie/species/shortProfile/unknown", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void speciesLookupBulk_returnsProfilesForEachName() {
        LongProfile profile = new LongProfile(
                null, MACROPUS_GUID, null, "Macropus", null, null, null, "genus", 6000,
                null, null, "accepted", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null);
        when(elasticService.getLongProfileForName(eq("Macropus"), eq(false))).thenReturn(profile);

        Map<String, Object> body = Map.of("names", List.of("Macropus"), "vernacular", false);
        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/v1/bie/species/lookup/bulk", HttpMethod.POST,
                new org.springframework.http.HttpEntity<>(body), new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).get("guid")).isEqualTo(MACROPUS_GUID);
    }

    @Test
    void speciesGuidsBulklookup_returnsTaxaForGuids() {
        TaxaBatchItem item = new TaxaBatchItem(
                MACROPUS_GUID, "Macropus", "Macropus", null, null, "genus", null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null);
        when(elasticService.getTaxa(List.of(MACROPUS_GUID))).thenReturn(List.of(item));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/bie/species/guids/bulklookup", HttpMethod.POST,
                new org.springframework.http.HttpEntity<>(List.of(MACROPUS_GUID)), new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void download_blankQuery_returnsBadRequest() {
        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/bie/download?q=", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
