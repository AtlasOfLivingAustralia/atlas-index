/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import org.apache.hc.client5.http.classic.HttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.env.Environment;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Supplies the {@link RestTestClient} used by the {@code @SpringBootTest(webEnvironment = RANDOM_PORT)}
 * integration tests. Spring Boot does not auto-configure a {@code RestTestClient} bound to a running
 * embedded server (unlike the now removed {@code TestRestTemplate}), so the bean is declared here.
 * <p>
 * The underlying HTTP client deliberately does <em>not</em> follow redirects and does not manage
 * cookies, matching the behaviour {@code TestRestTemplate} provided, so tests can assert on 3xx
 * responses and {@code Location} headers.
 * <p>
 * The bean is {@link Lazy} because {@code local.server.port} is only known once the embedded server
 * has started.
 */
@TestConfiguration(proxyBeanMethods = false)
public class RestTestClientConfiguration {

    @Bean
    @Lazy
    public RestTestClient restTestClient(Environment environment) {
        HttpClient httpClient = HttpClientBuilder.create()
                .disableRedirectHandling()
                .disableCookieManagement()
                .build();
        ClientHttpRequestFactory requestFactory = new HttpComponentsClientHttpRequestFactory(httpClient);

        return RestTestClient.bindToServer(requestFactory)
                .baseUrl("http://localhost:" + environment.getProperty("local.server.port"))
                .build();
    }
}

