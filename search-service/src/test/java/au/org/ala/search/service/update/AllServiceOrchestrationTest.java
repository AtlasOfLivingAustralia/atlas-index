/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link AllService#run()} orchestration logic: verifies conditional dispatch of
 * collaborator services based on {@code task.*.enabled} flags and the seeded TAXON count, the
 * DwCA-import-abort short-circuit, and that sitemap/dashboard always run last. No Spring context
 * or containers are used — {@code run()} is invoked directly (not through the {@code @Async}
 * proxy that only applies when the bean is Spring-managed), so it executes synchronously and
 * collaborator {@code run()} calls are verified via Mockito. See {@link AllServiceTest} for
 * {@code isTaskEnabled()} coverage.
 */
class AllServiceOrchestrationTest {

    private CollectionsImportService collectionsImportService;
    private WordpressImportService wordpressImportService;
    private KnowledgebaseImportService knowledgebaseImportService;
    private DigivolImportService digivolImportService;
    private LogService logService;
    private ListImportService listImportService;
    private BiocollectImportService biocollectImportService;
    private LayerImportService layerImportService;
    private AreaImportService areaImportService;
    private DwCAImportService dwCAImportService;
    private TaxonUpdateService taxonUpdateService;
    private SitemapService sitemapService;
    private DashboardService dashboardService;
    private DescriptionsUpdateService descriptionsUpdateService;
    private PostgresSyncService postgresSyncService;
    private ElasticService elasticService;

    private AllService allService;

