/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.queue;

import au.org.ala.search.LeadershipStatus;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.quality.QualityProfile;
import au.org.ala.search.service.remote.QualityDataService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.service.update.*;
import au.org.ala.search.util.InstanceUtil;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.smile.SmileFactory;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Map;

/**
 * Service to send and consume messages intended for the leader instance. Supports waiting for message acknowledgments.
 * <p>
 * Messages supported:
 * - TaskType.DATA_QUALITY_SAVE
 * - TaskType.DATA_QUALITY_DELETE
 */
@Slf4j
@Service
public class LeaderQueue {
    public static final String LEADER_QUEUE = "leader";

    private final LogService logService;
    private final RabbitTemplate rabbitTemplate;
    private final QualityDataService qualityDataService;
    private final LeadershipStatus leadershipStatus;
    protected final WordpressImportService wordpressImportService;
    protected final KnowledgebaseImportService knowledgebaseImportService;
    protected final ListImportService listImportService;
    protected final CollectionsImportService collectionsImportService;
    protected final BiocollectImportService biocollectImportService;
    protected final DigivolImportService digivolImportService;
    protected final LayerImportService layerImportService;
    protected final AreaImportService areaImportService;
    protected final DwCAImportService dwcaImportService;
    protected final TaxonUpdateService taxonUpdateService;
    protected final SitemapService sitemapService;
    protected final AllService allService;
    protected final DashboardService dashboardService;
    protected final DescriptionsUpdateService descriptionsUpdateService;
    private final PostgresSyncService postgresSyncService;

    @Value("${rabbitmq.exchange.direct}")
    private String directExchange;
    @Value("${rabbitmq.host:}")
    private String rabbitMqHost;

    ObjectMapper smileObjectMapper = new ObjectMapper(new SmileFactory());

    public LeaderQueue(RabbitTemplate rabbitTemplate, LogService logService, QualityDataService qualityDataService, LeadershipStatus leadershipStatus, WordpressImportService wordpressImportService, KnowledgebaseImportService knowledgebaseImportService, ListImportService listImportService, CollectionsImportService collectionsImportService, BiocollectImportService biocollectImportService, DigivolImportService digivolImportService, LayerImportService layerImportService, AreaImportService areaImportService, DwCAImportService dwcaImportService, TaxonUpdateService taxonUpdateService, SitemapService sitemapService, AllService allService, DashboardService dashboardService, DescriptionsUpdateService descriptionsUpdateService, PostgresSyncService postgresSyncService) {
        this.rabbitTemplate = rabbitTemplate;
        this.logService = logService;
        this.leadershipStatus = leadershipStatus;

        this.qualityDataService = qualityDataService;
        this.wordpressImportService = wordpressImportService;
        this.knowledgebaseImportService = knowledgebaseImportService;
        this.listImportService = listImportService;
        this.collectionsImportService = collectionsImportService;
        this.biocollectImportService = biocollectImportService;
        this.digivolImportService = digivolImportService;
        this.layerImportService = layerImportService;
        this.areaImportService = areaImportService;
        this.dwcaImportService = dwcaImportService;
        this.taxonUpdateService = taxonUpdateService;
        this.sitemapService = sitemapService;
        this.allService = allService;
        this.dashboardService = dashboardService;
        this.descriptionsUpdateService = descriptionsUpdateService;
        this.postgresSyncService = postgresSyncService;

        // Increase the timeout for RPC responses to 30 seconds
        this.rabbitTemplate.setReplyTimeout(30_000);

        SimpleDateFormat customDateFormat = new SimpleDateFormat("EEE MMM dd HH:mm:ss z yyyy");
        smileObjectMapper.setDateFormat(customDateFormat);
    }

    /**
     * RPC method to send a message to the leader instance and wait for a response.
     *
     * Performance: Respond with an enum value.
     *
     * @param message message to send
     * @return A map containing the response status, e.g. {"status": "ok"} or {"status": "error"} or {"status": "timeout"}
     */
    public Map<String, String> sendRpcMessage(TaskType message, Object payload) throws IOException {
        return sendMessage(message, payload, true);
    }

