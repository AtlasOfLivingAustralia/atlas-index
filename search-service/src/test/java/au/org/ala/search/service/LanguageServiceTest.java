/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.model.cache.LanguageInfo;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link LanguageService#getLanguageInfo(String)}. No Spring context, no
 * containers, no file I/O — the public {@code languageMapping} field is populated directly
 * with fixture data instead of going through {@code init()}.
 */
class LanguageServiceTest {

    private LanguageService serviceWithLanguages(Map<String, LanguageInfo> languages) {
        LanguageService service = new LanguageService();
        service.languageMapping = new ConcurrentHashMap<>(languages);
        return service;
    }

    @Test
    void getLanguageInfo_knownLanguageCode_returnsInfo() {
        LanguageInfo english = new LanguageInfo("English", "http://example.org/lang/en");
        LanguageService service = serviceWithLanguages(Map.of("en", english));

        assertThat(service.getLanguageInfo("en")).isSameAs(english);
    }

    @Test
    void getLanguageInfo_unknownLanguageCode_returnsNull() {
        LanguageService service = serviceWithLanguages(Map.of());

        assertThat(service.getLanguageInfo("xx")).isNull();
    }

    @Test
    void getLanguageInfo_caseSensitiveLookup() {
        LanguageInfo english = new LanguageInfo("English", "http://example.org/lang/en");
        LanguageService service = serviceWithLanguages(Map.of("en", english));

        assertThat(service.getLanguageInfo("EN")).isNull();
    }

    @Test
    void getLanguageInfo_nullLanguageCode_throwsNullPointerException() {
        // languageMapping is a ConcurrentHashMap, which rejects null keys/lookups
        LanguageInfo english = new LanguageInfo("English", "http://example.org/lang/en");
        LanguageService service = serviceWithLanguages(Map.of("en", english));

        assertThatThrownBy(() -> service.getLanguageInfo(null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void getLanguageInfo_emptyMapping_returnsNull() {
        LanguageService service = new LanguageService();
        service.languageMapping = new ConcurrentHashMap<>();

        assertThat(service.getLanguageInfo("en")).isNull();
    }
}
