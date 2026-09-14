/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic unit tests for {@link HttpCacheHeaders}. No Spring context, no containers —
 * the component is instantiated directly and {@code @Value}-annotated setters are invoked
 * manually to simulate property injection.
 */
class HttpCacheHeadersTest {

    @Test
    void forName_configuredCacheName_returnsPublicMaxAgeHeader() {
        HttpCacheHeaders httpCacheHeaders = new HttpCacheHeaders();
        httpCacheHeaders.setBannerMaxAge(900);

        HttpHeaders headers = httpCacheHeaders.forName("banner");

        assertThat(headers.getCacheControl()).isEqualTo("max-age=900, public");
    }

    @Test
    void forName_unconfiguredCacheName_returnsNoStore() {
        HttpCacheHeaders httpCacheHeaders = new HttpCacheHeaders();
        httpCacheHeaders.setBannerMaxAge(900);

        HttpHeaders headers = httpCacheHeaders.forName("not-a-registered-name");

        assertThat(headers.getCacheControl()).isEqualTo("no-store");
    }

    @Test
    void forName_zeroMaxAge_returnsNoStore() {
        HttpCacheHeaders httpCacheHeaders = new HttpCacheHeaders();
        httpCacheHeaders.setBannerMaxAge(0);

        HttpHeaders headers = httpCacheHeaders.forName("banner");

        assertThat(headers.getCacheControl()).isEqualTo("no-store");
    }

    @Test
    void forName_negativeMaxAge_returnsNoStore() {
        HttpCacheHeaders httpCacheHeaders = new HttpCacheHeaders();
        httpCacheHeaders.setBannerMaxAge(-1);

        HttpHeaders headers = httpCacheHeaders.forName("banner");

        assertThat(headers.getCacheControl()).isEqualTo("no-store");
    }

    @Test
    void forName_positiveMaxAge_reflectsConfiguredSeconds() {
        HttpCacheHeaders httpCacheHeaders = new HttpCacheHeaders();
        httpCacheHeaders.setBannerMaxAge(60);

        HttpHeaders headers = httpCacheHeaders.forName("banner");

        assertThat(headers.getCacheControl()).contains("max-age=60");
    }

    @Test
    void forName_noConfigurationAtAll_returnsNoStore() {
        HttpCacheHeaders httpCacheHeaders = new HttpCacheHeaders();

        HttpHeaders headers = httpCacheHeaders.forName("banner");

        assertThat(headers.getCacheControl()).isEqualTo("no-store");
    }
}
