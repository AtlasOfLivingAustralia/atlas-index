package au.org.ala.search;

import au.org.ala.search.model.ListBackedFields;
import au.org.ala.search.model.dto.SetRequest;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.ListService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.LinkedBlockingQueue;

// TODO: queue persistence, e.g. to disk
// TODO: interface with external queueing system, e.g. RabbitMQ
@Service
public class QueueService {

    private static final Logger logger = LoggerFactory.getLogger(QueueService.class);

    Map<String, LinkedBlockingQueue<Object>> queues = new ConcurrentHashMap<>();

    public void add(Object queueItem) {
        logger.info("Adding item to queue: " + queueItem);

        LinkedBlockingQueue<Object> queue = queues.get(queueItem.getClass().getName());
        if (queue == null) {
            queue = new LinkedBlockingQueue<>();
            queues.put(queueItem.getClass().getName(), queue);
        }

        queue.add(queueItem);
    }

    /**
     * Get the next item from the queue, waiting if necessary until an element becomes available.
     *
     * @param queueName
     * @return
     */
    public Object next(String queueName) throws InterruptedException {
        LinkedBlockingQueue<Object> queue = queues.get(queueName);
        if (queue == null) {
            // initialize an empty queue
            queue = new LinkedBlockingQueue<>();
            queues.put(queueName, queue);
        }

        Object item = queue.take();
        if (item != null) {
            logger.info("Retrieved item from queue: " + item);
        }
        return item;
    }
}
