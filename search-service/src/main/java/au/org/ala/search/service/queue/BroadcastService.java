/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.queue;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.util.InstanceUtil;
import lombok.Getter;
import org.apache.commons.lang3.StringUtils;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import static au.org.ala.search.service.queue.BroadcastService.BroadcastMessage.CACHE_RESET;

/**
 * Service to send and consume messages from the broadcast queue for all messages that are to be broadcast to all instances.
 * <p>
 * Messages supported:
 * - Cache reset
 */
@Service
public class BroadcastService {
    public static final String BROADCAST_QUEUE = "broadcast";
    private static final TaskType taskType = TaskType.ALL;
    @Getter
    private static BroadcastService instance;
    protected final LogService logService;
    private final CollectoryCache collectoryCache;
    private final ListCache listCache;
    private final RabbitTemplate rabbitTemplate;
    @Value("${rabbitmq.exchange}")
    private String exchange;
    @Value("${rabbitmq.host:}")
    private String host;

    public BroadcastService(CollectoryCache collectoryCache, ListCache listCache, RabbitTemplate rabbitTemplate, LogService logService) {
        this.collectoryCache = collectoryCache;
        this.listCache = listCache;
        this.rabbitTemplate = rabbitTemplate;
        this.logService = logService;

        instance = this;
    }

    /**
     * Send a message to all instances.
     *
     * @param message
     */
    public void sendMessage(BroadcastMessage message) {
        if (StringUtils.isNotEmpty(host)) {
            rabbitTemplate.convertAndSend(exchange, "", message.name());
        } else {
            receiveMessage(message.name());
        }
    }

    /**
     * Receive a message from the broadcast queue, or directly if no exchange is configured.
     *
     * @param message
     */
    public void receiveMessage(String message) {
        if (message.equals(CACHE_RESET.name())) {
            resetCache();
        }
    }

    public void resetCache() {
        logService.log(taskType, "reset cache called, instance: " + InstanceUtil.getInstanceId());
        collectoryCache.cacheRefresh();
        listCache.cacheRefresh();
    }

    public enum BroadcastMessage {
        CACHE_RESET
    }
}
