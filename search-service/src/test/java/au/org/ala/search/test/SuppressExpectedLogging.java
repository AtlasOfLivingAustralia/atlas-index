/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.test;

import org.junit.jupiter.api.extension.ExtendWith;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a test method (or an entire test class) as one that deliberately triggers a
 * production {@code log.error(...)}/{@code log.warn(...)} call as part of exercising a
 * negative-path/resilience code path (e.g. "upstream service returns an error, verify we
 * degrade gracefully"). Since the resulting log line is an <b>expected</b> outcome of the
 * test passing — not a real failure — it otherwise clutters {@code mvn test} console output
 * with a misleading-looking ERROR line/stack trace.
 * <p>
 * Applying this annotation raises the named logger(s) to {@code OFF} only for the duration of
 * the annotated test method (or, if applied at the class level, for every test method in that
 * class), then restores each logger's previous level immediately afterwards - so any other
 * test exercising the same production class is unaffected and will still surface unexpected
 * errors normally.
 * <p>
 * Prefer this over a blanket {@code logging.level.*=OFF} entry in
 * {@code src/test/resources/application.properties}: a global override silences the logger for
 * <i>every</i> test in the suite, including future tests that might trigger a genuine bug in
 * that same class. Annotating only the specific test method(s) that are known to intentionally
 * trigger the log keeps everything else visible.
 * <p>
 * Example:
 * <pre>{@code
 * @Test
 * @SuppressExpectedLogging("au.org.ala.search.service.SessionAuthService")
 * void exchangeCodeForToken_upstreamError_returnsNull() {
 *     ...
 * }
 * }</pre>
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
@ExtendWith(SuppressExpectedLoggingExtension.class)
public @interface SuppressExpectedLogging {

    /**
     * Fully-qualified logger name(s) (typically the owning class's name, matching what
     * {@code @Slf4j} generates) to suppress for the duration of the annotated test.
     */
    String[] value();
}

