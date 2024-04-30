package au.org.ala.search;

import au.org.ala.ws.security.client.AlaAuthClient;
import org.pac4j.core.config.Config;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AuthMachineJwtConfiguration {
    @Bean
    AuthMachineJwt authMachineJwt(Config config, AlaAuthClient alaAuthClient) {
        return new AuthMachineJwt(config, alaAuthClient);
    }
}
