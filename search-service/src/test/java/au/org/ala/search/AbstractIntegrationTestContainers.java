/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.service.queue.BroadcastQueue;
import au.org.ala.search.service.queue.ConsumerQueue;
import au.org.ala.search.service.queue.LeaderQueue;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.MockitoAnnotations;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.rabbitmq.RabbitMQContainer;

import java.util.concurrent.RejectedExecutionException;

/**
 * Base class for integration tests requiring PostgreSQL, Elasticsearch, and RabbitMQ.
 * <p>
 * Containers are shared across all test classes (singleton pattern) — started once per JVM.
 * Testcontainers 2.x handles Docker Desktop detection automatically on all platforms.
 */
public abstract class AbstractIntegrationTestContainers {

    static {
        // Suppress some harmless exceptions
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            if (throwable instanceof RejectedExecutionException && thread.getName().startsWith("connectionFactory")) {
                return;
            }
            if (previous != null) {
                previous.uncaughtException(thread, throwable);
            } else {
                thread.getThreadGroup().uncaughtException(thread, throwable);
            }
        });
    }

    public static final RabbitMQContainer rabbitMQContainer =
            new RabbitMQContainer("rabbitmq:3.9.13-management");

    public static final PostgreSQLContainer postgreSQLContainer =
            new PostgreSQLContainer("postgres:17-alpine")
                    .withDatabaseName("search")
                    .withUsername("guest")
                    .withPassword("guest")
                    // Each distinct combination of @MockBean across test classes forces Spring's
                    // test context cache to spin up a separate ApplicationContext, and therefore a
                    // separate Hikari connection pool against this single shared instance. Raise
                    // max_connections well above the default (100) so a full `mvn test` run doesn't
                    // intermittently fail with "FATAL: sorry, too many clients already". See also the
                    // reduced Hikari pool sizes in src/test/resources/application.properties.
                    .withCommand("postgres", "-c", "max_connections=300");

    public static final ElasticsearchContainer elasticsearchContainer =
            new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch:8.13.0")
                    .withEnv("xpack.security.enabled", "false");

    static {
        rabbitMQContainer.start();
        postgreSQLContainer.start();
        elasticsearchContainer.start();
    }

    @DynamicPropertySource
    static void dynamicProperties(DynamicPropertyRegistry registry) {
        registry.add("rabbitmq.host", rabbitMQContainer::getHost);
        registry.add("rabbitmq.port", rabbitMQContainer::getAmqpPort);
        registry.add("elastic.host", elasticsearchContainer::getHttpHostAddress);
        registry.add("spring.datasource.url", postgreSQLContainer::getJdbcUrl);
    }

    @Autowired
    private RabbitAdmin rabbitAdmin;

    @BeforeEach
    public void initMocks() {
        MockitoAnnotations.openMocks(this);
    }

    /**
     * Purge all known RabbitMQ queues before every test in every integration test class.
     * <p>
     * RabbitMQ (and its queues) are shared singleton containers across the whole JVM fork, so a
     * message left behind by a previous test (e.g. a fire-and-forget message sent to the leader
     * queue while its listener was briefly stopped) can otherwise linger and be delivered much
     * later — even during the final shutdown of the whole test suite, after Elasticsearch's
     * Testcontainers instance has already been reaped. That produces spurious
     * "Connection refused" errors right at JVM exit and can delay/complicate clean shutdown.
     * Purging before each test guarantees a clean slate regardless of which test last touched
     * these queues.
     */
    @BeforeEach
    public void purgeSharedRabbitQueuesBeforeEach() {
        purgeSharedRabbitQueues(rabbitAdmin);
    }

    /**
     * Purge again once all tests in a class have finished so this class doesn't leave stray
     * messages behind for whichever test class (or final JVM shutdown) runs next.
     */
    @AfterAll
    static void purgeSharedRabbitQueuesAfterAll(@Autowired RabbitAdmin rabbitAdmin) {
        purgeSharedRabbitQueues(rabbitAdmin);
    }

    private static void purgeSharedRabbitQueues(RabbitAdmin rabbitAdmin) {
        rabbitAdmin.purgeQueue(BroadcastQueue.BROADCAST_QUEUE, true);
        rabbitAdmin.purgeQueue(LeaderQueue.LEADER_QUEUE, true);
        rabbitAdmin.purgeQueue(ConsumerQueue.TASK_QUEUE, true);
    }
}
