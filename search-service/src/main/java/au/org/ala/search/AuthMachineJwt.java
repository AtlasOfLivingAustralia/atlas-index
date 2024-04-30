package au.org.ala.search;

import au.org.ala.ws.security.AlaWebServiceAuthFilter;
import au.org.ala.ws.security.client.AlaAuthClient;
import au.org.ala.ws.security.profile.AlaUserProfile;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.pac4j.core.config.Config;
import org.pac4j.core.context.WebContext;
import org.pac4j.core.credentials.Credentials;
import org.pac4j.core.exception.CredentialsException;
import org.pac4j.core.profile.ProfileManager;
import org.pac4j.core.profile.UserProfile;
import org.pac4j.core.util.FindBest;
import org.pac4j.jee.context.JEEContextFactory;
import org.pac4j.oidc.credentials.OidcCredentials;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.Principal;
import java.util.*;

public class AuthMachineJwt extends OncePerRequestFilter {
    public static final Logger log = LoggerFactory.getLogger(AlaWebServiceAuthFilter.class);
    private Config config;
    private AlaAuthClient alaAuthClient;

    public AuthMachineJwt(Config config, AlaAuthClient alaAuthClient) {
        this.config = config;
        this.alaAuthClient = alaAuthClient;
    }

    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            WebContext context =
                    FindBest.webContextFactory(null, this.config, JEEContextFactory.INSTANCE)
                            .newContext(request, response);
            Optional<Credentials> optCredentials =
                    this.alaAuthClient.getCredentials(context, this.config.getSessionStore());
            if (optCredentials.isPresent()) {
                Credentials credentials = optCredentials.get();
                Optional<UserProfile> optProfile =
                        this.alaAuthClient.getUserProfile(credentials, context, this.config.getSessionStore());
                if (optProfile.isPresent()) {
                    UserProfile userProfile = optProfile.get();
                    this.setAuthenticatedUserAsPrincipal(userProfile);
                    ProfileManager profileManager =
                            new ProfileManager(context, this.config.getSessionStore());
                    profileManager.setConfig(this.config);
                    profileManager.save(
                            this.alaAuthClient.getSaveProfileInSession(context, userProfile),
                            userProfile,
                            this.alaAuthClient.isMultiProfile(context, userProfile));
                } else {
                    if (credentials instanceof OidcCredentials) {
                        final Set<String> scope =
                                new HashSet<>(
                                        ((OidcCredentials) credentials).getAccessToken().getScope().toStringList());
                        UserProfile userProfile =
                                new AlaUserProfile() {
                                    @Override
                                    public String getName() {
                                        return null;
                                    }

                                    @Override
                                    public String getUserId() {
                                        return null;
                                    }

                                    @Override
                                    public String getEmail() {
                                        return null;
                                    }

                                    @Override
                                    public String getGivenName() {
                                        return null;
                                    }

                                    @Override
                                    public String getFamilyName() {
                                        return null;
                                    }

                                    @Override
                                    public String getId() {
                                        return null;
                                    }

                                    @Override
                                    public void setId(String s) {
                                    }

                                    @Override
                                    public String getTypedId() {
                                        return null;
                                    }

                                    @Override
                                    public String getUsername() {
                                        return null;
                                    }

                                    @Override
                                    public Object getAttribute(String s) {
                                        return null;
                                    }

                                    @Override
                                    public Map<String, Object> getAttributes() {
                                        return null;
                                    }

                                    @Override
                                    public boolean containsAttribute(String s) {
                                        return false;
                                    }

                                    @Override
                                    public void addAttribute(String s, Object o) {
                                    }

                                    @Override
                                    public void removeAttribute(String s) {
                                    }

                                    @Override
                                    public void addAuthenticationAttribute(String s, Object o) {
                                    }

                                    @Override
                                    public void removeAuthenticationAttribute(String s) {
                                    }

                                    @Override
                                    public void addRole(String s) {
                                    }

                                    @Override
                                    public void addRoles(Collection<String> collection) {
                                    }

                                    @Override
                                    public Set<String> getRoles() {
                                        return scope;
                                    }

                                    @Override
                                    public void addPermission(String s) {
                                    }

                                    @Override
                                    public void addPermissions(Collection<String> collection) {
                                    }

                                    @Override
                                    public Set<String> getPermissions() {
                                        return null;
                                    }

                                    @Override
                                    public boolean isRemembered() {
                                        return false;
                                    }

                                    @Override
                                    public void setRemembered(boolean b) {
                                    }

                                    @Override
                                    public String getClientName() {
                                        return null;
                                    }

                                    @Override
                                    public void setClientName(String s) {
                                    }

                                    @Override
                                    public String getLinkedId() {
                                        return null;
                                    }

                                    @Override
                                    public void setLinkedId(String s) {
                                    }

                                    @Override
                                    public boolean isExpired() {
                                        return false;
                                    }

                                    @Override
                                    public Principal asPrincipal() {
                                        return null;
                                    }
                                };

                        this.setAuthenticatedUserAsPrincipal(userProfile);
                        ProfileManager profileManager =
                                new ProfileManager(context, this.config.getSessionStore());
                        profileManager.setConfig(this.config);
                        profileManager.save(
                                this.alaAuthClient.getSaveProfileInSession(context, userProfile),
                                userProfile,
                                this.alaAuthClient.isMultiProfile(context, userProfile));
                    }
                }
            }
        } catch (CredentialsException ex) {
            log.info("authentication failed invalid credentials", ex);
            response.sendError(
                    HttpStatus.UNAUTHORIZED.value(), HttpStatus.UNAUTHORIZED.getReasonPhrase());
            return;
        }

        chain.doFilter(request, response);
    }

    private void setAuthenticatedUserAsPrincipal(UserProfile userProfile) {
        SecurityContext securityContext = SecurityContextHolder.getContext();
        List<String> credentials = new ArrayList();
        List<GrantedAuthority> authorities = new ArrayList();
        userProfile.getRoles().forEach((s) -> authorities.add(new SimpleGrantedAuthority(s)));
        PreAuthenticatedAuthenticationToken token = new PreAuthenticatedAuthenticationToken(userProfile, credentials, authorities);
        token.setAuthenticated(true);
        securityContext.setAuthentication(token);
    }

    public Config getConfig() {
        return this.config;
    }

    public void setConfig(Config config) {
        this.config = config;
    }

    public AlaAuthClient getAlaAuthClient() {
        return this.alaAuthClient;
    }

    public void setAlaAuthClient(AlaAuthClient alaAuthClient) {
        this.alaAuthClient = alaAuthClient;
    }
}
