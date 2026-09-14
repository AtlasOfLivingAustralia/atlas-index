/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.config.ConfigChangeListener;
import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.remote.AuditService;
import au.org.ala.search.service.remote.ConfigService;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.annotation.DirtiesContext;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

/**
 * End-to-end integration tests for {@link ConfigService} and {@link AuditService} wiring through
 * {@link AdminController#configSet(ConfigData, java.security.Principal, jakarta.servlet.http.HttpServletRequest)}
 * / {@code /admin/audit} — proving real listener/validation/audit side effects, not mocked
 * collaborators.
 * <p>
 * Unlike {@code AdminControllerIntegrationTest} (which {@code @MockBean}s {@code ConfigService}
 * and {@code AuditService} to test controller-level branching only), this class leaves
 * {@link ConfigService}, {@link AuditService}, and {@code SchedulerService} as real, Spring-wired
 * beans — only {@link AuthService} is mocked (to force {@code isAdmin()==true} and stub
 * {@code getActor(...)}).
 * <p>
 * <b>Config key strategy:</b> the real, already-registered
 * {@code schedule.LOGGER_UPDATE_SUMMARY_TABLES.enabled} {@code ConfigValidationListener}
 * (registered by {@code SchedulerService.initSchedules()} at startup against every schedulable
 * {@code TaskType}) is used only for the validation-wiring tests, since it's the one real
 * production validator available to exercise without further wiring. All other tests (change
 * listener firing, audit recording, no-op-on-unchanged-value) use a fresh, randomly-generated
 * config key per test method — {@link ConfigService} has no listener-deregistration API, so a
 * {@link ConfigChangeListener} registered via {@link ConfigService#registerListener} on a shared
 * key would remain registered for the lifetime of the (class-scoped) Spring context and could
 * race with a later test method's save on the same key while this test's asynchronous broadcast
 * round trip is still in flight — using a unique key per test avoids any such cross-test
 * interference entirely.
 * <p>
 * {@code @DirtiesContext(AFTER_CLASS)} because this class registers extra
 * {@code ConfigChangeListener}s on the real, singleton {@code ConfigService} bean that should not
 * outlive this test class, and mutates the shared
 * {@code schedule.LOGGER_UPDATE_SUMMARY_TABLES.enabled} key (restored in {@code @AfterEach}).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class ConfigAuditIntegrationTest extends AbstractIntegrationTestContainers {

    private static final String SCHEDULER_CONFIG_KEY = "schedule.LOGGER_UPDATE_SUMMARY_TABLES.enabled";

    @MockBean
    private AuthService authService;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ConfigService configService;

    @Autowired
    private AuditService auditService;

    @BeforeEach
    void setUp() {
        reset(authService);
        when(authService.isAdmin(any())).thenReturn(true);
        when(authService.getActor(any(), any(), any())).thenReturn("test-actor");
    }

    @AfterEach
    void restoreSchedulerConfigValue() {
        // dynamic-config-defaults.properties seeds this key to "true" — restore it directly
        // (bypassing HTTP/audit/broadcast) so later tests in this class see a known starting value.
        ConfigData current = configService.get(SCHEDULER_CONFIG_KEY);
        if (current != null && !"true".equalsIgnoreCase(current.value)) {
            configService.save(ConfigData.builder().id(SCHEDULER_CONFIG_KEY).value("true").notes(current.notes).build());
        }
    }

    private ResponseEntity<String> postConfig(String key, String value) {
        ConfigData request = ConfigData.builder().id(key).value(value).notes("test").build();
        return restTemplate.exchange("/admin/config", HttpMethod.POST, new HttpEntity<>(request), String.class);
    }

    private List<ConfigData> getAllConfig() {
        ResponseEntity<List<ConfigData>> resp = restTemplate.exchange("/admin/config", HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ConfigData>>() {
                });
        return resp.getBody();
    }

    private String uniqueKey() {
        return "test.config.audit.integration." + UUID.randomUUID();
    }

    @Test
    void configSet_invalidBooleanValue_realValidationListenerRejects_returnsBadRequest() {
        // "schedule.LOGGER_UPDATE_SUMMARY_TABLES.enabled" has a real ConfigValidationListener
        // registered by SchedulerService.initSchedules() at application startup (isValidBoolean) —
        // this is NOT mocked, proving the registration/triggerValidation wiring works end-to-end.
        ResponseEntity<String> response = postConfig(SCHEDULER_CONFIG_KEY, "not-a-boolean");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("Config value is invalid");
    }

    @Test
    void configSet_validBooleanValue_realValidationListenerAccepts_persistsChange() {
        ResponseEntity<String> response = postConfig(SCHEDULER_CONFIG_KEY, "false");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        List<ConfigData> all = getAllConfig();
        assertThat(all).anySatisfy(cd -> {
            assertThat(cd.id).isEqualTo(SCHEDULER_CONFIG_KEY);
            assertThat(cd.value).isEqualTo("false");
        });
    }

    @Test
    void configSet_sameValueAsCurrent_isNoOpAndDoesNotRecordAudit() {
        String key = uniqueKey();
        configService.save(ConfigData.builder().id(key).value("initial").notes("baseline").build());
        long auditCountBefore = auditService.search(AuditService.TABLE_CONFIG, key, null, null, null, 0, 200)
                .getTotalElements();

        // POSTing the identical value should be a no-op per ConfigService.save (early return),
        // so no new audit entry should be recorded.
        ResponseEntity<String> response = postConfig(key, "initial");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        long auditCountAfter = auditService.search(AuditService.TABLE_CONFIG, key, null, null, null, 0, 200)
                .getTotalElements();
        assertThat(auditCountAfter).isEqualTo(auditCountBefore);
    }

    @Test
    void configSet_changedValue_realChangeListenerFiresViaBroadcastRoundTrip() {
        // Fresh, never-touched-elsewhere key so this test's registered listener cannot race with
        // any other test method's save on the same key (ConfigService has no way to deregister).
        String key = uniqueKey();
        configService.save(ConfigData.builder().id(key).value("initial").notes("baseline").build());

        AtomicReference<ConfigData> observedNewValue = new AtomicReference<>();
        AtomicReference<ConfigData> observedPrevValue = new AtomicReference<>();
        ConfigChangeListener testListener = (newValue, prevValue) -> {
            observedNewValue.set(newValue);
            observedPrevValue.set(prevValue);
        };
        configService.registerListener(key, testListener, null);

        ResponseEntity<String> response = postConfig(key, "changed");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        // ConfigService.save() only broadcasts (real RabbitMQ, since rabbitmq.host is set) —
        // triggerListeners() is invoked asynchronously when this instance's own broadcast
        // listener consumes the message it just published, so poll rather than asserting inline.
        Awaitility.await().atMost(10, TimeUnit.SECONDS)
                .untilAsserted(() -> assertThat(observedNewValue.get()).isNotNull());

        assertThat(observedNewValue.get().value).isEqualTo("changed");
        assertThat(observedPrevValue.get()).isNotNull();
        assertThat(observedPrevValue.get().value).isEqualTo("initial");
    }

    @Test
    void configSet_changedValue_recordsRealAuditEntry_visibleViaAuditHistoryEndpoint() {
        String key = uniqueKey();
        configService.save(ConfigData.builder().id(key).value("before").notes("baseline").build());

        ResponseEntity<String> response = postConfig(key, "after");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<Map<String, Object>> auditResponse = restTemplate.exchange(
                "/admin/audit?entityTable=config&entityId=" + key,
                HttpMethod.GET, null, new ParameterizedTypeReference<Map<String, Object>>() {
                });

        assertThat(auditResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        List<Map<String, Object>> content = (List<Map<String, Object>>) auditResponse.getBody().get("content");
        assertThat(content).isNotEmpty();
        assertThat(content).anySatisfy(entry -> {
            assertThat(entry.get("entityTable")).isEqualTo("config");
            assertThat(entry.get("entityId")).isEqualTo(key);
            assertThat(entry.get("action")).isEqualTo("UPDATE");
            assertThat(entry.get("actor")).isEqualTo("test-actor");
            assertThat((String) entry.get("diff")).contains("before").contains("after");
        });
    }

    @Test
    void auditHistory_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ResponseEntity<String> response = restTemplate.exchange(
                "/admin/audit", HttpMethod.GET, null, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void configSet_notAdmin_returnsForbidden() {
        when(authService.isAdmin(any())).thenReturn(false);

        ResponseEntity<String> response = postConfig(uniqueKey(), "false");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
