/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.model.dto.UserInfo;
import au.org.ala.search.util.CryptoUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for authentication-related operations.
 *
 * Interacts with session management and user authentication systems.
 *
 */
@Slf4j
@Service
public class SessionAuthService {

    private static final String SESSION_SECRET_COOKIE = "session_secret";
    private static final String SESSION_SECRET_DEBUG_COOKIE = "session_secret_debug";
    public static final String SESSION_AUTH_RESPONSE = "auth_response";
    private static final String SESSION_AUTH_DEBUG = "token_debug";
    private static final String SESSION_AUTH_ERROR = "auth_error";
    private static final String PKCE_CODE_VERIFIER = "pkce_code_verifier";
    private static final String REDIRECT_PATH = "/callback?client_name=OidcClient"; // aligned with ala-security-project

    // error messages
    public static final String SECRET_INVALID = "secret_invalid"; // possible race condition, client to retry login
    public static final String INVALID_REFRESH_TOKEN = "invalid_refresh_token"; // expired refresh token, user must login again
    public static final String INVALID_ID_TOKEN = "invalid_id_token"; // invalid id token, user must login again
    public static final String INVALID_TOKEN = "invalid_token"; // generic invalid token, user must login again
    public static final String EXCHANGE_FAILED = "exchange_failed"; // code exchange failed, user must login again

    // clients are expected shorted return paths to avoid overly long state parameters
    private static final int MAX_PATH_LENGTH = 200;

    // filled from the discoveryUri response
    private static String OIDC_AUTH_URL;
    private static String TOKEN_ENDPOINT;
    private static String OIDC_LOGOUT_URL;
    private static String REVOKE_ENDPOINT;

    @Value("#{'${openapi.servers}'.split(',')[0]}")
    private String baseUrl;

    @Value("${security.oidc.scope}")
    private String scope;

    @Value("${security.oidc.discovery-uri}")
    private String discoveryUri;

    @Value("${security.oidc.clientId}")
    private String clientId;

    @Value("${security.oidc.secret}")
    private String secret;

    @Value("#{'${security.cors.origins}'.split(',')}")
    private List<String> corsOrigins;

    @Value("${security.oidc.userIdClaim}")
    private String userIdClaim;

    @Value("${security.oidc.roleClaims}")
    private String roleClaims;

    @Value("${security.cookie.domain}")
    private String cookieDomain;

    @Value("${security.login.maxAgeDays}")
    private int loginMaxAge;

    @Value("${security.cookie.name}")
    private String SESSION_STATUS_COOKIE;

    @Value("${security.cookie.debug}")
    private boolean sessionCookieDebug;

    /**
     * COGNITO: use Cognito logout endpoint and parameters
     * DEFAULT: use the CAS OIDC logout endpoint and parameters
     */
    @Value("${security.oidc.logoutAction}")
    private String logoutAction; // DEFAULT or COGNITO


    @PostConstruct
    public void init() {
        cacheAuthUrls();
    }

    /**
     * Exchange the authorization code for tokens using PKCE
     *
     * @param code
     * @param codeVerifier
     * @return map with access_token, id_token, refresh_token, expires_in, token_type
     */
    public Map<String, Object> exchangeCodeForToken(String code, String codeVerifier) {
        String tokenEndpoint = fetchTokenEndpointFromDiscovery();

        Map<String, String> params = new HashMap<>();
        params.put("grant_type", "authorization_code");
        params.put("code", code);
        params.put("redirect_uri", baseUrl + REDIRECT_PATH);
        params.put("client_id", clientId);
        if (StringUtils.isNotEmpty(secret)) {
            params.put("client_secret", secret);
        }
        params.put("code_verifier", codeVerifier);

        try {
            ResponseEntity<String> response = doPost(tokenEndpoint, params);

            if (response.getStatusCode() == HttpStatus.OK) {
                ObjectMapper mapper = new ObjectMapper();
                Map<String, Object> tokenResponse = mapper.readValue(response.getBody(), Map.class);
                return tokenResponse;
            }
        } catch (Exception e) {
            log.error("Failed to exchangeCodeForToken", e);
        }
        return null;
    }

