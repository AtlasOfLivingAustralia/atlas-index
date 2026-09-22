/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.RestTestClientConfiguration;
import au.org.ala.search.model.dto.UserInfo;
import au.org.ala.search.service.SessionAuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Integration test for {@link AuthController}. {@link SessionAuthService} is mocked so the
 * test focuses on the controller's own logic: CORS origin gating for {@code /session}, redirect
 * path allow-listing for {@code /login} and {@code /logout}, and the already-logged-in
 * short-circuit and state-validation branches of {@code /callback}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(RestTestClientConfiguration.class)
public class AuthControllerIntegrationTest extends AbstractIntegrationTestContainers {

    @MockitoBean
    private SessionAuthService sessionAuthService;

    @Autowired
    private RestTestClient restTestClient;

    @BeforeEach
    void resetMocks() {
        reset(sessionAuthService);
    }

    @Test
    void session_disallowedOrigin_returnsForbidden() {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.add("Origin", "https://not-allowed.example.com");

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/session")
                .headers(h -> h.addAll(headers))
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void session_missingOrigin_returnsForbidden() {
        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/session")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void session_allowedOriginNoExistingSession_returnsNotAuthenticated() {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.add("Origin", "http://localhost:5173");

        EntityExchangeResult<UserInfo> resp = restTestClient.get()
                .uri("/session")
                .headers(h -> h.addAll(headers))
                .exchange()
                .expectBody(UserInfo.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getResponseBody().isAuthenticated()).isFalse();
    }

    @Test
    void login_disallowedPath_returnsBadRequest() {
        when(sessionAuthService.isAllowedRedirectOnly(anyString())).thenReturn(false);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/login?path=https://other.example.com")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void login_allowedPath_redirectsToGeneratedLoginUrl() throws Exception {
        when(sessionAuthService.isAllowedRedirectOnly(anyString())).thenReturn(true);
        when(sessionAuthService.getSecret(any())).thenReturn(null);
        when(sessionAuthService.getLoginPath(any(), any(), anyString(), any(), anyString()))
                .thenReturn("https://idp.example.com/authorize?state=abc");

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/login?path=/some/return/path")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getResponseHeaders().getFirst("Location")).isEqualTo("https://idp.example.com/authorize?state=abc");
    }

    @Test
    void login_serviceReturnsNull_returnsInternalServerError() throws Exception {
        when(sessionAuthService.isAllowedRedirectOnly(anyString())).thenReturn(true);
        when(sessionAuthService.getSecret(any())).thenReturn(null);
        when(sessionAuthService.getLoginPath(any(), any(), anyString(), any(), anyString())).thenReturn(null);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/login?path=/some/return/path")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Test
    void callback_alreadyLoggedIn_redirectsToDecodedReturnPath() {
        String returnPath = "/already/logged/in";
        String state = Base64.getUrlEncoder().encodeToString(returnPath.getBytes(StandardCharsets.UTF_8));

        when(sessionAuthService.getSecret(any())).thenReturn("existing-secret");
        when(sessionAuthService.isSessionLoggedIn(any(), any(), anyString(), anyString())).thenReturn(true);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/callback?code=abc&state=" + state)
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getResponseHeaders().getFirst("Location")).isEqualTo(returnPath);
    }

    @Test
    void callback_invalidState_returnsBadRequest() throws Exception {
        when(sessionAuthService.getSecret(any())).thenReturn(null);
        when(sessionAuthService.generateAndSetSecret(any(), anyString())).thenReturn("new-secret");
        when(sessionAuthService.validateStateAndGetReturnPath(any(), any(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(null);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/callback?code=abc&state=invalid-state")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void callback_validState_redirectsToReturnPath() throws Exception {
        when(sessionAuthService.getSecret(any())).thenReturn(null);
        when(sessionAuthService.generateAndSetSecret(any(), anyString())).thenReturn("new-secret");
        when(sessionAuthService.validateStateAndGetReturnPath(any(), any(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn("/return/path");

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/callback?code=abc&state=some-state")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getResponseHeaders().getFirst("Location")).isEqualTo("/return/path");
    }

    @Test
    void logout_disallowedPath_returnsBadRequest() {
        when(sessionAuthService.isAllowedRedirectOnly(anyString())).thenReturn(false);

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/logout?path=https://other.example.com")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void logout_allowedPath_redirectsToLogoutPath() {
        when(sessionAuthService.isAllowedRedirectOnly(anyString())).thenReturn(true);
        when(sessionAuthService.logoutPath(anyString(), any(), any(), any())).thenReturn("https://idp.example.com/logout");

        EntityExchangeResult<String> resp = restTestClient.get()
                .uri("/logout?path=/home")
                .exchange()
                .expectBody(String.class)
                .returnResult();

        assertThat(resp.getStatus()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getResponseHeaders().getFirst("Location")).isEqualTo("https://idp.example.com/logout");
    }
}
