package au.org.ala.search;

import au.org.ala.ws.security.AlaWebServiceAuthFilter;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;

@Configuration
@EnableWebSecurity
@ComponentScan(basePackages = {"au.org.ala.ws.security"})
@EnableMethodSecurity
@EnableCaching
@Order(1)
public class SecurityConfig {

    protected final AlaWebServiceAuthFilter alaWebServiceAuthFilter;

    public SecurityConfig(AlaWebServiceAuthFilter alaWebServiceAuthFilter) {
        this.alaWebServiceAuthFilter = alaWebServiceAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http.addFilterBefore(alaWebServiceAuthFilter, BasicAuthenticationFilter.class);
        http.authorizeHttpRequests(a -> a.requestMatchers("/**").permitAll());
        return http.csrf(AbstractHttpConfigurer::disable).build();
    }
}
