package au.org.ala.search.util.auth;

import com.google.common.annotations.VisibleForTesting;
import com.nimbusds.oauth2.sdk.*;
import com.nimbusds.oauth2.sdk.auth.ClientSecretBasic;
import com.nimbusds.oauth2.sdk.auth.Secret;
import com.nimbusds.oauth2.sdk.id.ClientID;
import com.nimbusds.oauth2.sdk.token.AccessToken;
import com.nimbusds.oauth2.sdk.token.RefreshToken;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.pac4j.core.config.Config;
import org.pac4j.core.context.WebContext;
import org.pac4j.core.context.session.SessionStore;
import org.pac4j.core.profile.ProfileManager;
import org.pac4j.core.util.FindBest;
import org.pac4j.jee.context.JEEContextFactory;
import org.pac4j.oidc.config.OidcConfiguration;
import org.pac4j.oidc.credentials.OidcCredentials;
import org.pac4j.oidc.profile.OidcProfile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

// TODO: move this and related classes into ala-security-project
public class TokenService {
    private static final Logger logger = LoggerFactory.getLogger(TokenService.class);

    final boolean cacheTokens;

    final String clientId;
    final String clientSecret;

    final String jwtScopes;
    @VisibleForTesting
    final Object lock = new Object();
    private final OidcConfiguration oidcConfiguration;
    private final SessionStore sessionStore;
    private final TokenClient tokenClient;
    List<String> finalScopes;
    // mutable to break circular spring dependency
    Config config;
    private Pac4jContextProvider pac4jContextProvider;
    final private long expiryWindow = 1; // 1 second
    private volatile transient OidcCredentials cachedCredentials;
    private volatile transient long cachedCredentialsLifetime = 0;

    public TokenService(Config config, OidcConfiguration oidcConfiguration, Pac4jContextProvider pac4jContextProvider,
                        SessionStore sessionStore, TokenClient tokenClient, String clientId, String clientSecret, String jwtScopes,
                        boolean cacheTokens) {
        this(oidcConfiguration, pac4jContextProvider, sessionStore, tokenClient, clientId, clientSecret, jwtScopes, cacheTokens);
        this.config = config;
    }

    public TokenService(OidcConfiguration oidcConfiguration, Pac4jContextProvider pac4jContextProvider,
                        SessionStore sessionStore, TokenClient tokenClient, String clientId, String clientSecret, String jwtScopes,
                        boolean cacheTokens) {
        this(oidcConfiguration, sessionStore, tokenClient, clientId, clientSecret, jwtScopes, cacheTokens);
        this.pac4jContextProvider = pac4jContextProvider;
    }

    public TokenService(OidcConfiguration oidcConfiguration, SessionStore sessionStore, TokenClient tokenClient,
                        String clientId, String clientSecret, String jwtScopes, boolean cacheTokens) {
        this.cacheTokens = cacheTokens;
        this.config = config;
        this.oidcConfiguration = oidcConfiguration;
        this.sessionStore = sessionStore;
        this.tokenClient = tokenClient;

        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.jwtScopes = jwtScopes;
        if (jwtScopes != null) {
            this.finalScopes = Arrays.stream(jwtScopes.split(" ")).toList();
        }
    }

    public ProfileManager getProfileManager(final HttpServletRequest request, final HttpServletResponse response) {
        final WebContext context;
        if (pac4jContextProvider != null) {
            context = pac4jContextProvider.webContext();
        } else {
            context = FindBest.webContextFactory(null, config, JEEContextFactory.INSTANCE).newContext(request, response);
        }
        final ProfileManager manager = new ProfileManager(context, sessionStore);
        manager.setConfig(config);
        return manager;
    }

    /**
     * Get an access token.  Will return the current user's access token or if there is no
     * current user, will request a client credentials grant based access token for this app.
     *
     * @param requireUser Whether the auth token must belong to an individual user (setting this to true will disable requesting a client credentials based app JWT)
     * @return The access token
     */
    public AccessToken getAuthToken(boolean requireUser, final HttpServletRequest request, final HttpServletResponse response) {
        AccessToken token = null;
        if (requireUser) {
            token = getProfileManager(request, response).getProfile(OidcProfile.class).map(OidcProfile::getAccessToken).orElse(null);
        } else {
            OidcCredentials credentials;
            if (oidcConfiguration != null) {
                if (cacheTokens) {
                    credentials = getOrRefreshToken();
                } else {
                    credentials = clientCredentialsToken();
                }
                if (credentials != null) {
                    token = credentials.getAccessToken();
                }
            } else {
                logger.debug("Not generating token because OIDC is not configured");
            }
        }
        return token;
    }

    private OidcCredentials getOrRefreshToken() {

        long now = (System.currentTimeMillis() / 1000) - expiryWindow;

        long lifetime = cachedCredentialsLifetime;
        if (lifetime == 0 || now >= lifetime) {
            synchronized (lock) {
                lifetime = cachedCredentialsLifetime;
                if (lifetime == 0 || now >= lifetime) {
                    OidcCredentials credentials = tokenSupplier(cachedCredentials);
                    cachedCredentials = credentials;
                    cachedCredentialsLifetime = (System.currentTimeMillis() / 1000) + credentials.getAccessToken().getLifetime();
                    return credentials;
                }
            }
        }
        return cachedCredentials;
    }

    private OidcCredentials tokenSupplier(OidcCredentials existingCredentials) {
        OidcCredentials credentials = null;
        if (existingCredentials != null && existingCredentials.getRefreshToken() != null) {
            try {
                logger.debug("Refreshing existing token");
                credentials = refreshToken(existingCredentials.getRefreshToken());
            } catch (Exception e) {
                logger.warn("Couldn't get refresh token from {}", existingCredentials.getRefreshToken(), e);
            }
        }
        if (credentials == null) { // no refresh token or refresh token grant failed
            logger.debug("Requesting new client credentials token");
            credentials = clientCredentialsToken();
        }
        return credentials;
    }

    private OidcCredentials clientCredentialsToken() {

        TokenRequest tokenRequest = new TokenRequest(
                oidcConfiguration.findProviderMetadata().getTokenEndpointURI(),
                new ClientSecretBasic(new ClientID(clientId), new Secret(clientSecret)),
                new ClientCredentialsGrant(),
                finalScopes != null ? new Scope(finalScopes.toArray(new String[0])) : new Scope());
        try {
            return tokenClient.executeTokenRequest(tokenRequest);
        } catch (IOException | ParseException e) {
            logger.error("failed to get clientCredentialsToken: " + e.getMessage(), e);
        }

        return null;
    }


    private OidcCredentials refreshToken(RefreshToken refreshToken) {
        TokenRequest tokenRequest = new TokenRequest(
                oidcConfiguration.findProviderMetadata().getTokenEndpointURI(),
                new ClientSecretBasic(new ClientID(clientId), new Secret(clientSecret)),
                new RefreshTokenGrant(refreshToken),
                new Scope(finalScopes.toArray(new String[0])));
        try {
            return tokenClient.executeTokenRequest(tokenRequest);
        } catch (IOException | ParseException e) {
            logger.error("failed to get clientCredentialsToken: " + e.getMessage(), e);
        }

        return null;
    }


}
