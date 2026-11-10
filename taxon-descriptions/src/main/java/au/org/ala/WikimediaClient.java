package au.org.ala;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Client for Wikimedia API interactions including authentication and rate-limited fetching.
 *
 * Implements Wikimedia Enterprise JWT token lifecycle:
 * - Login (POST /v1/login)
 * - Token Refresh (POST /v1/token-refresh)
 * - Token caching to disk
 * - Respecting 429/503 Retry-After headers and shared rate limit pauses across threads.
 */
public class WikimediaClient {

    private static final String DEFAULT_AUTH_URL = "https://auth.enterprise.wikimedia.com";
    private static final int DEFAULT_MAX_RETRIES = 3;
    private static final long DEFAULT_RATE_LIMIT_PAUSE_MS = 5_000L;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    // Shared across all threads to coordinate rate limit pauses
    private static final AtomicLong pauseUntilTimestamp = new AtomicLong(0);

    private final String authUrl;
    private final String username;
    private final String password;
    private final String userAgent;
    private final File tokenCacheFile;
    private final int maxRetries;

    private String accessToken;
    private String refreshToken;
    private String idToken;
    private long expiresAtMillis;
    private long refreshTokenExpiresAtMillis;

    public WikimediaClient(String authUrl, String username, String password, String userAgent, File tokenCacheFile, int maxRetries) {
        this.authUrl = StringUtils.isNotBlank(authUrl) ? authUrl : DEFAULT_AUTH_URL;
        this.username = username;
        this.password = password;
        this.userAgent = userAgent;
        this.tokenCacheFile = tokenCacheFile;
        this.maxRetries = maxRetries > 0 ? maxRetries : DEFAULT_MAX_RETRIES;

        loadCachedTokens();
    }

    public static WikimediaClient createFromConfig(Map config, String descriptionsTmp, String userAgent) {
        String authUrl = config.get("wikimediaAuthUrl") != null ? config.get("wikimediaAuthUrl").toString().trim() : DEFAULT_AUTH_URL;
        String username = config.get("wikimediaUsername") != null ? config.get("wikimediaUsername").toString().trim() : null;
        String password = config.get("wikimediaPassword") != null ? config.get("wikimediaPassword").toString().trim() : null;

        if (config.get("wikimediaAuthFile") != null) {
            String authFilePath = config.get("wikimediaAuthFile").toString().trim();
            File authFile = new File(authFilePath);
            if (authFile.exists() && authFile.canRead()) {
                try {
                    Map<String, String> creds = OBJECT_MAPPER.readValue(authFile, new TypeReference<Map<String, String>>() {});
                    if (StringUtils.isNotBlank(creds.get("username"))) {
                        username = creds.get("username").trim();
                    }
                    if (StringUtils.isNotBlank(creds.get("password"))) {
                        password = creds.get("password").trim();
                    }
                } catch (Exception e) {
                    System.err.println("Failed to read wikimedia credentials from " + authFilePath + ": " + e.getMessage());
                }
            }
        }

        File tokenCacheFile = null;
        if (StringUtils.isNotBlank(descriptionsTmp)) {
            tokenCacheFile = new File(descriptionsTmp + "/wikipedia/auth_tokens.json");
        }

        return new WikimediaClient(authUrl, username, password, userAgent, tokenCacheFile, DEFAULT_MAX_RETRIES);
    }

    private synchronized void loadCachedTokens() {
        if (tokenCacheFile == null || !tokenCacheFile.exists()) {
            return;
        }

        try {
            Map<String, Object> data = OBJECT_MAPPER.readValue(tokenCacheFile, Map.class);
            this.accessToken = (String) data.get("accessToken");
            this.refreshToken = (String) data.get("refreshToken");
            this.idToken = (String) data.get("idToken");
            this.expiresAtMillis = data.get("expiresAtMillis") != null ? ((Number) data.get("expiresAtMillis")).longValue() : 0;
            this.refreshTokenExpiresAtMillis = data.get("refreshTokenExpiresAtMillis") != null ? ((Number) data.get("refreshTokenExpiresAtMillis")).longValue() : 0;
        } catch (Exception e) {
            System.err.println("Failed to read token cache file: " + e.getMessage());
        }
    }

