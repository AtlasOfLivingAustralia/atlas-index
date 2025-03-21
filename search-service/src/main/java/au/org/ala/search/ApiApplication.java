/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.service.OpenapiService;
import au.org.ala.search.service.update.AllService;
import au.org.ala.search.util.RejectedExecutionHandlerImpl;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.web.firewall.StrictHttpFirewall;

import static org.apache.tomcat.util.buf.EncodedSolidusHandling.DECODE;

@Slf4j
@SpringBootApplication
@EnableAsync
@EnableCaching
@EnableScheduling
public class ApiApplication {
    private final AllService allService;
    private final LeadershipStatus leadershipStatus;

    public ApiApplication(AllService allService, LeadershipStatus leadershipStatus) {
        this.allService = allService;
        this.leadershipStatus = leadershipStatus;
    }

    public static void main(String[] args) {
        SpringApplication.run(ApiApplication.class, args);
    }

    @Scheduled(cron = "${task.all.cron}")
    public void runAllTasks() {
        if (leadershipStatus.isLeader()) {
            allService.run();
        }
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
        log.info("ThreadPoolTaskExecutor processExecutor set");
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
        log.info("ThreadPoolTaskExecutor blockingExecutor set");
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
        log.info("ThreadPoolTaskExecutor elasticSearchUpdate set");
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
