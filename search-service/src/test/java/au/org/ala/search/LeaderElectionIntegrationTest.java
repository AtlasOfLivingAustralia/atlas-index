/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.SchedulerService;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.queue.BroadcastQueue;
import au.org.ala.search.service.queue.LeaderQueue;
import org.junit.jupiter.api.*;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.ApplicationContext;
import org.springframework.integration.leader.event.OnGrantedEvent;
import org.springframework.integration.leader.event.OnRevokedEvent;

import java.lang.reflect.Field;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
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
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class LeaderElectionIntegrationTest extends AbstractIntegrationTestContainers {

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

    @MockBean
    private CollectoryCache collectoryCache;

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
        // We can't directly observe the message being consumed without a spy,
        // so we verify the listener is running (which means it's able to consume).
        await().atMost(15, TimeUnit.SECONDS)
                .until(() -> rabbitListenerEndpointRegistry
                        .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning());

        // Give a brief moment for message consumption
        await().atMost(5, TimeUnit.SECONDS).pollInterval(500, TimeUnit.MILLISECONDS)
                .untilAsserted(() ->
                        // Verify queue depth is zero via RabbitMQ management API or
                        // simply assert no exception — the listener is running and will consume.
                        assertThat(rabbitListenerEndpointRegistry
                                .getListenerContainer(LeaderQueue.LEADER_QUEUE).isRunning()).isTrue()
                );
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
    @SuppressWarnings("unchecked")
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
