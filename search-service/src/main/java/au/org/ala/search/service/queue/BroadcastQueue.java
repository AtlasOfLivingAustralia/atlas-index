/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.queue;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.remote.ConfigService;
import au.org.ala.search.service.remote.QualityDataService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.util.InstanceUtil;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.smile.SmileFactory;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.text.SimpleDateFormat;
import java.util.Map;

/**
 * Service to send and consume messages from the broadcast queue for all messages that are to be broadcast to all instances.
 * <p>
 * Messages supported:
 * - Cache reset
 */
@Slf4j
@Service
public class BroadcastQueue {
    public static final String BROADCAST_QUEUE = "broadcast";
    @Getter
    private static BroadcastQueue instance;
    protected final LogService logService;
    private final CollectoryCache collectoryCache;
    private final ListCache listCache;
    private final RabbitTemplate rabbitTemplate;
    private final QualityDataService qualityDataService;
    private final ConfigService configService;
    @Value("${rabbitmq.exchange.broadcast}")
    private String broadcastExchange;
    @Value("${rabbitmq.host:}")
    private String rabbitMqHost;

    ObjectMapper smileObjectMapper = new ObjectMapper(new SmileFactory());

    public BroadcastQueue(CollectoryCache collectoryCache, ListCache listCache, RabbitTemplate rabbitTemplate, LogService logService, QualityDataService qualityDataService, ConfigService configService) {
        this.collectoryCache = collectoryCache;
        this.listCache = listCache;
        this.rabbitTemplate = rabbitTemplate;
        this.logService = logService;

        instance = this;
        this.qualityDataService = qualityDataService;

        SimpleDateFormat customDateFormat = new SimpleDateFormat("EEE MMM dd HH:mm:ss z yyyy");
        smileObjectMapper.setDateFormat(customDateFormat);
        this.configService = configService;
    }

    /**
     * Send a message to all instances.
     *
     * @param message message to send
     */
    public void sendMessage(TaskType message, Object payload) {
        if (StringUtils.isNotEmpty(rabbitMqHost)) {
            Map<String, Object> map = Map.of(
                    "payload", payload,
                    "message", message.name()
            );

            try {
                byte[] bytes = smileObjectMapper.writeValueAsBytes(map);
                rabbitTemplate.convertAndSend(broadcastExchange, "", bytes);
            } catch (JsonProcessingException e) {
                log.error("Error serializing message to send", e);
            }
        } else {
            receiveMessage(message.name(), payload);
        }
    }

    public void receiveMessage(byte[] message) {
        try {
            Map<String, Object> map = smileObjectMapper.readValue(message, Map.class);
            String taskTypeName = (String) map.get("message");
            Object payload = map.get("payload");
            receiveMessage(taskTypeName, payload);
        } catch (Exception e) {
            log.error("Error parsing message", e);
        }
    }

    /**
     * Receive a message from the broadcast queue, or directly if no exchange is configured.
     *
     * @param message a TaskType of category TaskType.Category.BROADCAST
     */
    public void receiveMessage(String message, Object payload) {
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
            qualityDataService.cacheRefresh();
        } else if (message.equals(TaskType.CACHE_RESET_COLLECTORY.name())) {
            collectoryCache.cacheRefresh();
        } else if (message.equals(TaskType.CACHE_RESET_LISTS.name())) {
            listCache.cacheRefresh();
        } else if (message.equals(TaskType.CACHE_RESET_DATA_QUALITY.name())) {
            qualityDataService.cacheRefresh();
        } else if (message.equals(TaskType.CONFIG_CHANGE.name())) {
            try {
                // Parse payload to ConfigData
                ConfigData prevConfigData = null;
                if (payload != null) {
                    prevConfigData = smileObjectMapper.convertValue(payload, ConfigData.class);
                }
                configService.triggerListeners(configService.get(prevConfigData.id), prevConfigData);
            } catch (IllegalArgumentException e) {
                log.error("Unknown message received: {}", message, e);
            }
        } else {
            log.error("Unhandled message received: {}", message);
        }
    }
}
