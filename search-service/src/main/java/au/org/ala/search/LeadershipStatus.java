/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
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
    }

    public boolean isLeader() {
        return isLeader.get();
    }

    private void setupAsLeader() {
        // TODO: do leadership setup here, queue recovery, etc

        // 1. identify and restart any failed tasks
        log.error("Leadership setup goes here");
    }
}
