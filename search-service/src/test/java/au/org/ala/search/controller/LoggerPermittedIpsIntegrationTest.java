/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Dedicated integration test for the {@code logger.permitted.ips} allow/deny behaviour on
 * {@code POST /v1/service/logger} (test property: {@code logger.permitted.ips=127.0.0.1,
 * 0:0:0:0:0:0:0:1}).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LoggerPermittedIpsIntegrationTest extends AbstractIntegrationTestContainers {

    private static final Integer EVENT_TYPE_ID = 9301;
    private static final Integer REASON_TYPE_ID = 9301;
    private static final Integer SOURCE_TYPE_ID = 9301;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeAll
    static void seedLookupTypes(@Autowired JdbcTemplate jdbcTemplate) {
        jdbcTemplate.update("INSERT INTO log_event_type (id, name) VALUES (?, ?) ON CONFLICT DO NOTHING",
                EVENT_TYPE_ID, "PERMITTED_IPS_TEST_EVENT");
        jdbcTemplate.update("INSERT INTO log_reason_type (id, rkey, name, default_order, is_deprecated) " +
                        "VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
                REASON_TYPE_ID, "logger.permitted.ips.test.reason", "test reason", 9999, 0);
        jdbcTemplate.update("INSERT INTO log_source_type (id, name) VALUES (?, ?) ON CONFLICT DO NOTHING",
                SOURCE_TYPE_ID, "PERMITTED_IPS_TEST_SOURCE");
    }

    @Test
    void createLogEvent_noAuth_permittedIpViaXForwardedFor_returns200() {
        ResponseEntity<Map<String, Object>> response = postLogEvent("127.0.0.1");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void createLogEvent_noAuth_permittedIpv6ViaXForwardedFor_returns200() {
        ResponseEntity<Map<String, Object>> response = postLogEvent("0:0:0:0:0:0:0:1");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void createLogEvent_noAuth_nonPermittedIpViaXForwardedFor_returnsForbidden() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Forwarded-For", "203.0.113.42"); // TEST-NET-3, guaranteed non-permitted

        ResponseEntity<String> response = restTemplate.exchange(
                "/v1/service/logger", HttpMethod.POST,
                new HttpEntity<>(payload(), headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void createLogEvent_noAuth_noXForwardedForHeader_fallsBackToRemoteAddr_returns200() {
        // TestRestTemplate connects to the embedded server over loopback, so
        // request.getRemoteAddr() resolves to a permitted loopback address (127.0.0.1 or
        // 0:0:0:0:0:0:0:1) when no X-Forwarded-For header is present.
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/v1/service/logger", HttpMethod.POST,
                new HttpEntity<>(payload(), headers), new ParameterizedTypeReference<>() {
                });

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    private ResponseEntity<Map<String, Object>> postLogEvent(String forwardedForIp) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Forwarded-For", forwardedForIp);

        return restTemplate.exchange(
                "/v1/service/logger", HttpMethod.POST,
                new HttpEntity<>(payload(), headers), new ParameterizedTypeReference<>() {
                });
    }

    private Map<String, Object> payload() {
        return Map.of(
                "eventTypeId", EVENT_TYPE_ID,
                "reasonTypeId", REASON_TYPE_ID,
                "sourceTypeId", SOURCE_TYPE_ID,
                "userEmail", "user@example.com",
                "recordCounts", Map.of("dr100", 1));
    }
}
