package au.org.ala.search;

import au.org.ala.search.service.OpenapiService;
import au.org.ala.search.service.update.AllService;
import au.org.ala.search.util.RejectedExecutionHandlerImpl;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.security.web.firewall.StrictHttpFirewall;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.apache.tomcat.util.buf.EncodedSolidusHandling.DECODE;

@SpringBootApplication
@EnableAsync
@EnableCaching
@EnableScheduling
public class ApiApplication {

    private static final Logger logger = LoggerFactory.getLogger(ApiApplication.class);
    private final AllService allService;
    @Value("${task.all.cron}")
    private String taskSchedule;
    @Value("${standalone}")
    private Boolean standalone;

    public ApiApplication(AllService allService) {
        this.allService = allService;
    }

    public static void main(String[] args) {
        SpringApplication.run(ApiApplication.class, args);
    }

    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();
        taskScheduler.initialize();

        if (StringUtils.isNotEmpty(taskSchedule)) {
            taskScheduler.schedule(() -> {
                // TODO: k8 leader or this.standalone detection
                if (standalone) {
                    allService.run();
                }
            }, new CronTrigger(taskSchedule));
        }

        return taskScheduler;
    }

    // modify firewall for path variables that need to be supported by legacy services
    @Bean
    public StrictHttpFirewall httpFirewall() {
        StrictHttpFirewall firewall = new StrictHttpFirewall();
        firewall.setAllowUrlEncodedDoubleSlash(true);
        firewall.setAllowUrlEncodedSlash(true);
        return firewall;
    }

    @Bean(name = "processExecutor")
    public TaskExecutor workExecutor() {
        ThreadPoolTaskExecutor threadPoolTaskExecutor = new ThreadPoolTaskExecutor();
        threadPoolTaskExecutor.setThreadNamePrefix("Async-work-");
        threadPoolTaskExecutor.setCorePoolSize(5); // size set to 5 to match DwcAImportService (1xDwCAImportService + 4xDwCAImportRunner-perArchiveDir)
        threadPoolTaskExecutor.setMaxPoolSize(5);
        threadPoolTaskExecutor.setQueueCapacity(100);
        threadPoolTaskExecutor.afterPropertiesSet();
        logger.info("ThreadPoolTaskExecutor processExecutor set");
        return threadPoolTaskExecutor;
    }

    @Bean(name = "blockingExecutor")
    public TaskExecutor blockingExecutor() {
        ThreadPoolTaskExecutor threadPoolTaskExecutor = new ThreadPoolTaskExecutor();
        threadPoolTaskExecutor.setThreadNamePrefix("Async-block-");
        threadPoolTaskExecutor.setCorePoolSize(4);
        threadPoolTaskExecutor.setMaxPoolSize(4);
        threadPoolTaskExecutor.setQueueCapacity(8);
        threadPoolTaskExecutor.afterPropertiesSet();
        threadPoolTaskExecutor.setRejectedExecutionHandler(
                new RejectedExecutionHandlerImpl()); // enable blocking
        logger.info("ThreadPoolTaskExecutor blockingExecutor set");
        return threadPoolTaskExecutor;
    }

    @Bean(name = "elasticSearchUpdate")
    public TaskExecutor elasticSearchUpdate() {
        ThreadPoolTaskExecutor threadPoolTaskExecutor = new ThreadPoolTaskExecutor();
        threadPoolTaskExecutor.setThreadNamePrefix("Async-update-");
        threadPoolTaskExecutor.setCorePoolSize(2);
        threadPoolTaskExecutor.setMaxPoolSize(2);
        threadPoolTaskExecutor.setQueueCapacity(8);
        threadPoolTaskExecutor.afterPropertiesSet();
        threadPoolTaskExecutor.setRejectedExecutionHandler(
                new RejectedExecutionHandlerImpl()); // enable blocking
        logger.info("ThreadPoolTaskExecutor elasticSearchUpdate set");
        return threadPoolTaskExecutor;
    }

    @Bean
    public OpenApiCustomizer applyStandardOpenAPIModifications(OpenapiService openapiService) {
        return openapiService::updateTags;
    }

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> tomcatCustomizer() {
        return factory -> factory.addConnectorCustomizers(connector -> connector.setEncodedSolidusHandling(DECODE.getValue()));
    }
}
