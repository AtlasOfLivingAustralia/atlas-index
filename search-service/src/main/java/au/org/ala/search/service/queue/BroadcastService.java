/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.queue;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.remote.DataQualityService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.util.InstanceUtil;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service to send and consume messages from the broadcast queue for all messages that are to be broadcast to all instances.
 * <p>
 * Messages supported:
 * - Cache reset
 */
@Slf4j
@Service
public class BroadcastService {
    public static final String BROADCAST_QUEUE = "broadcast";
    @Getter
    private static BroadcastService instance;
    protected final LogService logService;
    private final CollectoryCache collectoryCache;
    private final ListCache listCache;
    private final RabbitTemplate rabbitTemplate;
    private final DataQualityService dataQualityService;
    @Value("${rabbitmq.exchange.broadcast}")
    private String broadcastExchange;
    @Value("${rabbitmq.host:}")
    private String rabbitMqHost;

    public BroadcastService(CollectoryCache collectoryCache, ListCache listCache, RabbitTemplate rabbitTemplate, LogService logService, DataQualityService dataQualityService) {
        this.collectoryCache = collectoryCache;
        this.listCache = listCache;
        this.rabbitTemplate = rabbitTemplate;
        this.logService = logService;

        instance = this;
        this.dataQualityService = dataQualityService;
    }

    /**
     * Send a message to all instances.
     *
     * @param message message to send
     */
    public void sendMessage(TaskType message) {
        if (StringUtils.isNotEmpty(rabbitMqHost)) {
            rabbitTemplate.convertAndSend(broadcastExchange, "", message.name());
        } else {
            receiveMessage(message.name());
        }
    }

    /**
     * Receive a message from the broadcast queue, or directly if no exchange is configured.
     *
     * @param message a TaskType of category TaskType.Category.BROADCAST
     */
    public void receiveMessage(String message) {
        TaskType taskType;
        try {
            taskType = TaskType.valueOf(message);
        } catch (IllegalArgumentException e) {
            log.error("Unknown message received: {}", message);
            return;
        }
        logService.log(taskType, "instance: " + InstanceUtil.getInstanceId());
        if (message.equals(TaskType.CACHE_RESET_ALL.name())) {
            collectoryCache.cacheRefresh();
            listCache.cacheRefresh();
            dataQualityService.cacheRefresh();
        } else if (message.equals(TaskType.CACHE_RESET_COLLECTORY.name())) {
            collectoryCache.cacheRefresh();
        } else if (message.equals(TaskType.CACHE_RESET_LISTS.name())) {
            listCache.cacheRefresh();
        } else if (message.equals(TaskType.CACHE_RESET_DATA_QUALITY.name())) {
            dataQualityService.cacheRefresh();
        } else {
            log.error("Unhandled message received: {}", message);
        }
    }
}
