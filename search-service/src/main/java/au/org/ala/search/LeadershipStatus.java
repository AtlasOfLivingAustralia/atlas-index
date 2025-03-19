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
 *
 * When not running in Kubernetes, leadership is always granted.
 *
 */
@Slf4j
@Component
public class LeadershipStatus {

    private AtomicBoolean isLeader = new AtomicBoolean(System.getenv("KUBERNETES_SERVICE_HOST") == null);

    @PostConstruct
    public void init() {
        if (isLeader.get()) {
            setupAsLeader();
        }

        log.error("Leadership status: " + isLeader.get());
    }

    @EventListener
    public void handleOnGrantedEvent(OnGrantedEvent event) {
        boolean wasLeader = isLeader.getAndSet(true);

        if (!wasLeader) {
            setupAsLeader();
        }

        log.error("Leadership granted: " + event.getRole());
    }

    @EventListener
    public void handleOnRevokedEvent(OnRevokedEvent event) {
        isLeader.set(false);
        log.error("Leadership revoked: " + event.getRole());
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
