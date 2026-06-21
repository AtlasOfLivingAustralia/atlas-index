/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import org.junit.jupiter.api.BeforeEach;
import org.mockito.MockitoAnnotations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.rabbitmq.RabbitMQContainer;

/**
 * Base class for integration tests requiring PostgreSQL, Elasticsearch, and RabbitMQ.
 * <p>
 * Containers are shared across all test classes (singleton pattern) — started once per JVM.
 * Testcontainers 2.x handles Docker Desktop detection automatically on all platforms.
 */
public abstract class AbstractIntegrationTestContainers {

    public static final RabbitMQContainer rabbitMQContainer =
            new RabbitMQContainer("rabbitmq:3.9.13-management");

    public static final PostgreSQLContainer postgreSQLContainer =
            new PostgreSQLContainer("postgres:17-alpine")
                    .withDatabaseName("search")
                    .withUsername("guest")
                    .withPassword("guest");

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

    @BeforeEach
    public void initMocks() {
        MockitoAnnotations.openMocks(this);
    }
}
