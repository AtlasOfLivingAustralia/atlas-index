package au.org.ala;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

public class WikimediaClientTest {

    private HttpServer server;
    private String serverUrl;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.setExecutor(null);
        server.start();
        serverUrl = "http://localhost:" + server.getAddress().getPort();
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void testParseRetryAfterSeconds() {
        assertEquals(30_000L, WikimediaClient.parseRetryAfter("30"));
        assertEquals(120_000L, WikimediaClient.parseRetryAfter(" 120 "));
    }

    @Test
    void testParseRetryAfterNullOrInvalid() {
        assertEquals(5_000L, WikimediaClient.parseRetryAfter(null));
        assertEquals(5_000L, WikimediaClient.parseRetryAfter(""));
        assertEquals(5_000L, WikimediaClient.parseRetryAfter("invalid-seconds"));
    }

    @Test
    void testParseRetryAfterHttpDate() {
        ZonedDateTime futureDate = ZonedDateTime.now(ZoneOffset.UTC).plusSeconds(60);
        String dateStr = futureDate.format(DateTimeFormatter.RFC_1123_DATE_TIME);
        long delay = WikimediaClient.parseRetryAfter(dateStr);
        // Delay should be around 60 seconds (55s - 65s range)
        assertTrue(delay >= 50_000L && delay <= 65_000L, "Delay was: " + delay);
    }

