/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.repo.QueuePostgresRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.UUID;


/**
 * QueueService is responsible for managing the queue of tasks in postgres.
 */
@Slf4j
@Service
public class QueueDataService {
    private final QueuePostgresRepository queuePostgresRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public QueueDataService(QueuePostgresRepository queuePostgresRepository) {
        this.queuePostgresRepository = queuePostgresRepository;
    }

    @Transactional
    public void updateStatus(UUID id, StatusCode statusCode, String message) {
        queuePostgresRepository.updateStatusAndStatusMessageById(
                id,
                message,
                statusCode.name(),
                new Date()
        );
    }

    @Transactional(readOnly = true)
    public QueueItem get(UUID id) {
        return queuePostgresRepository.findByIdNative(id);
    }

    @Transactional(readOnly = true)
    public Page<QueueItem> list(UUID id, String userId, String userEmail, String status, String taskType, Long page, Long pageSize) {
        PageRequest pageable = PageRequest.of(
                page != null ? page.intValue() : 0,
                pageSize != null ? pageSize.intValue() : 20,
                Sort.by(Sort.Direction.DESC, "created")
        );
        return queuePostgresRepository.findByFilters(id, userId, userEmail, status != null ? StatusCode.valueOf(status).name() : null, taskType != null ? TaskType.valueOf(taskType).name() : null, pageable);
    }

    /**
     * Get a list of running tasks with their IDs and liveness timestamps.
     *
     * @return Object Array of Long, Date pairs, where Long is the task ID and Date is the liveness timestamp.
     */
    @Transactional(readOnly = true)
    public List<Object[]> getRunningIdsAndLiveness() {
        return queuePostgresRepository.getRunningTasksIdAndLiveness();
    }

    @Transactional
    public void updateLivenessById(UUID id, Date date) {
        queuePostgresRepository.updateLivenessById(id, date);
    }

    @Transactional(readOnly = true)
    public List<Object[]> getOrphanedUsers() {
        return queuePostgresRepository.findFirstQueuedTaskIdForUsersWithNoRunningTasks();
    }
}