    private synchronized void persistTokens() {
        if (tokenCacheFile == null) {
            return;
        }

        try {
            File parent = tokenCacheFile.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            Map<String, Object> data = new HashMap<>();
            data.put("accessToken", accessToken);
            data.put("refreshToken", refreshToken);
            data.put("idToken", idToken);
            data.put("expiresAtMillis", expiresAtMillis);
            data.put("refreshTokenExpiresAtMillis", refreshTokenExpiresAtMillis);
            OBJECT_MAPPER.writeValue(tokenCacheFile, data);
        } catch (Exception e) {
            System.err.println("Failed to write token cache file: " + e.getMessage());
        }
    }

    public synchronized String getValidAccessToken() {
        if (StringUtils.isBlank(username) || StringUtils.isBlank(password)) {
            return null;
        }

        long now = System.currentTimeMillis();
        // Check if current access token is valid (with 60-second buffer)
        if (StringUtils.isNotBlank(accessToken) && now < (expiresAtMillis - 60_000L)) {
            return accessToken;
        }

        // Try to refresh token if valid refresh token exists
        if (StringUtils.isNotBlank(refreshToken) && (refreshTokenExpiresAtMillis == 0 || now < refreshTokenExpiresAtMillis)) {
            try {
                if (refreshAccessToken()) {
                    return accessToken;
                }
            } catch (Exception e) {
                System.err.println("Token refresh failed: " + e.getMessage() + ". Retrying with login.");
            }
        }

        // Fall back to login
        try {
            if (login()) {
                return accessToken;
            }
        } catch (Exception e) {
            System.err.println("Wikimedia login failed: " + e.getMessage());
        }

        return null;
    }

    public synchronized void invalidateAccessToken() {
        this.accessToken = null;
        this.expiresAtMillis = 0;
        if (tokenCacheFile != null && tokenCacheFile.exists()) {
            persistTokens();
        }
    }

    private synchronized boolean login() throws IOException {
        String endpoint = authUrl + "/v1/login";
        Map<String, String> payload = Map.of(
                "username", username.toLowerCase(),
                "password", password
        );

        HttpURLConnection conn = (HttpURLConnection) new URL(endpoint).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Accept", "application/json");
        if (StringUtils.isNotBlank(userAgent)) {
            conn.setRequestProperty("User-Agent", userAgent);
        }
        conn.setDoOutput(true);
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(15_000);

        byte[] postBytes = OBJECT_MAPPER.writeValueAsBytes(payload);
        try (OutputStream os = conn.getOutputStream()) {
            os.write(postBytes);
        }

        int status = conn.getResponseCode();
        if (status == 200) {
            try (InputStream is = conn.getInputStream()) {
                Map resp = OBJECT_MAPPER.readValue(is, Map.class);
                this.accessToken = (String) resp.get("access_token");
                this.refreshToken = (String) resp.get("refresh_token");
                this.idToken = (String) resp.get("id_token");
                long expiresIn = resp.get("expires_in") != null ? ((Number) resp.get("expires_in")).longValue() : 86400L;
                long now = System.currentTimeMillis();
                this.expiresAtMillis = now + (expiresIn * 1000L);
                // Refresh tokens are valid for 90 days according to Wikimedia docs
                this.refreshTokenExpiresAtMillis = now + (90L * 24 * 3600 * 1000L);
                persistTokens();
                return true;
            }
        } else {
            String errorMsg = "";
            try (InputStream es = conn.getErrorStream()) {
                if (es != null) {
                    errorMsg = new String(es.readAllBytes(), StandardCharsets.UTF_8);
                }
            } catch (Exception ignored) {
            }
            System.err.println("Wikimedia login failed with HTTP " + status + ": " + errorMsg);
            return false;
        }
    }

    private synchronized boolean refreshAccessToken() throws IOException {
        String endpoint = authUrl + "/v1/token-refresh";
        Map<String, String> payload = Map.of("refresh_token", refreshToken);

        HttpURLConnection conn = (HttpURLConnection) new URL(endpoint).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Accept", "application/json");
        if (StringUtils.isNotBlank(userAgent)) {
            conn.setRequestProperty("User-Agent", userAgent);
        }
        conn.setDoOutput(true);
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(15_000);

        byte[] postBytes = OBJECT_MAPPER.writeValueAsBytes(payload);
        try (OutputStream os = conn.getOutputStream()) {
            os.write(postBytes);
        }

        int status = conn.getResponseCode();
        if (status == 200) {
            try (InputStream is = conn.getInputStream()) {
                Map resp = OBJECT_MAPPER.readValue(is, Map.class);
                this.accessToken = (String) resp.get("access_token");
                if (resp.containsKey("id_token")) {
                    this.idToken = (String) resp.get("id_token");
                }
                long expiresIn = resp.get("expires_in") != null ? ((Number) resp.get("expires_in")).longValue() : 86400L;
                this.expiresAtMillis = System.currentTimeMillis() + (expiresIn * 1000L);
                persistTokens();
                return true;
            }
        } else {
            // Refresh token may have expired or revoked
            this.refreshToken = null;
            this.refreshTokenExpiresAtMillis = 0;
            return false;
        }
    }

