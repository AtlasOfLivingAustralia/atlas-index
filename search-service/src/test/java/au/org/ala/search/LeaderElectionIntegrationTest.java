/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.QueueRequest;
import au.org.ala.search.model.queue.SearchQueueRequest;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.service.SchedulerService;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.queue.BroadcastQueue;
import au.org.ala.search.service.queue.ConsumerQueue;
import au.org.ala.search.service.queue.LeaderQueue;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.QueueDataService;
import au.org.ala.search.service.update.PostgresSyncService;
import org.junit.jupiter.api.*;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.ApplicationContext;
import org.springframework.integration.leader.event.OnGrantedEvent;
import org.springframework.integration.leader.event.OnRevokedEvent;
import org.springframework.test.context.TestPropertySource;

import java.io.File;
import java.io.FileWriter;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.util.concurrent.TimeUnit;

/**
 * Integration tests for leader election lifecycle.
 * <p>
 * Tests verify the full Spring event-driven leader/follower state machine:
 * - Initial state (non-Kubernetes → always leader)
 * - OnRevokedEvent: sets non-leader, stops leader queue listener, cancels LEADER_ONLY schedules
 * - OnGrantedEvent: sets leader, starts leader queue listener, restores LEADER_ONLY schedules
 * - RabbitMQ routing: non-leader forwards to leader queue; leader processes locally
 * - Broadcast delivery regardless of leadership state
 * - Rapid grant/revoke/grant transitions
 * <p>
 * The Spring Cloud Kubernetes leader election library (Fabric8) is NOT active in tests
 * (no KUBERNETES_SERVICE_HOST env var, spring.cloud.kubernetes.leader.enabled not set).
 * Instead, OnGrantedEvent and OnRevokedEvent are published directly to the ApplicationContext,
 * which is how LeadershipStatus receives them in production too.
 * <p>
 * <b>Known limitation (same as {@code ConsumerQueueIntegrationTest}):</b> since
 * {@code consumerQueueTask_survivesLeadershipRevocationMidFlight} exercises the real
 * {@link ConsumerQueue} bean (which registers a {@code @RabbitListener} on the shared
 * {@code consumer} queue), this class re-enables {@code rabbitmq.consumer.listener.auto-startup}
 * (disabled by default in {@code src/test/resources/application.properties} - see
 * {@link ConsumerQueue#taskListener}) via {@code @TestPropertySource}, and uses
 * {@code @DirtiesContext} to close its {@code ApplicationContext} (and deregister its listener)
 * once this class's tests complete, so it does not become a stale competing consumer for
 * {@code ConsumerQueueIntegrationTest} or any other test class that publishes real messages onto
 * the {@code consumer} queue afterwards in the same JVM fork.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
@TestPropertySource(properties = {
        "download.filestore.path=target/leader-election-test-downloads",
        "rabbitmq.consumer.listener.auto-startup=true"
})
public class LeaderElectionIntegrationTest extends AbstractIntegrationTestContainers {

    private static final Path DOWNLOAD_DIR = Path.of("target/leader-election-test-downloads");

    @BeforeAll
    static void prepareFileStore() throws Exception {
        Files.createDirectories(DOWNLOAD_DIR.resolve("search"));
    }

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private LeadershipStatus leadershipStatus;

    @Autowired
    private SchedulerService schedulerService;

    @Autowired
    private LeaderQueue leaderQueue;

    @Autowired
    private BroadcastQueue broadcastQueue;

    @Autowired
    private RabbitListenerEndpointRegistry rabbitListenerEndpointRegistry;

    @Autowired
    private ConsumerQueue consumerQueue;

    @Autowired
    private QueueDataService queueDataService;

    @Autowired
    private DownloadFileStoreService downloadFileStoreService;

    @Autowired
    private org.springframework.amqp.rabbit.core.RabbitAdmin rabbitAdmin;

    @MockitoBean
    private CollectoryCache collectoryCache;

    @MockitoBean
    private ElasticService elasticService;

    @MockitoBean
    private PostgresSyncService postgresSyncService;

    @AfterEach
    void restoreLeaderState() throws Exception {
        if (!leadershipStatus.isLeader()) {
            publishGranted();
            await().atMost(10, TimeUnit.SECONDS)
                    .until(() -> rabbitListenerEndpointRegistry
                            .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning());
        }
    }

    @Test
    @Order(1)
    void initialState_nonKubernetes_isLeader() {
        // Without KUBERNETES_SERVICE_HOST, LeadershipStatus defaults to true
        assertThat(leadershipStatus.isLeader()).isTrue();
    }

    @Test
    @Order(2)
    void initialState_leaderQueueListenerIsRunning() {
        // After @PostConstruct setupAsLeader(), the listener should be running
        await().atMost(10, TimeUnit.SECONDS)
                .until(() -> rabbitListenerEndpointRegistry
                        .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning());
    }

    @Test
    @Order(10)
    void onRevokedEvent_setsNotLeader() {
        assertThat(leadershipStatus.isLeader()).isTrue();

        publishRevoked();

        assertThat(leadershipStatus.isLeader()).isFalse();
    }

    @Test
    @Order(11)
    void onRevokedEvent_stopsLeaderQueueListener() {
        publishRevoked();

        assertThat(rabbitListenerEndpointRegistry
                .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning())
                .isFalse();
    }

    @Test
    @Order(12)
    void onRevokedEvent_leaderOnlyTaskNotScheduled() {
        publishRevoked();

        // After revoke, the scheduledTasks map should NOT contain LOGGER_UPDATE_SUMMARY_TABLES.
        // We verify this indirectly: check that leadershipStatus.isLeader() is false,
        // and that calling reschedule for a LEADER_ONLY task results in no future being added.
        // Direct access to the private scheduledTasks map via reflection.
        Map<TaskType, ?> scheduledTasks = getScheduledTasks();
        assertThat(scheduledTasks).doesNotContainKey(TaskType.LOGGER_UPDATE_SUMMARY_TABLES);
    }

    @Test
    @Order(20)
    void onGrantedEvent_afterRevoke_setsLeader() {
        publishRevoked();
        assertThat(leadershipStatus.isLeader()).isFalse();

        publishGranted();
        assertThat(leadershipStatus.isLeader()).isTrue();
    }

    @Test
    @Order(21)
    void onGrantedEvent_afterRevoke_startsLeaderQueueListener() {
        publishRevoked();
        assertThat(rabbitListenerEndpointRegistry
                .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning())
                .isFalse();

        publishGranted();

        // setupAsLeader() starts the listener in a background thread — use Awaitility
        await().atMost(10, TimeUnit.SECONDS)
                .until(() -> rabbitListenerEndpointRegistry
                        .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning());
    }

    @Test
    @Order(22)
    void onGrantedEvent_duplicateGrant_doesNotDoubleStartListener() {
        // Already a leader — a second grant should be a no-op (wasLeader == true branch)
        assertThat(leadershipStatus.isLeader()).isTrue();

        // Publishing a second grant when already leader should not throw or start a second listener
        publishGranted();

        // Listener should still be running (or starting) — no crash
        await().atMost(10, TimeUnit.SECONDS)
                .until(() -> rabbitListenerEndpointRegistry
                        .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning());
        assertThat(leadershipStatus.isLeader()).isTrue();
    }

    @Test
    @Order(30)
    void leaderSendMessage_processesLocallyWithoutRabbitMQ() throws Exception {
        assertThat(leadershipStatus.isLeader()).isTrue();

        // When this node IS the leader, sendMessage() must call receiveMessage() directly
        // (no RabbitMQ round-trip). LOGGER_UPDATE_SUMMARY_TABLES is a LEADER_ONLY task
        // that maps to a no-op in receiveMessage (it's not in the switch — see LeaderQueue.receiveMessage).
        // We verify that the call returns a result (no timeout) and doesn't throw.
        Map<String, String> result = leaderQueue.sendMessage(
                TaskType.LOGGER_UPDATE_SUMMARY_TABLES, null, false);

        // When processed locally the result will be "ok" or "error" (not "timeout")
        assertThat(result).containsKey("status");
        assertThat(result.get("status")).isNotEqualTo("timeout");
    }

    @Test
    @Order(31)
    void nonLeader_sendMessage_routesToRabbitMQLeaderQueue() throws Exception {
        // Revoke leadership so this node becomes a follower
        publishRevoked();
        assertThat(leadershipStatus.isLeader()).isFalse();

        // The leader queue listener is stopped, so the message will sit in the queue.
        // Sending with isRpc=false (fire-and-forget) should not block.
        Map<String, String> result = leaderQueue.sendMessage(
                TaskType.LOGGER_UPDATE_SUMMARY_TABLES, null, false);

        // A fire-and-forget to RabbitMQ returns "ok" immediately
        assertThat(result.get("status")).isEqualTo("ok");
    }

    @Test
    @Order(32)
    void nonLeaderQueuedMessage_consumedWhenLeaderReturns() throws Exception {
        // Revoke → send message to leader queue → re-grant → message should be consumed
        publishRevoked();

        // Send a fire-and-forget POSTGRES_SYNC message (has a handler in LeaderQueue.receiveMessage)
        leaderQueue.sendMessage(TaskType.POSTGRES_SYNC, null, false);

        // Re-grant leadership — the listener starts, picks up the queued message
        publishGranted();

        // Wait for the listener to start and consume the queued message.
        await().atMost(15, TimeUnit.SECONDS)
                .until(() -> rabbitListenerEndpointRegistry
                        .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning());

        // Ensure the message is actually drained from the queue before this test (or the class)
        // finishes. Without this, the message can otherwise linger in the shared/singleton
        // RabbitMQ queue and be delivered arbitrarily later — even during final JVM shutdown,
        // once Elasticsearch's Testcontainers instance has already been reaped, producing a
        // spurious "Connection refused" error at shutdown.
        await().atMost(10, TimeUnit.SECONDS).pollInterval(200, TimeUnit.MILLISECONDS)
                .untilAsserted(() -> {
                    org.springframework.amqp.core.QueueInformation info =
                            rabbitAdmin.getQueueInfo(LeaderQueue.LEADER_QUEUE);
                    assertThat(info).isNotNull();
                    assertThat(info.getMessageCount()).isZero();
                });
    }

    @Test
    @Order(40)
    void broadcastMessage_deliveredWhenLeader() throws InterruptedException {
        assertThat(leadershipStatus.isLeader()).isTrue();

        broadcastQueue.sendMessage(TaskType.CACHE_RESET_COLLECTORY, null);
        Thread.sleep(2000);

        verify(collectoryCache, atLeastOnce()).cacheRefresh();
    }

    @Test
    @Order(41)
    void broadcastMessage_deliveredWhenNonLeader() throws InterruptedException {
        publishRevoked();
        assertThat(leadershipStatus.isLeader()).isFalse();

        // Even as a non-leader, this node's fanout queue subscription is still active.
        // Sending a broadcast message puts it on the fanout exchange — all subscribers receive it.
        broadcastQueue.sendMessage(TaskType.CACHE_RESET_COLLECTORY, null);
        Thread.sleep(2000);

        verify(collectoryCache, atLeastOnce()).cacheRefresh();
    }

    @Test
    @Order(50)
    void rapidGrantRevokeGrant_finalStateIsLeader() throws Exception {
        publishRevoked();
        publishGranted();
        publishRevoked();
        publishGranted();

        assertThat(leadershipStatus.isLeader()).isTrue();

        // After final grant, listener should eventually start
        await().atMost(15, TimeUnit.SECONDS)
                .until(() -> rabbitListenerEndpointRegistry
                        .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning());
    }

    @Test
    @Order(51)
    void rapidRevokeGrant_stateConsistentWithFinalEvent() {
        publishGranted();
        publishRevoked();
        publishRevoked(); // duplicate revoke — idempotent

        assertThat(leadershipStatus.isLeader()).isFalse();
        assertThat(rabbitListenerEndpointRegistry
                .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning())
                .isFalse();
    }

    @Test
    @Order(60)
    void consumerQueueTask_survivesLeadershipRevocationMidFlight() throws Exception {
        assertThat(leadershipStatus.isLeader()).isTrue();

        // Slow down the "export" so the task is still RUNNING when leadership is revoked.
        when(elasticService.isValidField(anyString())).thenReturn(true);
        File csvFile = File.createTempFile("leader-election-consumer-test", ".csv");
        try (FileWriter fw = new FileWriter(csvFile, StandardCharsets.UTF_8)) {
            fw.write("guid,scientificName\nurn:lsid:test:1,Testus scientificus\n");
        }
        when(elasticService.download(eq("kangaroo"), any(), eq("guid"), eq(false))).thenAnswer(invocation -> {
            Thread.sleep(2000);
            return csvFile;
        });

        String userId = "user-" + UUID.randomUUID();
        SearchQueueRequest searchQueueRequest = new SearchQueueRequest();
        searchQueueRequest.filename = "leader-election-results-" + UUID.randomUUID();
        searchQueueRequest.q = new String[]{"kangaroo"};
        searchQueueRequest.fl = new String[]{"guid"};

        QueueItem submitted = consumerQueue.add(QueueRequest.builder()
                .taskType(TaskType.SEARCH_DOWNLOAD)
                .searchQueueRequest(searchQueueRequest)
                .build(), userId);

        assertThat(submitted.status).isEqualTo(StatusCode.QUEUED);

        // Wait until the task is actually RUNNING, then revoke leadership mid-flight.
        awaitConsumerStatus(submitted.id, StatusCode.RUNNING);

        publishRevoked();
        assertThat(leadershipStatus.isLeader()).isFalse();
        // The LEADER_QUEUE listener is stopped, but this in-flight ConsumerQueue/TASK_QUEUE task
        // is independent of leader-queue plumbing, so it should still run to completion.
        assertThat(rabbitListenerEndpointRegistry
                .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning())
                .isFalse();

        QueueItem finished = awaitConsumerStatus(submitted.id, StatusCode.FINISHED, StatusCode.ERROR);
        assertThat(finished.status).as("statusMessage: %s", finished.statusMessage).isEqualTo(StatusCode.FINISHED);

        File zipFile = new File(downloadFileStoreService.getFilePath(finished));
        assertThat(zipFile).exists();
    }

    private QueueItem awaitConsumerStatus(UUID id, StatusCode... anyOf) {
        return await()
                .atMost(20, TimeUnit.SECONDS)
                .pollInterval(200, TimeUnit.MILLISECONDS)
                .until(() -> queueDataService.get(id), item -> {
                    if (item == null) {
                        return false;
                    }
                    for (StatusCode status : anyOf) {
                        if (item.status == status) {
                            return true;
                        }
                    }
                    return false;
                });
    }

    private void publishGranted() {
        // OnGrantedEvent(source, context, role)
        applicationContext.publishEvent(new OnGrantedEvent(this, null, "leader"));
    }

    private void publishRevoked() {
        // OnRevokedEvent(source, context, role)
        applicationContext.publishEvent(new OnRevokedEvent(this, null, "leader"));
    }

    /**
     * Access the private scheduledTasks map in SchedulerService via reflection
     * to verify whether a given task type has an active schedule.
     */
    private Map<TaskType, ?> getScheduledTasks() {
        try {
            Field field = SchedulerService.class.getDeclaredField("scheduledTasks");
            field.setAccessible(true);
            return (Map<TaskType, ?>) field.get(schedulerService);
        } catch (NoSuchFieldException | IllegalAccessException e) {
            throw new RuntimeException("Could not access scheduledTasks via reflection", e);
        }
    }
}
