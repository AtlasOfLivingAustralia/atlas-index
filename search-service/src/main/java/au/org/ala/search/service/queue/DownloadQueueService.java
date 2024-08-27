package au.org.ala.search.service.queue;

import au.org.ala.search.MessageQueueConfig;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.QueueRequest;
import org.apache.commons.lang3.StringUtils;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import au.org.ala.search.service.remote.ElasticService;

import javax.lang.model.element.ModuleElement;


@Component
public class DownloadQueueService {
    public final static String QUEUE_NAME = MessageQueueConfig.QUEUE_NAME;
    public final static String EXCHANGE_NAME = MessageQueueConfig.EXCHANGE_NAME;
    public final static String ROUTING_KEY = MessageQueueConfig.ROUTING_KEY;
    private static final Logger logger = LoggerFactory.getLogger(DownloadQueueService.class);
    private final RabbitTemplate rabbitTemplate;
    private final Queue queue;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    public DownloadQueueService(RabbitTemplate rabbitTemplate, Queue queue) {
        this.rabbitTemplate = rabbitTemplate;
        this.queue = queue;
    }

//    public void request(String userId, QueueRequest queueRequest) {
//        rabbitTemplate.convertAndSend("", "routingKey", queueRequest);
//    }
//
    public void request(String userId, String email,  String sourceUrl, String taskType) {
        QueueRequest queueRequest = QueueRequest.builder()
                .email(email)
                .sourceUrl(sourceUrl)
                .taskType(TaskType.valueOf(taskType.toUpperCase()))
                .build();

        String messageId = UUID.randomUUID().toString();

        // Setting the message ID and other properties
        MessagePostProcessor messagePostProcessor = message -> {
            message.getMessageProperties().setMessageId(messageId);
            return message;
        };

        rabbitTemplate.convertAndSend(EXCHANGE_NAME, ROUTING_KEY, queueRequest, messagePostProcessor);
    }

    @RabbitListener(queues = QUEUE_NAME)
    public void processDownload( QueueRequest queueRequest, Message message) {
        //todo update db with status: processing
        try {
            //Retrieve messge id

            MessageProperties messageProperties = message.getMessageProperties();
            String messageId = messageProperties.getMessageId();

            logger.info("Received downloading request from " + queueRequest.getEmail());
            //Cannot direct convert with unknown reasons
            //SearchQueueRequest request = (SearchQueueRequest) queueRequest;

            //todo workout what params are acceptable
            String[] qs = collectQ(queueRequest.getSourceUrl());
            String q = qs[0];
            String[] fqs = qs.length > 1 ? Arrays.copyOfRange(qs, 1, qs.length) : null;

            String[] fields = new String[]{"guid", "name"};
            //download(q, fqs, fields);
        } catch(Exception e) {
            logger.error("Error processing download request", e);
        } finally {
            //todo update db with status: completed
        }
    }

    /**
     * todo fix invalid query issue
     *
     * @param q
     * @param fqs
     * @param fields
     * @return
     */
    private String download(String q, String[] fqs, String[] fields) {
        String csvFilename = "searchResult.csv";
        String zippedFilename = "searchResult";
        try {
            File tmpFile = File.createTempFile("searchResult", ".json");
            File zippedFile = File.createTempFile(zippedFilename, ".zip");

            try (FileOutputStream fos = new FileOutputStream(zippedFile)) {
                ZipOutputStream zos = new ZipOutputStream(fos);

                ZipEntry ze = new ZipEntry(csvFilename);
                zos.putNextEntry(ze);

                tmpFile = elasticService.download(q, fqs, StringUtils.join(fields, ","));
                StreamUtils.copy(new FileInputStream(tmpFile), zos);

                zos.closeEntry();
                zos.close();
            } catch (Exception e) {
                logger.error("search download: ", e);
            } finally {
                if (tmpFile != null) {
                    tmpFile.delete();
                }
            }
            return zippedFile.getAbsolutePath();
        } catch (Exception e) {
            logger.error("search download: ", e);
        }
        return null;
    }

    private String[] collectQ(String url){
        try {
            URI uri = new URI(url);
            String query = uri.getQuery();

            Map<String, List<String>> queryParams = Stream.of(query.split("&"))
                    .map(pair -> pair.split("="))
                    .collect(Collectors.groupingBy(
                            keyValue -> URLDecoder.decode(keyValue[0], StandardCharsets.UTF_8),
                            Collectors.mapping(keyValue -> URLDecoder.decode(keyValue[1], StandardCharsets.UTF_8),
                                    Collectors.toList())));
            List<String> qValues = queryParams.getOrDefault("q", new ArrayList<>());
            return qValues.toArray(new String[0]);
        } catch (Exception e) {
            logger.error("Error parsing URL", e);
            return new String[0];
        }
    }

}
