package au.org.ala.search.controller;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.dto.SetRequest;
import au.org.ala.search.service.AdminService;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.service.update.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

/**
 * Admin API
 *
 * TODO: rename or refactor controllers as it looks odd
 * TODO: better annotate v1 and v2 services for the swagger-ui
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class V2AdminController {
    private static final Logger logger = LoggerFactory.getLogger(V2AdminController.class);
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
    protected final AdminService adminService;
    protected final AllService allService;
    protected final AuthService authService;
    protected final DashboardService dashboardService;
    private final LogService logService;
    private final TaskExecutor processExecutor;
    private final TaskExecutor blockingExecutor;
    private final TaskExecutor elasticSearchUpdate;

    public V2AdminController(DwCAImportService dwCAImportService, WordpressImportService wordpressImportService, TaskExecutor blockingExecutor, KnowledgebaseImportService knowledgebaseImportService, ListImportService listImportService, AdminService adminService, AllService allService, CollectionsImportService collectionsImportService, BiocollectImportService biocollectImportService, LogService logService, LayerImportService layerImportService, AreaImportService areaImportService, DashboardService dashboardService, TaskExecutor processExecutor, TaskExecutor elasticSearchUpdate, AuthService authService, TaxonUpdateService taxonUpdateService, SitemapService sitemapService) {
        this.dwCAImportService = dwCAImportService;
        this.wordpressImportService = wordpressImportService;
        this.blockingExecutor = blockingExecutor;
        this.knowledgebaseImportService = knowledgebaseImportService;
        this.listImportService = listImportService;
        this.adminService = adminService;
        this.allService = allService;
        this.collectionsImportService = collectionsImportService;
        this.biocollectImportService = biocollectImportService;
        this.logService = logService;
        this.layerImportService = layerImportService;
        this.areaImportService = areaImportService;
        this.dashboardService = dashboardService;
        this.processExecutor = processExecutor;
        this.elasticSearchUpdate = elasticSearchUpdate;
        this.authService = authService;
        this.taxonUpdateService = taxonUpdateService;
        this.sitemapService = sitemapService;
    }

    @SecurityRequirement(name = "JWT")
    @Operation(tags = "ADMIN", summary = "Set list backed value")
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @PostMapping(path = "/v2/admin/set", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> index(@RequestBody SetRequest setValue,
                                        @AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        boolean successful = adminService.setValue(setValue);

        if (!successful) {
            return ResponseEntity.internalServerError().build();
        }

        return ResponseEntity.ok().build();
    }

    @SecurityRequirement(name = "JWT")
    @Operation(tags = "ADMIN", summary = "Update data")
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @GetMapping(path = "/v2/admin/update", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> index(
            @RequestParam(name = "type") TaskType type,
            @AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        if (!allService.isTaskEnabled(type)) {
            return ResponseEntity.ok().body("{\"message\": \"task is disabled\"}");
        }

        if (((ThreadPoolTaskExecutor) processExecutor).getActiveCount() > 0 && type == TaskType.ALL) {
            return ResponseEntity.ok().body("{\"message\": \"cannot queue ALL when any task is in progress\"}");
        }

        switch (type) {
            case TaskType.ALL -> allService.run();
            case TaskType.AREA -> areaImportService.run();
            case TaskType.BIOCACHE -> taxonUpdateService.run();
            case TaskType.BIOCOLLECT -> biocollectImportService.run();
            case TaskType.COLLECTIONS -> collectionsImportService.run();
            case TaskType.DWCA -> dwCAImportService.run();
            case TaskType.KNOWLEDGEBASE -> knowledgebaseImportService.run();
            case TaskType.LAYER -> layerImportService.run();
            case TaskType.LISTS -> listImportService.run();
            case TaskType.SITEMAP -> sitemapService.run();
            case TaskType.WORDPRESS -> wordpressImportService.run();
            case TaskType.DASHBOARD -> dashboardService.run();
        }

        return ResponseEntity.ok("{\"message\": \"task queued\"}");
    }

    @Operation(tags = "ADMIN", summary = "Application info")
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @SecurityRequirement(name = "JWT")
    @GetMapping(path = "/v2/admin/info", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> info(
            @RequestParam(name = "type", required = false) TaskType type,
            @RequestParam(name = "pageSize", required = false, defaultValue = "1") Integer logPageSize,
            @AuthenticationPrincipal Principal principal)
            throws IOException {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        Map<String, Object> response = new HashMap<>();

        // most recent status for each task
        Map<String, Object> tasks = new HashMap<>();
        for (TaskType tt : TaskType.values()) {
            if (type == null || tt == type) {
                Map<String, Object> taskMap = new HashMap<>();
                taskMap.put("description", tt.description);
                taskMap.put("log", logService.getStatus(tt, logPageSize));
                taskMap.put("enabled", allService.isTaskEnabled(tt));
                tasks.put(tt.name(), taskMap);
            }
        }
        response.put("tasks", tasks);

        Map<String, Object> queues = new HashMap<>();
        Map<String, Object> queue = new HashMap<>();
        queue.put("activeCount", ((ThreadPoolTaskExecutor) processExecutor).getActiveCount());
        queue.put("queueCapacity", ((ThreadPoolTaskExecutor) processExecutor).getQueueCapacity());
        queue.put("queueSize", ((ThreadPoolTaskExecutor) processExecutor).getQueueSize());
        queue.put("description", "tasks queue");
        queues.put("tasks", queue);

        queue = new HashMap<>();
        queue.put("activeCount", ((ThreadPoolTaskExecutor) blockingExecutor).getActiveCount());
        queue.put("queueCapacity", ((ThreadPoolTaskExecutor) blockingExecutor).getQueueCapacity());
        queue.put("queueSize", ((ThreadPoolTaskExecutor) blockingExecutor).getQueueSize());
        queue.put("description", "blocking queue containing sub tasks");
        queues.put("subtasks", queue);

        queue = new HashMap<>();
        queue.put("activeCount", ((ThreadPoolTaskExecutor) elasticSearchUpdate).getActiveCount());
        queue.put("queueCapacity", ((ThreadPoolTaskExecutor) elasticSearchUpdate).getQueueCapacity());
        queue.put("queueSize", ((ThreadPoolTaskExecutor) elasticSearchUpdate).getQueueSize());
        queue.put("description", "blocking queue containing a subset of update requests");
        queues.put("elasticsearch", queue);

        response.put("queues", queues);

        return ResponseEntity.ok(new ObjectMapper().writer().writeValueAsString(response));
    }
}
