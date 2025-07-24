/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.model.dto.SetRequest;
import au.org.ala.search.model.quality.QualityProfile;
import au.org.ala.search.service.AdminService;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.consumer.FieldguideConsumer;
import au.org.ala.search.service.consumer.SearchConsumer;
import au.org.ala.search.service.queue.*;
import au.org.ala.search.service.remote.ConfigService;
import au.org.ala.search.service.remote.QualityDataService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.service.update.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.SneakyThrows;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

/**
 * Admin API
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class V2AdminController {
    protected final WordpressImportService wordpressImportService;
    protected final KnowledgebaseImportService knowledgebaseImportService;
    protected final ListImportService listImportService;
    protected final CollectionsImportService collectionsImportService;
    protected final BiocollectImportService biocollectImportService;
    protected final DigivolImportService digivolImportService;
    protected final LayerImportService layerImportService;
    protected final AreaImportService areaImportService;
    protected final DwCAImportService dwCAImportService;
    protected final TaxonUpdateService taxonUpdateService;
    protected final SitemapService sitemapService;
    protected final AdminService adminService;
    protected final AllService allService;
    protected final AuthService authService;
    protected final DashboardService dashboardService;
    protected final LogService logService;
    protected final TaskExecutor processExecutor;
    protected final TaskExecutor blockingExecutor;
    protected final TaskExecutor elasticSearchUpdate;
    protected final ConsumerQueue consumerQueue;
    protected final FieldguideConsumer fieldguideConsumer;
    protected final SearchConsumer searchConsumer;
    protected final DescriptionsUpdateService descriptionsUpdateService;
    protected final QualityDataService qualityDataService;
    protected final BroadcastQueue broadcastQueue;
    private final LeaderQueue leaderQueue;
    private final ConfigService configService;

    public V2AdminController(DwCAImportService dwCAImportService, WordpressImportService wordpressImportService, DigivolImportService digivolImportService,
                             TaskExecutor blockingExecutor, KnowledgebaseImportService knowledgebaseImportService,
                             ListImportService listImportService, AdminService adminService, AllService allService,
                             CollectionsImportService collectionsImportService,
                             BiocollectImportService biocollectImportService, LogService logService,
                             LayerImportService layerImportService, AreaImportService areaImportService,
                             DashboardService dashboardService, TaskExecutor processExecutor,
                             TaskExecutor elasticSearchUpdate, AuthService authService,
                             TaxonUpdateService taxonUpdateService, SitemapService sitemapService,
                             ConsumerQueue consumerQueue, FieldguideConsumer fieldguideConsumer,
                             SearchConsumer searchConsumer,
                             DescriptionsUpdateService descriptionsUpdateService,
                             QualityDataService qualityDataService, BroadcastQueue broadcastQueue, LeaderQueue leaderQueue, ConfigService configService) {
        this.dwCAImportService = dwCAImportService;
        this.wordpressImportService = wordpressImportService;
        this.digivolImportService = digivolImportService;
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
        this.consumerQueue = consumerQueue;
        this.fieldguideConsumer = fieldguideConsumer;
        this.searchConsumer = searchConsumer;
        this.descriptionsUpdateService = descriptionsUpdateService;
        this.qualityDataService = qualityDataService;
        this.broadcastQueue = broadcastQueue;
        this.leaderQueue = leaderQueue;
        this.configService = configService;
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
    @Operation(tags = "ADMIN", summary = "Start a task")
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @PostMapping(path = "/v2/admin/task", produces = MediaType.APPLICATION_JSON_VALUE, consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> index(
            @RequestParam(name = "type") TaskType type,
            @RequestBody(required = false) Map<String, Object> requestBody,
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

        boolean notSupported = false;
        switch (type) {
            // ingestion tasks
            case TaskType.ALL -> allService.run();
            case TaskType.AREA -> areaImportService.run();
            case TaskType.BIOCACHE -> taxonUpdateService.run();
            case TaskType.DIGIVOL -> digivolImportService.run();
            case TaskType.BIOCOLLECT -> biocollectImportService.run();
            case TaskType.COLLECTIONS -> collectionsImportService.run();
            case TaskType.DWCA -> dwCAImportService.run();
            case TaskType.KNOWLEDGEBASE -> knowledgebaseImportService.run();
            case TaskType.LAYER -> layerImportService.run();
            case TaskType.LISTS -> listImportService.run();
            case TaskType.SITEMAP -> sitemapService.run();
            case TaskType.WORDPRESS -> wordpressImportService.run();
            case TaskType.DASHBOARD -> dashboardService.run();
            case TaskType.TAXON_DESCRIPTION -> descriptionsUpdateService.run();

            // broadcast tasks
            case TaskType.CACHE_RESET_ALL -> broadcastQueue.sendMessage(type, null);
            case TaskType.CACHE_RESET_COLLECTORY -> broadcastQueue.sendMessage(type, null);
            case TaskType.CACHE_RESET_LISTS -> broadcastQueue.sendMessage(type, null);
            case TaskType.CACHE_RESET_DATA_QUALITY -> broadcastQueue.sendMessage(type, null);

            default -> {
                notSupported = true;
            }
        }

        if (notSupported) {
            return ResponseEntity.badRequest().body("{\"message\": \"notSupported task type: " + type + "\"}");
        }
        return ResponseEntity.ok("{\"message\": \"task queued\"}");
    }

    @Operation(tags = "ADMIN", summary = "Application events log")
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @SecurityRequirement(name = "JWT")
    @GetMapping(path = "/v2/admin/log", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> log(
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

        return ResponseEntity.ok(new ObjectMapper().writer().writeValueAsString(response));
    }

    @Operation(tags = "ADMIN", summary = "Application staus")
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @SecurityRequirement(name = "JWT")
    @GetMapping(path = "/v2/admin/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> status(@AuthenticationPrincipal Principal principal)
            throws IOException {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        Map<String, Object> response = new HashMap<>();

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

        queues.putAll(consumerQueue.getQueueStats());

        response.put("queues", queues);

        return ResponseEntity.ok(new ObjectMapper().writer().writeValueAsString(response));
    }

    @Operation(tags = "ADMIN", summary = "List data quality profiles")
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @SecurityRequirement(name = "JWT")
    @GetMapping(path = "/v2/admin/dq", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<QualityProfile>> dqGet(
            @RequestParam(name = "page", required = false, defaultValue = "0") Integer page,
            @RequestParam(name = "pageSize", required = false, defaultValue = "10") Integer pageSize,
            @RequestParam(name = "q", required = false) String q,
            @AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        return ResponseEntity.ok(qualityDataService.getProfiles());
    }

    @SneakyThrows
    @Operation(tags = "ADMIN", summary = "Delete a data quality profile",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Profile deleted successfully"),
                    @ApiResponse(responseCode = "202", description = "Profile deletion is queued (timeout)"),
                    @ApiResponse(responseCode = "500", description = "Profile deletion failed")
            })
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @SecurityRequirement(name = "JWT")
    @DeleteMapping(path = "/v2/admin/dq", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> dqDelete(
            @RequestParam(name = "id") Long id,
            @AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        // Check if the profile exists
        QualityProfile existingProfile = qualityDataService.getProfile(String.valueOf(id));
        if (existingProfile == null) {
            return ResponseEntity.notFound().build();
        }

        // A basic wait for the cache to be cleared after the deletion
        CountDownLatch latch = qualityDataService.getCacheRefreshLatch();
        Map<String, String> response = leaderQueue.sendRpcMessage(TaskType.DATA_QUALITY_DELETE, QualityProfile.builder().id(id).build());
        if (response == null || response.get("status").equals("error")) {
            return ResponseEntity.status(500).body("{\"message\": \"Profile deletion failed\"}");
        } else if (response.get("status").equals("timeout")) {
            return ResponseEntity.status(202).body("{\"message\": \"Profile deletion is queued (timeout)\"}");
        }

        // Wait for max 5 seconds for the cache to be cleared after a successful deletion. Otherwise it probably failed.
        latch.await(5000, java.util.concurrent.TimeUnit.MILLISECONDS);

        // Check if the profile was deleted
        QualityProfile profile = qualityDataService.getProfileNow(existingProfile.getShortName());
        if (profile != null) {
            return ResponseEntity.status(500).body("{\"message\": \"Profile deletion failed\"}");
        }

        return ResponseEntity.ok("{\"message\": \"Profile deleted successfully\"}");
    }

    @SneakyThrows
    @Operation(tags = "ADMIN", summary = "Create or update a data quality profile",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Profile saved/created successfully"),
                    @ApiResponse(responseCode = "202", description = "Profile save/creation is queued (timeout)"),
                    @ApiResponse(responseCode = "500", description = "Profile save/creation failed")
            })
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @SecurityRequirement(name = "JWT")
    @PostMapping(path = "/v2/admin/dq", produces = MediaType.APPLICATION_JSON_VALUE, consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<QualityProfile> dqPost(
            @RequestBody QualityProfile profile,
            @AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        Map<String, String> response = leaderQueue.sendRpcMessage(TaskType.DATA_QUALITY_SAVE, profile);
        if (response == null || response.get("status").equals("error")) {
            return ResponseEntity.status(500).build();
        } else if (response.get("status").equals("timeout")) {
            return ResponseEntity.status(202).build();
        }

        // unlike the delete API this create/update API does not need to wait for the cache to be cleared
        QualityProfile newProfile = qualityDataService.getProfileNow(profile.getShortName());
        if (newProfile == null) {
            return ResponseEntity.status(500).build();
        }

        return ResponseEntity.ok(newProfile);
    }

    @SecurityRequirement(name = "JWT")
    @Operation(tags = "ADMIN", summary = "Update one dynamic config value")
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @PostMapping(path = "/v2/admin/config", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> configSet(@RequestBody ConfigData newConfigData,
                                        @AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        try {
            configService.save(newConfigData);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("{\"message\": \"Failed to save config data: " + e.getMessage() + "\"}");
        }

        return ResponseEntity.ok().build();
    }

    @SecurityRequirement(name = "JWT")
    @Operation(tags = "ADMIN", summary = "Get all dynamic config values")
    @Tag(name = "ADMIN", description = "REST Services for admin")
    @GetMapping(path = "/v2/admin/config", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ConfigData>> configSet(@AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        return ResponseEntity.ok().body(configService.getAll());
    }
}
