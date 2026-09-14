/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.test;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Backing JUnit 5 extension for {@link SuppressExpectedLogging}. See that annotation's
 * javadoc for rationale/usage.
 */
public class SuppressExpectedLoggingExtension implements BeforeEachCallback, AfterEachCallback {

    private static final ExtensionContext.Namespace NAMESPACE =
            ExtensionContext.Namespace.create(SuppressExpectedLoggingExtension.class);
    private static final String STORE_KEY = "savedLevels";

    @Override
    public void beforeEach(ExtensionContext context) {
        SuppressExpectedLogging annotation = findAnnotation(context);
        if (annotation == null) {
            return;
        }

        Map<String, Level> savedLevels = new LinkedHashMap<>();
        for (String loggerName : annotation.value()) {
            Logger logger = (Logger) LoggerFactory.getLogger(loggerName);
            savedLevels.put(loggerName, logger.getLevel());
            logger.setLevel(Level.OFF);
        }
        context.getStore(NAMESPACE).put(STORE_KEY, savedLevels);
    }

    @Override
    @SuppressWarnings("unchecked")
    public void afterEach(ExtensionContext context) {
        Map<String, Level> savedLevels =
                (Map<String, Level>) context.getStore(NAMESPACE).get(STORE_KEY);
        if (savedLevels == null) {
            return;
        }
        savedLevels.forEach((loggerName, level) ->
                ((Logger) LoggerFactory.getLogger(loggerName)).setLevel(level));
    }

    /**
     * Method-level annotation takes precedence; falls back to a class-level annotation so the
     * whole test class can be covered when every method in it intentionally triggers the same
     * expected error logging (e.g. a dedicated "failure paths" test class).
     */
    private SuppressExpectedLogging findAnnotation(ExtensionContext context) {
        Optional<SuppressExpectedLogging> onMethod = context.getTestMethod()
                .map(m -> m.getAnnotation(SuppressExpectedLogging.class));
        if (onMethod.isPresent()) {
            return onMethod.get();
        }
        return context.getTestClass()
                .map(c -> c.getAnnotation(SuppressExpectedLogging.class))
                .orElse(null);
    }
}

