/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.LeadershipStatus;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.model.config.ConfigValidationListener;
import au.org.ala.search.service.queue.BroadcastQueue;
import au.org.ala.search.service.remote.ConfigService;
import au.org.ala.search.service.update.*;
import io.micrometer.common.util.StringUtils;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ScheduledFuture;

/**
 * SchedulerService manages scheduled tasks for the search service and responds to configuration changes.
 * <p>
 * Looks for configuration keys in the ConfigService in the format:
 * <pre>
 *     schedule.{task}.cron={cron_expression}
 *     schedule.{task}.enabled={true|false}
 *     where {task} is one of the TaskType enum values that is schedulable.
 *     </pre>
 */
@Slf4j
@Service
public class SchedulerService {

    private final ConfigService configService;
    private final LeadershipStatus leadershipStatus;
    private final AllService allService;
    private final BroadcastQueue broadcastQueue;
    private final AreaImportService areaImportService;
    private final TaxonUpdateService taxonUpdateService;
    private final DigivolImportService digivolImportService;
    private final BiocollectImportService biocollectImportService;
    private final CollectionsImportService collectionsImportService;
    private final KnowledgebaseImportService knowledgebaseImportService;
    private final LayerImportService layerImportService;
    private final WordpressImportService wordpressImportService;
    private final SitemapService sitemapService;
    private final DashboardService dashboardService;
    private final ListImportService listImportService;

    private final ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();
    private final Map<TaskType, ScheduledFuture<?>> scheduledTasks = new EnumMap<>(TaskType.class);

    public SchedulerService(ConfigService configService, LeadershipStatus leadershipStatus, AllService allService,
                            BroadcastQueue broadcastQueue, AreaImportService areaImportService,
                            TaxonUpdateService taxonUpdateService, DigivolImportService digivolImportService,
                            BiocollectImportService biocollectImportService, CollectionsImportService collectionsImportService,
                            KnowledgebaseImportService knowledgebaseImportService, LayerImportService layerImportService,
                            WordpressImportService wordpressImportService, SitemapService sitemapService,
                            DashboardService dashboardService, ListImportService listImportService) {
        this.configService = configService;
        this.leadershipStatus = leadershipStatus;
        this.allService = allService;
        this.broadcastQueue = broadcastQueue;
        this.areaImportService = areaImportService;
        this.taxonUpdateService = taxonUpdateService;
        this.digivolImportService = digivolImportService;
        this.biocollectImportService = biocollectImportService;
        this.collectionsImportService = collectionsImportService;
        this.dashboardService = dashboardService;
        this.listImportService = listImportService;
        this.knowledgebaseImportService = knowledgebaseImportService;
        this.layerImportService = layerImportService;
        this.wordpressImportService = wordpressImportService;
        this.sitemapService = sitemapService;

        taskScheduler.setPoolSize((int) Arrays.stream(TaskType.values()).filter(it -> it.schedulable).count());
        taskScheduler.initialize();
    }

    ConfigValidationListener isValidCron = (value) -> {
        if (StringUtils.isEmpty(value)) {
            return true; // empty cron is valid
        }
        try {
            new CronTrigger(value); // will throw IllegalArgumentException if invalid
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    };

    ConfigValidationListener isValidBoolean = (value) -> "false".equalsIgnoreCase(value) || "true".equalsIgnoreCase(value);

    @PostConstruct
    public void init() {
        initSchedules();
    }

    public void reschedule(TaskType task, Runnable runnable) {
        ScheduledFuture<?> scheduledTask = scheduledTasks.remove(task);

        if (scheduledTask != null) {
            scheduledTask.cancel(false); // don't interrupt if running
        }

        if (task.category == TaskType.Category.INGESTION && !leadershipStatus.isLeader()) {
            return; // do not schedule ingestion tasks if this is not the leader
        }

        // listen for changes to the cron expression config
        configService.registerListener("schedule." + task.name() + ".cron", (newValue, prevValue) -> {
            log.info("Rescheduling task: {} with new cron: {}", task.name(), newValue.value);
            reschedule(task, runnable);
        }, isValidCron);

        // listen for changes to the enabled flag config
        configService.registerListener("schedule." + task.name() + ".enabled", (newValue, prevValue) -> {
            log.info("Rescheduling task: {} with new enabled value: {}", task.name(), newValue.value);
            reschedule(task, runnable);
        }, isValidBoolean);

        ConfigData cdEnabled = configService.get("schedule." + task.name() + ".enabled");
        if (cdEnabled == null || !Boolean.parseBoolean(cdEnabled.value)) {
            return; // do not schedule if not enabled
        }

        ConfigData cdCron = configService.get("schedule." + task.name() + ".cron");
        if (cdCron == null || StringUtils.isEmpty(cdCron.value)) {
            return; // do not schedule if cron is not set
        }

        // update the cron for the scheduledTask
        scheduledTask = taskScheduler.schedule(runnable, new CronTrigger(cdCron.value));
        scheduledTasks.put(task, scheduledTask);
    }

    public void initSchedules() {
        // iterate through all tasks that are schedulable and register them when enabled
        for (TaskType task : TaskType.values()) {
            if (!task.schedulable) {
                continue;
            }

            switch (task) {
                case ALL -> reschedule(task, allService::run);
                case BIOCACHE -> reschedule(task, taxonUpdateService::run);
                case DIGIVOL -> reschedule(task, digivolImportService::run);
                case AREA -> reschedule(task, areaImportService::run);
                case BIOCOLLECT -> reschedule(task, biocollectImportService::run);
                case COLLECTIONS -> reschedule(task, collectionsImportService::run);
                case KNOWLEDGEBASE -> reschedule(task, knowledgebaseImportService::run);
                case LAYER -> reschedule(task, layerImportService::run);
                case WORDPRESS -> reschedule(task, wordpressImportService::run);
                case LISTS -> reschedule(task, listImportService::run);
                case SITEMAP -> reschedule(task, sitemapService::run);
                case DASHBOARD -> reschedule(task, dashboardService::run);
                case CACHE_RESET_ALL, CACHE_RESET_COLLECTORY, CACHE_RESET_LISTS, CACHE_RESET_DATA_QUALITY ->
                        reschedule(task, () -> broadcastQueue.sendMessage(task, null));
            }
        }
    }
}
