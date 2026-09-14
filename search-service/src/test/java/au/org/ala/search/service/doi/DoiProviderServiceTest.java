/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.doi;

import au.org.ala.search.model.doi.MintRequest;
import au.org.ala.search.util.doi.ServiceResponse;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link DoiProviderService#generateLandingPageUrl(String, String)}. No Spring
 * context, no containers — a minimal anonymous subclass provides no-op implementations of the
 * abstract provider-specific methods (never invoked by this test), and the
 * {@code @Value}-annotated {@code doiBaseUrl} field is set via reflection to simulate property
 * injection.
 */
class DoiProviderServiceTest {

    private static class TestDoiProviderService extends DoiProviderService {
        @Override
        String generateRequestPayload(String uuid, MintRequest.ProviderMetadata metadata, String landingPageUrl, String doi, Boolean active) {
            throw new UnsupportedOperationException("not used in these tests");
        }

        @Override
        ServiceResponse invokeCreateService(Object requestPayload, String landingPageUrl) {
            throw new UnsupportedOperationException("not used in these tests");
        }

        @Override
        ServiceResponse invokeUpdateService(String doi, Object requestPayload, String landingPageUrl) {
            throw new UnsupportedOperationException("not used in these tests");
        }
    }

    private DoiProviderService serviceWithBaseUrl(String baseUrl) throws Exception {
        TestDoiProviderService service = new TestDoiProviderService();
        Field f = DoiProviderService.class.getDeclaredField("doiBaseUrl");
        f.setAccessible(true);
        f.set(service, baseUrl);
        return service;
    }

    @Test
    void generateLandingPageUrl_noCustomUrl_buildsFromBaseUrlAndUuid() throws Exception {
        DoiProviderService service = serviceWithBaseUrl("https://example.org");

        String url = service.generateLandingPageUrl("abc-123", null);

        assertThat(url).isEqualTo("https://example.org/doi/abc-123");
    }

    @Test
    void generateLandingPageUrl_blankCustomUrl_buildsFromBaseUrlAndUuid() throws Exception {
        DoiProviderService service = serviceWithBaseUrl("https://example.org");

        String url = service.generateLandingPageUrl("abc-123", "   ");

        assertThat(url).isEqualTo("https://example.org/doi/abc-123");
    }

    @Test
    void generateLandingPageUrl_customUrlProvided_returnsCustomUrlUnchanged() throws Exception {
        DoiProviderService service = serviceWithBaseUrl("https://example.org");

        String url = service.generateLandingPageUrl("abc-123", "https://custom.example.org/landing");

        assertThat(url).isEqualTo("https://custom.example.org/landing");
    }

    @Test
    void generateLandingPageUrl_nullUuid_throwsIllegalArgumentException() throws Exception {
        DoiProviderService service = serviceWithBaseUrl("https://example.org");

        assertThatThrownBy(() -> service.generateLandingPageUrl(null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("uuid must not be null or empty");
    }

    @Test
    void generateLandingPageUrl_emptyUuid_throwsIllegalArgumentException() throws Exception {
        DoiProviderService service = serviceWithBaseUrl("https://example.org");

        assertThatThrownBy(() -> service.generateLandingPageUrl("", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("uuid must not be null or empty");
    }
}