    public String generateCodeVerifier() {
        byte[] code = new byte[32];
        new SecureRandom().nextBytes(code);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(code);
    }

    /**
     * Use the refresh token to get a new access token
     *
     * @param refreshToken
     * @return map with access_token, id_token, expires_in, token_type
     */
    public Map<String, Object> refreshAccessToken(String refreshToken) {
        try {
            String tokenEndpoint = fetchTokenEndpointFromDiscovery();

            Map<String, String> params = new HashMap<>();
            params.put("grant_type", "refresh_token");
            params.put("refresh_token", refreshToken);
            params.put("client_id", clientId);

            ResponseEntity<String> response = doPost(tokenEndpoint, params);

            if (response.getStatusCode() == HttpStatus.OK) {
                ObjectMapper mapper = new ObjectMapper();
                Map<String, Object> tokenResponse = mapper.readValue(response.getBody(), Map.class);

                // if the response does not contain a new refresh token, reuse the old one
                if (!tokenResponse.containsKey("refresh_token")) {
                    tokenResponse.put("refresh_token", refreshToken);
                }

                return tokenResponse;
            }
        } catch (Exception e) {
            log.error("Failed to refreshAccessToken", e);
        }
        return null;
    }

    public String fetchAuthUrlFromDiscovery() {
        if (OIDC_AUTH_URL != null) {
            return OIDC_AUTH_URL;
        }

        cacheAuthUrls();

        return OIDC_AUTH_URL;
    }

    /**
     * Fetch the token endpoint from the OIDC discovery document, caching it for future use as it will not change.
     * @return the token endpoint URL
     */
    public String fetchTokenEndpointFromDiscovery() {
        if (TOKEN_ENDPOINT != null) {
            return TOKEN_ENDPOINT;
        }

        cacheAuthUrls();

        return TOKEN_ENDPOINT;
    }

    /**
     * Fetch the logout URL from the OIDC discovery document, caching it for future use as it will not change.
     * @return the logout endpoint URL
     */
    public String fetchLogoutUrlFromDiscovery() {
        if (OIDC_LOGOUT_URL != null) {
            return OIDC_LOGOUT_URL;
        }

        cacheAuthUrls();

        return OIDC_LOGOUT_URL;
    }

    /**
     * Fetch the revoke endpoint from the OIDC discovery document, caching it for future use as it will not change.
     * @return the revoke endpoint URL
     */
    public String fetchRevokeEndpointFromDiscovery() {
        if (REVOKE_ENDPOINT != null) {
            return REVOKE_ENDPOINT;
        }

        cacheAuthUrls();

        return REVOKE_ENDPOINT;
    }

