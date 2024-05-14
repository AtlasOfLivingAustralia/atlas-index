package au.org.ala.search.service.update;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.LogService;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class AllService {
    private static final Logger logger = LoggerFactory.getLogger(AllService.class);
    private static final TaskType taskType = TaskType.ALL;
    protected final WordpressImportService wordpressImportService;
    protected final KnowledgebaseImportService knowledgebaseImportService;
    protected final ListImportService listImportService;
    protected final CollectionsImportService collectionsImportService;
    protected final BiocollectImportService biocollectImportService;
    protected final LayerImportService layerImportService;
    protected final AreaImportService areaImportService;
    protected final DwCAImportService dwCAImportService;
    protected final TaxonUpdateService taxonUpdateService;
    protected final SitemapService sitemapService;
    protected final LogService logService;
    protected final DashboardService dashboardService;
    @Value("${task.AREA.enabled}")
    public Boolean taskAreaEnabled;
    @Value("${task.BIOCACHE.enabled}")
    public Boolean taskBiocacheEnabled;
    @Value("${task.BIOCOLLECT.enabled}")
    public Boolean taskBiocollectEnabled;
    @Value("${task.COLLECTIONS.enabled}")
    public Boolean taskCollectionsEnabled;
    @Value("${task.DWCA.enabled}")
    public Boolean taskDwcaEnabled;
    @Value("${task.KNOWLEDGEBASE.enabled}")
    public Boolean taskKnowledgebaseEnabled;
    @Value("${task.LAYER.enabled}")
    public Boolean taskLayerEnabled;
    @Value("${task.LISTS.enabled}")
    public Boolean taskListsEnabled;
    @Value("${task.SITEMAP.enabled}")
    public Boolean taskSitemapEnabled;
    @Value("${task.WORDPRESS.enabled}")
    public Boolean taskWordpressEnabled;

    public AllService(CollectionsImportService collectionsImportService, WordpressImportService wordpressImportService,
                      KnowledgebaseImportService knowledgebaseImportService, LogService logService,
                      ListImportService listImportService, BiocollectImportService biocollectImportService,
                      LayerImportService layerImportService, AreaImportService areaImportService,
                      DwCAImportService dwCAImportService, TaxonUpdateService taxonUpdateService,
                      SitemapService sitemapService, DashboardService dashboardService) {
        this.collectionsImportService = collectionsImportService;
        this.wordpressImportService = wordpressImportService;
        this.knowledgebaseImportService = knowledgebaseImportService;
        this.logService = logService;
        this.listImportService = listImportService;
        this.biocollectImportService = biocollectImportService;
        this.layerImportService = layerImportService;
        this.areaImportService = areaImportService;
        this.dwCAImportService = dwCAImportService;
        this.taxonUpdateService = taxonUpdateService;
        this.sitemapService = sitemapService;
        this.dashboardService = dashboardService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        try {
            logService.log(taskType, "Start");

            // Delete existing DwCA records and import again
            CompletableFuture<Boolean> dwcaImport = dwCAImportService.run();

            // wait for DwCA import to finish
            logService.log(taskType, "Waiting for DwCA to finish");
            CompletableFuture.allOf(dwcaImport).join();

            if (!dwcaImport.get()) {
                logService.log(taskType, "Failed to import DwCA");
                logger.error("DwCA import failed. Aborting Import everything.");
                return CompletableFuture.completedFuture(false);
            }

            List<CompletableFuture<Boolean>> tasks = new ArrayList<>(10);

            // queue import lists and update other TAXON fields, may create COMMON records
            tasks.add(listImportService.run());

            // queue update TAXON fields
            tasks.add(taxonUpdateService.run());

            // queue everything else
            tasks.add(areaImportService.run());
            tasks.add(biocollectImportService.run());
            tasks.add(collectionsImportService.run());
            tasks.add(knowledgebaseImportService.run());
            tasks.add(layerImportService.run());
            tasks.add(wordpressImportService.run());

            // wait for everything to finish
            logService.log(taskType, "Waiting for other updates to finish");
            CompletableFuture.allOf(tasks.toArray(new CompletableFuture[0])).join();

            // generate sitemap (TAXON only) and dashboard
            logService.log(taskType, "Waiting for sitemap and dashboard to finish");
            CompletableFuture.allOf(new CompletableFuture[]{sitemapService.run(), dashboardService.run()}).join();

            logService.log(taskType, "Finished");

            return CompletableFuture.completedFuture(true);
        } catch (Exception e) {
            logService.log(taskType, "Failed to import all: " + e.getMessage());
            logger.error("Failed import all: " + e.getMessage(), e);
            return CompletableFuture.completedFuture(false);
        }
    }

    public Boolean isTaskEnabled(TaskType taskType) {
        // ALL and RECORD are special cases and always enabled
        if (taskType == TaskType.ALL || taskType == TaskType.RECORD || taskType == TaskType.DASHBOARD) {
            return true;
        }

        try {
            Field field = AllService.class.getField("task" + StringUtils.capitalize(taskType.name().toLowerCase()) + "Enabled");
            return (Boolean) field.get(this);
        } catch (NoSuchFieldException | IllegalAccessException e) {
            return true; // it is probably OK to ignore this exception
        }
    }
}
