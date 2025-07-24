/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.repo.QueuePostgresRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Date;


/**
 * QueueService is responsible for managing the queue of tasks in postgres.
 */
@Slf4j
@Service
public class QueueDataService {
    private final QueuePostgresRepository queuePostgresRepository;

    public QueueDataService(QueuePostgresRepository queuePostgresRepository) {
        this.queuePostgresRepository = queuePostgresRepository;
    }

    public QueueItem updateStatus(QueueItem item, StatusCode statusCode, String message) {
        QueueItem currentItem = get(item.id);
        if (currentItem != null) {
            currentItem.status = statusCode;
            currentItem.statusMessage = message;
            currentItem.updated = new Date();
            queuePostgresRepository.save(currentItem);
        } else {
            log.warn("Queue item not found for id: {}", item.id);
        }

        return currentItem;
    }

    public QueueItem get(Long id) {
        return queuePostgresRepository.findById(id).orElse(null);
    }


}
