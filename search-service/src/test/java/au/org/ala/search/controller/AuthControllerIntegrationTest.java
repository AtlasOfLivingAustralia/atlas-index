/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.dto.UserInfo;
import au.org.ala.search.service.SessionAuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

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
public class AuthControllerIntegrationTest extends AbstractIntegrationTestContainers {

    @MockBean
    private SessionAuthService sessionAuthService;

    @Autowired
    private TestRestTemplate restTemplate;

    @BeforeEach
    void resetMocks() {
        reset(sessionAuthService);
    }

    @Test
    void session_disallowedOrigin_returnsForbidden() {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.add("Origin", "https://not-allowed.example.com");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/session", HttpMethod.GET, new org.springframework.http.HttpEntity<>(headers), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void session_missingOrigin_returnsForbidden() {
        ResponseEntity<String> resp = restTemplate.exchange(
                "/session", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void session_allowedOriginNoExistingSession_returnsNotAuthenticated() {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.add("Origin", "http://localhost:5173");

        ResponseEntity<UserInfo> resp = restTemplate.exchange(
                "/session", HttpMethod.GET, new org.springframework.http.HttpEntity<>(headers), UserInfo.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().isAuthenticated()).isFalse();
    }

    @Test
    void login_disallowedPath_returnsBadRequest() {
        when(sessionAuthService.isAllowedRedirectOnly(anyString())).thenReturn(false);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/login?path=https://other.example.com", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void login_allowedPath_redirectsToGeneratedLoginUrl() throws Exception {
        when(sessionAuthService.isAllowedRedirectOnly(anyString())).thenReturn(true);
        when(sessionAuthService.getSecret(any())).thenReturn(null);
        when(sessionAuthService.getLoginPath(any(), any(), anyString(), any(), anyString()))
                .thenReturn("https://idp.example.com/authorize?state=abc");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/login?path=/some/return/path", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getHeaders().getFirst("Location")).isEqualTo("https://idp.example.com/authorize?state=abc");
    }

    @Test
    void login_serviceReturnsNull_returnsInternalServerError() throws Exception {
        when(sessionAuthService.isAllowedRedirectOnly(anyString())).thenReturn(true);
        when(sessionAuthService.getSecret(any())).thenReturn(null);
        when(sessionAuthService.getLoginPath(any(), any(), anyString(), any(), anyString())).thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/login?path=/some/return/path", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Test
    void callback_alreadyLoggedIn_redirectsToDecodedReturnPath() {
        String returnPath = "/already/logged/in";
        String state = Base64.getUrlEncoder().encodeToString(returnPath.getBytes(StandardCharsets.UTF_8));

        when(sessionAuthService.getSecret(any())).thenReturn("existing-secret");
        when(sessionAuthService.isSessionLoggedIn(any(), any(), anyString(), anyString())).thenReturn(true);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/callback?code=abc&state=" + state, HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getHeaders().getFirst("Location")).isEqualTo(returnPath);
    }

    @Test
    void callback_invalidState_returnsBadRequest() throws Exception {
        when(sessionAuthService.getSecret(any())).thenReturn(null);
        when(sessionAuthService.generateAndSetSecret(any(), anyString())).thenReturn("new-secret");
        when(sessionAuthService.validateStateAndGetReturnPath(any(), any(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(null);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/callback?code=abc&state=invalid-state", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void callback_validState_redirectsToReturnPath() throws Exception {
        when(sessionAuthService.getSecret(any())).thenReturn(null);
        when(sessionAuthService.generateAndSetSecret(any(), anyString())).thenReturn("new-secret");
        when(sessionAuthService.validateStateAndGetReturnPath(any(), any(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn("/return/path");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/callback?code=abc&state=some-state", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getHeaders().getFirst("Location")).isEqualTo("/return/path");
    }

    @Test
    void logout_disallowedPath_returnsBadRequest() {
        when(sessionAuthService.isAllowedRedirectOnly(anyString())).thenReturn(false);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/logout?path=https://other.example.com", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void logout_allowedPath_redirectsToLogoutPath() {
        when(sessionAuthService.isAllowedRedirectOnly(anyString())).thenReturn(true);
        when(sessionAuthService.logoutPath(anyString(), any(), any(), any())).thenReturn("https://idp.example.com/logout");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/logout?path=/home", HttpMethod.GET, null, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(resp.getHeaders().getFirst("Location")).isEqualTo("https://idp.example.com/logout");
    }
}