    @BeforeEach
    void setUp() {
        collectionsImportService = mock(CollectionsImportService.class);
        wordpressImportService = mock(WordpressImportService.class);
        knowledgebaseImportService = mock(KnowledgebaseImportService.class);
        digivolImportService = mock(DigivolImportService.class);
        logService = mock(LogService.class);
        listImportService = mock(ListImportService.class);
        biocollectImportService = mock(BiocollectImportService.class);
        layerImportService = mock(LayerImportService.class);
        areaImportService = mock(AreaImportService.class);
        dwCAImportService = mock(DwCAImportService.class);
        taxonUpdateService = mock(TaxonUpdateService.class);
        sitemapService = mock(SitemapService.class);
        dashboardService = mock(DashboardService.class);
        descriptionsUpdateService = mock(DescriptionsUpdateService.class);
        postgresSyncService = mock(PostgresSyncService.class);
        elasticService = mock(ElasticService.class);

        allService = new AllService(collectionsImportService, wordpressImportService, knowledgebaseImportService,
                digivolImportService, logService, listImportService, biocollectImportService, layerImportService,
                areaImportService, dwCAImportService, taxonUpdateService, sitemapService, dashboardService,
                descriptionsUpdateService, postgresSyncService, elasticService);

        // enable every task by default; individual tests override as needed
        allService.taskAreaEnabled = true;
        allService.taskBiocacheEnabled = true;
        allService.taskBiocollectEnabled = true;
        allService.taskDigivolEnabled = true;
        allService.taskCollectionsEnabled = true;
        allService.taskDwcaEnabled = true;
        allService.taskKnowledgebaseEnabled = true;
        allService.taskLayerEnabled = true;
        allService.taskListsEnabled = true;
        allService.taskSitemapEnabled = true;
        allService.taskWordpressEnabled = true;
        allService.taskTaxonDescriptionEnabled = true;
        allService.taskDashboardEnabled = true;
        allService.taskPostgresSyncEnabled = true;

        when(dwCAImportService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(listImportService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(taxonUpdateService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(descriptionsUpdateService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(postgresSyncService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(areaImportService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(biocollectImportService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(collectionsImportService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(knowledgebaseImportService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(layerImportService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(wordpressImportService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(digivolImportService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(sitemapService.run()).thenReturn(CompletableFuture.completedFuture(true));
        when(dashboardService.run()).thenReturn(CompletableFuture.completedFuture(true));
    }

    @Test
    void run_taxonCountZero_runsDescriptionsAndPostgresSyncAlongsideEverythingElse() {
        when(elasticService.queryCount("idxtype", IndexDocType.TAXON.name())).thenReturn(0L);

        Boolean result = allService.run().join();

        assertThat(result).isTrue();
        verify(dwCAImportService).run();
        verify(listImportService).run();
        verify(taxonUpdateService).run();
        verify(descriptionsUpdateService).run();
        verify(postgresSyncService).run();
        verify(areaImportService).run();
        verify(biocollectImportService).run();
        verify(collectionsImportService).run();
        verify(knowledgebaseImportService).run();
        verify(layerImportService).run();
        verify(wordpressImportService).run();
        verify(digivolImportService).run();
        verify(sitemapService).run();
        verify(dashboardService).run();
    }

    @Test
    void run_taxonCountNonZero_skipsDescriptionsAndPostgresSync() {
        when(elasticService.queryCount("idxtype", IndexDocType.TAXON.name())).thenReturn(42L);

        Boolean result = allService.run().join();

        assertThat(result).isTrue();
        verify(descriptionsUpdateService, never()).run();
        verify(postgresSyncService, never()).run();
        // everything else still runs
        verify(listImportService).run();
        verify(taxonUpdateService).run();
        verify(areaImportService).run();
        verify(sitemapService).run();
        verify(dashboardService).run();
    }

    @Test
    @au.org.ala.search.test.SuppressExpectedLogging("au.org.ala.search.service.update.AllService")
    void run_dwcaImportFails_abortsBeforeRunningAnyOtherTask() {
        when(elasticService.queryCount("idxtype", IndexDocType.TAXON.name())).thenReturn(0L);
        when(dwCAImportService.run()).thenReturn(CompletableFuture.completedFuture(false));

        Boolean result = allService.run().join();

        assertThat(result).isFalse();
        verify(dwCAImportService).run();
        verifyNoInteractions(listImportService, taxonUpdateService, descriptionsUpdateService,
                postgresSyncService, areaImportService, biocollectImportService, collectionsImportService,
                knowledgebaseImportService, layerImportService, wordpressImportService, digivolImportService,
                sitemapService, dashboardService);
    }

    @Test
    void run_dwcaDisabled_skipsDwcaButRunsEverythingElse() {
        allService.taskDwcaEnabled = false;
        when(elasticService.queryCount("idxtype", IndexDocType.TAXON.name())).thenReturn(0L);

        Boolean result = allService.run().join();

        assertThat(result).isTrue();
        verify(dwCAImportService, never()).run();
        verify(listImportService).run();
        verify(sitemapService).run();
        verify(dashboardService).run();
    }

    @Test
    void run_individualTaskDisabled_correspondingServiceNotInvoked() {
        allService.taskListsEnabled = false;
        allService.taskAreaEnabled = false;
        allService.taskBiocollectEnabled = false;
        allService.taskCollectionsEnabled = false;
        allService.taskKnowledgebaseEnabled = false;
        allService.taskLayerEnabled = false;
        allService.taskWordpressEnabled = false;
        allService.taskDigivolEnabled = false;
        allService.taskBiocacheEnabled = false;
        when(elasticService.queryCount("idxtype", IndexDocType.TAXON.name())).thenReturn(0L);

        Boolean result = allService.run().join();

        assertThat(result).isTrue();
        verify(listImportService, never()).run();
        verify(areaImportService, never()).run();
        verify(biocollectImportService, never()).run();
        verify(collectionsImportService, never()).run();
        verify(knowledgebaseImportService, never()).run();
        verify(layerImportService, never()).run();
        verify(wordpressImportService, never()).run();
        verify(digivolImportService, never()).run();
        verify(taxonUpdateService, never()).run();
        // still runs since it does not depend on the disabled flags above
        verify(dwCAImportService).run();
        verify(sitemapService).run();
        verify(dashboardService).run();
    }

    @Test
    void run_sitemapAndDashboardDisabled_notInvokedButOtherTasksStillRun() {
        allService.taskSitemapEnabled = false;
        allService.taskDashboardEnabled = false;
        when(elasticService.queryCount("idxtype", IndexDocType.TAXON.name())).thenReturn(0L);

        Boolean result = allService.run().join();

        assertThat(result).isTrue();
        verify(sitemapService, never()).run();
        verify(dashboardService, never()).run();
        verify(listImportService).run();
    }
}
