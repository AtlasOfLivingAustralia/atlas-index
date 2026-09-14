/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.ListBackedFields;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.taxon.TaxonData;
import au.org.ala.search.repo.TaxonDataPostgresRepository;
import au.org.ala.search.service.remote.ElasticService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end coverage of {@link PostgresSyncService#run()} against a real (Testcontainers)
 * PostgreSQL instance (seeded via {@link TaxonDataPostgresRepository}) and a real Elasticsearch
 * instance: seeds {@code taxon_data} rows for the {@code HIDDEN}/{@code IMAGE}/{@code WIKI}/
 * {@code HERO_DESCRIPTION} list-backed fields against a matching TAXON document (matched via
 * {@code ElasticService.queryTaxonId}, which requires {@code idxtype:TAXON} and no
 * {@code acceptedConceptID}), and verifies all four fields are synced onto the ES document.
 * <p>
 * The {@code DESCRIPTIONS} field sync branch (which additionally requires a
 * {@code StaticFileStoreService}-backed taxon description JSON file to exist) is not covered
 * here — no {@code taxon_data} row is seeded for that key, so {@code findAllByKey} returns an
 * empty list and that branch is a no-op in this test, exercising only the "0 written, 0 skipped"
 * path.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PostgresSyncServiceIntegrationTest extends AbstractIntegrationTestContainers {

    @Autowired
    private PostgresSyncService postgresSyncService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;

    @Autowired
    private TaxonDataPostgresRepository taxonDataPostgresRepository;

    @Test
    void run_syncsHiddenImageWikiAndHeroDescriptionFieldsFromPostgresToElasticsearch() {
        String taxonConceptId = "urn:lsid:test:postgres-sync-taxon";
        String documentId = "postgres-sync-taxon-doc";

        SearchItemIndex taxon = SearchItemIndex.builder()
                .id(documentId)
                .guid(taxonConceptId)
                .idxtype("TAXON")
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(elasticService.buildIndexQuery(taxon))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        taxonDataPostgresRepository.save(TaxonData.builder()
                .taxonConceptId(taxonConceptId)
                .key(ListBackedFields.HIDDEN.field)
                .value("image-1,image-2")
                .build());
        taxonDataPostgresRepository.save(TaxonData.builder()
                .taxonConceptId(taxonConceptId)
                .key(ListBackedFields.IMAGE.field)
                .value("preferred-image-id")
                .build());
        taxonDataPostgresRepository.save(TaxonData.builder()
                .taxonConceptId(taxonConceptId)
                .key(ListBackedFields.WIKI.field)
                .value("https://en.wikipedia.org/wiki/Test_taxon")
                .build());
        taxonDataPostgresRepository.save(TaxonData.builder()
                .taxonConceptId(taxonConceptId)
                .key(ListBackedFields.HERO_DESCRIPTION.field)
                .value("A synced hero description")
                .build());

        postgresSyncService.run().join();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            Map<?, ?> indexed = elasticService.getDocumentMap(documentId);
            assertThat(indexed).isNotNull();
            assertThat(indexed.get("hiddenImages_s")).isEqualTo("image-1,image-2");
            assertThat(indexed.get("image")).isEqualTo("preferred-image-id");
            assertThat(indexed.get("wikiUrl_s")).isEqualTo("https://en.wikipedia.org/wiki/Test_taxon");
            assertThat(indexed.get("heroDescription")).isEqualTo("A synced hero description");
        });
    }
}
