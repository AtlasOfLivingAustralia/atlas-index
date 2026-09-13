/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.dto.UserInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.tomakehurst.wiremock.WireMockServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Coverage of {@link SessionAuthService}'s OIDC flows (discovery caching, authorization-code
 * token exchange, refresh, and state/PKCE redirect validation) against a WireMock-stubbed OIDC
 * provider, called directly on the real Spring-managed bean.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SessionAuthServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static final WireMockServer wireMockServer = new WireMockServer(0);

    @Autowired
    private SessionAuthService sessionAuthService;

    @BeforeAll
    static void startWireMockAndStubDiscovery() {
        wireMockServer.start();
        String base = "http://localhost:" + wireMockServer.port();

        wireMockServer.stubFor(get(urlEqualTo("/.well-known/openid-configuration"))
                .willReturn(okJson("""
                        {
                          "authorization_endpoint": "%s/authorize",
                          "token_endpoint": "%s/token",
                          "end_session_endpoint": "%s/logout",
                          "revocation_endpoint": "%s/revoke"
                        }
                        """.formatted(base, base, base, base))));
    }

    @AfterAll
    static void stopWireMockAndResetCachedStatics() throws Exception {
        wireMockServer.stop();

        for (String fieldName : new String[]{"OIDC_AUTH_URL", "TOKEN_ENDPOINT", "OIDC_LOGOUT_URL", "REVOKE_ENDPOINT"}) {
            Field field = SessionAuthService.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(null, null);
        }
    }

    @DynamicPropertySource
    static void oidcProperties(DynamicPropertyRegistry registry) {
        registry.add("security.oidc.discovery-uri",
                () -> "http://localhost:" + wireMockServer.port() + "/.well-known/openid-configuration");
        registry.add("security.oidc.clientId", () -> "test-client-id");
        registry.add("security.oidc.secret", () -> "test-client-secret");
    }

    @Test
    void discoveryDocument_cachedAtStartup_endpointsReflectWireMockStubs() {
        String base = "http://localhost:" + wireMockServer.port();

        assertThat(sessionAuthService.fetchAuthUrlFromDiscovery()).isEqualTo(base + "/authorize");
        assertThat(sessionAuthService.fetchTokenEndpointFromDiscovery()).isEqualTo(base + "/token");
        assertThat(sessionAuthService.fetchLogoutUrlFromDiscovery()).isEqualTo(base + "/logout");
        assertThat(sessionAuthService.fetchRevokeEndpointFromDiscovery()).isEqualTo(base + "/revoke");
    }

    @Test
    void exchangeCodeForToken_success_returnsTokenMap() {
        wireMockServer.stubFor(post(urlEqualTo("/token"))
                .withRequestBody(containing("grant_type=authorization_code"))
                .withRequestBody(containing("code=test-auth-code"))
                .withRequestBody(containing("code_verifier=test-code-verifier"))
                .willReturn(okJson("""
                        {
                          "access_token": "access-token-1",
                          "id_token": "id-token-1",
                          "refresh_token": "refresh-token-1",
                          "expires_in": 3600,
                          "token_type": "Bearer"
                        }
                        """)));

        Map<String, Object> tokens = sessionAuthService.exchangeCodeForToken("test-auth-code", "test-code-verifier");

        assertThat(tokens).isNotNull();
        assertThat(tokens.get("access_token")).isEqualTo("access-token-1");
        assertThat(tokens.get("refresh_token")).isEqualTo("refresh-token-1");
    }

    @Test
    @au.org.ala.search.test.SuppressExpectedLogging("au.org.ala.search.service.SessionAuthService")
    void exchangeCodeForToken_upstreamError_returnsNull() {
        wireMockServer.stubFor(post(urlEqualTo("/token"))
                .withRequestBody(containing("code=bad-code"))
                .willReturn(aResponse().withStatus(400).withBody("invalid_grant")));

        Map<String, Object> tokens = sessionAuthService.exchangeCodeForToken("bad-code", "test-code-verifier");

        assertThat(tokens).isNull();
    }

    @Test
    void refreshAccessToken_responseOmitsRefreshToken_reusesProvidedOne() {
        wireMockServer.stubFor(post(urlEqualTo("/token"))
                .withRequestBody(containing("grant_type=refresh_token"))
                .withRequestBody(containing("refresh_token=old-refresh-token"))
                .willReturn(okJson("""
                        {
                          "access_token": "access-token-2",
                          "id_token": "id-token-2",
                          "expires_in": 3600,
                          "token_type": "Bearer"
                        }
                        """)));

        Map<String, Object> tokens = sessionAuthService.refreshAccessToken("old-refresh-token");

        assertThat(tokens).isNotNull();
        assertThat(tokens.get("access_token")).isEqualTo("access-token-2");
        // no refresh_token in the upstream response -> the old one is reused
        assertThat(tokens.get("refresh_token")).isEqualTo("old-refresh-token");
    }

    @Test
    void isAllowedRedirectOnly_and_isAllowedRedirect_corsOriginChecks() {
        // security.cors.origins=http://localhost:5173,http://localhost:8080,http://localhost:8081
        assertThat(sessionAuthService.isAllowedRedirectOnly("http://localhost:5173/some/path")).isTrue();
        assertThat(sessionAuthService.isAllowedRedirectOnly("https://evil.example.com")).isFalse();
        assertThat(sessionAuthService.isAllowedRedirectOnly("")).isFalse();

        assertThat(sessionAuthService.isAllowedRedirect("http://localhost:8080/x", "http://localhost:8080")).isTrue();
        assertThat(sessionAuthService.isAllowedRedirect("http://localhost:8080/x", "https://evil.example.com")).isFalse();
        assertThat(sessionAuthService.isAllowedRedirect("https://evil.example.com", "http://localhost:8080")).isFalse();
    }

    @Test
    void validateStateAndGetReturnPath_missingPkceCodeVerifier_setsTimedOutError() {
        MockHttpSession session = new MockHttpSession();
        MockHttpServletResponse response = new MockHttpServletResponse();
        String returnPath = "/some/return/path";
        String state = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(returnPath.getBytes(StandardCharsets.UTF_8));

        // no PKCE_CODE_VERIFIER stored in session — simulates a session timeout between the
        // login redirect and the OIDC callback
        String result = sessionAuthService.validateStateAndGetReturnPath(
                response, session, "some-secret", "any-code", state, "http://localhost:5173");

        assertThat(result).isEqualTo(returnPath);
        assertThat(session.getAttribute("auth_error")).isEqualTo("timed out");
        assertThat(session.getAttribute(SessionAuthService.SESSION_AUTH_RESPONSE)).isNull();
    }

    @Test
    void validateStateAndGetReturnPath_successfulExchange_savesTokensToSessionAndDecodesUserInfo() throws Exception {
        String userIdValue = "test-user-id";
        String email = "test@example.org";
        String idToken = fakeJwt(Map.of(
                "cognito:username", userIdValue,
                "email", email,
                "given_name", "Test",
                "family_name", "User",
                "ala:role", "ROLE_USER"));

        wireMockServer.stubFor(post(urlEqualTo("/token"))
                .withRequestBody(containing("code=state-test-code"))
                .withRequestBody(containing("code_verifier=stored-code-verifier"))
                .willReturn(okJson(new ObjectMapper().writeValueAsString(Map.of(
                        "access_token", "state-test-access-token",
                        "id_token", idToken,
                        "refresh_token", "state-test-refresh-token",
                        "expires_in", 3600,
                        "token_type", "Bearer")))));

        MockHttpSession session = new MockHttpSession();
        session.setAttribute("pkce_code_verifier", "stored-code-verifier");
        MockHttpServletResponse response = new MockHttpServletResponse();

        String returnPath = "/after/login";
        String state = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(returnPath.getBytes(StandardCharsets.UTF_8));
        String secret = "test-session-secret-0123456789ab";

        String result = sessionAuthService.validateStateAndGetReturnPath(
                response, session, secret, "state-test-code", state, "http://localhost:5173");

        assertThat(result).isEqualTo(returnPath);
        assertThat(session.getAttribute(SessionAuthService.SESSION_AUTH_RESPONSE)).isNotNull();
        assertThat(session.getAttribute("auth_error")).isNull();

        UserInfo userInfo = sessionAuthService.getTokenInfo(response, session, secret, "http://localhost:5173", null);
        assertThat(userInfo.isAuthenticated()).isTrue();
        assertThat(userInfo.getUserId()).isEqualTo(userIdValue);
        assertThat(userInfo.getEmail()).isEqualTo(email);
        assertThat(userInfo.getRoles()).contains("ROLE_USER");
    }

    @Test
    void logoutPath_noSessionSecretCookie_returnsPathUnchanged() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpSession session = new MockHttpSession();

        String result = sessionAuthService.logoutPath("/after/logout", session, request, response);

        assertThat(result).isEqualTo("/after/logout");
    }

    @Test
    void logoutPath_loggedInCognito_revokesTokenAndReturnsCognitoLogoutUrl() throws Exception {
        wireMockServer.stubFor(post(urlEqualTo("/revoke")).willReturn(okJson("{}")));

        String secret = "test-session-secret-0123456789ab";
        String idToken = fakeJwt(Map.of("cognito:username", "logout-user"));

        MockHttpSession session = new MockHttpSession();
        au.org.ala.search.util.CryptoUtil.encrypt("dummy", secret); // sanity: CryptoUtil usable with this secret
        Map<String, Object> tokens = Map.of(
                "access_token", "logout-access-token",
                "id_token", idToken,
                "refresh_token", "logout-refresh-token",
                "expires_in", 3600);
        sessionAuthService.saveJWTToSession(tokens, session, secret);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("session_secret", secret));
        MockHttpServletResponse response = new MockHttpServletResponse();

        String result = sessionAuthService.logoutPath("/after/logout", session, request, response);

        assertThat(result).contains("/logout?client_id=test-client-id");
        assertThat(result).contains("logout_uri=");
        assertThat(session.getAttribute(SessionAuthService.SESSION_AUTH_RESPONSE)).isNull();

        wireMockServer.verify(postRequestedFor(urlEqualTo("/revoke")));
    }

    /**
     * Builds a syntactically valid (unsigned) JWT-shaped string: base64url(header).
     * base64url(payload).base64url(signature) — sufficient for
     * {@code SessionAuthService.getTokenInfo}'s {@code idToken.split("\\.")}/payload-decoding
     * logic, which never verifies the signature.
     */
    private static String fakeJwt(Map<String, Object> claims) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        String header = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mapper.writeValueAsBytes(claims));
        String signature = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("sig".getBytes(StandardCharsets.UTF_8));
        return header + "." + payload + "." + signature;
    }
}
