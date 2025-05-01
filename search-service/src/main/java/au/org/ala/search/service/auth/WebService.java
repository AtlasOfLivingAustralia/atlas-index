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
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpStatus;
import org.apache.http.entity.ContentType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

// TODO: move this and related classes into ala-security-project
@Service
public class WebService {
    private static final Logger logger = LoggerFactory.getLogger(WebService.class);
    // TODO: enable authService; static final String DEFAULT_AUTH_HEADER = "X-ALA-userId";
    // TODO: enable authService; AuthService authService
    @Autowired
    TokenService tokenService;

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
     * @param includeUser   true to include the userId and email in the request headers and the ALA-Auth cookie.  If using JWTs sends the current user's access token, if false only sends a ClientCredentials grant token for this apps client id Default = true.
     * @param customHeaders Map of [headerName:value] for any extra HTTP headers to be sent with the request. Default = [:].
     * @return [statusCode: int, resp: [:]] on success, or [statusCode: int, error: string] on error
     */
    public Map get(String url, Map params, ContentType contentType, boolean includeApiKey, boolean includeUser, Map customHeaders) {
        return send(GET, url, params, contentType, null, null, includeApiKey, includeUser, customHeaders);
    }

    /**
     * Sends an HTTP PUT request to the specified URL. The URL must already be URL-encoded (if necessary).
     * <p>
     * Note: by default, the Accept header will be set to the same content type as the ContentType provided. To override
     * this default behaviour, include an 'Accept' header in the 'customHeaders' parameter.
     * <p>
     * The body map will be sent as the JSON body of the request (i.e. use request.getJSON() on the receiving end).
     *
     * @param url           The url-encoded url to send the request to
     * @param body          Object containing the data to be sent as the post body. e.g. Map, Array
     * @param params        Map of parameters to be appended to the query string. Parameters will be URL-encoded automatically.
     * @param contentType   the desired content type for the request. Defaults to application/json
     * @param includeApiKey true to include the service's API Key in the request headers (uses property 'service.apiKey').  If using JWTs, instead sends a JWT Bearer tokens Default = true.
     * @param includeUser   true to include the userId and email in the request headers and the ALA-Auth cookie.  If using JWTs sends the current user's access token, if false only sends a ClientCredentials grant token for this apps client id Default = true.
     * @param customHeaders Map of [headerName:value] for any extra HTTP headers to be sent with the request. Default = [:].
     * @return [statusCode: int, resp: [:]] on success, or [statusCode: int, error: string] on error
     */
    Map put(String url, Object body, Map params, ContentType contentType, boolean includeApiKey, boolean includeUser, Map customHeaders) {
        return send(PUT, url, params, contentType, body, null, includeApiKey, includeUser, customHeaders);
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
     * @param includeUser   true to include the userId and email in the request headers and the ALA-Auth cookie.  If using JWTs sends the current user's access token, if false only sends a ClientCredentials grant token for this apps client id Default = true.
     * @param customHeaders Map of [headerName:value] for any extra HTTP headers to be sent with the request. Default = [:].
     * @return [statusCode: int, resp: [:]] on success, or [statusCode: int, error: string] on error
     */
    public Map post(String url, Object body, Map params, ContentType contentType, boolean includeApiKey, boolean includeUser, Map customHeaders) {
        return send(POST, url, params, contentType, body, null, includeApiKey, includeUser, customHeaders);
    }

    /**
     * Sends a multipart HTTP POST request to the specified URL. The URL must already be URL-encoded (if necessary).
     * <p>
     * Note: by default, the Accept header will be set to the same content type as the ContentType provided. To override
     * this default behaviour, include an 'Accept' header in the 'customHeaders' parameter.
     * <p>
     * Each item in the body map will be sent as a separate Part in the Multipart Request. To send the entire map as a
     * single part, you will need too use the format [data: body].
     * <p>
     * Files can be one of the following types:
     * <ul>
     * <li>byte[]</li>
     * <li>CommonsMultipartFile</li>
     * <li>InputStream</li>
     * <li>File</li>
     * <li>Anything that supports the .bytes accessor</li>
     * </ul>
     *
     * @param url             The url-encoded url to send the request to
     * @param body            Object containing the data to be sent as the post body. e.g. Map, Array
     * @param params          Map of parameters to be appended to the query string. Parameters will be URL-encoded automatically.
     * @param files           List of 0 or more files to be included in the multipart request (note: if files is null, then the request will NOT be multipart)
     * @param partContentType the desired content type for the request PARTS (the request itself will always be sent as multipart/form-data). Defaults to application/json. All non-file parts will have the same content type.
     * @param includeApiKey   true to include the service's API Key in the request headers (uses property 'service.apiKey').  If using JWTs, instead sends a JWT Bearer tokens Default = true.
     * @param includeUser     true to include the userId and email in the request headers and the ALA-Auth cookie.  If using JWTs sends the current user's access token, if false only sends a ClientCredentials grant token for this apps client id Default = true.
     * @param customHeaders   Map of [headerName:value] for any extra HTTP headers to be sent with the request. Default = [:].
     * @return [statusCode: int, resp: [:]] on success, or [statusCode: int, error: string] on error
     */
    Map postMultipart(String url, Object body, Map params, List files, ContentType partContentType, boolean includeApiKey, boolean includeUser, Map customHeaders) {
        return send(POST, url, params, partContentType, body, files, includeApiKey, includeUser, customHeaders);
    }

    /**
     * Sends a multipart HTTP POST request to the specified URL. The URL must already be URL-encoded (if necessary).
     * <p>
     * Note: by default, the Accept header will be set to the same content type as the ContentType provided. To override
     * this default behaviour, include an 'Accept' header in the 'customHeaders' parameter.
     * <p>
     * Each item in the body map will be sent as a separate Part in the Multipart Request. To send the entire map as a
     * single part, you will need too use the format [data: body].
     * <p>
     * Files map is [String: Object] that can be one of the following types:
     * <ul>
     * <li>byte[]</li>
     * <li>CommonsMultipartFile</li>
     * <li>InputStream</li>
     * <li>File</li>
     * <li>Anything that supports the .bytes accessor</li>
     * </ul>
     *
     * @param url             The url-encoded url to send the request to
     * @param body            Object containing the data to be sent as the post body. e.g. Map, Array
     * @param params          Map of parameters to be appended to the query string. Parameters will be URL-encoded automatically.
     * @param files           Map of 0 or more names and files to be included in the multipart request (note: if files is null, then the request will NOT be multipart)
     * @param partContentType the desired content type for the request PARTS (the request itself will always be sent as multipart/form-data). Defaults to application/json. All non-file parts will have the same content type.
     * @param includeApiKey   true to include the service's API Key in the request headers (uses property 'service.apiKey').  If using JWTs, instead sends a JWT Bearer tokens Default = true.
     * @param includeUser     true to include the userId and email in the request headers and the ALA-Auth cookie.  If using JWTs sends the current user's access token, if false only sends a ClientCredentials grant token for this apps client id Default = true.
     * @param customHeaders   Map of [headerName:value] for any extra HTTP headers to be sent with the request. Default = [:].
     * @return [statusCode: int, resp: [:]] on success, or [statusCode: int, error: string] on error
     */
    Map postMultipart(String url, Object body, Map params, Map files, ContentType partContentType, boolean includeApiKey, boolean includeUser, Map customHeaders) {
        return send(POST, url, params, partContentType, body, files, includeApiKey, includeUser, customHeaders);
    }

    /**
     * Sends a HTTP DELETE request to the specified URL. The URL must already be URL-encoded (if necessary).
     * <p>
     * Note: by default, the Accept header will be set to the same content type as the ContentType provided. To override
     * this default behaviour, include an 'Accept' header in the 'customHeaders' parameter.
     *
     * @param url           The url-encoded url to send the request to
     * @param params        Map of parameters to be appended to the query string. Parameters will be URL-encoded automatically.
     * @param contentType   the desired content type for the request. Defaults to application/json
     * @param includeApiKey true to include the service's API Key in the request headers (uses property 'service.apiKey').  If using JWTs, instead sends a JWT Bearer tokens Default = true.
     * @param includeUser   true to include the userId and email in the request headers and the ALA-Auth cookie.  If using JWTs sends the current user's access token, if false only sends a ClientCredentials grant token for this apps client id Default = true.
     * @param customHeaders Map of [headerName:value] for any extra HTTP headers to be sent with the request. Default = [:].
     * @return [statusCode: int, resp: [:]] on success, or [statusCode: int, error: string] on error
     */
    Map delete(String url, Map params, ContentType contentType, boolean includeApiKey, boolean includeUser, Map customHeaders) {
        return send(DELETE, url, params, contentType, null, null, includeApiKey, includeUser, customHeaders);
    }

    /**
     * Proxies a request URL but doesn't assume the response is text based.
     * <p>
     * Used for operations like proxying a download request from one application to another.
     *
     * @param response      The HttpServletResponse of the calling request: the response from the proxied request will be written to this object
     * @param url           The URL of the service to proxy to
     * @param includeApiKey true to include the service's API Key in the request headers (uses property 'service.apiKey').  If using JWTs, instead sends a JWT Bearer tokens Default = true.
     * @param includeUser   true to include the userId and email in the request headers and the ALA-Auth cookie.  If using JWTs sends the current user's access token, if false only sends a ClientCredentials grant token for this apps client id Default = true.
     */
    void proxyGetRequest(HttpServletResponse response, String url, boolean includeApiKey, boolean includeUser) {
        logger.debug("Proxying GET request to " + url);
        HttpURLConnection conn = null;

        try {
            conn = (HttpURLConnection) configureConnection(url, includeApiKey, includeUser);
            conn.setUseCaches(false);

            conn.setRequestProperty(CONNECTION, "close"); // disable Keep Alive

            conn.connect();

            response.setContentType(conn.getContentType());
            int contentLength = conn.getContentLength();
            if (contentLength != -1) {
                response.setContentLength(contentLength);
            }

            String headerValue = conn.getHeaderField(CONTENT_DISPOSITION);
            if (headerValue != null) {
                response.setHeader(CONTENT_DISPOSITION, headerValue);
            }

            response.setStatus(conn.getResponseCode());
            IOUtils.copy(conn.getInputStream(), response.getOutputStream());
        } catch (IOException e) {
            logger.error("failed to proxyGetRequest " + url + ", " + e.getMessage(), e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    /**
     * Proxies a request URL with post data but doesn't assume the response is text based.
     *
     * @param response      The HttpServletResponse of the calling request: the response from the proxied request will be written to this object
     * @param url           The URL of the service to proxy to
     * @param postBody      The POST data to send with the proxied request. If it is a Collection, then it will be converted to JSON, otherwise it will be sent as a String.
     * @param contentType   the desired content type for the request. Defaults to application/json.
     * @param includeApiKey true to include the service's API Key in the request headers (uses property 'service.apiKey').  If using JWTs, instead sends a JWT Bearer tokens Default = true.
     * @param includeUser   true to include the userId and email in the request headers and the ALA-Auth cookie.  If using JWTs sends the current user's access token, if false only sends a ClientCredentials grant token for this apps client id Default = true.
     */
    void proxyPostRequest(HttpServletResponse response, String url, Object postBody, ContentType contentType, boolean includeApiKey, boolean includeUser, Map<String, String> cookies) {
        logger.debug("Proxying POST request to " + url);

        HttpURLConnection conn = null;

        try {
            conn = (HttpURLConnection) configureConnection(url, includeApiKey, includeUser);
            conn.setUseCaches(false);

            conn.setRequestMethod("POST");
            conn.setRequestProperty(CONNECTION, "close"); // disable Keep Alive
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", contentType.toString());

            if (cookies != null) {
                for (Map.Entry<String, String> entry : cookies.entrySet()) {
                    conn.setRequestProperty(entry.getKey(), entry.getValue());
                }
            }

            OutputStreamWriter wr = new OutputStreamWriter(conn.getOutputStream(), StandardCharsets.UTF_8);
            if (contentType == ContentType.APPLICATION_JSON && postBody instanceof Collection) {
                wr.write(new ObjectMapper().writer().writeValueAsString(postBody));
            } else if (contentType == ContentType.APPLICATION_FORM_URLENCODED) {
                StringBuilder formData = new StringBuilder();
                if (postBody instanceof Map) {
                    ((Map<?, ?>) postBody).forEach((k, v) -> {
                        formData.append(formData.isEmpty() ? "" : "&").append(enc(String.valueOf(k))).append("=");
                        if (v instanceof Collection || v instanceof String[]) {
                            formData.append(enc(StringUtils.join(v, ", ")));
                        } else {
                            formData.append(enc(String.valueOf(v)));
                        }
                    });
                }
                wr.write(formData.toString());
            } else {
                wr.write(String.valueOf(postBody));
            }
            wr.flush();
            wr.close();

            response.setContentType(conn.getContentType());
            int contentLength = conn.getContentLength();
            if (contentLength != -1) {
                response.setContentLength(contentLength);
            }

            String headerValue = conn.getHeaderField(CONTENT_DISPOSITION);
            if (headerValue != null) {
                response.setHeader(CONTENT_DISPOSITION, headerValue);
            }

            response.setStatus(conn.getResponseCode());
            IOUtils.copy(conn.getInputStream(), response.getOutputStream());
        } catch (IOException ignored) {

        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private Map send(HttpMethod method, String url, Map params, ContentType contentType,
                     Object body, Object files, boolean includeApiKey, boolean includeUser,
                     Map customHeaders) {
        logger.debug(method.name() + " request to " + url);

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
                // TODO: multipart entry for file
                // NOTE: order is important - Content-Type MUST be set BEFORE the body
                // request.entity = constructMultiPartEntity(body, files, contentType);
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
                // TODO: detect non JSON response
                String text = IOUtils.toString(conn.getInputStream(), StandardCharsets.UTF_8);
                try {
                    Map resp = new ObjectMapper().readValue(text, Map.class);
                    result.put("resp", resp);
                } catch (Exception e) {
                    result.put("resp", text);
                }
            } else {
                logger.error(url + " return statusCode: " + statusCode);
                result.put("error", "Failed calling web service - service returned HTTP " + statusCode);
            }
        } catch (Exception e) {
            logger.error("Failed sending " + method.name() + "request to " + url, e);
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
        UserDetails user = null;
        // We can only get the user id from the auth service if we are running in a http request.
        // The Sprint RequestContextHolder's requestAttributes will be null if there is no request.
        // The #currentRequestAttributes method, which is used by the authService, throws an IllegalStateException if
        // there is no request, so we need to check if requestAttributes exist before trying to get the user details.
//        if (includeUser && RequestContextHolder.getRequestAttributes() != null) {
        // TODO enable authService; user = authService.userDetails();
//        }

        conn.setRequestProperty(HttpHeaders.USER_AGENT, getUserAgent());

        includeAuthTokensInternal(conn, includeUser, includeApiKey, user);

        if (customHeaders != null) {
            for (Map.Entry<String, String> entry : customHeaders.entrySet()) {
                conn.setRequestProperty(entry.getKey(), entry.getValue());
            }
        }
    }

    /**
     * Files is a List<Object> or Map<String, Object>.
     */
//    private static HttpEntity constructMultiPartEntity(Object parts, Object files, ContentType partContentType) {
//        MultipartEntityBuilder entityBuilder = MultipartEntityBuilder.create();
//        entityBuilder.setMode(HttpMultipartMode.BROWSER_COMPATIBLE);
//
//        if (parts instanceof Map) {
//            parts?.each { key, value ->
//                def val = partContentType == ContentType.APPLICATION_JSON && !(value instanceof net.sf.json.JSON) ? value as JSON : value
//                entityBuilder.addPart(key?.toString(), new StringBody((val) as String, partContentType))
//            }
//        } else if (parts != null) {
//            def val = partContentType == ContentType.APPLICATION_JSON && !(parts instanceof net.sf.json.JSON) ? parts as JSON : parts
//            entityBuilder.addTextBody("json", val as String, partContentType);
//        }
//
//        if (files instanceof List) {
//            files.eachWithIndex { it, index ->
//                if (it instanceof byte[]) {
//                    entityBuilder.addPart("file${index}", new ByteArrayBody(it, "file${index}"));
//                }
//                // Grails 3.3 multipart file is instance of org.springframework.web.multipart.support.StandardMultipartHttpServletRequest.StandardMultipartFile
//                // But StandardMultipartFile and CommonMultipartFile are both inherited from MultipartFile
//                else if (it instanceof MultipartFile) {
//                    entityBuilder.addPart(it.originalFilename, new InputStreamBody(it.inputStream, it.contentType, it.originalFilename))
//                } else if (it instanceof InputStream) {
//                    entityBuilder.addPart("file${index}", new InputStreamBody(it, "file${index}"));
//                } else if (it instanceof File) {
//                    entityBuilder.addPart(it.getName(), new FileBody(it, it.getName()));
//                } else {
//                    entityBuilder.addPart("file${index}", new ByteArrayBody(it.bytes, "file${index}"));
//                }
//            }
//        } else if (files instanceof Map) {
//            files.eachWithIndex { it, index ->
//                if (it.value instanceof byte[]) {
//                    entityBuilder.addPart(it.key, new ByteArrayBody(it.value, "file${index}"));
//                }
//                // Grails 3.3 multipart file is instance of org.springframework.web.multipart.support.StandardMultipartHttpServletRequest.StandardMultipartFile
//                // But StandardMultipartFile and CommonMultipartFile are both inherited from MultipartFile
//                else if (it.value instanceof MultipartFile) {
//                    entityBuilder.addPart(it.key, new InputStreamBody(it.value.inputStream, it.value.contentType, it.value.originalFilename));
//                } else if (it.value instanceof InputStream) {
//                    entityBuilder.addPart(it.key, new InputStreamBody(it.value, "file${index}"));
//                } else if (it.value instanceof File) {
//                    entityBuilder.addPart(it.key, new FileBody(it.value, it.value.getName()));
//                } else {
//                    entityBuilder.addPart(it.key, new ByteArrayBody(it.value.bytes, "file${index}"));
//                }
//            }
//        }
//
//        entityBuilder.build();
//    }
    private URLConnection configureConnection(String url, boolean includeApiKey, boolean includeUser) throws IOException {
        URLConnection conn = URI.create(url).toURL().openConnection();

        conn.setConnectTimeout(connectTimeout);
        conn.setReadTimeout(readTimeout);
        conn.setRequestProperty(HttpHeaders.USER_AGENT, getUserAgent());
        UserDetails user = null; // TODO: enable authService.userDetails();

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
