/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.queue;

import au.org.ala.search.LeadershipStatus;
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
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;

/**
 * QueueService for user requests. Supports one active request per user at a time, regardless of the request type.
 * <p>
 * Request flow is:
 * API Request -> Postgres and Queue -> Consumer
 * <p>
 * - The consumer will requeue when > 1 request is in progress for the user, based on the record status in Postgres.
 * - When RabbitMQ is enabled, the number of concurrent requests on this instance is limited by rabbitmq.task.concurrency.
 * - When RabbitMQ is not enabled, the number of concurrent requests is the same as the number of unique users in the queue.
 * <p>
 * Cancel flow is:
 * API Request -> Postgres CANCEL -> broadcast CANCEL -> Broadcast handler.
 * Individual consumers are also responsible for checking the db the cancel logic.
 * <p>
 * Handling of queue errors for standalone mode:
 * - At startup, requeue RUNNING tasks first, then QUEUED tasks, into the local queue.
 * <p>
 * Handling of queue errors for RabbitMQ mode:
 * - At startup, do nothing as the incomplete items should be in the RabbitMQ queue.
 * - If a QUEUED item is absent from the external queue it will be ignored. TODO: implement a way to requeue them or mark them as ERROR.
 * <p>
 * Handling of task liveness:
 * - Periodically (every 3 min) set the 'liveness' of active tasks to prevent them from being marked as lost.
 * - Periodically (every 5 min) check for lost tasks (no liveness in 10 min) and flag them with status ERROR.
 * <p>
 * Future: split into conditional services, one for RabbitMQ, one for local queue.
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
    private final ConcurrentHashMap<UUID, Future> futureMap = new ConcurrentHashMap<>(); // for cancellation
    private final LeadershipStatus leadershipStatus;

    @Value("${rabbitmq.host:}")
    private String rabbitMqHost;


    @Value("${standalone.task.queue.concurrency:20}")
    private int standaloneTaskQueueConcurrency; // used when RabbitMQ is not enabled

    public ConsumerQueue(QueuePostgresRepository queuePostgresRepository, QueueDataService queueDataService, ElasticService elasticService, RabbitTemplate rabbitTemplate, FieldguideConsumer fieldguideConsumer, SandboxConsumer sandboxConsumer, SearchConsumer searchConsumer, LeadershipStatus leadershipStatus) {
        this.queuePostgresRepository = queuePostgresRepository;
        this.queueDataService = queueDataService;
        this.elasticService = elasticService;
        this.rabbitTemplate = rabbitTemplate;
        this.fieldguideConsumer = fieldguideConsumer;
        this.sandboxConsumer = sandboxConsumer;
        this.searchConsumer = searchConsumer;
        this.leadershipStatus = leadershipStatus;
    }

    @PostConstruct
    public void init() {
        standaloneThreadLimit = new Semaphore(standaloneTaskQueueConcurrency);

        if (leadershipStatus.isLeader()) {
            recoverTasks();
        }
    }

    @PreDestroy
    public void onDestruct() {
        userExecutors.forEach((userId, executor) -> {
            // Future: shutdown the executors more gracefully, e.g. timeout, wait for tasks to save progress for the next consumer.
            executor.shutdown();
        });
    }

    @Scheduled(fixedDelay = 60 * 60 * 1000, initialDelay = 60 * 60 * 1000)
    public void removeUnusedExecutors() {
        for (Map.Entry<String, ThreadPoolExecutor> set : new HashMap<>(userExecutors).entrySet()) {
            synchronized (set.getValue()) {
                if (set.getValue().getQueue().isEmpty() && set.getValue().getActiveCount() == 0) {
                    userExecutors.remove(set.getKey());
                    set.getValue().shutdown();
                }
            }
        }
    }

    @Scheduled(fixedDelay = 3 * 60 * 1000, initialDelay = 3 * 60 * 1000)
    public void updateTaskLiveness() {
        log.info("signalling task liveness...");
        int count = 0;
        for (UUID id : new HashMap<>(futureMap).keySet()) {
            queueDataService.updateLivenessById(id, new Date());
            count++;
        }
        log.info("Updated liveness for {} running tasks.", count);
    }

    @Scheduled(fixedDelay = 5 * 60 * 1000, initialDelay = 60 * 1000)
    public void recoverLostTasks() {
        if (leadershipStatus.isLeader()) {
            int count = 0;
            log.info("Terminating lost tasks..."); // this is to prevent failed tasks from blocking the queue
            for (Object[] entry : queueDataService.getRunningIdsAndLiveness()) {
                // if the task is RUNNING but has no liveness update for more than 10 minutes, flag as an ERROR.
                if (entry[1] == null || ((Instant) entry[1]).isBefore(Instant.now().minusSeconds(10 * 60))) {
                    // These errors need to be investigated as the persistence of the external queue is important
                    log.error("Terminate lost task: {}", entry[0]);
                    count++;

                    // TODO: what happens when the instance running the task dies unexpectedly and the task was not
                    //  requeued into the external queue? I suspect it will be marked as ERROR, but it should be
                    //  marked as QUEUED instead, so it can be requeued. Is this a use case that needs to be handled?
                    queueDataService.updateStatus((UUID) entry[0], StatusCode.ERROR, "timed out");
                }
            }
            log.info("Total lost tasks marked as ERROR {}", count);
        } else {
            log.info("Not the leader, skipping task recovery.");
        }
    }

    private void recoverTasks() {
        log.info("Recovering tasks from the queue at startup...");

        // do not recover tasks if in standalone mode as they are in the RabbitMQ consumer queue
        if (StringUtils.isNotEmpty(rabbitMqHost)) {
            log.info("RabbitMQ is enabled, skipping task recovery.");
            return;
        }

        // recover RUNNING tasks for all users, for standalone mode
        int count = 0;
        for (QueueItem queueItem : queuePostgresRepository.findAllByUserIdAndStatus(null, StatusCode.RUNNING.name())) {
            try {
                ThreadPoolExecutor executor = userExecutors.computeIfAbsent(queueItem.userId, k -> new ThreadPoolExecutor(1, 1, 0L, java.util.concurrent.TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>()));
                ;
                synchronized (executor) {
                    consume(queueItem, executor);
                    count++;
                }
            } catch (InterruptedException e) {
                log.warn("Interrupted while recovering task: {}", queueItem.id, e);
                Thread.currentThread().interrupt(); // restore the interrupted status
            }
        }
        log.info("Recovered {} tasks from the queue that were previously running.", count);

        // recover QUEUED tasks for all users by putting them back into the standalone queue
        for (QueueItem queueItem : queuePostgresRepository.findAllByUserIdAndStatus(null, StatusCode.QUEUED.name())) {
            try {
                addToQueue(queueItem);
                count++;
            } catch (Exception e) {
                log.error("Error recovering task: {}", queueItem.id, e);
            }
        }

        log.info("Task recovery completed.");
    }

    /**
     * Add a new request to the queue for a given user.
     *
     * @param queueRequest
     * @param userId
     * @return
     */
    public QueueItem add(QueueRequest queueRequest, String userId) {
        TaskType requestType = queueRequest.taskType;
        log.info("Adding download request to queue: {}", requestType);

        // limit the max number of queued requests per user
        int count = queuePostgresRepository.countByUserIdAndStatus(userId, StatusCode.QUEUED.name());
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
                .queueRequest(queueRequest)
                .status(StatusCode.QUEUED).build());
        queuePostgresRepository.flush();

        addToQueue(queueItem);

        return queueItem;
    }

    /**
     * Add a queue item to the RabbitMQ queue or the local queue for processing.
     *
     * @param queueItem
     */
    private void addToQueue(QueueItem queueItem) {
        if (StringUtils.isNotEmpty(rabbitMqHost)) { // only if RabbitMQ is enabled
            byte[] idBytes = queueItem.id.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            rabbitTemplate.convertAndSend(TASK_QUEUE, idBytes);
        } else {
            // manage the local queue
            ThreadPoolExecutor executor = userExecutors.computeIfAbsent(queueItem.userId, k -> new ThreadPoolExecutor(1, 1, 0L, java.util.concurrent.TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>()));

            synchronized (executor) {
                try {
                    consume(queueItem, executor);
                } catch (InterruptedException ignored) {
                    // if shutting down, just ignore the interruption as the init() will recover the item
                }
            }
        }
    }

    /**
     * Consume a queue item. This method is called by the consumer to process the next item in the queue.
     * <p>
     * - For RabbitMQ, this method is called when a message is received from the queue.
     * - For the local queue, this method is called after adding an item from the API and during startup.
     *
     * @param queueItem
     * @param executor  executor to use when RabbitMQ is not enabled.
     * @return true if the item was consumed, false if it needs to be requeued
     */
    private boolean consume(QueueItem queueItem, ThreadPoolExecutor executor) throws InterruptedException {

        if (StringUtils.isNotEmpty(rabbitMqHost) && !queueItem.status.equals(StatusCode.RUNNING)) {
            int numRunning = queuePostgresRepository.countByUserIdAndStatus(queueItem.userId, StatusCode.RUNNING.name());

            // Limit the number of concurrent requests per user to 1, regardless of the number of instances.
            if (numRunning > 0) {
                return false; // There is already a running item for this user, do not process this item, requeue instead
            }
        }

        Runnable runnable = () -> {
            try {
                // check if the item is still in the queue, it might have been cancelled.
                QueueItem currentItem = queueDataService.get(queueItem.id);
                if (currentItem == null || currentItem.status == StatusCode.CANCELLED) {
                    log.info("Queue item {} id: {} is no longer in the queue or has been cancelled", queueItem.queueRequest.taskType, queueItem.id);
                    return; // item is no longer in the queue or has been cancelled
                }

                // process the queue item based on its type
                log.info("processing queue item {} id: {}", queueItem.queueRequest.taskType, queueItem.id);
                queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "");

                runTask(queueItem);

                queueDataService.updateStatus(queueItem.id, StatusCode.FINISHED, "");
            } catch (InterruptedException | RuntimeException e) {
                // handle interruption or runtime exceptions that are thrown during a CANCEL request
                QueueItem currentItem = queueDataService.get(queueItem.id);
                if (currentItem != null && currentItem.status != StatusCode.CANCELLED) {
                    // requeue the item if it was interrupted by a shutdown
                    queueDataService.updateStatus(queueItem.id, StatusCode.QUEUED, "requeued after interruption");
                } else {
                    log.info("Queue item {} id: {} was cancelled or no longer in the queue", queueItem.queueRequest.taskType, queueItem.id);
                    return; // item is no longer in the queue or has been cancelled
                }
                queueDataService.updateStatus(queueItem.id, StatusCode.QUEUED, "interrupted");

                log.warn("(interrupted) added {} back to the queue: {}", queueItem.queueRequest.taskType, queueItem.id);
            } catch (Exception e) {
                log.error("Error processing queue item {} id: {}", queueItem.queueRequest.taskType, queueItem.id, e);
                queueDataService.updateStatus(queueItem.id, StatusCode.ERROR, e.getMessage());
            }

            // remove the future from the map after completion
            futureMap.remove(queueItem.id);
        };

        if (executor != null) {
            // wrap with the global thread limit
            Runnable limitedRunnable = () -> {
                try {
                    // Need to flag the task as RUNNING before acquiring the semaphore to avoid issues with failure detection.
                    queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "");

                    standaloneThreadLimit.acquire();

                    runnable.run();
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                } finally {
                    standaloneThreadLimit.release();
                }
            };

            // track for cancellation
            if (futureMap.containsKey(queueItem.id)) {
                log.error("Queue item {} id: {} is already in the futures map, replacing it", queueItem.queueRequest.taskType, queueItem.id);
            } else {
                // use the user's executor to run the task asynchronously per user
                Future future = executor.submit(limitedRunnable);

                futureMap.put(queueItem.id, future);
            }
        } else {
            // track for cancellation
            if (futureMap.containsKey(queueItem.id)) {
                log.error("Queue item {} id: {} is already in the futures map, skipping", queueItem.queueRequest.taskType, queueItem.id);
            } else {
                FutureTask<?> future = new FutureTask<>(runnable, null);
                futureMap.put(queueItem.id, future);

                new Thread(future, "QueueItem-" + queueItem.id).start();

                try {
                    future.get(); // waiting until actually finished, not just detecting that it received the "cancel" signal
                } catch (Exception e) {
                    if (!(e instanceof CancellationException)) {
                        log.error("error", e);
                    }
                }
            }
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
        // get the id from the message
        UUID id = null;
        try {
            id = UUID.fromString(new String(message.getBody(), java.nio.charset.StandardCharsets.UTF_8));
            log.info("Received task message: {}", id);

            if (futureMap.containsKey(id)) {
                // all ready running, this should not happen, but just in case cancel it.
                log.error("Task with id {} is already in progress, cancelling the task.", id);
                cancel(id, "Duplicate processing attempt");
                channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, false); // do not requeue
                return;
            }

            // retrieve the queue item from the database
            QueueItem queueItem = queueDataService.get(id);

            if (queueItem == null || queueItem.status == StatusCode.CANCELLED || queueItem.status == StatusCode.ERROR) {
                // do not process the message if invalid
                log.warn("Queue item removed without processing: {}", id);
                channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, false); // do not requeue
                return;
            }

            boolean isConsumed = consume(queueItem, null);

            // check the item status after consumption
            QueueItem currentQueueItem = queueDataService.get(id);
            if (!isConsumed || (currentQueueItem != null &&
                    (currentQueueItem.status == StatusCode.RUNNING || currentQueueItem.status == StatusCode.QUEUED))) {
                // not consumed or interruption other than CANCELLED, requeue the message.
                // e.g. if there is already a running item for the user
                channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, true); // requeue}
                return;
            }

            channel.basicAck(message.getMessageProperties().getDeliveryTag(), false);
        } catch (Exception e) {
            // requeue only if required
            boolean requeue = false;
            if (id != null) {
                QueueItem queueItem = queueDataService.get(id);
                if (queueItem != null && queueItem.status != StatusCode.CANCELLED && queueItem.status != StatusCode.ERROR) {
                    requeue = true;
                }
            }
            channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, requeue);

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
                long queued = queuePostgresRepository.countByTaskTypeAndStatus(taskType.name(), StatusCode.QUEUED.name());
                long running = queuePostgresRepository.countByTaskTypeAndStatus(taskType.name(), StatusCode.RUNNING.name());
                long finished = queuePostgresRepository.countByTaskTypeAndStatus(taskType.name(), StatusCode.FINISHED.name());
                long cancelled = queuePostgresRepository.countByTaskTypeAndStatus(taskType.name(), StatusCode.CANCELLED.name());
                long error = queuePostgresRepository.countByTaskTypeAndStatus(taskType.name(), StatusCode.ERROR.name());

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

    public void cancel(UUID id, String message) {
        log.info("Cancelling task with id: {}", id);
        queueDataService.updateStatus(id, StatusCode.CANCELLED, message);

        Future future = futureMap.remove(id);
        if (future == null) {
            log.debug("No future found for task id: {}", id);
            return;
        }

        future.cancel(true);

        log.info("Task with id: {} cancelled successfully.", id);

    }
}
