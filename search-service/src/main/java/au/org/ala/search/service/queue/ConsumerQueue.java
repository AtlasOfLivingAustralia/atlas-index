/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.queue;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.*;
import au.org.ala.search.repo.QueuePostgresRepository;
import au.org.ala.search.service.consumer.FieldguideConsumer;
import au.org.ala.search.service.consumer.SandboxConsumer;
import au.org.ala.search.service.consumer.SearchConsumer;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.QueueDataService;
import au.org.ala.search.util.QueryParserUtil;
import com.rabbitmq.client.Channel;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

/**
 * QueueService for user requests. Supports one active request per user at a time, regardless of the request type.
 *
 * Request flow is:
 * API Request -> Postgres and Queue -> Consumer
 *
 * - The consumer will requeue when > 1 request is in progress for the user, based on the record status in Postgres.
 * - When RabbitMQ is enabled, the number of concurrent requests on this instance is limited by rabbitmq.task.concurrency.
 * - When RabbitMQ is not enabled, the number of concurrent requests is the same as the number of unique users in the queue.
 *
 * Future: support for concurrent requests per user, or specific users or clients.
 *
 * TODO: add support for request cancellation.
 */
@Slf4j
@Service
public class ConsumerQueue {
    public static final String TASK_QUEUE = "consumer";
    private static final int MAX_USER_QUEUE_SIZE = 10; // maximum number of queued requests per user TODO: move to application properties
    private static Semaphore standaloneThreadLimit;

    private final QueuePostgresRepository queuePostgresRepository;
    private final QueueDataService queueDataService;
    private final ElasticService elasticService;
    private final RabbitTemplate rabbitTemplate;
    private final FieldguideConsumer fieldguideConsumer;
    private final SandboxConsumer sandboxConsumer;
    private final SearchConsumer searchConsumer;

    // Local queues and executors for each user, in use only when RabbitMQ is not enabled.
    private final ConcurrentHashMap<String, ThreadPoolExecutor> userExecutors = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, LinkedBlockingQueue<Long>> queues = new ConcurrentHashMap<>();

    @Value("${rabbitmq.host:}")
    private String rabbitMqHost;

    @Value("${standalone.task.queue.concurrency:20}")
    private int standaloneTaskQueueConcurrency; // used when RabbitMQ is not enabled

    public ConsumerQueue(QueuePostgresRepository queuePostgresRepository, QueueDataService queueDataService, ElasticService elasticService, RabbitTemplate rabbitTemplate, FieldguideConsumer fieldguideConsumer, SandboxConsumer sandboxConsumer, SearchConsumer searchConsumer) {
        this.queuePostgresRepository = queuePostgresRepository;
        this.queueDataService = queueDataService;
        this.elasticService = elasticService;
        this.rabbitTemplate = rabbitTemplate;
        this.fieldguideConsumer = fieldguideConsumer;
        this.sandboxConsumer = sandboxConsumer;
        this.searchConsumer = searchConsumer;
    }

    @PostConstruct
    public void init() {
        standaloneThreadLimit = new Semaphore(standaloneTaskQueueConcurrency);
    }

    @PreDestroy
    public void onDestruct() {
        userExecutors.forEach((userId, executor) -> {
            // Future: shutdown the executors more gracefully, e.g. timeout, wait for tasks to save progress for the next consumer.
            executor.shutdown();
        });
    }

    @Scheduled(fixedDelay = 3600000) // hourly
    public void removeUnusedExecutors() {
        for (Map.Entry<String, ThreadPoolExecutor> set : new HashMap<>(userExecutors).entrySet()) {
            // get the user queue for locking purposes
            LinkedBlockingQueue<Long> queue = queues.get(set.getKey());
            synchronized (queue) {
                if (queue.isEmpty() && set.getValue().getActiveCount() == 0) {
                    userExecutors.remove(set.getKey());
                    set.getValue().shutdown();
                }
            }
        }
    }