    /**
     * Fetch and cache the OIDC discovery document endpoints. They will not change.
     */
    public void cacheAuthUrls() {
        RestTemplate restTemplate = new RestTemplate();
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(discoveryUri, String.class);
            if (response.getStatusCode() == HttpStatus.OK) {
                ObjectMapper mapper = new ObjectMapper();
                Map<String, Object> discovery = mapper.readValue(response.getBody(), Map.class);

                // set class static variables
                OIDC_AUTH_URL = (String) discovery.get("authorization_endpoint");
                TOKEN_ENDPOINT = (String) discovery.get("token_endpoint");
                OIDC_LOGOUT_URL = (String) discovery.get("end_session_endpoint");
                REVOKE_ENDPOINT = (String) discovery.get("revocation_endpoint");
            }
        } catch (Exception e) {
            log.error("Failed to fetch OIDC discovery document", e);
        }
    }

    /**
     * Check if the return path is allowed for redirect after login/logout.
     * Only checks the return path, not the origin.
     *
     * @param returnPath
     * @return true if the return path is allowed
     */
    public boolean isAllowedRedirectOnly(String returnPath) {
        if (StringUtils.isEmpty(returnPath)) {
            return false;
        }
        return corsOrigins.stream().anyMatch(returnPath::startsWith);
    }

    /**
     * Check if the return path and origin are allowed for redirect after login/logout.
     * The return path must match an allowed CORS origin, and the origin must also match an allowed CORS origin.
     *
     * @param returnPath
     * @param origin
     * @return true if the return path and origin are allowed
     */
    public boolean isAllowedRedirect(String returnPath, String origin) {
        boolean allowedReturnPath = corsOrigins.stream().anyMatch(returnPath::startsWith);
        boolean allowedOrigin = corsOrigins.stream().anyMatch(origin::startsWith);

        return allowedReturnPath && allowedOrigin;
    }

    /**
     * Encrypt and save the tokens to the session. A secret is created if not provided.
     *
     * @param tokenResponse
     * @param session
     * @throws Exception
     */
    public void saveJWTToSession(Map<String, Object> tokenResponse, HttpSession session, String secret) throws Exception {
        Map<String, Object> savedResponse = new HashMap<>();

        savedResponse.put("access_token", CryptoUtil.encrypt((String) tokenResponse.get("access_token"), secret));
        savedResponse.put("id_token", CryptoUtil.encrypt((String) tokenResponse.get("id_token"), secret));
        savedResponse.put("refresh_token", CryptoUtil.encrypt((String) tokenResponse.get("refresh_token"), secret));

        // access token expiry time in millis
        savedResponse.put("expires_at", System.currentTimeMillis() + ((Number) tokenResponse.get("expires_in")).longValue() * 1000);

        // debug info
        if (sessionCookieDebug) {
            savedResponse.put(SESSION_AUTH_DEBUG, secret.substring(0, 4) + "-" + System.currentTimeMillis());
        }

        session.setAttribute(SESSION_AUTH_RESPONSE, savedResponse);
        session.removeAttribute(SESSION_AUTH_ERROR);
    }

    /**
     * Get the token info from the session. Refreshing the access token if needed.
     *
     * @param response
     * @param session
     * @param secret
     * @return UserInfo object with access token details and user info and authenticated=true, or authenticated=false if not logged in
     */
    public UserInfo getTokenInfo(HttpServletResponse response, HttpSession session, String secret, String origin, String secretDebug) {
        if (StringUtils.isEmpty(secret)) {
            log.warn("Missing session_secret cookie");
            return UserInfo.builder().authenticated(false).error((String) session.getAttribute(SESSION_AUTH_ERROR)).build();
        }

        if (session.getAttribute(SESSION_AUTH_RESPONSE) == null) {
            return UserInfo.builder().authenticated(false).error((String) session.getAttribute(SESSION_AUTH_ERROR)).build();
        }

        try {
            Map<String, Object> authResponse = (Map<String, Object>) session.getAttribute(SESSION_AUTH_RESPONSE);
            long expiresAt = (Long) authResponse.get("expires_at");
            boolean refreshed = false; // for debugging
            if (System.currentTimeMillis() > expiresAt - 60000) { // 1 minute offset
                // token expired
                String refreshToken = null;
                try {
                    refreshToken = (String) authResponse.get("refresh_token");
                    if (refreshToken != null) {
                        refreshToken = CryptoUtil.decrypt(refreshToken, secret);
                    } else {
                        log.info("Refresh token missing in session auth response");
                    }
                } catch (Exception e) {
                    log.info("Failed to decrypt refresh token, possible race condition; secretDebug: {}, tokenDebug: {}", secretDebug, authResponse.get(SESSION_AUTH_DEBUG), e);
                    refreshToken = null;
                }

                if (refreshToken == null) {
                    return UserInfo.builder().authenticated(false).error(SECRET_INVALID).build();
                }

                // refresh the access token
                Map<String, Object> newTokens = refreshAccessToken(refreshToken);
                if (newTokens == null || newTokens.get("access_token") == null) {
                    log.error("Failed to refresh access token");
                    session.removeAttribute(SESSION_AUTH_RESPONSE);
                    removeSecret(response);
                    session.setAttribute(SESSION_AUTH_ERROR, INVALID_REFRESH_TOKEN);

                    return UserInfo.builder().authenticated(false).error((String) session.getAttribute(SESSION_AUTH_ERROR)).build();
                }

                // rotate the secret
                secret = generateAndSetSecret(response, origin);

                // save the new tokens to the session
                if (!newTokens.containsKey("refresh_token")) {
                    newTokens.put("refresh_token", refreshToken); // reuse old refresh token if not rotated
                }
                saveJWTToSession(newTokens, session, secret);

                // re-read the auth response that is encrypted with the new secret
                authResponse = (Map<String, Object>) session.getAttribute(SESSION_AUTH_RESPONSE);

                // indicate that a refresh occurred
                refreshed = true;
            }

            // decrypt access token, checking for invalid secret
            String accessToken = null;
            try {
                accessToken = (String) authResponse.get("access_token");
                if (accessToken != null) {
                    accessToken = CryptoUtil.decrypt(accessToken, secret);
                } else {
                    log.info("Access token missing in session auth response");
                }
            } catch (Exception e) {
                log.info("Failed to decrypt refresh token, possible race condition; secretDebug: {}, tokenDebug: {}, wasRefreshed: {}", secretDebug, authResponse.get(SESSION_AUTH_DEBUG), refreshed, e);
                accessToken = null;
            }

            if (accessToken == null) {
                return UserInfo.builder().authenticated(false).error(SECRET_INVALID).build();
            }

            // assuming secret is valid if here
            String idToken = CryptoUtil.decrypt((String) authResponse.get("id_token"), secret);
            expiresAt = (Long) authResponse.get("expires_at"); // re-read in case refreshed

            // get user info from the id token
            String[] parts = idToken.split("\\.");
            if (parts.length == 3) {
                String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
                ObjectMapper mapper = new ObjectMapper();
                Map<String, Object> payloadMap = mapper.readValue(payloadJson, new TypeReference<Map<String, Object>>() {});

                return UserInfo.builder()
                        .accessToken(accessToken)
                        .expiresAt(expiresAt)
                        .userId((String) payloadMap.get(userIdClaim))
                        .email((String) payloadMap.get("email"))
                        .firstName((String) payloadMap.get("given_name"))
                        .lastName((String) payloadMap.get("family_name"))
                        .roles(toStringArray(payloadMap.get(roleClaims)))
                        .authenticated(true)
                        .build();
            }

            session.setAttribute(SESSION_AUTH_ERROR, INVALID_ID_TOKEN);
        } catch (Exception e) {
            log.error("Error getting token information", e);
            session.setAttribute(SESSION_AUTH_ERROR, INVALID_TOKEN);
        }
        return UserInfo.builder().authenticated(false).error((String) session.getAttribute(SESSION_AUTH_ERROR)).build();
    }

    /**
     * Get the login path or build the login URL if not logged in.
     *
     * @param session
     * @param path
     * @param secret
     * @return
     * @throws NoSuchAlgorithmException
     */
    public String getLoginPath(HttpServletResponse response, HttpSession session, String path, String secret, String origin) throws NoSuchAlgorithmException {
        // return immediately if already logged in. No secret means not logged in.
        if (StringUtils.isNotEmpty(secret) && isSessionLoggedIn(response, session, secret, origin)) {
            return path;
        }

        return buildLoginUrl(session, path);
    }

    public String[] toStringArray(Object obj) {
        if (obj instanceof String) {
            return ((String) obj).split(",");
        } else if (obj instanceof String[]) {
            return (String[]) obj;
        } else if (obj instanceof List<?> list) {
            return list.stream().map(Object::toString).toArray(String[]::new);
        }
        return new String[0];
    }

    /**
     * Check if the session is logged in.
     *
     * @param response
     * @param session
     * @param secret
     * @return true if logged in
     */
    public boolean isSessionLoggedIn(HttpServletResponse response, HttpSession session, String secret, String origin) {
        return session.getAttribute(SESSION_AUTH_RESPONSE) != null && getTokenInfo(response, session, origin, secret, origin).isAuthenticated();
    }

    /**
     * Build the OIDC login URL with PKCE and state parameters, storing the code verifier and return path in the session.
     *
     * @param session
     * @param returnPath
     * @return the login URL for redirection
     * @throws NoSuchAlgorithmException
     */
    private String buildLoginUrl(HttpSession session, String returnPath) throws NoSuchAlgorithmException {
        // Generate PKCE code verifier if not already present.
        // Reuse is allowed to handle multiple concurrent login requests.
        // Code is removed after use.
        String codeVerifier = (String) session.getAttribute(PKCE_CODE_VERIFIER);
        if (codeVerifier == null) {
            codeVerifier = generateCodeVerifier();
        }

        // Store codeVerifier in session for later use
        session.setAttribute(PKCE_CODE_VERIFIER, codeVerifier);

        // Generate code_challenge from codeVerifier
        String codeChallenge = Base64.getUrlEncoder().withoutPadding().encodeToString(
                java.security.MessageDigest.getInstance("SHA-256")
                        .digest(codeVerifier.getBytes(StandardCharsets.US_ASCII)));

        // Store returnPath in session associated with a hash, but only the first MAX_PATH_LENGTH characters
        String constrainedReturnPath = returnPath.length() > MAX_PATH_LENGTH ? returnPath.substring(0, MAX_PATH_LENGTH) : returnPath;
        String pathState = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(constrainedReturnPath.getBytes(StandardCharsets.UTF_8));

        // Build OIDC authorization URL
        return fetchAuthUrlFromDiscovery() +
                "?response_type=code" +
                "&client_id=" + clientId +
                "&redirect_uri=" + baseUrl + REDIRECT_PATH +
                "&scope=" + URLEncoder.encode(scope, StandardCharsets.UTF_8) +
                "&state=" + pathState +
                "&code_challenge=" + codeChallenge +
                "&code_challenge_method=S256";
    }


    /**
     * Validate the state parameter and return the associated returnPath if the code for token exchange is successful.
     *
     * @param session
     * @param secret
     * @param code
     * @param state
     * @return
     */
    public String validateStateAndGetReturnPath(HttpServletResponse response, HttpSession session, String secret, String code, String state, String origin) {
        String returnPath = new String(Base64.getUrlDecoder().decode(state), StandardCharsets.UTF_8);

        // check again if already logged in
        if (isSessionLoggedIn(response, session, secret, origin)) {
            return returnPath;
        }

        // Retrieve PKCE code verifier from session
        // If absent then the session is already valid and this can be considered a "timeout" event.
        //  login 1 -> login page 1 (no PKCE, create and store in session)
        //  login 2 -> login page 2 (reuse PKCE from session as it exists)
        //  login page 1 -> callback, use PKCE, remove PKCE from session
        //  -> refresh token expires or user logs out
        //  login page 2 -> callback, SESSION_AUTH_RESPONSE missing (not logged in), PKCE missing, cannot complete login
        String codeVerifier = (String) session.getAttribute(PKCE_CODE_VERIFIER);
        if (codeVerifier == null) {
            log.warn("Missing PKCE code verifier in session");

            // save state to the session
            session.removeAttribute(SESSION_AUTH_RESPONSE);
            removeSecret(response);
            session.setAttribute(SESSION_AUTH_ERROR, "timed out");

            // continue the redirect, the client will see that the login failed
            return returnPath;
        }

        // Exchange code for id, access and refresh tokens
        Map<String, Object> tokens = exchangeCodeForToken(code, codeVerifier);
        if (tokens == null || tokens.get("access_token") == null) {
            log.error("Failed to exchange code for access token");

            // save state to the session
            session.removeAttribute(SESSION_AUTH_RESPONSE);
            removeSecret(response);
            session.setAttribute(SESSION_AUTH_ERROR, EXCHANGE_FAILED);

            // continue the redirect, the client will see that the login failed
            return returnPath;
        }

        // save to session
        try {
            saveJWTToSession(tokens, session, secret);
        } catch (Exception e) {
            log.error("Failed to save tokens to session", e);

            // save state to the session
            session.removeAttribute(SESSION_AUTH_RESPONSE);
            removeSecret(response);
            session.setAttribute(SESSION_AUTH_ERROR, "save to session failed");

            // continue the redirect, the client will see that the login failed
        }

        return returnPath;
    }

    /**
     * Get the session secret from the cookie. Create if not found.
     *
     * @param request
     * @return the secret, or null if not found
     */
    public String getSecret(HttpServletRequest request) {
        String secret = null;
        jakarta.servlet.http.Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (jakarta.servlet.http.Cookie cookie : cookies) {
                if (SESSION_SECRET_COOKIE.equals(cookie.getName())) {
                    secret = cookie.getValue();
                    break;
                }
            }
        }

        return secret;
    }

    /**
     * Get the session secret's debug information from the cookie.
     *
     * @param request
     * @return the secret, or null if not found
     */
    public String getSecretDebug(HttpServletRequest request) {
        String secret = null;
        jakarta.servlet.http.Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (jakarta.servlet.http.Cookie cookie : cookies) {
                if (SESSION_SECRET_DEBUG_COOKIE.equals(cookie.getName())) {
                    secret = cookie.getValue();
                    break;
                }
            }
        }

        return secret;
    }

    /**
     * Create a new session secret, store in a cookie and return it.
     *
     * @param response
     * @return
     */
    public String generateAndSetSecret(HttpServletResponse response, String origin) throws NoSuchAlgorithmException {
        String secret = Base64.getUrlEncoder().withoutPadding().encodeToString(SecureRandom.getInstanceStrong().generateSeed(32));
        Cookie secretCookie = new Cookie(SESSION_SECRET_COOKIE, secret);
        secretCookie.setHttpOnly(true);
        if (!baseUrl.startsWith("http://localhost")) { // exclude secure=true when testing locally
            secretCookie.setSecure(true);
        }
        secretCookie.setPath("/");
        secretCookie.setMaxAge(loginMaxAge * 24 * 60 * 60); // should be at least as long as the refresh token validity
        response.addCookie(secretCookie);

        // set SESSION_STATUS_COOKIE at the domain level for client-side checks
        // same as above but usable by client-side scripts
        Cookie statusCookie = new Cookie(SESSION_STATUS_COOKIE, "true");
        statusCookie.setHttpOnly(false);
        statusCookie.setPath("/");
        statusCookie.setMaxAge(loginMaxAge * 24 * 60 * 60); // should be at least as long as the refresh token validity
        if (StringUtils.isNotEmpty(cookieDomain)) {
            statusCookie.setDomain(cookieDomain);
        }
        response.addCookie(statusCookie);

        // set the debug cookie
        if (sessionCookieDebug) {
            Cookie debugCookie = new Cookie(SESSION_SECRET_DEBUG_COOKIE, secret.substring(0, 4) + '-' + System.currentTimeMillis() + '-' + URLEncoder.encode(origin, StandardCharsets.UTF_8));
            debugCookie.setHttpOnly(false);
            debugCookie.setPath("/");
            debugCookie.setMaxAge(loginMaxAge * 24 * 60 * 60);
            if (StringUtils.isNotEmpty(cookieDomain)) {
                debugCookie.setDomain(cookieDomain);
            }
            response.addCookie(debugCookie);
        }

        return secret;
    }

    /**
     * Remove the session secret cookie.
     */
    public void removeSecret(HttpServletResponse response) {
        Cookie secretCookie = new Cookie(SESSION_SECRET_COOKIE, "");
        secretCookie.setHttpOnly(true);
        if (!baseUrl.startsWith("http://localhost")) { // exclude secure=true when testing locally
            secretCookie.setSecure(true);
        }
        secretCookie.setPath("/");
        secretCookie.setMaxAge(0); // delete cookie
        response.addCookie(secretCookie);

        // remove instead of setting to false
        Cookie statusCookie = new Cookie(SESSION_STATUS_COOKIE, "true");
        statusCookie.setHttpOnly(false);
        statusCookie.setPath("/");
        statusCookie.setMaxAge(0);
        if (StringUtils.isNotEmpty(cookieDomain)) {
            statusCookie.setDomain(cookieDomain);
        }
        response.addCookie(statusCookie);

        // remove the debug cookie
        if (!sessionCookieDebug) {
            Cookie debugCookie = new Cookie(SESSION_SECRET_DEBUG_COOKIE, "");
            debugCookie.setHttpOnly(false);
            debugCookie.setPath("/");
            debugCookie.setMaxAge(0);
            if (StringUtils.isNotEmpty(cookieDomain)) {
                debugCookie.setDomain(cookieDomain);
            }
            response.addCookie(debugCookie);
        }
    }

    /**
     * Perform a POST request with form-urlencoded parameters.
     *
     * @param url
     * @param params
     * @return
     */
    private ResponseEntity<String> doPost(String url, Map<String, String> params) {
        RestTemplate restTemplate = new RestTemplate();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        StringBuilder body = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (!body.isEmpty()) body.append("&");
            body.append(entry.getKey()).append("=").append(entry.getValue());
        }

        HttpEntity<String> request = new HttpEntity<>(body.toString(), headers);

        return restTemplate.postForEntity(url, request, String.class);
    }

    public String logoutPath(String path, HttpSession session, HttpServletRequest request, HttpServletResponse response) {
        // when no secret, just redirect to the path
        String secret = getSecret(request);
        if (secret == null) {
            return path;
        }

        // when no login, just redirect to the path
        if (session.getAttribute(SessionAuthService.SESSION_AUTH_RESPONSE) == null) {
            return path;
        }

        String origin = request.getHeader("Origin");
        UserInfo userInfo = getTokenInfo(response, session, secret, origin, getSecretDebug(request));
        if (!userInfo.isAuthenticated()) {
            // not logged in, just return the path
            return path;
        }

        // get refresh token for revocation
        Map<String, Object> authResponse = (Map<String, Object>) session.getAttribute(SESSION_AUTH_RESPONSE);
        String refreshToken = null; // for cognito
        String idToken = null; // for cas oidc
        try {
            refreshToken = CryptoUtil.decrypt((String) authResponse.get("refresh_token"), secret);
            idToken = CryptoUtil.decrypt((String) authResponse.get("id_token"), secret);
        } catch (Exception e) {
            log.info("Failed to decrypt refresh token, possible race condition", e);
            return path;
        }

        String revokeUrl = fetchRevokeEndpointFromDiscovery();
        try {
            Map<String, String> params = new HashMap<>();
            if ("COGNITO".equalsIgnoreCase(logoutAction)) {
                params.put("token", refreshToken);
                params.put("client_id", clientId);
            } else { // DEFAULT == logoutAction
                // TODO: test with other providers
                params.put("token", refreshToken);
                params.put("token_type_hint", "refresh_token");
                params.put("client_id", clientId);
                if (StringUtils.isNotEmpty(secret)) {
                    params.put("client_secret", secret);
                }
            }

            ResponseEntity<String> responseEntity = doPost(revokeUrl, params);
            if (responseEntity.getStatusCode() != HttpStatus.OK) {
                log.warn("Failed to revoke access token, status: {}", responseEntity.getStatusCode());
            }
        } catch (Exception e) {
            log.error("Failed to revoke access token", e);
        }

        // remove the auth_response attribute only
        session.removeAttribute(SessionAuthService.SESSION_AUTH_RESPONSE);

        // cleanup cookies
        removeSecret(response);

        // redirect to the OIDC logout endpoint
        String logoutUrl = fetchLogoutUrlFromDiscovery();

        // return via this app as remote clients will not be registered with the OIDC provider for this clientId
        String encodedRedirect = URLEncoder.encode(path, StandardCharsets.UTF_8);

        // build the logout URL depending on the provider
        // cognito: client_id, logout_uri
        // cas: post_logout_redirect_uri, id_token_hint
        String url;
        if ("COGNITO".equalsIgnoreCase(logoutAction)) {
            url = logoutUrl + "?client_id=" + clientId + "&logout_uri=" + encodedRedirect;
        } else { // DEFAULT == logoutAction
            url = logoutUrl + "?post_logout_redirect_uri=" + encodedRedirect +
                    "&id_token_hint=" + URLEncoder.encode(idToken, StandardCharsets.UTF_8);
        }

        return url;
    }
}
