/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.service.queue.LeaderQueue;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${rabbitmq.host:}")
    private String rabbitMqHost;

    public LeadershipStatus(RabbitListenerEndpointRegistry registry) {
        this.registry = registry;
    }

    private final AtomicBoolean isLeader = new AtomicBoolean(System.getenv("KUBERNETES_SERVICE_HOST") == null);

    @PostConstruct
    public void init() {
        if (isLeader.get()) {
            setupAsLeader();
        }

        log.info("Leadership status: {}", isLeader.get());
    }


    @EventListener
    public void handleOnGrantedEvent(OnGrantedEvent event) {
        boolean wasLeader = isLeader.getAndSet(true);

        if (!wasLeader) {
            setupAsLeader();
        }

        log.info("Leadership granted: {}", event.getRole());
    }

    @EventListener
    public void handleOnRevokedEvent(OnRevokedEvent event) {
        isLeader.set(false);
        log.info("Leadership revoked: {}", event.getRole());

        registry.getListenerContainer(LeaderQueue.LEADER_QUEUE).stop();
    }

    public boolean isLeader() {
        return isLeader.get();
    }

    private void setupAsLeader() {
        // 1. identify and restart any failed tasks
        log.error("Leadership setup goes here");

        // 2. start the leader queue listener
        if (StringUtils.isNotEmpty(rabbitMqHost)) {
            new Thread(() -> {
                int attempts = 0;
                int delayMs = 100;
                while (attempts < 300 * 1000 / delayMs) { // 5 minutes
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
                    } catch (InterruptedException ignored) {

                    }
                }
                log.error("Error starting leader queue listener after 5 minutes, giving up");
            }).start();
        }
    }
}
