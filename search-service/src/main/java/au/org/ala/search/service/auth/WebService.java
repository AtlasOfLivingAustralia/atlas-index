/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.auth;

import au.org.ala.web.UserDetails;
import au.org.ala.ws.security.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.net.HttpHeaders;
import com.nimbusds.oauth2.sdk.token.AccessToken;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpStatus;
import org.apache.http.entity.ContentType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.apache.http.HttpHeaders.CONNECTION;
import static org.springframework.http.HttpHeaders.CONTENT_DISPOSITION;
import static org.springframework.http.HttpMethod.*;

/**
 * A generic web service client based on a subset of the ala-security-project grails WebService.
 */
@Slf4j
@Service
public class WebService {
    final TokenService tokenService;

    @Value("${webservice.connect.timeout}")
    private Integer connectTimeout;
    @Value("${webservice.read.timeout}")
    private Integer readTimeout;
    @Value("${webservice.jwt}")
    private Boolean webserviceJwt;
    @Value("${app.name}")
    private String infoAppName;
    @Value("${app.version}")
    private String infoAppVersion;

    public WebService(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    private static String appendQueryString(String url, Map<String, String> params) {
        if (params != null) {
            StringBuilder sb = new StringBuilder();
            params.forEach((k, v) -> {
                        sb.append(sb.isEmpty() ? "?" : "&");
                        sb.append(enc(String.valueOf(k))).append("=").append(enc(String.valueOf(v)));
                    }
            );
            return url + sb;
        }

        return url;
    }

    static String enc(String str) {
        return str != null ? URLEncoder.encode(str, StandardCharsets.UTF_8) : "";
    }

    /**
     * Sends an HTTP GET request to the specified URL. The URL must already be URL-encoded (if necessary).
     * <p>
     * Note: by default, the Accept header will be set to the same content type as the ContentType provided. To override
     * this default behaviour, include an 'Accept' header in the 'customHeaders' parameter.
     *
     * @param url           The url-encoded URL to send the request to
     * @param params        Map of parameters to be appended to the query string. Parameters will be URL-encoded automatically.
     * @param contentType   the desired content type for the request. Defaults to application/json
     * @param includeApiKey true to include the service's API Key in the request headers (uses property 'service.apiKey').  If using JWTs, instead sends a JWT Bearer tokens Default = true.
     * @param includeUser   (not implemented, always false) true to include the userId and email in the request headers and the ALA-Auth cookie.  If using JWTs sends the current user's access token, if false only sends a ClientCredentials grant token for this apps client id Default = true.
     * @param customHeaders Map of [headerName:value] for any extra HTTP headers to be sent with the request. Default = [:].
     * @return [statusCode: int, resp: [:]] on success, or [statusCode: int, error: string] on error
     */
    public Map get(String url, Map params, ContentType contentType, boolean includeApiKey, boolean includeUser, Map customHeaders) {
        return send(GET, url, params, contentType, null, null, includeApiKey, includeUser, customHeaders);
    }

    /**
     * Sends an HTTP POST request to the specified URL. The URL must already be URL-encoded (if necessary).
     * <p>
     * Note: by default, the Accept header will be set to the same content type as the ContentType provided. To override
     * this default behaviour, include an 'Accept' header in the 'customHeaders' parameter.
     * <p>
     * The body map will be sent as the body of the request (i.e. use request.getJSON() on the receiving end).
     *
     * @param url           The url-encoded url to send the request to
     * @param body          Object containing the data to be sent as the post body. e.g. Map, Array
     * @param params        Map of parameters to be appended to the query string. Parameters will be URL-encoded automatically.
     * @param contentType   the desired content type for the request. Defaults to application/json
     * @param includeApiKey true to include the service's API Key in the request headers (uses property 'service.apiKey').  If using JWTs, instead sends a JWT Bearer tokens Default = true.
     * @param includeUser   (not implemented, always false) true to include the userId and email in the request headers and the ALA-Auth cookie.  If using JWTs sends the current user's access token, if false only sends a ClientCredentials grant token for this apps client id Default = true.
     * @param customHeaders Map of [headerName:value] for any extra HTTP headers to be sent with the request. Default = [:].
     * @return [statusCode: int, resp: [:]] on success, or [statusCode: int, error: string] on error
     */
    public Map post(String url, Object body, Map params, ContentType contentType, boolean includeApiKey, boolean includeUser, Map customHeaders) {
        return send(POST, url, params, contentType, body, null, includeApiKey, includeUser, customHeaders);
    }

    private Map send(HttpMethod method, String url, Map params, ContentType contentType,
                     Object body, Object files, boolean includeApiKey, boolean includeUser,
                     Map customHeaders) {
        log.debug("{} request to {}", method.name(), url);

        Map result = new HashMap();

        HttpURLConnection conn = null;

        try {
            url = appendQueryString(url, params);

            conn = (HttpURLConnection) configureConnection(url, includeApiKey, includeUser);
            conn.setUseCaches(false);

            conn.setRequestMethod(method.name());
            conn.setRequestProperty(CONNECTION, "close"); // disable Keep Alive

            if (!"GET".equals(method.name()) && !"DELETE".equals(method.name())) {
                conn.setDoOutput(true);
            }

            conn.setRequestProperty("Content-Type", contentType.toString());

            configureRequestTimeouts(conn);
            configureRequestHeaders(conn, includeApiKey, includeUser, customHeaders);

            if (files != null) {
                // This is here in case the other source WebService methods are added to this class
            } else if (body != null) {
                // NOTE: order is important - Content-Type MUST be set BEFORE the body
                OutputStreamWriter wr = new OutputStreamWriter(conn.getOutputStream());
                if (contentType.equals(ContentType.APPLICATION_JSON)) {
                    wr.write(new ObjectMapper().writer().writeValueAsString(body));
                } else {
                    wr.write(String.valueOf(body));
                }
                wr.flush();
            }

            int statusCode = conn.getResponseCode();
            result.put("statusCode", statusCode);
            if (statusCode == HttpURLConnection.HTTP_OK || statusCode == HttpURLConnection.HTTP_CREATED) {
                String text = IOUtils.toString(conn.getInputStream(), StandardCharsets.UTF_8);
                try {
                    Map resp = new ObjectMapper().readValue(text, Map.class);
                    result.put("resp", resp);
                } catch (Exception e) {
                    result.put("resp", text);
                }
            } else {
                log.error("{} return statusCode: {}", url, statusCode);
                result.put("error", "Failed calling web service - service returned HTTP " + statusCode);
            }
        } catch (Exception e) {
            log.error("Failed sending {} request to {}", method.name(), url, e);
            result.put("statusCode", HttpStatus.SC_INTERNAL_SERVER_ERROR);
            result.put("error", "Failed calling web service. " + e.getClass().getName() + " " + e.getMessage() + " URL= " + url + ", method " + method.name() + ".");
        }

        return result;
    }

    private void configureRequestTimeouts(HttpURLConnection conn) {
        conn.setConnectTimeout(connectTimeout);
        conn.setReadTimeout(readTimeout);
    }

    private void configureRequestHeaders(HttpURLConnection conn, boolean includeApiKey, boolean includeUser, Map<String, String> customHeaders) {
        UserDetails user = null; // here because it is in the grails WebService, but it is never used

        conn.setRequestProperty(HttpHeaders.USER_AGENT, getUserAgent());

        includeAuthTokensInternal(conn, includeUser, includeApiKey, user);

        if (customHeaders != null) {
            for (Map.Entry<String, String> entry : customHeaders.entrySet()) {
                conn.setRequestProperty(entry.getKey(), entry.getValue());
            }
        }
    }

    // includeUser is not implemented - user is always null
    private URLConnection configureConnection(String url, boolean includeApiKey, boolean includeUser) throws IOException {
        URLConnection conn = URI.create(url).toURL().openConnection();

        conn.setConnectTimeout(connectTimeout);
        conn.setReadTimeout(readTimeout);
        conn.setRequestProperty(HttpHeaders.USER_AGENT, getUserAgent());
        UserDetails user = null; // Not implemented

        includeAuthTokens((HttpURLConnection) conn, includeUser, includeApiKey, user);

        return conn;
    }

    void includeAuthTokens(HttpURLConnection conn, Boolean includeUser, Boolean includeApiKey, UserDetails user) {
        includeAuthTokensInternal(conn, includeUser, includeApiKey, user);
    }

    private void includeAuthTokensInternal(HttpURLConnection conn, Boolean includeUser, Boolean includeApiKey, UserDetails user) {
        if (webserviceJwt) {
            includeAuthTokensJwt(conn, includeUser, includeApiKey, user);
        }
    }

    void includeAuthTokensJwt(HttpURLConnection conn, Boolean includeUser, Boolean includeApiKey, UserDetails user) {
        if ((user != null && includeUser) || (includeApiKey)) {
            AccessToken token = tokenService.getAuthToken(user != null && includeUser, null, null);
            if (token != null) {
                conn.setRequestProperty(HttpHeaders.AUTHORIZATION, token.toAuthorizationHeader());
            }
        }
    }

    private String getUserAgent() {
        return infoAppName + "/" + infoAppVersion;
    }
}