    public QueueItem add(QueueRequest queueRequest, String userId) {
        TaskType requestType = queueRequest.taskType;
        log.info("Adding download request to queue: {}", requestType);

        // limit the max number of queued requests per user
        int count = queuePostgresRepository.countByUserIdAndStatus(userId, StatusCode.QUEUED);
        if (count > MAX_USER_QUEUE_SIZE) {
            String errorMessage = "Too many requests in the queue for user: " + userId + ". Maximum is " + MAX_USER_QUEUE_SIZE;
            return QueueItem.builder().status(StatusCode.ERROR).statusMessage(errorMessage).build();
        }

        String errorMessage = getValidationError(queueRequest);
        if (errorMessage != null) {
            // don't save, just return the error message
            return QueueItem.builder().status(StatusCode.ERROR).statusMessage(errorMessage).build();
        }

        sanitize(queueRequest);

        // persist the request in a db
        Date created = new Date();
        QueueItem queueItem = queuePostgresRepository.save(QueueItem.builder()
                .userId(userId)
                .created(created)
                .updated(created)
                .queueRequest(queueRequest)
                .status(StatusCode.QUEUED).build());

        if (StringUtils.isNotEmpty(rabbitMqHost)) { // only if RabbitMQ is enabled
            byte[] idBytes = java.nio.ByteBuffer.allocate(Long.BYTES).putLong(queueItem.id).array();
            rabbitTemplate.convertAndSend(TASK_QUEUE, idBytes);
        } else {
            // manage the local queue
            LinkedBlockingQueue<Long> queue = queues.computeIfAbsent(requestType.name(), k -> new LinkedBlockingQueue<>());
            Executor executor = null;
            synchronized (queue) {
                queue.add(queueItem.id);
                executor = userExecutors.computeIfAbsent(userId, k -> new ThreadPoolExecutor(1, 1, 0L, java.util.concurrent.TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>()));
            }

            consume(queueItem, executor);
        }

        return queueItem;
    }

    /**
     * Consume a queue item. This method is called by the consumer to process the next item in the queue.
     *
     * - For RabbitMQ, this method is called when a message is received from the queue.
     * - For the local queue, this method is called after adding an item from the API and during startup.
     *
     * @param queueItem
     * @param executor executor to use when RabbitMQ is not enabled.
     * @return true if the item was consumed, false if it needs to be requeued
     */
    private boolean consume(QueueItem queueItem, Executor executor) {
        // count number of running items for this user
        List<QueueItem> running = queuePostgresRepository.findAllByUserIdAndStatus(queueItem.userId, StatusCode.RUNNING);

        // Limit to one running item per user. Treat RUNNING items as recovering items and do not requeue.
        if (!running.isEmpty() && running.get(0).status != StatusCode.RUNNING) {
            return false; // There is already a running item for this user, do not process this item
        }

        Runnable runnable = () -> {
            try {
                // process the queue item based on its type
                log.info("processing queue item {} id: {}", queueItem.queueRequest.taskType, queueItem.id);
                queueDataService.updateStatus(queueItem, StatusCode.RUNNING, "");

                runTask(queueItem);

                queueDataService.updateStatus(queueItem, StatusCode.FINISHED, "");
            } catch (InterruptedException e) {
                // when doing a clean shutdown, add it back to the queue
                queueDataService.updateStatus(queueItem, StatusCode.QUEUED, "interrupted");

                log.warn("(interrupted) added {} back to the queue: {}", queueItem.queueRequest.taskType, queueItem.id);
            } catch (Exception e) {
                log.error("Error processing queue item {} id: {}", queueItem.queueRequest.taskType, queueItem.id, e);
                queueDataService.updateStatus(queueItem, StatusCode.ERROR, e.getMessage());
                // update the status to error
                queueItem.status = StatusCode.ERROR;
                queueItem.statusMessage = "Error processing request: " + e.getMessage();
                queueItem.updated = new Date();
                queuePostgresRepository.save(queueItem);
            }
        };

        if (executor != null) {
            // wrap with the global thread limit
            Runnable limitedRunnable = () -> {
                try {
                    standaloneThreadLimit.acquire();
                    runnable.run();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    standaloneThreadLimit.release();
                }
            };

            // use the user's executor to run the task asynchronously
            executor.execute(limitedRunnable);
        } else {
            // run the task synchronously, threads are managed by taskListener concurrency
            runnable.run();
        }

        return true;
    }

    private void runTask(QueueItem queueItem) throws Exception {
        switch (queueItem.queueRequest.taskType) {
            case SEARCH_DOWNLOAD -> searchConsumer.consume(queueItem);
            case FIELDGUIDE -> fieldguideConsumer.consume(queueItem);
            case SANDBOX -> sandboxConsumer.consume(queueItem);
            default -> log.error("Unsupported task type: {}", queueItem.queueRequest.taskType);
        }
    }

