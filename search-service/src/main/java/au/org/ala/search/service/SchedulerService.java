// search-service/src/main/java/au/org/ala/search/service/schedule/DynamicSchedulerService.java
package au.org.ala.search.service;

import au.org.ala.search.LeadershipStatus;
import au.org.ala.search.model.config.ConfigValidationListener;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.remote.ConfigService;
import au.org.ala.search.service.update.AllService;
import io.micrometer.common.util.StringUtils;
import jakarta.annotation.PostConstruct;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ScheduledFuture;

enum TaskKeys {
    ALL("schedule.task.all"),
    LIST_CACHE("schedule.cache.list"),
    DASHBOARD("schedule.task.dashboard");

    private final String key;

    TaskKeys(String key) {
        this.key = key;
    }

    public String getKey() {
        return key;
    }
}

@Service
public class SchedulerService {

    private final ConfigService configService;
    private final LeadershipStatus leadershipStatus;
    private final AllService allService;
    private final ListCache listCache;

    private final ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();
    private final Map<TaskKeys, ScheduledFuture<?>> scheduledTasks = new EnumMap<>(TaskKeys.class);

    public SchedulerService(ConfigService configService,
                            LeadershipStatus leadershipStatus, AllService allService,
                            ListCache listCache) {
        this.configService = configService;
        this.leadershipStatus = leadershipStatus;
        this.allService = allService;
        this.listCache = listCache;

        taskScheduler.setPoolSize(TaskKeys.values().length);
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

    @PostConstruct
    public void init() {
        initLeaderTasks();
        initInstanceTasks();
    }

    public void reschedule(TaskKeys task, String cron, Runnable runnable) {
        ScheduledFuture<?> scheduledTask = scheduledTasks.remove(task);

        if (scheduledTask != null) {
            scheduledTask.cancel(false); // don't interrupt if running
        }

        if (StringUtils.isEmpty(cron)) {
            return; // do not schedule if cron is empty
        }

        // update the cron for the scheduledTask
        scheduledTask = taskScheduler.schedule(runnable, new CronTrigger(cron));
        scheduledTasks.put(task, scheduledTask);
    }

    // TODO: think this through more, should this be scheduled on leadership change instead?
    public void initLeaderTasks() {
        if (leadershipStatus.isLeader()) {
            reschedule(TaskKeys.ALL, configService.get(TaskKeys.ALL.getKey()), allService::run);
            configService.registerListener(TaskKeys.ALL.getKey(), (newValue, prevValue) -> {
                reschedule(TaskKeys.ALL, newValue.getData().value, allService::run);
            }, isValidCron);

//            reschedule(TaskKeys.DASHBOARD, configService.get(TaskKeys.DASHBOARD.getKey()), allService::updateDashboard);
        } else {
            // If not leader, cancel leader tasks
            ScheduledFuture future = scheduledTasks.remove(TaskKeys.ALL);
            if (future != null) {
                future.cancel(true);
            }
            future = scheduledTasks.remove(TaskKeys.DASHBOARD);
            if (future != null) {
                future.cancel(true);
            }
        }
    }

    private void initInstanceTasks() {
        // TODO: work out what to do here, around broadcasting cache reset events, and adding granularity to the cache refresh
        reschedule(TaskKeys.LIST_CACHE, configService.get(TaskKeys.LIST_CACHE.getKey()), listCache::cacheRefresh);
        configService.registerListener(TaskKeys.LIST_CACHE.getKey(), (newValue, prevValue) -> {
            reschedule(TaskKeys.LIST_CACHE, newValue.getData().value, listCache::cacheRefresh);
        }, isValidCron);
    }
}
