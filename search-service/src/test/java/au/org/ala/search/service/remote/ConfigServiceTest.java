/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.config.ConfigChangeListener;
import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.model.config.ConfigValidationListener;
import au.org.ala.search.repo.ConfigDataPostgresRepository;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ResourceLoader;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Unit tests for {@link ConfigService#triggerListeners} and the private
 * {@code triggerValidation} helper. No Spring context, no containers — constructor
 * dependencies are Mockito mocks that are never invoked ({@code @PostConstruct init()} only
 * runs under a real Spring container), listeners are registered via
 * {@link ConfigService#registerListener}, and the private validation method is exercised via
 * reflection.
 */
class ConfigServiceTest {

    private final ConfigService configService = new ConfigService(
            mock(ConfigDataPostgresRepository.class), mock(ResourceLoader.class), new AuditService(null));

    private ConfigData configData(String id, String value) {
        ConfigData cd = new ConfigData();
        cd.id = id;
        cd.value = value;
        return cd;
    }

    private boolean triggerValidation(ConfigData configData) throws Exception {
        Method m = ConfigService.class.getDeclaredMethod("triggerValidation", ConfigData.class);
        m.setAccessible(true);
        return (boolean) m.invoke(configService, configData);
    }

    @Test
    void triggerListeners_noListenersRegistered_doesNothing() {
        ConfigData current = configData("my.key", "new-value");
        ConfigData prev = configData("my.key", "old-value");

        // should not throw even though no listener is registered for this key
        configService.triggerListeners(current, prev);
    }

    @Test
    void triggerListeners_registeredListener_isInvokedWithBothValues() {
        List<ConfigData> received = new ArrayList<>();
        ConfigChangeListener listener = (configData, prevConfigData) -> {
            received.add(configData);
            received.add(prevConfigData);
        };
        configService.registerListener("my.key", listener, null);

        ConfigData current = configData("my.key", "new-value");
        ConfigData prev = configData("my.key", "old-value");
        configService.triggerListeners(current, prev);

        assertThat(received).containsExactly(current, prev);
    }

    @Test
    void triggerListeners_multipleListenersForSameKey_allInvoked() {
        List<String> invoked = new ArrayList<>();
        configService.registerListener("my.key", (c, p) -> invoked.add("listener1"), null);
        configService.registerListener("my.key", (c, p) -> invoked.add("listener2"), null);

        configService.triggerListeners(configData("my.key", "v"), null);

        assertThat(invoked).containsExactlyInAnyOrder("listener1", "listener2");
    }

    @Test
    void triggerListeners_listenerRegisteredForDifferentKey_notInvoked() {
        List<String> invoked = new ArrayList<>();
        configService.registerListener("other.key", (c, p) -> invoked.add("should-not-run"), null);

        configService.triggerListeners(configData("my.key", "v"), null);

        assertThat(invoked).isEmpty();
    }

    @Test
    void registerListener_nullListenerAndValidation_doesNotThrow() {
        // registerListener guards against null listener/validation internally
        configService.registerListener("my.key", null, null);

        configService.triggerListeners(configData("my.key", "v"), null);
    }

    @Test
    void triggerValidation_noValidatorsRegistered_returnsTrue() throws Exception {
        assertThat(triggerValidation(configData("my.key", "any-value"))).isTrue();
    }

    @Test
    void triggerValidation_validatorAccepts_returnsTrue() throws Exception {
        configService.registerListener("my.key", null, value -> value.length() > 2);

        assertThat(triggerValidation(configData("my.key", "abc"))).isTrue();
    }

    @Test
    void triggerValidation_validatorRejects_returnsFalse() throws Exception {
        configService.registerListener("my.key", null, value -> value.length() > 2);

        assertThat(triggerValidation(configData("my.key", "a"))).isFalse();
    }

    @Test
    void triggerValidation_anyValidatorRejects_shortCircuitsToFalse() throws Exception {
        configService.registerListener("my.key", null, (ConfigValidationListener) value -> true);
        configService.registerListener("my.key", null, (ConfigValidationListener) value -> false);

        assertThat(triggerValidation(configData("my.key", "value"))).isFalse();
    }

    @Test
    void triggerValidation_differentKeyValidator_notApplied() throws Exception {
        configService.registerListener("other.key", null, value -> false);

        assertThat(triggerValidation(configData("my.key", "any-value"))).isTrue();
    }

    @Test
    void broadcastConfigChange_transactionActive_registersSynchronization() throws Exception {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            Method m = ConfigService.class.getDeclaredMethod("broadcastConfigChange", String.class, ConfigData.class);
            m.setAccessible(true);
            m.invoke(configService, "test.key", null);

            List<TransactionSynchronization> synchronizations = TransactionSynchronizationManager.getSynchronizations();
            assertThat(synchronizations).hasSize(1);

            // trigger afterCommit to verify it completes cleanly without exception
            synchronizations.get(0).afterCommit();
        } finally {
            TransactionSynchronizationManager.clear();
        }
    }

    @Test
    void broadcastConfigChange_noTransactionActive_executesImmediatelyWithoutRegistration() throws Exception {
        Method m = ConfigService.class.getDeclaredMethod("broadcastConfigChange", String.class, ConfigData.class);
        m.setAccessible(true);
        m.invoke(configService, "test.key", null);

        assertThat(TransactionSynchronizationManager.isSynchronizationActive()).isFalse();
    }
}