    /**
     * Parses the Retry-After header.
     * Can be integer seconds (e.g. "30") or HTTP-date (RFC 1123).
     *
     * @param retryAfterHeader value of the Retry-After response header
     * @return delay in milliseconds to pause before retrying
     */
    public static long parseRetryAfter(String retryAfterHeader) {
        if (StringUtils.isBlank(retryAfterHeader)) {
            return DEFAULT_RATE_LIMIT_PAUSE_MS;
        }

        String trimmed = retryAfterHeader.trim();

        // 1. Try parsing as integer seconds
        try {
            long seconds = Long.parseLong(trimmed);
            return Math.max(seconds, 1L) * 1000L;
        } catch (NumberFormatException ignored) {
        }

        // 2. Try parsing as RFC 1123 HTTP date
        try {
            ZonedDateTime date = ZonedDateTime.parse(trimmed, DateTimeFormatter.RFC_1123_DATE_TIME);
            long delayMs = date.toInstant().toEpochMilli() - System.currentTimeMillis();
            return Math.max(delayMs, DEFAULT_RATE_LIMIT_PAUSE_MS);
        } catch (DateTimeParseException ignored) {
        }

        return DEFAULT_RATE_LIMIT_PAUSE_MS;
    }

    /**
     * Fetches the HTML of a Wikipedia page and saves it to outputFile.
     * Respects rate limits, 429/503 Retry-After, and 401 re-authentication.
     *
     * @param url Wikipedia page URL
     * @param outputFile target file on disk
     * @return true if successfully fetched and written, false otherwise
     */
    public boolean fetchPageHtml(String url, File outputFile) {
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            // Wait if global rate limit pause is currently in effect
            long waitTime = pauseUntilTimestamp.get() - System.currentTimeMillis();
            if (waitTime > 0) {
                try {
                    Thread.sleep(waitTime);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return false;
                }
            }

            try {
                Connection conn = Jsoup.connect(url)
                        .userAgent(userAgent)
                        .ignoreHttpErrors(true)
                        .followRedirects(true)
                        .timeout(30_000);

                String token = getValidAccessToken();
                if (StringUtils.isNotBlank(token)) {
                    conn.header("Authorization", "Bearer " + token);
                }

                Connection.Response response = conn.execute();
                int statusCode = response.statusCode();

                if (statusCode == 200) {
                    Document doc = response.parse();
                    File parent = outputFile.getParentFile();
                    if (parent != null && !parent.exists()) {
                        parent.mkdirs();
                    }
                    try (FileWriter writer = new FileWriter(outputFile, StandardCharsets.UTF_8)) {
                        writer.write(doc.outerHtml());
                    }
                    return true;
                } else if (statusCode == 401) {
                    System.err.println("Received 401 Unauthorized for URL " + url + ". Invalidating token and retrying.");
                    invalidateAccessToken();
                    Thread.sleep(500);
                } else if (statusCode == 429 || statusCode == 503) {
                    String retryAfterHeader = response.header("Retry-After");
                    long pauseMs = parseRetryAfter(retryAfterHeader);
                    long targetPause = System.currentTimeMillis() + pauseMs;
                    pauseUntilTimestamp.accumulateAndGet(targetPause, Math::max);
                    System.out.println("Rate limited (HTTP " + statusCode + ") for " + url + ", pausing for " + (pauseMs / 1000) + "s (attempt " + attempt + "/" + maxRetries + ")");
                    Thread.sleep(pauseMs);
                } else if (statusCode == 404) {
                    // Page not found; no retry needed
                    return false;
                } else {
                    System.err.println("HTTP " + statusCode + " fetching " + url + " (attempt " + attempt + "/" + maxRetries + ")");
                    if (attempt < maxRetries) {
                        Thread.sleep(1000L * attempt);
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            } catch (Exception e) {
                System.err.println("Error fetching wikipedia html for: " + url + ", " + e.getMessage() + " (attempt " + attempt + "/" + maxRetries + ")");
                if (attempt < maxRetries) {
                    try {
                        Thread.sleep(1000L * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return false;
                    }
                }
            }
        }

        return false;
    }
}
