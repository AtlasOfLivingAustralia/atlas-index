/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.model.dto.UserInfo;
import au.org.ala.search.service.SessionAuthService;
import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.stereotype.Controller;
import org.springframework.web.server.ResponseStatusException;

import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

/**
 * Controller for session authentication and related APIs.
 */
@Hidden
@Slf4j
@Controller
@RequestMapping("/")
public class AuthController {

    private final SessionAuthService sessionAuthService;

    @Value("#{'${security.cors.origins}'.split(',')}")
    private List<String> corsOrigins;

    public AuthController(SessionAuthService sessionAuthService) {
        this.sessionAuthService = sessionAuthService;
    }

    // CORS headers are set by WebConfig for this endpoint
    @GetMapping(path = "/session", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public UserInfo sessionInfo(
            HttpServletRequest request,
            HttpServletResponse response,
            @RequestHeader(value = "Origin", required = false) String origin) {
        boolean allowedOrigin = origin != null && corsOrigins.stream()
                .anyMatch(o -> origin.equals(o) || origin.startsWith(o + "/"));

        if (!allowedOrigin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "forbidden");
        }

        // Only get existing session, do not create a new one
        HttpSession session = request.getSession(false);
        if (session == null) {
            return UserInfo.builder().authenticated(false).build();
        }

        // if there is no secret, then request is not logged in as the secret is only set after successful login
        String secret = sessionAuthService.getSecret(request);
        if (secret == null) {
            return UserInfo.builder().authenticated(false).build();
        }

        UserInfo userInfo = sessionAuthService.getTokenInfo(response, session, secret);
        if (userInfo == null) {
            return UserInfo.builder().authenticated(false).build();
        } else {
            return userInfo;
        }
    }

    /**
     * A session is created prior to calling this endpoint, reducing concurrency issues.
     *
     * @param path
     * @param session
     * @param request
     * @param response
     * @return
     */
    @GetMapping("/login")
    public ResponseEntity<Void> login(
            @RequestParam String path,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        if (!sessionAuthService.isAllowedRedirectOnly(path)) {
            log.warn("Blocked login redirect: returnPath={}", path);
            return ResponseEntity.status(400).build();
        }

        try {
            String url = sessionAuthService.getLoginPath(response, session, path, sessionAuthService.getSecret(request));
            if (url == null) {
                log.warn("Failed to generate login path");
                return ResponseEntity.status(500).build();
            } else {
                HttpHeaders headers = new HttpHeaders();
                headers.add("Location", url);
                return ResponseEntity.status(302).headers(headers).build();
            }
        } catch (NoSuchAlgorithmException e) {
            log.error("Failed to generate PKCE code verifier/challenge", e);
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam String code,
            @RequestParam String state,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        // return immediately if already logged in. No secret means not logged in.
        String secret = sessionAuthService.getSecret(request);
        if (StringUtils.isNotEmpty(secret) && sessionAuthService.isSessionLoggedIn(response, session, secret)) {
            HttpHeaders headers = new HttpHeaders();
            String returnPath = new String(Base64.getUrlDecoder().decode(state), StandardCharsets.UTF_8);
            headers.add("Location", returnPath);
            return ResponseEntity.status(302).headers(headers).build();
        }

        // create a new secret as this is a new login not a refresh
        try {
            secret = sessionAuthService.generateAndSetSecret(response);
        } catch (NoSuchAlgorithmException e) {
            log.error("Failed to generate session secret", e);
            return ResponseEntity.status(500).build();
        }

        String returnPath = sessionAuthService.validateStateAndGetReturnPath(response, session, secret, code, state);
        if (returnPath == null) {
            log.warn("Possibly invalid or expired state parameter: {}", state);
            return ResponseEntity.status(400).build();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.add("Location", returnPath);
        return ResponseEntity.status(302).headers(headers).build();
    }

    @GetMapping("/logout")
    public ResponseEntity<Void> logout(
            @RequestParam String path,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response) {
        // verify the path is allowed
        if (!sessionAuthService.isAllowedRedirectOnly(path)) {
            log.warn("Blocked logout redirect: returnPath={}", path);
            return ResponseEntity.status(400).build();
        }

        String logoutPath = sessionAuthService.logoutPath(path, session, request, response);

        HttpHeaders headers = new HttpHeaders();
        headers.add("Location", logoutPath);
        return ResponseEntity.status(302).headers(headers).build();
    }
}
