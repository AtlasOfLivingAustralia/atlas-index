/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.service.SchedulerService;
import au.org.ala.search.service.queue.LeaderQueue;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.listener.MessageListenerContainer;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.integration.leader.event.OnGrantedEvent;
import org.springframework.integration.leader.event.OnRevokedEvent;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.*;

class LeadershipStatusTest {

    @Test
    void testRevocationStopsRetryLoopAndInterruptsThread() throws Exception {
        RabbitListenerEndpointRegistry registry = mock(RabbitListenerEndpointRegistry.class);
        SchedulerService schedulerService = mock(SchedulerService.class);
        MessageListenerContainer container = mock(MessageListenerContainer.class);

        when(registry.getListenerContainer(LeaderQueue.LEADER_QUEUE)).thenReturn(container);

        // Make start() throw an exception to simulate failure / retry
        CountDownLatch firstAttemptLatch = new CountDownLatch(1);
        AtomicInteger startAttempts = new AtomicInteger(0);

        doAnswer(invocation -> {
            startAttempts.incrementAndGet();
            firstAttemptLatch.countDown();
            throw new RuntimeException("RabbitMQ connection failure");
        }).when(container).start();

        LeadershipStatus leadershipStatus = new LeadershipStatus(registry, schedulerService);
        ReflectionTestUtils.setField(leadershipStatus, "rabbitMqHost", "localhost");

        // Explicitly revoke to put into non-leader state
        leadershipStatus.handleOnRevokedEvent(new OnRevokedEvent(this, null, "leader"));

        // Grant leadership -> initiates retry loop
        leadershipStatus.handleOnGrantedEvent(new OnGrantedEvent(this, null, "leader"));

        // Wait until at least 1 attempt has been made
        assertThat(firstAttemptLatch.await(5, TimeUnit.SECONDS)).isTrue();

        // Revoke leadership while start is failing
        leadershipStatus.handleOnRevokedEvent(new OnRevokedEvent(this, null, "leader"));

        assertThat(leadershipStatus.isLeader()).isFalse();

        // Give time to ensure thread has stopped and no more start attempts occur
        int attemptsAtRevoke = startAttempts.get();
        Thread.sleep(500);

        // Attempts should have ceased because the thread was terminated/interrupted and isLeader is false
        assertThat(startAttempts.get()).isLessThanOrEqualTo(attemptsAtRevoke + 1);

        Thread startupThread = (Thread) ReflectionTestUtils.getField(leadershipStatus, "leaderStartupThread");
        if (startupThread != null) {
            await().atMost(2, TimeUnit.SECONDS).until(() -> !startupThread.isAlive());
        }
    }

    @Test
    void testRevocationDuringStartStopsContainer() {
        RabbitListenerEndpointRegistry registry = mock(RabbitListenerEndpointRegistry.class);
        SchedulerService schedulerService = mock(SchedulerService.class);
        MessageListenerContainer container = mock(MessageListenerContainer.class);

        when(registry.getListenerContainer(LeaderQueue.LEADER_QUEUE)).thenReturn(container);
        when(container.isRunning()).thenReturn(true);

        LeadershipStatus leadershipStatus = new LeadershipStatus(registry, schedulerService);
        ReflectionTestUtils.setField(leadershipStatus, "rabbitMqHost", "localhost");

        // Simulate leadership granted then revoked
        leadershipStatus.handleOnGrantedEvent(new OnGrantedEvent(this, null, "leader"));
        leadershipStatus.handleOnRevokedEvent(new OnRevokedEvent(this, null, "leader"));

        verify(container, atLeastOnce()).stop();
    }
}


