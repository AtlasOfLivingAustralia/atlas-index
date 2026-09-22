/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import au.org.ala.ws.security.client.AlaAuthClient;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.pac4j.core.config.Config;
import org.pac4j.core.context.WebContext;
import org.pac4j.core.context.WebContextFactory;
import org.pac4j.core.context.session.SessionStore;
import org.pac4j.core.context.session.SessionStoreFactory;
import org.pac4j.core.credentials.Credentials;
import org.pac4j.core.exception.CredentialsException;
import org.pac4j.core.profile.ProfileManager;
import org.pac4j.core.profile.UserProfile;
import org.pac4j.core.profile.factory.ProfileManagerFactory;
import org.pac4j.oidc.credentials.OidcCredentials;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;

import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link AuthMachineJwt}, the machine/M2M JWT authentication filter. No Spring
 * context, no containers, no real JWTs/OIDC provider are needed: JWT signature/issuer/audience/
 * expiry validation is entirely delegated to the external {@code ala-ws-security} library's
 * {@link AlaAuthClient}, so this test mocks {@code AlaAuthClient}/{@code Config} directly
 * and exercises {@code AuthMachineJwt.doFilterInternal}'s own credential/profile branching logic
 * (the part of the filter this codebase actually owns): missing credentials, an authenticated
 * user profile, the machine/M2M scope-only fallback path (an OIDC access token with no full
 * user profile), and the invalid/expired/malformed-credentials 401 short-circuit.
 * <p>
 * Test is in the same package as {@link AuthMachineJwt} to call the {@code protected
 * doFilterInternal} method directly (matching how {@link org.springframework.web.filter.OncePerRequestFilter}
 * subclasses are typically unit tested without a servlet container).
 */
class AuthMachineJwtTest {

    private final Config config = mock(Config.class);
    private final AlaAuthClient alaAuthClient = mock(AlaAuthClient.class);
    private final WebContext webContext = mock(WebContext.class);
    private final SessionStore sessionStore = mock(SessionStore.class);
    private final ProfileManager profileManager = mock(ProfileManager.class);
    private final AuthMachineJwt filter = new AuthMachineJwt(config, alaAuthClient);

    {
        // pac4j 6 builds the WebContext/SessionStore/ProfileManager via factories on Config,
        // which AuthMachineJwt then wraps in a CallContext.
        WebContextFactory webContextFactory = parameters -> webContext;
        SessionStoreFactory sessionStoreFactory = parameters -> sessionStore;
        ProfileManagerFactory profileManagerFactory = (ctx, store) -> profileManager;
        when(config.getWebContextFactory()).thenReturn(webContextFactory);
        when(config.getSessionStoreFactory()).thenReturn(sessionStoreFactory);
        when(config.getProfileManagerFactory()).thenReturn(profileManagerFactory);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void doFilterInternal_noCredentials_continuesChainWithoutAuthenticating() throws Exception {
        when(alaAuthClient.getCredentials(any())).thenReturn(Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void doFilterInternal_validCredentialsAndProfile_authenticatesPrincipalWithRoles() throws Exception {
        Credentials credentials = mock(Credentials.class);
        UserProfile profile = mock(UserProfile.class);
        when(profile.getRoles()).thenReturn(Set.of("ROLE_ADMIN"));
        when(alaAuthClient.getCredentials(any())).thenReturn(Optional.of(credentials));
        when(alaAuthClient.getUserProfile(any(), eq(credentials))).thenReturn(Optional.of(profile));
        when(alaAuthClient.getSaveProfileInSession(any(), any())).thenReturn(false);
        when(alaAuthClient.isMultiProfile(any(), any())).thenReturn(false);

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isInstanceOf(PreAuthenticatedAuthenticationToken.class);
        assertThat(authentication.isAuthenticated()).isTrue();
        assertThat(authentication.getPrincipal()).isSameAs(profile);
        assertThat(authentication.getAuthorities())
                .extracting(a -> a.getAuthority())
                .containsExactly("ROLE_ADMIN");
    }

    @Test
    void doFilterInternal_oidcCredentialsWithScopeOnly_authenticatesAnonymousProfileWithScopeAsRoles() throws Exception {
        // Machine/M2M case: an OIDC access token with scopes but no full user profile (e.g. a
        // client-credentials-grant token) — AuthMachineJwt builds a stub AlaUserProfile whose
        // getRoles() returns the token's scope set, so AuthService.isAdmin/hasAdminRole can treat
        // a scope like "ala/internal" as a role.
        OidcCredentials credentials = new OidcCredentials();
        credentials.setAccessToken(Map.of("scope", "ala/internal users/read"));

        when(alaAuthClient.getCredentials(any())).thenReturn(Optional.of(credentials));
        when(alaAuthClient.getUserProfile(any(), eq(credentials))).thenReturn(Optional.empty());
        when(alaAuthClient.getSaveProfileInSession(any(), any())).thenReturn(false);
        when(alaAuthClient.isMultiProfile(any(), any())).thenReturn(false);

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isInstanceOf(PreAuthenticatedAuthenticationToken.class);
        assertThat(authentication.getAuthorities())
                .extracting(a -> a.getAuthority())
                .containsExactlyInAnyOrder("ala/internal", "users/read");
    }

    @Test
    void doFilterInternal_credentialsExceptionThrown_sends401AndDoesNotContinueChain() throws Exception {
        when(alaAuthClient.getCredentials(any())).thenThrow(new CredentialsException("expired/malformed token"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        verifyNoInteractions(chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