    /**
     * Send a message to the leader instance without waiting for a response.
     *
     * @param message message to send
     * @param payload Object compatible with the TaskType's payloadType, or null if not applicable
     * @param isRpc true if this is an RPC message, false for a broadcast message
     * @return A map containing the response status, e.g. {"status": "ok"} or {"status": "error"}
     */
    public Map<String, String> sendMessage(TaskType message, Object payload, boolean isRpc) throws IOException {
        if (StringUtils.isNotEmpty(rabbitMqHost) && !leadershipStatus.isLeader()) {
            Map<String, Object> map = Map.of(
                    "payload", payload,
                    "message", message.name()
            );

            byte[] bytes = smileObjectMapper.writeValueAsBytes(map);

            if (isRpc) {
                Object response = rabbitTemplate.convertSendAndReceive(directExchange, LEADER_QUEUE, bytes);

                // convert response from byte[] to Map with smileObjectMapper
                if (response instanceof byte[] responseBytes) {
                    Map<String, String> responseMap = smileObjectMapper.readValue(responseBytes, Map.class);
                    log.info("Received response from leader: {}", responseMap);
                    return responseMap;
                } else {
                    log.info("RPC timeout: {}", message.name());
                    return Map.of("status", "timeout");
                }
            } else {
                // Send the message without waiting for a response
                rabbitTemplate.convertAndSend(directExchange, LEADER_QUEUE, bytes);
                log.info("Sent message to leader: {}", message.name());
                return Map.of("status", "ok");
            }
        }

        // this is the leader
        if (receiveMessage(message.name(), payload)) {
            return Map.of("status", "ok");
        } else {
            return Map.of("status", "error");
        }
    }

    public boolean receiveMessage(byte[] message) {
        try {
            Map<String, Object> map = smileObjectMapper.readValue(message, Map.class);
            String taskTypeName = (String) map.get("message");
            Object payload = map.get("payload");
            return receiveMessage(taskTypeName, payload);
        } catch (Exception e) {
            log.error("Error parsing message", e);
        }
        return false;
    }

    /**
     * Receive a message from the broadcast queue, or directly if no exchange is configured.
     *
     * @param message
     * @param payload Object compatible with the TaskType's payloadType, or null if not applicable
     * @return true if the message was processed successfully, false otherwise
     */
    public boolean receiveMessage(String message, Object payload) {
        TaskType taskType;

        // Parse payload to qualityProfile
        QualityProfile qualityProfile = null;
        try {
            taskType = TaskType.valueOf(message);
            if (taskType.payloadType != null && payload != null) {
                qualityProfile = smileObjectMapper.convertValue(payload, QualityProfile.class);
            }
        } catch (IllegalArgumentException e) {
            log.error("Unknown message received: {}", message, e);
            return false;
        }

        logService.log(taskType, "instance: " + InstanceUtil.getInstanceId());
        if (message.equals(TaskType.DATA_QUALITY_DELETE.name())) {
            if (qualityProfile == null || qualityProfile.getId() == null) {
                log.error("Quality profile ID is required for deletion.");
                return false;
            }
            qualityDataService.delete(qualityProfile.getId());
        } else if (message.equals(TaskType.DATA_QUALITY_SAVE.name())) {
            if (qualityProfile == null) {
                log.error("Quality profile is required for saving.");
                return false;
            }
            QualityProfile qp = qualityDataService.save(qualityProfile);
            return qp != null;
        } else if (message.equals(TaskType.ALL.name())) {
            allService.run();
        } else if (message.equals(TaskType.AREA.name())) {
            areaImportService.run();
        } else if (message.equals(TaskType.BIOCACHE.name())) {
            taxonUpdateService.run();
        } else if (message.equals(TaskType.DIGIVOL.name())) {
            digivolImportService.run();
        } else if (message.equals(TaskType.BIOCOLLECT.name())) {
            biocollectImportService.run();
        } else if (message.equals(TaskType.COLLECTIONS.name())) {
            collectionsImportService.run();
        } else if (message.equals(TaskType.DWCA.name())) {
            dwcaImportService.run();
        } else if (message.equals(TaskType.KNOWLEDGEBASE.name())) {
            knowledgebaseImportService.run();
        } else if (message.equals(TaskType.LAYER.name())) {
            layerImportService.run();
        } else if (message.equals(TaskType.LISTS.name())) {
            listImportService.run();
        } else if (message.equals(TaskType.SITEMAP.name())) {
            sitemapService.run();
        } else if (message.equals(TaskType.WORDPRESS.name())) {
            wordpressImportService.run();
        } else if (message.equals(TaskType.DASHBOARD.name())) {
            dashboardService.run();
        } else if (message.equals(TaskType.TAXON_DESCRIPTION.name())) {
            descriptionsUpdateService.run();
        } else if (message.equals(TaskType.POSTGRES_SYNC.name())) {
            postgresSyncService.run();
        } else {
            logService.log(taskType, "Unknown broadcast message: " + message);
            return false;
        }
        return true;
    }

    @RabbitListener(queues = LeaderQueue.LEADER_QUEUE, id = LeaderQueue.LEADER_QUEUE, autoStartup = "false")
    public byte[] handleMessage(byte[] message) throws JsonProcessingException {
        Map<String, String> response;
        try {
            log.debug("Received message on leader queue: {}", message);
            boolean successful = receiveMessage(message);
            response = Map.of("status", successful ? "ok" : "error");
        } catch (Exception e) {
            log.error("Error processing message on leader queue: {}", e.getMessage(), e);
            response = Map.of("status", "error");
        }

        return smileObjectMapper.writeValueAsBytes(response);
    }
}