    private void sanitize(QueueRequest queueRequest) {
        if (queueRequest.searchQueueRequest != null) {
            if (!queueRequest.searchQueueRequest.filename.toLowerCase().endsWith(".csv")) {
                queueRequest.searchQueueRequest.filename += ".csv";
            }
        } else if (queueRequest.fieldguideQueueRequest != null) {
            if (!queueRequest.fieldguideQueueRequest.filename.toLowerCase().endsWith(".pdf")) {
                queueRequest.fieldguideQueueRequest.filename += ".pdf";
            }
        }
    }

    private String getValidationError(QueueRequest queueRequest) {
        if (queueRequest.sandboxQueueRequest != null) {
            // Future: validate sandboxQueueRequest fields
            return null;
        }

        if (queueRequest.searchQueueRequest != null) {
            if (StringUtils.isEmpty(queueRequest.searchQueueRequest.filename)) {
                return "missing filename";
            }

            for (String q : queueRequest.searchQueueRequest.q) {
                if (StringUtils.isNotEmpty(q) && !QueryParserUtil.isValid(q, elasticService::isValidField)) {
                    return "invalid query";
                }

                // Future: validate searchQueueRequest.fl by comparing with ES index fields
                // Future: validate searchQueueRequest.q by returning > 0 results for the ES query
            }

            return null;
        } else if (queueRequest.fieldguideQueueRequest != null) {
            if (StringUtils.isEmpty(queueRequest.fieldguideQueueRequest.filename)) {
                return "missing filename";
            }

            if (StringUtils.isEmpty(queueRequest.fieldguideQueueRequest.title)) {
                return "missing title";
            }
            if (StringUtils.isEmpty(queueRequest.email)) {
                return "missing email";
            }

            // sourceUrl is optional, but if provided it must be a valid URL
            if (queueRequest.fieldguideQueueRequest.sourceUrl != null) {
                try {
                    new java.net.URL(queueRequest.fieldguideQueueRequest.sourceUrl);
                } catch (java.net.MalformedURLException e) {
                    return "invalid sourceUrl";
                }
            }

            // Future: validate fieldguideQueueRequest.id by validating each taxon concept ID

            return queueRequest.fieldguideQueueRequest.id == null
                    || queueRequest.fieldguideQueueRequest.id.length == 0 ? "missing id" : null;
        }
        return null;
    }

    // consumerQueueListenerContainerFactory sets the concurrency value
    @RabbitListener(queues = TASK_QUEUE, id = TASK_QUEUE, ackMode = "MANUAL", containerFactory = "consumerQueueListenerContainerFactory")
    public void taskListener(Message message, Channel channel) throws IOException {
        try {
            // get the id from the message
            long id = java.nio.ByteBuffer.wrap(message.getBody()).getLong();
            log.info("Received task message: {}", id);
            // retrieve the queue item from the database
            QueueItem queueItem = queueDataService.get(id);
            if (queueItem == null) {
                log.warn("Queue item not found for id: {}", id);
                channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, false); // do not requeue
                return;
            }

            boolean isConsumed = consume(queueItem, null);
            if (!isConsumed) { // not consumed, requeue the message. e.g. if there is already a running item for the user
                channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, true); // requeue
                return;
            }

            channel.basicAck(message.getMessageProperties().getDeliveryTag(), false);
        } catch (Exception e) {
            channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, true); // requeue on error
        }
    }

    /**
     * Get simple statistics for the task queue. Used by the admin interface to display queue status.
     *
     * @return
     */
    public Map<String, Object> getQueueStats() {
        Map<String, Object> stats = new HashMap<>();

        for (TaskType taskType : TaskType.values()) {
            if (taskType.category == TaskType.Category.CONSUMER) {
                long total = queuePostgresRepository.countByTaskType(taskType.name());
                long queued = queuePostgresRepository.countByTaskTypeAndStatus(taskType.name(), StatusCode.QUEUED);
                long running = queuePostgresRepository.countByTaskTypeAndStatus(taskType.name(), StatusCode.RUNNING);
                long finished = queuePostgresRepository.countByTaskTypeAndStatus(taskType.name(), StatusCode.FINISHED);
                long cancelled = queuePostgresRepository.countByTaskTypeAndStatus(taskType.name(), StatusCode.CANCELLED);
                long error = queuePostgresRepository.countByTaskTypeAndStatus(taskType.name(), StatusCode.ERROR);

                Map<String, Long> taskStats = new HashMap<>();
                taskStats.put("total", total);
                taskStats.put("queued", queued);
                taskStats.put("running", running);
                taskStats.put("finished", finished);
                taskStats.put("cancelled", cancelled);
                taskStats.put("error", error);

                stats.put(taskType.name().toLowerCase(), taskStats);
            }
        }

        return stats;
    }
}
