/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.service.queue.LeaderQueue;
import au.org.ala.search.service.SchedulerService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.event.EventListener;
import org.springframework.integration.leader.event.OnGrantedEvent;
import org.springframework.integration.leader.event.OnRevokedEvent;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Event listener for leadership events.
 * <p>
 * When not running in Kubernetes, leadership is always granted.
 */
@Slf4j
@Component
public class LeadershipStatus {

    private final RabbitListenerEndpointRegistry registry;
    private final SchedulerService schedulerService;

    @Value("${rabbitmq.host:}")
    private String rabbitMqHost;

    public LeadershipStatus(RabbitListenerEndpointRegistry registry, @Lazy SchedulerService schedulerService) {
        this.registry = registry;
        this.schedulerService = schedulerService;
    }

    private final AtomicBoolean isLeader = new AtomicBoolean(System.getenv("KUBERNETES_SERVICE_HOST") == null);
    private final AtomicBoolean shuttingDown = new AtomicBoolean(false);
    private volatile Thread leaderStartupThread;

    @PostConstruct
    public void init() {
        if (isLeader.get()) {
            setupAsLeader();
        }

        log.info("Leadership status: {}", isLeader.get());
    }

    /**
     * Ensure the leader queue listener (and its background startup retry thread) are stopped
     * before the application context finishes tearing down other beans.
     */
    @PreDestroy
    public void shutdown() {
        shuttingDown.set(true);

        Thread startupThread = leaderStartupThread;
        if (startupThread != null && startupThread.isAlive()) {
            startupThread.interrupt();
        }

        try {
            var container = registry.getListenerContainer(LeaderQueue.LEADER_QUEUE);
            if (container.isRunning()) {
                container.stop();
            }
        } catch (Exception e) {
            log.warn("Error stopping leader queue listener during shutdown", e);
        }
    }


    @EventListener
    public void handleOnGrantedEvent(OnGrantedEvent event) {
        boolean wasLeader = isLeader.getAndSet(true);

        if (!wasLeader) {
            setupAsLeader();
            schedulerService.initSchedules();
        }

        log.info("Leadership granted: {}", event.getRole());
    }

    @EventListener
    public void handleOnRevokedEvent(OnRevokedEvent event) {
        isLeader.set(false);
        log.info("Leadership revoked: {}", event.getRole());
        schedulerService.initSchedules();

        registry.getListenerContainer(LeaderQueue.LEADER_QUEUE).stop();
    }

    public boolean isLeader() {
        return isLeader.get();
    }

    private void setupAsLeader() {
        // 1. identify and restart any failed tasks
        // TODO: identify and restart any failed tasks.
        log.debug("Leadership setup: identify and restart any failed tasks (not yet implemented)");

        // 2. start the leader queue listener
        if (StringUtils.isNotEmpty(rabbitMqHost)) {
            Thread thread = new Thread(() -> {
                int attempts = 0;
                int delayMs = 100;
                while (!shuttingDown.get() && attempts < 300 * 1000 / delayMs) { // 5 minutes
                    attempts++;
                    try {
                        registry.getListenerContainer(LeaderQueue.LEADER_QUEUE).start();
                        log.info("Started leader queue listener after {} seconds", (attempts * delayMs / 1000.0));
                        return;
                    } catch (Exception e) {
                        if (attempts % 10 == 0) {
                            log.info("Failed to start leader queue listener after {} seconds, retrying...", (attempts * delayMs / 1000.0));
                        }
                    }
                    try {
                        Thread.sleep(delayMs);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
                if (!shuttingDown.get()) {
                    log.error("Error starting leader queue listener after 5 minutes, giving up");
                }
            });
            // Daemon so this background retry loop never prevents JVM shutdown on its own.
            thread.setDaemon(true);
            thread.setName("leader-queue-startup");
            leaderStartupThread = thread;
            thread.start();
        }
    }
}
