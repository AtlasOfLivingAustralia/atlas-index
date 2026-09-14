/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.quality.QualityCategory;
import au.org.ala.search.model.quality.QualityFilter;
import au.org.ala.search.model.quality.QualityProfile;
import au.org.ala.search.service.remote.QualityDataService;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Integration test for {@link V1DataQualityController} — a read-only proxy over
 * {@link QualityDataService} (which is mocked here). CRUD operations for quality
 * profiles/categories/filters are performed via {@code AdminController} (dqGet/dqDelete/dqPost),
 * not this controller.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class V1DataQualityControllerIntegrationTest extends AbstractIntegrationTestContainers {

    @MockBean
    private QualityDataService qualityDataService;

    @Autowired
    private TestRestTemplate restTemplate;

    @BeforeEach
    void resetMocks() {
        reset(qualityDataService);
    }

    private QualityFilter filter(long id) {
        return QualityFilter.builder().id(id).enabled(true).description("Spatially valid")
                .filter("spatiallyValid:true").displayOrder(1L).build();
    }

    private QualityCategory category(long id) {
        return QualityCategory.builder().id(id).enabled(true).name("spatial").label("Spatial")
                .description("Spatial quality").displayOrder(1L)
                .qualityFilters(List.of(filter(445L))).build();
    }

    private QualityProfile profile(long id, String shortName) {
        return QualityProfile.builder().id(id).shortName(shortName).name("ALA General")
                .enabled(true).categories(List.of(category(444L))).build();
    }

    @Test
    void profiles_returnsListFromService() {
        when(qualityDataService.getProfiles(any(), any(), any(), anyInt(), anyInt(), any(), any()))
                .thenReturn(List.of(profile(441L, "ALA")));

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/v1/dq/data-profiles", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).get("shortName")).isEqualTo("ALA");
    }

    @Test
    void profile_found_returnsProfile() {
        when(qualityDataService.getProfile("441")).thenReturn(profile(441L, "ALA"));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/dq/data-profiles/441", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().get("shortName")).isEqualTo("ALA");
    }

    @Test
    void profile_notFound_returnsNotFound() {
        when(qualityDataService.getProfile("unknown")).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/dq/data-profiles/unknown", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void categories_found_returnsCategoryList() {
        when(qualityDataService.getProfile("ALA")).thenReturn(profile(441L, "ALA"));

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/v1/dq/data-profiles/ALA/categories", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).get("name")).isEqualTo("spatial");
    }

    @Test
    void categories_profileNotFound_returnsNotFound() {
        when(qualityDataService.getProfile("unknown")).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/dq/data-profiles/unknown/categories", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void category_found_returnsCategory() {
        when(qualityDataService.getCategory("ALA", 444L)).thenReturn(category(444L));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/dq/data-profiles/ALA/categories/444", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().get("name")).isEqualTo("spatial");
    }

    @Test
    void category_notFound_returnsNotFound() {
        when(qualityDataService.getCategory("ALA", 999L)).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/dq/data-profiles/ALA/categories/999", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void qualityFilters_found_returnsFilterList() {
        when(qualityDataService.getCategory("ALA", 444L)).thenReturn(category(444L));

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/v1/dq/data-profiles/ALA/categories/444/filters", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).get("filter")).isEqualTo("spatiallyValid:true");
    }

    @Test
    void qualityFilters_categoryNotFound_returnsNotFound() {
        when(qualityDataService.getCategory("ALA", 999L)).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/dq/data-profiles/ALA/categories/999/filters", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void qualityFilter_found_returnsFilter() {
        when(qualityDataService.getFilter("ALA", 444L, 445L)).thenReturn(filter(445L));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/dq/data-profiles/ALA/categories/444/filters/445", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().get("filter")).isEqualTo("spatiallyValid:true");
    }

    @Test
    void qualityFilter_notFound_returnsNotFound() {
        when(qualityDataService.getFilter("ALA", 444L, 999L)).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/dq/data-profiles/ALA/categories/444/filters/999", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getEnabledFiltersByLabel_returnsMap() {
        when(qualityDataService.getEnabledFiltersByLabel("ALA General"))
                .thenReturn(Map.of("Spatial", "spatiallyValid:true"));

        ResponseEntity<Map<String, String>> resp = restTemplate.exchange(
                "/v1/dq/quality/getEnabledFiltersByLabel?profileName=ALA General", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("Spatial", "spatiallyValid:true");
    }

    @Test
    void getEnabledQualityFilters_returnsSet() {
        when(qualityDataService.getEnabledQualityFilters("ALA General")).thenReturn(Set.of("spatiallyValid:true"));

        ResponseEntity<Set<String>> resp = restTemplate.exchange(
                "/v1/dq/quality/getEnabledQualityFilters?profileName=ALA General", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsExactly("spatiallyValid:true");
    }

    @Test
    void getGroupedEnabledFilters_returnsMap() {
        LinkedHashMap<String, List<QualityFilter>> grouped = new LinkedHashMap<>();
        grouped.put("Spatial", List.of(filter(445L)));
        when(qualityDataService.getGroupedEnabledFilters("ALA General")).thenReturn(grouped);

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/dq/quality/getGroupedEnabledFilters?profileName=ALA General", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsKey("Spatial");
    }

    @Test
    void findAllEnabledCategories_returnsList() {
        when(qualityDataService.findAllEnabledCategories("ALA General")).thenReturn(List.of(category(444L)));

        ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                "/v1/dq/quality/findAllEnabledCategories?profileName=ALA General", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).hasSize(1);
    }

    @Test
    void activeProfile_found_returnsProfile() {
        when(qualityDataService.getProfileOrDefault("ALA")).thenReturn(profile(441L, "ALA"));

        ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                "/v1/dq/quality/activeProfile?profileName=ALA", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().get("shortName")).isEqualTo("ALA");
    }

    @Test
    void activeProfile_notFound_returnsNotFound() {
        when(qualityDataService.getProfileOrDefault("unknown")).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/dq/quality/activeProfile?profileName=unknown", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getJoinedQualityFilter_returnsString() {
        when(qualityDataService.getJoinedQualityFilter("ALA")).thenReturn("spatiallyValid:true AND -userAssertions:50001");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/dq/quality/getJoinedQualityFilter?profileName=ALA", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isEqualTo("spatiallyValid:true AND -userAssertions:50001");
    }

    @Test
    void getInverseCategoryFilter_returnsString() {
        when(qualityDataService.getInverseCategoryFilter(441L)).thenReturn("-spatiallyValid:true");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/v1/dq/quality/getInverseCategoryFilter?qualityCategoryId=441", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isEqualTo("-spatiallyValid:true");
    }

    @Test
    void getAllInverseCategoryFiltersForProfile_returnsMap() {
        when(qualityDataService.getAllInverseCategoryFiltersForProfile("441"))
                .thenReturn(Map.of("Spatial", "-spatiallyValid:true"));

        ResponseEntity<Map<String, String>> resp = restTemplate.exchange(
                "/v1/dq/quality/getAllInverseCategoryFiltersForProfile?qualityProfileId=441", HttpMethod.GET, null, new ParameterizedTypeReference<>() {
                });

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("Spatial", "-spatiallyValid:true");
    }
}
