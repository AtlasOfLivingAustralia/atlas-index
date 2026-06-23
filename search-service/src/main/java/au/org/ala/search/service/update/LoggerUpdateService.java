/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.LogService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
public class LoggerUpdateService {

    private static final TaskType taskType = TaskType.LOGGER_UPDATE_SUMMARY_TABLES;

    private final JdbcTemplate jdbcTemplate;
    private final LogService logService;

    public LoggerUpdateService(JdbcTemplate jdbcTemplate, LogService logService) {
        this.jdbcTemplate = jdbcTemplate;
        this.logService = logService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        logService.log(taskType, "Starting");
        try {
            jdbcTemplate.execute("CALL process_new_events()");
            logService.log(taskType, "Finished");
            return CompletableFuture.completedFuture(true);
        } catch (Exception e) {
            log.error("Failed to update logger summary tables: {}", e.getMessage(), e);
            logService.log(taskType, "Failed: " + e.getMessage());
            return CompletableFuture.completedFuture(false);
        }
    }
}

