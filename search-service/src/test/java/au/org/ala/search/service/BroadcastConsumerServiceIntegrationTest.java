/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.queue.BroadcastQueue;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockitoAnnotations;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.junit.jupiter.Container;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest
public class BroadcastConsumerServiceIntegrationTest {

    @Container
    public static RabbitMQContainer rabbitMQContainer = new RabbitMQContainer("rabbitmq:3.9.13-management");

    @Container
    public static PostgreSQLContainer<?> postgreSQLContainer = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("search")
            .withUsername("guest")
            .withPassword("guest");

    @Container
    public static ElasticsearchContainer elasticsearchContainer = new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch:8.13.0")
            .withEnv("xpack.security.enabled", "false");

    @MockBean
    private CollectoryCache collectoryCache;

    @MockBean
    private ListCache listCache;

    @Autowired
    private BroadcastQueue broadcastQueue;

    @DynamicPropertySource
    static void dynamicProperties(DynamicPropertyRegistry registry) {
        registry.add("rabbitmq.host", rabbitMQContainer::getHost);
        registry.add("rabbitmq.port", rabbitMQContainer::getAmqpPort);

        registry.add("elastic.host", elasticsearchContainer::getHttpHostAddress);

        registry.add("spring.datasource.url", postgreSQLContainer::getJdbcUrl);
        System.out.println("**** JDBC URL: " + postgreSQLContainer.getJdbcUrl());
    }

    @BeforeAll
    public static void setUp() {
        rabbitMQContainer.start();
        elasticsearchContainer.start();
        postgreSQLContainer.start();
    }

    @BeforeEach
    public void initMocks() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testSendAndReceiveCacheReset() throws InterruptedException {
        broadcastQueue.sendMessage(TaskType.CACHE_RESET_ALL, null);
        broadcastQueue.sendMessage(TaskType.CACHE_RESET_ALL, null);
        broadcastQueue.sendMessage(TaskType.CACHE_RESET_ALL, null);

        // Wait for the message to be consumed
        Thread.sleep(2000);

        verify(collectoryCache, times(3)).cacheRefresh();
        verify(listCache, times(3)).cacheRefresh();
    }
}
