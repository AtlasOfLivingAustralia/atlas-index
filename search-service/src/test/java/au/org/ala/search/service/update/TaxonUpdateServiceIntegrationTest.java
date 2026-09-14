/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.remote.BiocacheApiService;
import au.org.ala.search.service.remote.ElasticService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * End-to-end coverage of {@link TaxonUpdateService#run()} (via the real {@link TaxonUpdateRunner}
 * and a real, Testcontainers-backed Elasticsearch instance) — only {@link BiocacheApiService} is
 * mocked, since it is the sole external-HTTP dependency of both classes.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TaxonUpdateServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static final String ACCEPTED_GUID = "urn:lsid:test:taxon-update-service:accepted";
    private static final String SYNONYM_GUID = "urn:lsid:test:taxon-update-service:synonym";

    @MockBean
    private BiocacheApiService biocacheApiService;

    @Autowired
    private TaxonUpdateService taxonUpdateService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;

    @DynamicPropertySource
    static void leftRightCsvProperty(DynamicPropertyRegistry registry) throws Exception {
        Path csv = Files.createTempFile("taxon-update-service-test-left-right", ".csv");
        Files.writeString(csv, ACCEPTED_GUID + ",100,200\n");
        registry.add("dwca.extract.leftRightCsvPath", () -> csv.toString());
    }

    @BeforeAll
    static void configureBiocacheStubs(@Autowired BiocacheApiService biocacheApiService) throws Exception {
        // Any "has an image" / preferred-filter lft facet lookup matches our single CSV row's lft ("100").
        when(biocacheApiService.getFacet(anyString(), isNull(), eq("lft"))).thenReturn(List.of("100"));
        when(biocacheApiService.getFacet(anyString(), anyString(), eq("lft"))).thenReturn(List.of("100"));
        when(biocacheApiService.queryImages(anyString(), any())).thenReturn(new String[]{"image1"});
        when(biocacheApiService.counts(anyList())).thenReturn(Map.of(ACCEPTED_GUID, 42));
    }

    @Test
    void run_updatesOccurrenceCountAndImageOnAccepted_andAcceptedConceptNameOnSynonym() {
        SearchItemIndex accepted = SearchItemIndex.builder()
                .id("taxon-update-service-accepted")
                .guid(ACCEPTED_GUID)
                .idxtype("TAXON")
                .scientificName("Testus acceptus")
                .nameComplete("Testus acceptus")
                .name("Testus acceptus")
                .modified(new Date())
                .build();
        SearchItemIndex synonym = SearchItemIndex.builder()
                .id("taxon-update-service-synonym")
                .guid(SYNONYM_GUID)
                .idxtype("TAXON")
                .scientificName("Testus synonymus")
                .name("Testus synonymus")
                .acceptedConceptID(ACCEPTED_GUID)
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(
                elasticService.buildIndexQuery(accepted), elasticService.buildIndexQuery(synonym))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        Boolean result = taxonUpdateService.run().join();
        assertThat(result).isTrue();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        await().atMost(15, TimeUnit.SECONDS).untilAsserted(() -> {
            Map<?, ?> acceptedDoc = elasticService.getDocumentMap("taxon-update-service-accepted");
            assertThat(acceptedDoc).isNotNull();
            assertThat(((Number) acceptedDoc.get("occurrenceCount")).intValue()).isEqualTo(42);
            assertThat(acceptedDoc.get("image")).isEqualTo("image1");
        });

        await().atMost(15, TimeUnit.SECONDS).untilAsserted(() -> {
            Map<?, ?> synonymDoc = elasticService.getDocumentMap("taxon-update-service-synonym");
            assertThat(synonymDoc).isNotNull();
            assertThat(synonymDoc.get("acceptedConceptName")).isEqualTo("Testus acceptus");
        });
    }
}
