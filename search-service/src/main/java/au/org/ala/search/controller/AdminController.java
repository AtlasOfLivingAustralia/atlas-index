/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.banner.BannerRequest;
import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.model.dto.IndexedField;
import au.org.ala.search.model.dto.SetRequest;
import au.org.ala.search.model.quality.QualityProfile;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.QueueRequest;
import au.org.ala.search.model.queue.SearchQueueRequest;
import au.org.ala.search.service.AdminService;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.consumer.FieldguideConsumer;
import au.org.ala.search.service.consumer.SearchConsumer;
import au.org.ala.search.service.queue.*;
import au.org.ala.search.service.remote.*;
import au.org.ala.search.service.update.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.mail.internet.MimeMessage;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;

/**
 * Admin API
 */
@Tag(name = "Admin", description = "Internal use only")
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class AdminController {
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
    private final QueueDataService queueDataService;
    private final ElasticService elasticService;
    private final DataFileStoreService dataFileStoreService;
    private final DownloadFileStoreService downloadFileStoreService;
    private final StaticFileStoreService staticFileStoreService;
    private final RabbitTemplate rabbitTemplate;
    private final TaxonDataService taxonDataService;
    private final ConfigService configDataService;
    private final UserDataService userDataService;
    private final SitemapFileStoreService sitemapFileStoreService;
    private final JavaMailSender emailSender;
    private final BannerService bannerService;

    @Value("${biocache.url}")
    private String biocacheWsUrl;

    @Value("${fieldguide.email.enabled}")
    public boolean emailEnabled;

    @Value("${email.from}")
    public String emailFrom;

    @Value("#{'${openapi.servers}'.split(',')[0]}")
    private String baseUrl;

    public AdminController(DwCAImportService dwCAImportService, WordpressImportService wordpressImportService, DigivolImportService digivolImportService,
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
                           QualityDataService qualityDataService, BroadcastQueue broadcastQueue, LeaderQueue leaderQueue,
                           ConfigService configService, QueueDataService queueDataService,
                           ElasticService elasticService, DataFileStoreService dataFileStoreService,
                           DownloadFileStoreService downloadFileStoreService, StaticFileStoreService staticFileStoreService,
                           RabbitTemplate rabbitTemplate, TaxonDataService taxonDataService, ConfigService configDataService,
                           UserDataService userDataService, SitemapFileStoreService sitemapFileStoreService,
                           JavaMailSender emailSender, BannerService bannerService) {
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
        this.queueDataService = queueDataService;
        this.elasticService = elasticService;
        this.dataFileStoreService = dataFileStoreService;
        this.downloadFileStoreService = downloadFileStoreService;
        this.staticFileStoreService = staticFileStoreService;
        this.rabbitTemplate = rabbitTemplate;
        this.taxonDataService = taxonDataService;
        this.configDataService = configDataService;
        this.userDataService = userDataService;
        this.sitemapFileStoreService = sitemapFileStoreService;
        this.emailSender = emailSender;
        this.bannerService = bannerService;
    }

    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @Operation(tags = "Admin", summary = "Set list backed value")
    @PostMapping(path = "/admin/set", consumes = MediaType.APPLICATION_JSON_VALUE)
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

    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @Operation(summary = "Start a task")
    @PostMapping(path = "/admin/task", produces = MediaType.APPLICATION_JSON_VALUE, consumes = MediaType.APPLICATION_JSON_VALUE)
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

        try {
            if (type.category == TaskType.Category.INGESTION) {
                leaderQueue.sendMessage(type, null, false);
            } else if (type.category == TaskType.Category.BROADCAST) {
                broadcastQueue.sendMessage(type, null);
            }
        } catch (Exception e) {
            log.error("Failed to queue task {}: {}", type, e.getMessage(), e);
            return ResponseEntity.internalServerError().body("{\"message\": \"failed to queue task: " + e.getMessage() + "\"}");
        }

        return ResponseEntity.ok("{\"message\": \"task queued, not yet validated\"}");
    }

    @Operation(tags = "Admin", summary = "Application events log")
    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @GetMapping(path = "/admin/log", produces = MediaType.APPLICATION_JSON_VALUE)
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

    @Operation(summary = "List data quality profiles")
    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @GetMapping(path = "/admin/dq", produces = MediaType.APPLICATION_JSON_VALUE)
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
    @Operation(summary = "Delete a data quality profile",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Profile deleted successfully"),
                    @ApiResponse(responseCode = "202", description = "Profile deletion is queued (timeout)"),
                    @ApiResponse(responseCode = "500", description = "Profile deletion failed")
            })
    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @DeleteMapping(path = "/admin/dq", produces = MediaType.APPLICATION_JSON_VALUE)
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
    @Operation(summary = "Create or update a data quality profile",
            responses = {
                    @ApiResponse(responseCode = "200", description = "Profile saved/created successfully"),
                    @ApiResponse(responseCode = "202", description = "Profile save/creation is queued (timeout)"),
                    @ApiResponse(responseCode = "500", description = "Profile save/creation failed")
            })
    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @PostMapping(path = "/admin/dq", produces = MediaType.APPLICATION_JSON_VALUE, consumes = MediaType.APPLICATION_JSON_VALUE)
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

    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @Operation(summary = "Update one dynamic config value")
    @PostMapping(path = "/admin/config", consumes = MediaType.APPLICATION_JSON_VALUE)
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

    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @Operation(summary = "Get all dynamic config values")
    @GetMapping(path = "/admin/config", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ConfigData>> configSet(@AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        return ResponseEntity.ok().body(configService.getAll());
    }

    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @Operation(summary = "Update a banner message",
            description = "Creates or updates a banner entry for the given UI section. Set message to an empty string to clear the banner.")
    @PostMapping(path = "/admin/banner", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> bannerUpdate(@RequestBody BannerRequest request,
                                             @AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        try {
            bannerService.save(request.getSection(), request.getMessage(), request.getSeverity());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok().build();
    }

    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @Operation(summary = "Search consumer tasks")
    @GetMapping(path = "/admin/tasks", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Page<QueueItem>> tasks(
            @RequestParam(name = "id", required = false) String id,
            @RequestParam(name = "userId", required = false) String userId,
            @RequestParam(name = "userEmail", required = false) String userEmail,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "taskType", required = false) String taskType,
            @RequestParam(name = "pageSize", required = false, defaultValue = "20") Long pageSize,
            @RequestParam(name = "page", required = false, defaultValue = "0") Long page,
            @AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        Page<QueueItem> result = queueDataService.list(id == null ? null : UUID.fromString(id), userId, userEmail, status, taskType, page, pageSize);

        return ResponseEntity.ok(result);
    }

    @SecurityRequirement(name = "JWT", scopes = {"admin"})
    @SecurityRequirement(name = "openIdConnect", scopes = {"ala/admin"})
    @Operation(summary = "Cancel a task")
    @DeleteMapping(path = "/admin/task")
    public ResponseEntity<?> cancelTask(
            @RequestParam(name = "id", required = false) Long id,
            @AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        broadcastQueue.sendMessage(TaskType.CANCEL_CONSUMER, id.toString());

        return ResponseEntity.ok().build();
    }

    /**
     * Return some info for the admin-ui dashboard. There is some overlap with the v2/admin/test endpoint.
     *
     * @param principal
     * @return
     */
    @GetMapping(path = "/admin/info", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> dashboard(@AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        Map<String, Object> response = new HashMap<>();

        Map<String, Object> elasticsearch = new HashMap<>();
        try {
            List<IndexedField> indexFields = elasticService.indexFields(true);
            elasticsearch.put("indexFields", indexFields.size());
        } catch (Exception e) {
            elasticsearch.put("error", "failed to retrieve index fields: " + e.getMessage());
        }

        try {
            Map<String, Object> idxtypes = new HashMap<>();
            for (IndexDocType type : IndexDocType.values()) {
                idxtypes.put(type.name(), elasticService.queryCount("idxtype", type.name()));
            }
            elasticsearch.put("idxtype", idxtypes);
        } catch (Exception e) {
            String error = elasticsearch.get("error") != null ? elasticsearch.get("error").toString() + ", " : "";
            elasticsearch.put("error", error + "failed to retrieve index fields: " + e.getMessage());
        }

        response.put("elasticsearch", elasticsearch);

        try {
            Map<String, Object> queues = new HashMap<>();
            queues.put("broadcastQueue", getQueueSize(BroadcastQueue.BROADCAST_QUEUE));
            queues.put("leaderQueue", getQueueSize(LeaderQueue.LEADER_QUEUE));
            queues.put("consumerQueue", getQueueSize(ConsumerQueue.TASK_QUEUE));
            response.put("rabbitmq", queues);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("rabbitmq", "Failed to get RabbitMQ queue sizes: " + e.getMessage());
        }

        // TODO: add local queue info when RabbitMQ is not used, for example:
//        Map<String, Object> response = new HashMap<>();
//        Map<String, Object> queues = new HashMap<>();
//        Map<String, Object> queue = new HashMap<>();
//        queue.put("activeCount", ((ThreadPoolTaskExecutor) processExecutor).getActiveCount());
//        queue.put("queueCapacity", ((ThreadPoolTaskExecutor) processExecutor).getQueueCapacity());
//        queue.put("queueSize", ((ThreadPoolTaskExecutor) processExecutor).getQueueSize());
//        queue.put("description", "tasks queue");
//        queues.put("tasks", queue);
//        queue = new HashMap<>();
//        queue.put("activeCount", ((ThreadPoolTaskExecutor) blockingExecutor).getActiveCount());
//        queue.put("queueCapacity", ((ThreadPoolTaskExecutor) blockingExecutor).getQueueCapacity());
//        queue.put("queueSize", ((ThreadPoolTaskExecutor) blockingExecutor).getQueueSize());
//        queue.put("description", "blocking queue containing sub tasks");
//        queues.put("subtasks", queue);
//        queue = new HashMap<>();
//        queue.put("activeCount", ((ThreadPoolTaskExecutor) elasticSearchUpdate).getActiveCount());
//        queue.put("queueCapacity", ((ThreadPoolTaskExecutor) elasticSearchUpdate).getQueueCapacity());
//        queue.put("queueSize", ((ThreadPoolTaskExecutor) elasticSearchUpdate).getQueueSize());
//        queue.put("description", "blocking queue containing a subset of update requests");
//        queues.put("elasticsearch", queue);
//        queues.putAll(consumerQueue.getQueueStats());
//        response.put("queues", queues);

        // postgres table counts
        try {
            Map<String, Object> tableCounts = new HashMap<>();
            tableCounts.put("taxon_data", taxonDataService.count());
            tableCounts.put("config", configDataService.count());
            tableCounts.put("dqprofile", qualityDataService.count());
            tableCounts.put("queue", queueDataService.count());
            tableCounts.put("userdata", userDataService.count());

            response.put("tables", tableCounts);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("tables", Map.of("error", e.getMessage()));
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping(path = "/admin/test", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> testVarious(@AuthenticationPrincipal Principal principal) {
        if (!authService.isAdmin(principal)) {
            throw new AccessDeniedException("Not authorised");
        }

        Map<String, Object> response = new HashMap<>();

        // test elasticsearch by retrieving index fields
        try {
            List<IndexedField> indexFields = elasticService.indexFields(true);
            response.put("indexFields", indexFields.size());
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("indexFields", e.getMessage());
        }

        // test elasticsearch by counting total TAXON documents
        try {
            long totalTaxon = elasticService.queryCount("idxtype", "TAXON");
            response.put("totalTaxon", totalTaxon);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("totalTaxon", e.getMessage());
        }

        // test data store storage
        try {
            File tmpFile = File.createTempFile("test-file", ".txt");
            String currentTimeMillis = String.valueOf(System.currentTimeMillis());
            Files.writeString(tmpFile.toPath(), currentTimeMillis);
            dataFileStoreService.copyToFileStore(tmpFile, "test-file.txt", true);

            File retrievedFile = dataFileStoreService.get("test-file.txt");
            String content = Files.readString(retrievedFile.toPath());
            if (currentTimeMillis.equals(content)) {
                response.put("dataFileStore", "File saved and retrieved successfully");
            } else {
                response.put("dataFileStore", "File content mismatch");
            }
            dataFileStoreService.cleanupFile(tmpFile);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("dataFileStore", "Failed to save or retrieve file: " + e.getMessage());
        }

        // test downloads storage
        try {
            File tmpFile = File.createTempFile("test-file", ".txt");
            String currentTimeMillis = String.valueOf(System.currentTimeMillis());
            Files.writeString(tmpFile.toPath(), currentTimeMillis);
            QueueItem queueItem = new QueueItem();
            queueItem.setId(UUID.randomUUID());
            queueItem.setQueueRequest(new QueueRequest());
            queueItem.getQueueRequest().setSearchQueueRequest(new SearchQueueRequest());
            downloadFileStoreService.copyToFileStore(tmpFile, queueItem, true);

            if (downloadFileStoreService.isS3()) {
                String presignedUrl = downloadFileStoreService.createPresignedGetUrl(queueItem);
                URL url = new URL(presignedUrl);
                String downloadedContent;
                try (InputStream in = url.openStream()) {
                    downloadedContent = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                }
                if (currentTimeMillis.equals(downloadedContent)) {
                    response.put("downloadFileStore", "Presigned URL file matches original");
                } else {
                    response.put("downloadFileStore", "Presigned URL file content mismatch");
                }
            } else {
                String filePath = downloadFileStoreService.getFilePath(queueItem);
                File retrievedFile = new File(filePath);
                String content = Files.readString(retrievedFile.toPath());
                if (currentTimeMillis.equals(content)) {
                    response.put("downloadFileStore", "File saved and retrieved successfully");
                } else {
                    response.put("downloadFileStore", "File content mismatch");
                }
            }

            downloadFileStoreService.delete(queueItem);

        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("downloadFileStore", "Failed to save or retrieve file: " + e.getMessage());
        }

        // test static file store
        try {
            File tmpFile = File.createTempFile("test-file", ".txt");
            String currentTimeMillis = String.valueOf(System.currentTimeMillis());
            Files.writeString(tmpFile.toPath(), currentTimeMillis);
            staticFileStoreService.copyToFileStore(tmpFile, "test-file.txt", true);

            File retrievedFile = staticFileStoreService.get("test-file.txt");
            String content = Files.readString(retrievedFile.toPath());
            if (currentTimeMillis.equals(content)) {
                response.put("staticFileStore", "File saved and retrieved successfully");
            } else {
                response.put("staticFileStore", "File content mismatch");
            }
            staticFileStoreService.cleanupFile(tmpFile);

            staticFileStoreService.delete("test-file.txt");
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("staticFileStore", "Failed to save or retrieve file: " + e.getMessage());
        }

        // test sitemap file store
        try {
            File tmpFile = File.createTempFile("test-file", ".txt");
            String currentTimeMillis = String.valueOf(System.currentTimeMillis());
            Files.writeString(tmpFile.toPath(), currentTimeMillis);
            sitemapFileStoreService.copyToFileStore(tmpFile, "test-file.txt", true);

            // TODO: use public path to test

            sitemapFileStoreService.deleteFile("test-file.txt");

            response.put("sitemapFileStore", "File saved and delete successfully");
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("sitemapFileStore", "Failed to save or retrieve file: " + e.getMessage());
        }

        // test rabbitmq connection by inspecting queue sizes
        try {
            response.put("broadcastQueue", getQueueSize(BroadcastQueue.BROADCAST_QUEUE));
            response.put("leaderQueue", getQueueSize(LeaderQueue.LEADER_QUEUE));
            response.put("consumerQueue", getQueueSize(ConsumerQueue.TASK_QUEUE));
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("rabbitmq", "Failed to get RabbitMQ queue info: " + e.getMessage());
        }

        // test postgres by counting the number of taxon_data records
        try {
            long totalTaxonData = taxonDataService.count();
            response.put("totalTaxonData", totalTaxonData);
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("totalTaxonData", e.getMessage());
        }

        // test a biocache-service query used by the dashboard service
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            Map result = objectMapper.readValue(IOUtils.toString(URI.create(biocacheWsUrl + "/occurrences/search?q=*:*&pageSize=0"), StandardCharsets.UTF_8), Map.class);
            response.put("biocacheOccurrences", result.get("totalRecords"));
        } catch (Exception e) {
            log.error(e.getMessage(), e);
            response.put("biocacheOccurrences", "Failed to execute biocache count query: " + e.getMessage());
        }

        if (emailEnabled) {
            try {
                String hostname = InetAddress.getLocalHost().getHostName();
                String env = System.getProperty("spring.profiles.active", "default");
                String version = getClass().getPackage().getImplementationVersion();

                MimeMessage mimeMessage = emailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, false, "UTF-8");
                helper.setFrom(emailFrom);
                helper.setTo(authService.getEmail(principal));
                helper.setSubject("Test email: " + baseUrl);
                helper.setText("<h1>Test email</h1>" +
                                "<ul>" +
                                "<li>Base URL: " + baseUrl + "</li>" +
                                "<li>Hostname: " + hostname + "</li>" +
                                "<li>Environment: " + env + "</li>" +
                                "<li>Version: " + version + "</li>" +
                                "</ul>", true);
                emailSender.send(mimeMessage);
                response.put("email", "Sent. Check your inbox: " + authService.getEmail(principal));
            } catch (Exception e) {
                log.error("Failed to send test email", e);
                response.put("email", "Exception: " + e.getMessage());
            }
        } else {
            response.put("email", "Disabled in configuration");
        }

        return ResponseEntity.ok(response);
    }

    private String getQueueSize(String queueName) {
        return rabbitTemplate.execute(channel ->
                "size=" + channel.queueDeclarePassive(queueName).getMessageCount() + ", " +
                        "consumers=" + channel.queueDeclarePassive(queueName).getConsumerCount() + ", ");
    }
}
