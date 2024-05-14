package au.org.ala.search;

import org.jetbrains.annotations.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.client.ClientConfiguration;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class Config extends ElasticsearchConfiguration {

    @Value("${elastic.host}")
    private String elasticHost;

    @Value("${elastic.timeout}")
    private Long elsticTimeout;

    @NotNull
    @Override
    public ClientConfiguration clientConfiguration() {
        return ClientConfiguration.builder()
                .connectedTo(elasticHost)
                .withSocketTimeout(elsticTimeout)
                .build();
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
