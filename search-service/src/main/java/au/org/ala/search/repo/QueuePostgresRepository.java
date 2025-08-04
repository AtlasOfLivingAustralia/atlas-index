/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.queue.QueueItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * Repository interface for managing QueueItem entities in a PostgreSQL database.
 * <p>
 * Do not use non-native queries in this repository, other than save().
 * <p>
 * Uses nativeQuery = true to bypass Hibernate's entity mapping and directly execute SQL queries.
 */
public interface QueuePostgresRepository extends JpaRepository<QueueItem, String> {

    @Query(
            value = "SELECT * FROM queue WHERE user_id = :userId AND status = :status",
            nativeQuery = true
    )
    List<QueueItem> findAllByUserIdAndStatus(String userId, String status);

    @Query(
            value = "SELECT id, liveness FROM queue WHERE status = 'RUNNING'",
            nativeQuery = true
    )
    List<Object[]> getRunningTasksIdAndLiveness();

    @Query(
            value = "SELECT COUNT(*) FROM queue WHERE user_id = :userId AND status = :status",
            nativeQuery = true
    )
    int countByUserIdAndStatus(String userId, String status);

    @Query(
            value = "SELECT COUNT(*) FROM queue WHERE queue_request->>'taskType' = :taskType",
            nativeQuery = true
    )
    long countByTaskType(@Param("taskType") String taskType);

    @Query(
            value = "SELECT COUNT(*) FROM queue WHERE queue_request->>'taskType' = :taskType AND status = :status",
            nativeQuery = true
    )
    long countByTaskTypeAndStatus(@Param("taskType") String taskType, @Param("status") String status);

    // Note: This admin only function and can be slow because it is returning the entire task JSON. Use a smaller page
    // size if it is too slow.
    @Query(value = "SELECT * FROM queue q " +
            "WHERE (:id IS NULL OR q.id = :id) " +
            "AND (:userId IS NULL OR q.user_id = :userId) " +
            "AND (:userEmail IS NULL OR q.queue_request->>'userEmail' = :userEmail) " +
            "AND (:status IS NULL OR q.status = :status) " +
            "AND (:taskType IS NULL OR q.queue_request->>'taskType' = :taskType)",
            countQuery = "SELECT COUNT(*) FROM queue q " +
                    "WHERE (:id IS NULL OR q.id = :id) " +
                    "AND (:userId IS NULL OR q.user_id = :userId) " +
                    "AND (:userEmail IS NULL OR q.queue_request->>'userEmail' = :userEmail) " +
                    "AND (:status IS NULL OR q.status = :status) " +
                    "AND (:taskType IS NULL OR q.queue_request->>'taskType' = :taskType)",
            nativeQuery = true)
    Page<QueueItem> findByFilters(
            @Param("id") UUID id,
            @Param("userId") String userId,
            @Param("userEmail") String userEmail,
            @Param("status") String status,
            @Param("taskType") String taskType,
            Pageable pageable);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "UPDATE queue q SET liveness = :liveness WHERE q.id = :id",
            nativeQuery = true)
    void updateLivenessById(@org.springframework.data.repository.query.Param("id") UUID id, @org.springframework.data.repository.query.Param("liveness") Date liveness);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            value = "UPDATE queue q SET status_message = :statusMessage, " +
                    "started = CASE WHEN :status = 'RUNNING' AND q.status <> 'RUNNING' THEN :updated ELSE q.started END, " +
                    "status = :status, liveness = :updated " +
                    "WHERE q.id = :id",
            nativeQuery = true)
    void updateStatusAndStatusMessageById(
            @org.springframework.data.repository.query.Param("id") UUID id,
            @org.springframework.data.repository.query.Param("statusMessage") String statusMessage,
            @org.springframework.data.repository.query.Param("status") String status,
            @org.springframework.data.repository.query.Param("updated") Date updated
    );

    // Not actually the oldest queued task, but that is not important.
    @Query(
            value = "SELECT MIN(id) AS first_queued_id, user_id " +
                    "FROM queue " +
                    "WHERE status = 'QUEUED' " +
                    "AND user_id IS NOT NULL " +
                    "AND user_id NOT IN (SELECT user_id FROM queue WHERE status = 'RUNNING') " +
                    "GROUP BY user_id",
            nativeQuery = true
    )
    List<Object[]> findFirstQueuedTaskIdForUsersWithNoRunningTasks();

    @Query(
            value = "SELECT * FROM queue WHERE id = :id",
            nativeQuery = true
    )
    QueueItem findByIdNative(@Param("id") UUID id);


}
