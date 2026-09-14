/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.url.SignedUrl;
import au.org.ala.search.model.url.UrlType;
import au.org.ala.search.repo.SignedUrlPostgresRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link SignedUrlService}'s pure/lightly-mocked expiry and URL-generation logic.
 * No Spring context, no containers — constructor dependencies are Mockito mocks, and the
 * {@code @Value}-annotated {@code baseUrl} field is set via reflection to simulate property
 * injection.
 */
class SignedUrlServiceTest {

    private final SignedUrlPostgresRepository signedUrlPostgresRepository = mock(SignedUrlPostgresRepository.class);
    private final DoiFileStoreService doiFileStoreService = mock(DoiFileStoreService.class);
    private final SignedUrlService signedUrlService = new SignedUrlService(signedUrlPostgresRepository, doiFileStoreService);

    private void setBaseUrl(String baseUrl) throws Exception {
        Field f = SignedUrlService.class.getDeclaredField("baseUrl");
        f.setAccessible(true);
        f.set(signedUrlService, baseUrl);
    }

    @Test
    void createUrl_buildsUrlFromBaseUrlAndGeneratedId() throws Exception {
        setBaseUrl("https://example.org");
        UUID generatedId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        when(signedUrlPostgresRepository.save(any())).thenAnswer(invocation -> {
            SignedUrl arg = invocation.getArgument(0);
            arg.setId(generatedId);
            return arg;
        });

        String url = signedUrlService.createUrl(UrlType.DOI_DOWNLOAD, 123456789L, new HashMap<>());

        assertThat(url).isEqualTo("https://example.org/v2/signed?id=" + generatedId);
    }

    @Test
    void createUrl_addsUrlTypeToDataBlob() throws Exception {
        setBaseUrl("https://example.org");
        Map<String, Object> data = new HashMap<>();
        when(signedUrlPostgresRepository.save(any())).thenAnswer(invocation -> {
            SignedUrl arg = invocation.getArgument(0);
            arg.setId(UUID.randomUUID());
            return arg;
        });

        signedUrlService.createUrl(UrlType.DOI_DOWNLOAD, 123456789L, data);

        assertThat(data).containsEntry("type", "DOI_DOWNLOAD");
    }

    @Test
    void createUrl_persistsExpiresAtAndBlob() throws Exception {
        setBaseUrl("https://example.org");
        Map<String, Object> data = new HashMap<>();
        data.put("uuid", "some-uuid");
        when(signedUrlPostgresRepository.save(any())).thenAnswer(invocation -> {
            SignedUrl arg = invocation.getArgument(0);
            assertThat(arg.getExpiresAt()).isEqualTo(123456789L);
            assertThat(arg.getBlob()).containsEntry("uuid", "some-uuid");
            arg.setId(UUID.randomUUID());
            return arg;
        });

        signedUrlService.createUrl(UrlType.DOI_DOWNLOAD, 123456789L, data);
    }

    @Test
    void getSignedUrl_unknownId_returnsNotFound() {
        UUID id = UUID.randomUUID();
        when(signedUrlPostgresRepository.findByIdNative(id)).thenReturn(null);

        ResponseEntity<?> response = signedUrlService.getSignedUrl(id);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getSignedUrl_expired_returnsNotFound() {
        UUID id = UUID.randomUUID();
        SignedUrl signedUrl = SignedUrl.builder()
                .id(id)
                .expiresAt(System.currentTimeMillis() - 10_000) // expired 10 seconds ago
                .blob(Map.of("type", "DOI_DOWNLOAD"))
                .build();
        when(signedUrlPostgresRepository.findByIdNative(id)).thenReturn(signedUrl);

        ResponseEntity<?> response = signedUrlService.getSignedUrl(id);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getSignedUrl_unsupportedBlobType_returnsInternalServerError() {
        UUID id = UUID.randomUUID();
        SignedUrl signedUrl = SignedUrl.builder()
                .id(id)
                .expiresAt(System.currentTimeMillis() + 60_000) // valid for another minute
                .blob(Map.of("type", "SOME_UNSUPPORTED_TYPE"))
                .build();
        when(signedUrlPostgresRepository.findByIdNative(id)).thenReturn(signedUrl);

        ResponseEntity<?> response = signedUrlService.getSignedUrl(id);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Test
    void getSignedUrl_doiDownloadButFileMissing_returnsNotFound() {
        UUID id = UUID.randomUUID();
        SignedUrl signedUrl = SignedUrl.builder()
                .id(id)
                .expiresAt(System.currentTimeMillis() + 60_000)
                .blob(Map.of("type", "DOI_DOWNLOAD", "uuid", UUID.randomUUID().toString(), "filename", "test.pdf"))
                .build();
        when(signedUrlPostgresRepository.findByIdNative(id)).thenReturn(signedUrl);
        when(doiFileStoreService.getFilePath(any())).thenReturn("/tmp/does-not-exist-" + UUID.randomUUID() + ".pdf");

        ResponseEntity<?> response = signedUrlService.getSignedUrl(id);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
