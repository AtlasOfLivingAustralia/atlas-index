/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.util.AuthMachineJwt;
import au.org.ala.ws.security.AlaWebServiceAuthFilter;
import au.org.ala.ws.security.TokenClient;
import au.org.ala.ws.security.TokenInterceptor;
import au.org.ala.ws.security.TokenService;
import au.org.ala.ws.security.client.AlaAuthClient;
import org.pac4j.core.config.Config;
import org.pac4j.core.context.session.SessionStore;
import org.pac4j.oidc.config.OidcConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;

/**
 * Configuration required for ala-security library integration and other requirements
 */
@Configuration
@EnableWebSecurity
@ComponentScan(basePackages = {"au.org.ala.ws.security", "au.org.ala.security.common"})
@EnableMethodSecurity
@EnableCaching
@Order(1)
public class SecurityConfig {

    protected final AlaWebServiceAuthFilter alaWebServiceAuthFilter;

    @Value("${webservice.client-id}")
    String clientId;

    @Value("${webservice.client-secret}")
    String clientSecret;

    @Value("${webservice.jwt-scopes}")
    String jwtScopes;

    @Value("${webservices.cache-tokens:true}")
    boolean cacheTokens;

    public SecurityConfig(AlaWebServiceAuthFilter alaWebServiceAuthFilter) {
        this.alaWebServiceAuthFilter = alaWebServiceAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.addFilterBefore(alaWebServiceAuthFilter, BasicAuthenticationFilter.class);
        http.authorizeHttpRequests(a -> a.requestMatchers("/**").permitAll());

        // disable the default logout handling as it interferes with AuthController
        http.logout(logout -> logout.logoutUrl("/never-match").permitAll());

        // security headers
        http.headers(headers -> headers.frameOptions(HeadersConfigurer.FrameOptionsConfig::deny)).authorizeHttpRequests(authz -> authz.anyRequest().permitAll());

        return http.csrf(AbstractHttpConfigurer::disable).build();
    }

    @Bean
    AuthMachineJwt authMachineJwt(Config config, AlaAuthClient alaAuthClient) {
        return new AuthMachineJwt(config, alaAuthClient);
    }


    @Bean
    TokenClient tokenClient(@Autowired(required = false) OidcConfiguration oidcConfiguration) {
        return new TokenClient(oidcConfiguration);
    }

    @Bean
    TokenService tokenService(
            @Autowired(required = false) OidcConfiguration oidcConfiguration,
            @Autowired(required = false) SessionStore sessionStore,
            @Autowired TokenClient tokenClient) {
        // note not injecting PAC4j Config here due to potential circular dependency
        return new TokenService(oidcConfiguration, sessionStore, tokenClient, clientId, clientSecret, jwtScopes, cacheTokens);
    }


    /**
     * OK HTTP Interceptor that injects a client credentials Bearer token into a request
     */
    @ConditionalOnProperty(prefix = "webservice", name = "jwt")
    @ConditionalOnMissingBean(name = "jwtInterceptor")
    @Bean
    TokenInterceptor jwtInterceptor(@Autowired TokenService tokenService) {
        return new TokenInterceptor(tokenService);
    }
}
