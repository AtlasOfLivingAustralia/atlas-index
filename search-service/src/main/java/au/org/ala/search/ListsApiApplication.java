package au.org.ala.search;

import au.org.ala.search.service.OpenapiService;
import au.org.ala.search.service.update.AllService;
import au.org.ala.search.util.RejectedExecutionHandlerImpl;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.OAuthFlow;
import io.swagger.v3.oas.models.security.OAuthFlows;
import io.swagger.v3.oas.models.security.Scopes;
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
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.PropertySource;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.security.web.firewall.StrictHttpFirewall;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.apache.tomcat.util.buf.EncodedSolidusHandling.DECODE;

@SpringBootApplication
@EnableAsync
@PropertySource(
        value = "file:///data/search-service/config/search-service-config.properties",
        ignoreResourceNotFound = true)
public class ListsApiApplication {

    private static final Logger logger = LoggerFactory.getLogger(ListsApiApplication.class);
    private final AllService allService;
    @Value("${task.schedule}")
    private String taskSchedule;
    @Value("${standalone}")
    private Boolean standalone;

    public ListsApiApplication(AllService allService) {
        this.allService = allService;
    }

    public static void main(String[] args) {
        SpringApplication.run(ListsApiApplication.class, args);
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

    @Value("${openapi.title}")
    private String openapiTitle;

    @Value("${openapi.description}")
    private String openapiDescription;

    @Value("${openapi.terms}")
    private String openapiTerms;

    @Value("${openapi.contact.name}")
    private String openapiContactName;

    @Value("${openapi.contact.email}")
    private String openapiContactEmail;

    @Value("${openapi.license.name}")
    private String openapiLicenseName;

    @Value("${openapi.license.url}")
    private String openapiLicenseUrl;

    @Value("${openapi.version}")
    private String openapiVersion;

    @Value("${openapi.servers}")
    private String openapiServers;

    // TODO: move this info, server and security openapi customization into openapiExampleService. Also rename to openapiService.
    @Bean
    public OpenApiCustomizer applyStandardOpenAPIModifications(OpenapiService openapiExampleService) {
        Info info = new Info()
                .title(openapiTitle)
                .description(openapiDescription)
                .termsOfService(openapiTerms)
                .contact(new Contact()
                        .name(openapiContactName)
                        .email(openapiContactEmail))
                .license(new License()
                        .name(openapiLicenseName)
                        .url(openapiLicenseUrl))
                .version(openapiVersion);

        return openApi -> {
            openApi.getComponents().addSecuritySchemes("jwt", new SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)
                    .bearerFormat("JWT")
                    .scheme("bearer"));

            openApi.info(info);
            openApi.servers(Arrays.stream(openapiServers.split(",")).map(s -> new io.swagger.v3.oas.models.servers.Server().url(s)).toList());
            List<String> pathsToUpdate = new ArrayList<>();
            openApi.getPaths().forEach((pathKey, path) -> path.readOperationsMap().forEach((opKey, op) -> {
                // inject path variables otherwise unsupported
                if (openapiExampleService.updatePaths(op)) {
                    pathsToUpdate.add(pathKey);
                }

                // replace default examples with real examples
                if (op.getRequestBody() != null && op.getRequestBody().getContent() != null) {
                    op.getRequestBody().getContent().forEach((cKey, c) -> c.setExample(openapiExampleService.updateExample(op.getOperationId(), c.getExample())));
                }
            }));

            // convert /** paths to /{id} for openapi
            pathsToUpdate.forEach(path -> {
                PathItem pathItem = openApi.getPaths().remove(path);
                openApi.getPaths().addPathItem(path.replace("**", "{id}"), pathItem);
            });
        }

                ;
    }

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> tomcatCustomizer() {
        return factory -> factory.addConnectorCustomizers(connector -> connector.setEncodedSolidusHandling(DECODE.getValue()));
    }
}
