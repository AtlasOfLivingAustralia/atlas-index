/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.StatusCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface QueuePostgresRepository extends JpaRepository<QueueItem, Long> {

    List<QueueItem> findAllByUserIdAndStatus(String userId, StatusCode status);

    int countByUserIdAndStatus(String userId, StatusCode status);

    @Query(
            value = "SELECT COUNT(*) FROM queue WHERE queue_request->>'taskType' = :taskType",
            nativeQuery = true
    )
    long countByTaskType(@Param("taskType") String taskType);

    @Query(
        value = "SELECT COUNT(*) FROM queue WHERE queue_request->>'taskType' = :taskType AND status = :status",
        nativeQuery = true
    )
    long countByTaskTypeAndStatus(@Param("taskType") String taskType, @Param("status") StatusCode status);
}
