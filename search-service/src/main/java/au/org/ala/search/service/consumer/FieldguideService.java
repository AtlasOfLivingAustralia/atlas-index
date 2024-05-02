package au.org.ala.search.service.consumer;

import au.org.ala.search.QueueService;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.LogService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.time.LocalDate;

@Service
public class FieldguideService {
    private static final Logger logger = LoggerFactory.getLogger(FieldguideService.class);
    private static final TaskType taskType = TaskType.FIELDGUIDE;

    protected final QueueService queueService;
    protected final LogService logService;
    protected final JavaMailSender emailSender;

    @Value("${images.url}")
    public String imagesUrl;

    @Value("${fieldguide.consumer.threads}")
    public Integer consumerThreads;

    public FieldguideService(LogService logService, QueueService queueService, JavaMailSender emailSender) {
        this.logService = logService;
        this.queueService = queueService;
        this.emailSender = emailSender;
    }

    @PostConstruct
    void init() {
        logger.info("fieldguide.consumer.threads: " + consumerThreads);
        if (consumerThreads > 0) {
            for (int i = 0; i < consumerThreads; i++) {
                new FieldguideConsumer().start();
            }
        }

        // TODO: add items to queue that might be here because of a restart interruption
    }

    // TODO: finish this
    void processItem(Object item) {
        // process item
        logger.info("Processing fieldguide update: " + item);

        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        resolver.setPrefix("/templates/");
        resolver.setSuffix(".html");

        var context = new Context();
        context.setVariable("name", "Bunny");
        context.setVariable("date", LocalDate.now().toString());

        var templateEngine = new TemplateEngine();
        templateEngine.setTemplateResolver(resolver);

        var result = templateEngine.process("pdf-test", context);
        System.out.println(result);

        // persist, in case of restart

        // stream to tmp PDF file:
        // - write document header, page header, footer
        // - elasticSearch query to get the preferred image, scientificName, commonName
        // - get image metadata (license, attribution, etc)
        // - get image
        // - get map
        // - write item

        // copy to final location, e.g. s3

        // register with DOI app (without DOI) - after integration with DOI app

        // send email
    }

    void sendEmail() {
        logger.info("sending email");
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("noreply@ala");
        message.setTo("test@ala");
        message.setSubject("fieldguide: etc");
        message.setText("content");
        emailSender.send(message);
    }

    class FieldguideConsumer extends Thread {
        @Override
        public void run() {
            while (true) {
                try {
                    // get next item from queue
                    Object item = queueService.next(taskType.name());

                    processItem(item);
                } catch (Exception e) {
                    logger.error("Error processing fieldguide update", e);
                }
            }
        }
    }
}
