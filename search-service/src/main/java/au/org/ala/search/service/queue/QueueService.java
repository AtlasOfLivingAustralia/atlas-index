/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.queue;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.*;
import au.org.ala.search.repo.QueueMongoRepository;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.util.QueryParserUtil;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingQueue;

@Service
public class QueueService {

    private static final Logger logger = LoggerFactory.getLogger(QueueService.class);

    protected final QueueMongoRepository queueMongoRepository;
    private final ElasticService elasticService;

    Map<String, LinkedBlockingQueue<QueueItem>> queues = new ConcurrentHashMap<>();

    public QueueService(QueueMongoRepository queueMongoRepository, ElasticService elasticService) {
        this.queueMongoRepository = queueMongoRepository;
        this.elasticService = elasticService;
    }

    public Status add(QueueRequest queueRequest) {
        String requestType = queueRequest.taskType.name();
        logger.info("Adding download request to queue: " + requestType);

        // fix filenames
        fixFilenames(queueRequest);

        String error = getError(queueRequest);
        if (error != null) {
            return Status.builder().statusCode(StatusCode.ERROR).message(error).build();
        }

        LocalDateTime now = LocalDateTime.now();

        // persist the request in a db
        QueueItem queueItem = queueMongoRepository.save(QueueItem.builder()
                .createdDate(now)
                .queueRequest(queueRequest)
                .status(Status.builder().statusCode(StatusCode.QUEUED).build()).build());

        // add the request to the queue
        LinkedBlockingQueue<QueueItem> queue = queues.get(requestType);
        if (queue == null) {
            queue = new LinkedBlockingQueue<>();
            queues.put(requestType, queue);
        }
        queue.add(queueItem);

        // save statusId
        return updateStatus(queueItem, StatusCode.QUEUED, "added to queue");
    }

    private void fixFilenames(QueueRequest queueRequest) {
        if (queueRequest instanceof SearchQueueRequest searchDownloadRequest) {
            if (!searchDownloadRequest.filename.toLowerCase().endsWith(".csv")) {
                searchDownloadRequest.filename += ".csv";
            }
        } else if (queueRequest instanceof FieldguideQueueRequest fieldguideDownloadRequest) {
            if (!fieldguideDownloadRequest.filename.toLowerCase().endsWith(".pdf")) {
                fieldguideDownloadRequest.filename += ".pdf";
            }
        }
    }

    /**
     * Get the next item from the queue, waiting if necessary until an element becomes available.
     *
     * @param taskType taskType of the queue
     * @return the next item from the queue
     */
    public QueueItem next(TaskType taskType) throws InterruptedException {
        LinkedBlockingQueue<QueueItem> queue = queues.get(taskType.name());
        if (queue == null) {
            // initialize an empty queue
            queue = new LinkedBlockingQueue<>();
            queues.put(taskType.name(), queue);
        }

        QueueItem item = queue.take();
        logger.info("Retrieved item from queue: " + item);

        return item;
    }

    public QueueItem get(String id) {
        return queueMongoRepository.findById(id).orElse(null);
    }

    private String getError(QueueRequest queueRequest) {
        if (queueRequest instanceof SandboxQueueRequest sandboxQueueRequest) {
            // TODO: validation
            return null;
        }

        if (StringUtils.isEmpty(queueRequest.filename)) {
            return "no filename";
        }

        if (queueRequest instanceof SearchQueueRequest searchDownloadRequest) {
            for (String q : searchDownloadRequest.q) {
                if (StringUtils.isNotEmpty(q) && !QueryParserUtil.isValid(q, elasticService::isValidField)) {
                    return "invalid query";
                }
            }

            return null;
        } else if (queueRequest instanceof FieldguideQueueRequest fieldguideDownloadRequest) {
            if (StringUtils.isEmpty(fieldguideDownloadRequest.title)) {
                return "no title";
            }
            if (StringUtils.isEmpty(fieldguideDownloadRequest.email)) {
                return "no email";
            }
            if (StringUtils.isEmpty(fieldguideDownloadRequest.sourceUrl)) {
                return "no sourceUrl";
            }

            return fieldguideDownloadRequest.id == null || fieldguideDownloadRequest.id.length == 0 ? "no ids" : null;
        }
        return null;
    }

    public List<QueueItem> list(String queueName) {
        return queues.get(queueName).stream().toList();
    }

    public Status updateStatus(QueueItem item, StatusCode statusCode, String s) {
        if (statusCode.equals(StatusCode.QUEUED)) {
            // TODO: when there exists an external queue, and this is a clean shutdown, add it back to the queue
        }

        // do not update status if it is already cancelled or has an error
        if (!item.status.statusCode.equals(StatusCode.CANCELLED) && !item.status.statusCode.equals(StatusCode.ERROR)) {
            Status newStatus = Status.builder().id(item.id).statusCode(statusCode).message(s).lastUpdated(LocalDateTime.now()).build();
            item.setStatus(newStatus);
            queueMongoRepository.save(item);

            return newStatus;
        }

        return item.getStatus();
    }
}
