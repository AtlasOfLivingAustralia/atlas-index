/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.remote.ElasticService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end coverage of {@link DescriptionsUpdateService#run()} against a real (Testcontainers)
 * Elasticsearch instance and a real {@link au.org.ala.search.service.remote.DataFileStoreService}
 * pointed at a local temp directory (via a {@code data.filestore.path} property override — local
 * mode, since the path doesn't start with {@code "s3"}). A fixture {@code hero-descriptions.json}
 * file is written directly into the temp dir before running. Covers both branches: a TAXON
 * document that already has a (different) {@code heroDescription} gets updated by
 * {@code updateCurrentDocuments()}, and a TAXON document with no existing {@code heroDescription}
 * gets it added by {@code addDescriptions()} (via {@code ElasticService.queryTaxonIds}, which
 * requires the doc be {@code idxtype:TAXON} and have no {@code acceptedConceptID}).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DescriptionsUpdateServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static Path tempDir;

    @Autowired
    private DescriptionsUpdateService descriptionsUpdateService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;

    @DynamicPropertySource
    static void fileStoreProperties(DynamicPropertyRegistry registry) throws IOException {
        tempDir = Files.createTempDirectory("descriptions-test");
        registry.add("data.filestore.path", () -> tempDir.toString());
    }

    @Test
    void run_updatesExistingDescriptionAndAddsNewOne() throws Exception {
        String guidA = "urn:lsid:test:hero-a";
        String guidB = "urn:lsid:test:hero-b";

        SearchItemIndex taxonA = SearchItemIndex.builder()
                .id("hero-a-doc")
                .guid(guidA)
                .idxtype("TAXON")
                .heroDescription("Old description A")
                .modified(new Date())
                .build();
        SearchItemIndex taxonB = SearchItemIndex.builder()
                .id("hero-b-doc")
                .guid(guidB)
                .idxtype("TAXON")
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(
                elasticService.buildIndexQuery(taxonA),
                elasticService.buildIndexQuery(taxonB))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        Files.writeString(tempDir.resolve("hero-descriptions.json"), """
                {
                  "%s": "New description A",
                  "%s": "New description B"
                }
                """.formatted(guidA, guidB));

        descriptionsUpdateService.run().join();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            Map<?, ?> docA = elasticService.getDocumentMap("hero-a-doc");
            assertThat(docA).isNotNull();
            assertThat(docA.get("heroDescription")).isEqualTo("New description A");

            Map<?, ?> docB = elasticService.getDocumentMap("hero-b-doc");
            assertThat(docB).isNotNull();
            assertThat(docB.get("heroDescription")).isEqualTo("New description B");
        });
    }
}
