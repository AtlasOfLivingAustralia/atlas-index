/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Reusable helper for adding {@code Cache-Control} response headers.
 *
 * <p>Cache durations are configured via properties following the convention:
 * <pre>
 *   http.cache.{name}.max-age=&lt;seconds&gt;
 * </pre>
 * For example:
 * <pre>
 *   http.cache.banner.max-age=900
 * </pre>
 *
 * <p>Usage in a controller:
 * <pre>
 *   return ResponseEntity.ok()
 *       .headers(httpCacheHeaders.forName("banner"))
 *       .body(payload);
 * </pre>
 */
@Component
public class HttpCacheHeaders {

    /** Resolved max-age values, keyed by cache name. Populated by @Value injection. */
    private final Map<String, Long> maxAgeByName = new ConcurrentHashMap<>();

    @Value("${http.cache.banner.max-age:900}")
    public void setBannerMaxAge(long seconds) {
        maxAgeByName.put("banner", seconds);
    }

    /**
     * Returns {@link HttpHeaders} containing a {@code Cache-Control: public, max-age=N}
     * directive for the named cache entry.
     *
     * <p>If no property has been registered for {@code name}, a default of
     * {@code no-store} is returned so that unconfigured endpoints are never
     * accidentally cached.
     *
     * @param name the cache name, matching the {@code http.cache.{name}.max-age} property key
     * @return populated {@link HttpHeaders}
     */
    public HttpHeaders forName(String name) {
        Long maxAge = maxAgeByName.get(name);
        CacheControl cc = (maxAge != null && maxAge > 0)
                ? CacheControl.maxAge(maxAge, TimeUnit.SECONDS).cachePublic()
                : CacheControl.noStore();
        HttpHeaders headers = new HttpHeaders();
        headers.setCacheControl(cc);
        return headers;
    }
}