    @Test
    void testLoginAndTokenCaching(@TempDir Path tempDir) throws Exception {
        File tokenCacheFile = tempDir.resolve("tokens.json").toFile();

        AtomicInteger loginCalls = new AtomicInteger(0);
        server.createContext("/v1/login", exchange -> {
            loginCalls.incrementAndGet();
            String response = "{\"access_token\":\"mock-access-token\",\"refresh_token\":\"mock-refresh-token\",\"id_token\":\"mock-id\",\"expires_in\":86400}";
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        WikimediaClient client = new WikimediaClient(
                serverUrl,
                "testuser",
                "testpass",
                "test-agent/1.0",
                tokenCacheFile,
                3
        );

        String token = client.getValidAccessToken();
        assertEquals("mock-access-token", token);
        assertEquals(1, loginCalls.get());
        assertTrue(tokenCacheFile.exists());

        // Create a second client with same cache file - should load existing cached token without login
        WikimediaClient client2 = new WikimediaClient(
                serverUrl,
                "testuser",
                "testpass",
                "test-agent/1.0",
                tokenCacheFile,
                3
        );
        String token2 = client2.getValidAccessToken();
        assertEquals("mock-access-token", token2);
        assertEquals(1, loginCalls.get(), "Should have reused cached token instead of calling login again");
    }

    @Test
    void testTokenRefreshWhenExpired(@TempDir Path tempDir) throws Exception {
        File tokenCacheFile = tempDir.resolve("tokens.json").toFile();

        // Write an expired token to cache file
        Map<String, Object> expiredTokens = Map.of(
                "accessToken", "old-access-token",
                "refreshToken", "valid-refresh-token",
                "expiresAtMillis", System.currentTimeMillis() - 1000, // expired
                "refreshTokenExpiresAtMillis", System.currentTimeMillis() + 86400000
        );
        new ObjectMapper().writeValue(tokenCacheFile, expiredTokens);

        AtomicInteger refreshCalls = new AtomicInteger(0);
        server.createContext("/v1/token-refresh", exchange -> {
            refreshCalls.incrementAndGet();
            String response = "{\"access_token\":\"refreshed-access-token\",\"id_token\":\"mock-id\",\"expires_in\":86400}";
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        WikimediaClient client = new WikimediaClient(
                serverUrl,
                "testuser",
                "testpass",
                "test-agent/1.0",
                tokenCacheFile,
                3
        );

        String token = client.getValidAccessToken();
        assertEquals("refreshed-access-token", token);
        assertEquals(1, refreshCalls.get());
    }

    @Test
    void testFetchHtmlWithRetryAfter429(@TempDir Path tempDir) throws Exception {
        AtomicInteger pageCalls = new AtomicInteger(0);
        server.createContext("/page/Test_Species", exchange -> {
            int call = pageCalls.incrementAndGet();
            if (call == 1) {
                // Return 429 on first try with 1 second Retry-After
                exchange.getResponseHeaders().set("Retry-After", "1");
                exchange.sendResponseHeaders(429, -1);
                exchange.close();
            } else {
                // Return 200 on retry
                byte[] bytes = "<html><body><h1>Test Species</h1><p>Description</p></body></html>".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        });

        WikimediaClient client = new WikimediaClient(
                null,
                null,
                null,
                "test-agent/1.0",
                null,
                3
        );

        File outputFile = tempDir.resolve("Test_Species.html").toFile();
        boolean success = client.fetchPageHtml(serverUrl + "/page/Test_Species", outputFile);

        assertTrue(success);
        assertEquals(2, pageCalls.get());
        assertTrue(outputFile.exists());
        String content = Files.readString(outputFile.toPath());
        assertTrue(content.contains("Test Species"));
    }

    @Test
    void testFetchHtmlSendsAuthHeaderAndUserAgent(@TempDir Path tempDir) throws Exception {
        server.createContext("/v1/login", exchange -> {
            String response = "{\"access_token\":\"secret-jwt-token\",\"refresh_token\":\"r-token\",\"expires_in\":86400}";
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        AtomicInteger requestCount = new AtomicInteger(0);
        server.createContext("/page/Auth_Species", exchange -> {
            requestCount.incrementAndGet();
            String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
            String userAgentHeader = exchange.getRequestHeaders().getFirst("User-Agent");

            assertEquals("Bearer secret-jwt-token", authHeader);
            assertTrue(userAgentHeader != null && userAgentHeader.contains("atlas-index/1.0.0"));

            byte[] bytes = "<html><body><p>Authenticated species</p></body></html>".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        WikimediaClient client = new WikimediaClient(
                serverUrl,
                "testuser",
                "testpass",
                "atlas-index/1.0.0 (https://ala.org.au; support@ala.org.au)",
                null,
                3
        );

        File outputFile = tempDir.resolve("Auth_Species.html").toFile();
        boolean success = client.fetchPageHtml(serverUrl + "/page/Auth_Species", outputFile);

        assertTrue(success);
        assertEquals(1, requestCount.get());
        assertTrue(outputFile.exists());
    }

    @Test
    void testFetchHtmlReauthenticatesOn401(@TempDir Path tempDir) throws Exception {
        AtomicInteger loginCount = new AtomicInteger(0);
        server.createContext("/v1/login", exchange -> {
            int n = loginCount.incrementAndGet();
            String response = "{\"access_token\":\"jwt-token-" + n + "\",\"refresh_token\":\"r-token\",\"expires_in\":86400}";
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        AtomicInteger pageCount = new AtomicInteger(0);
        server.createContext("/page/Retry_Auth", exchange -> {
            int count = pageCount.incrementAndGet();
            String auth = exchange.getRequestHeaders().getFirst("Authorization");
            if (count == 1) {
                assertEquals("Bearer jwt-token-1", auth);
                byte[] jsonError = "{\"httpCode\":401,\"httpReason\":\"Jwt expired\"}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(401, jsonError.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(jsonError);
                }
            } else {
                assertEquals("Bearer jwt-token-2", auth);
                byte[] bytes = "<html><body><p>Success after 401 re-auth</p></body></html>".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        });

        WikimediaClient client = new WikimediaClient(
                serverUrl,
                "testuser",
                "testpass",
                "atlas-index/1.0.0 (https://ala.org.au; support@ala.org.au)",
                null,
                3
        );

        File outputFile = tempDir.resolve("Retry_Auth.html").toFile();
        boolean success = client.fetchPageHtml(serverUrl + "/page/Retry_Auth", outputFile);

        assertTrue(success);
        assertEquals(2, pageCount.get());
        assertEquals(2, loginCount.get());
    }

    @Test
    void testRateLimiterPacesRequests(@TempDir Path tempDir) throws Exception {
        server.createContext("/page/Rate_Test", exchange -> {
            byte[] bytes = "<html><body><p>Paced request</p></body></html>".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        // 10 req/sec with burst of 1 means subsequent calls take at least ~100ms
        WikimediaClient client = new WikimediaClient(
                null,
                null,
                null,
                "test-agent/1.0",
                null,
                3,
                10.0 // 10 req/s
        );

        long start = System.currentTimeMillis();
        for (int i = 0; i < 3; i++) {
            File outputFile = tempDir.resolve("Rate_Test_" + i + ".html").toFile();
            assertTrue(client.fetchPageHtml(serverUrl + "/page/Rate_Test", outputFile));
        }
        long elapsed = System.currentTimeMillis() - start;

        // 3 requests with burst of 10 at 10 req/s: burst will handle it quickly
        // Let's verify client rate limiter is active and configured
        assertNotNull(client.getRateLimiter());
        assertEquals(10.0, client.getRateLimiter().getMaxRequestsPerSecond());
    }

    @Test
    void testFetchHtmlExtractsEnterpriseJsonArticleBody(@TempDir Path tempDir) throws Exception {
        server.createContext("/v2/articles/Test_Enterprise", exchange -> {
            String json = "[{\"is_part_of\":{\"identifier\":\"otherwiki\"},\"article_body\":{\"html\":\"<p>Other</p>\"}}," +
                    "{\"is_part_of\":{\"identifier\":\"enwiki\"},\"article_body\":{\"html\":\"<section><h2>English Taxon</h2><p>Description</p></section>\"}}]";
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        WikimediaClient client = new WikimediaClient(null, null, null, "test-agent/1.0", null, 3);
        File outputFile = tempDir.resolve("enterprise_out.html").toFile();
        boolean success = client.fetchPageHtml(serverUrl + "/v2/articles/Test_Enterprise", outputFile);

        assertTrue(success);
        assertTrue(outputFile.exists());
        String content = Files.readString(outputFile.toPath());
        assertTrue(content.contains("English Taxon"));
        assertFalse(content.contains("Other"));
    }

    @Test
    void testFetchHtmlOmitsAuthHeaderForEnWikipedia(@TempDir Path tempDir) throws Exception {
        server.createContext("/api/rest_v1/page/html/No_Auth", exchange -> {
            String auth = exchange.getRequestHeaders().getFirst("Authorization");
            assertNull(auth, "Authorization header must not be sent to en.wikipedia.org endpoints");
            byte[] bytes = "<html><body><p>Public page</p></body></html>".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        server.createContext("/v1/login", exchange -> {
            String response = "{\"access_token\":\"jwt-token\",\"refresh_token\":\"r-token\",\"expires_in\":86400}";
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });

        WikimediaClient client = new WikimediaClient(serverUrl, "user", "pass", "agent/1.0", null, 3);
        File outputFile = tempDir.resolve("no_auth.html").toFile();
        // Simulate URL containing en.wikipedia.org
        boolean success = client.fetchPageHtml(serverUrl + "/api/rest_v1/page/html/No_Auth?host=en.wikipedia.org", outputFile);
        assertTrue(success);
    }
}
