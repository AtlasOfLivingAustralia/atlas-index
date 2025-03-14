package au.org.ala.search;

import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.queue.BroadcastService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockitoAnnotations;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.junit.jupiter.Container;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest
public class BroadcastConsumerServiceIntegrationTest {

    @Container
    public static RabbitMQContainer rabbitMQContainer = new RabbitMQContainer("rabbitmq:3.9.13-management");

    @Container
    public static MongoDBContainer mongoDBContainer = new MongoDBContainer("mongo:6.0");

    @Container
    public static ElasticsearchContainer elasticsearchContainer = new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch:8.13.0")
            .withEnv("xpack.security.enabled", "false");

    @MockBean
    private CollectoryCache collectoryCache;

    @MockBean
    private ListCache listCache;

    @Autowired
    private BroadcastService broadcastService;

    @DynamicPropertySource
    static void rabbitProperties(DynamicPropertyRegistry registry) {
        registry.add("rabbitmq.host", rabbitMQContainer::getHost);
        registry.add("rabbitmq.port", rabbitMQContainer::getAmqpPort);

        registry.add("spring.data.mongodb.uri", mongoDBContainer::getReplicaSetUrl);
        registry.add("spring.data.mongodb.host", mongoDBContainer::getHost);
        registry.add("spring.data.mongodb.port", mongoDBContainer::getFirstMappedPort);

        registry.add("elastic.host", elasticsearchContainer::getHttpHostAddress);
    }

    @BeforeAll
    public static void setUp() {
        rabbitMQContainer.start();
        mongoDBContainer.start();
        elasticsearchContainer.start();
    }

    @BeforeEach
    public void initMocks() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testSendAndReceiveCacheReset() throws InterruptedException {
        broadcastService.sendMessage(BroadcastService.BroadcastMessage.CACHE_RESET);
        broadcastService.sendMessage(BroadcastService.BroadcastMessage.CACHE_RESET);
        broadcastService.sendMessage(BroadcastService.BroadcastMessage.CACHE_RESET);

        // Wait for the message to be consumed
        Thread.sleep(2000);

        verify(collectoryCache, times(3)).cacheRefresh();
        verify(listCache, times(3)).cacheRefresh();
    }
}
