/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.userdetails.UserDetailsClient;
import au.org.ala.ws.security.profile.AlaUserProfile;
import org.junit.jupiter.api.Test;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;

import java.lang.reflect.Field;
import java.security.Principal;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AuthService}. No Spring context, no containers — the single
 * {@link UserDetailsClient} collaborator is a Mockito mock, {@link AlaUserProfile} instances are
 * mocked (it's a plain interface), and the {@code @Value}-annotated private fields are set via
 * reflection to simulate property injection.
 */
class AuthServiceTest {

    private final AuthService authService = new AuthService(mock(UserDetailsClient.class));

    private void setAdminRoles(List<String> roles) throws Exception {
        Field f = AuthService.class.getDeclaredField("adminRoles");
        f.setAccessible(true);
        f.set(authService, roles);
    }

    private void setPermittedIps(List<String> ips) throws Exception {
        Field f = AuthService.class.getDeclaredField("permittedIps");
        f.setAccessible(true);
        f.set(authService, ips);
    }

    @Test
    void hasAdminRole_nullProfile_returnsFalse() {
        assertThat(authService.hasAdminRole(null)).isFalse();
    }

    @Test
    void hasAdminRole_profileWithNullRoles_returnsFalse() throws Exception {
        setAdminRoles(List.of("ROLE_ADMIN"));
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getRoles()).thenReturn(null);

        assertThat(authService.hasAdminRole(profile)).isFalse();
    }

    @Test
    void hasAdminRole_adminRolesNotConfigured_returnsFalse() throws Exception {
        setAdminRoles(null);
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getRoles()).thenReturn(Set.of("ROLE_ADMIN"));

        assertThat(authService.hasAdminRole(profile)).isFalse();
    }

    @Test
    void hasAdminRole_matchingRole_returnsTrue() throws Exception {
        setAdminRoles(List.of("ROLE_ADMIN", "ROLE_SUPERUSER"));
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getRoles()).thenReturn(Set.of("ROLE_USER", "ROLE_ADMIN"));

        assertThat(authService.hasAdminRole(profile)).isTrue();
    }

    @Test
    void hasAdminRole_noMatchingRole_returnsFalse() throws Exception {
        setAdminRoles(List.of("ROLE_ADMIN"));
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getRoles()).thenReturn(Set.of("ROLE_USER"));

        assertThat(authService.hasAdminRole(profile)).isFalse();
    }

    @Test
    void isAdmin_directAlaUserProfile_admin_returnsTrue() throws Exception {
        setAdminRoles(List.of("ROLE_ADMIN"));
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getRoles()).thenReturn(Set.of("ROLE_ADMIN"));

        assertThat(authService.isAdmin(profile)).isTrue();
    }

    @Test
    void isAdmin_directAlaUserProfile_notAdmin_returnsFalse() throws Exception {
        setAdminRoles(List.of("ROLE_ADMIN"));
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getRoles()).thenReturn(Set.of("ROLE_USER"));

        assertThat(authService.isAdmin(profile)).isFalse();
    }

    @Test
    void isAdmin_preAuthenticatedToken_wrapsAlaUserProfile() throws Exception {
        setAdminRoles(List.of("ROLE_ADMIN"));
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getRoles()).thenReturn(Set.of("ROLE_ADMIN"));
        PreAuthenticatedAuthenticationToken token =
                new PreAuthenticatedAuthenticationToken(profile, null);

        assertThat(authService.isAdmin(token)).isTrue();
    }

    @Test
    void isAdmin_unrecognisedPrincipalType_returnsFalse() {
        Principal other = () -> "some-name";

        assertThat(authService.isAdmin(other)).isFalse();
    }

    @Test
    void isAdmin_profileWithNullRoles_returnsFalse() throws Exception {
        setAdminRoles(List.of("ROLE_ADMIN"));
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getRoles()).thenReturn(null);

        assertThat(authService.isAdmin(profile)).isFalse();
    }

    @Test
    void getEmail_directAlaUserProfile_returnsEmail() {
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getEmail()).thenReturn("test@example.com");

        assertThat(authService.getEmail(profile)).isEqualTo("test@example.com");
    }

    @Test
    void getEmail_preAuthenticatedToken_returnsEmail() {
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getEmail()).thenReturn("test@example.com");
        PreAuthenticatedAuthenticationToken token =
                new PreAuthenticatedAuthenticationToken(profile, null);

        assertThat(authService.getEmail(token)).isEqualTo("test@example.com");
    }

    @Test
    void getEmail_unrecognisedPrincipalType_returnsNull() {
        Principal other = () -> "some-name";

        assertThat(authService.getEmail(other)).isNull();
    }

    @Test
    void getUserId_directAlaUserProfile_returnsUserId() {
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getUserId()).thenReturn("user-123");

        assertThat(authService.getUserId(profile)).isEqualTo("user-123");
    }

    @Test
    void getUserId_unrecognisedPrincipalType_returnsNull() {
        Principal other = () -> "some-name";

        assertThat(authService.getUserId(other)).isNull();
    }

    @Test
    void getRoles_directAlaUserProfile_returnsRoles() {
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getRoles()).thenReturn(Set.of("ROLE_ADMIN"));

        assertThat(authService.getRoles(profile)).containsExactly("ROLE_ADMIN");
    }

    @Test
    void getRoles_unrecognisedPrincipalType_returnsNull() {
        Principal other = () -> "some-name";

        assertThat(authService.getRoles(other)).isNull();
    }

    @Test
    @au.org.ala.search.test.SuppressExpectedLogging("au.org.ala.search.service.AuthService")
    void getUserForEmailAddress_clientThrowsException_returnsNull() throws Exception {
        UserDetailsClient client = mock(UserDetailsClient.class);
        retrofit2.Call<au.org.ala.web.UserDetails> call = mock(retrofit2.Call.class);
        when(client.getUserDetails("test@example.com", true)).thenReturn(call);
        when(call.execute()).thenThrow(new java.io.IOException("boom"));
        AuthService service = new AuthService(client);

        assertThat(service.getUserForEmailAddress("test@example.com")).isNull();
    }

    @Test
    void getActor_withUserId_returnsUserId() {
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getUserId()).thenReturn("user-123");

        assertThat(authService.getActor(profile, "1.2.3.4", "some-agent")).isEqualTo("user-123");
    }

    @Test
    void getActor_noUserId_returnsIpAndUserAgent() {
        Principal other = () -> "some-name";

        assertThat(authService.getActor(other, "1.2.3.4", "curl/8.0")).isEqualTo("1.2.3.4 (curl/8.0)");
    }

    @Test
    void getActor_noUserIdNoIpNoUserAgent_returnsUnknownPlaceholders() {
        Principal other = () -> "some-name";

        assertThat(authService.getActor(other, null, null)).isEqualTo("unknown (unknown)");
    }

    @Test
    void getActor_truncatesLongActorStringTo255Chars() {
        Principal other = () -> "some-name";
        String longUserAgent = "x".repeat(300);

        String actor = authService.getActor(other, "1.2.3.4", longUserAgent);

        assertThat(actor).hasSize(255);
    }

    @Test
    void getActor_convenienceOverload_delegatesWithNullIpAndUserAgent() {
        Principal other = () -> "some-name";

        assertThat(authService.getActor(other)).isEqualTo("unknown (unknown)");
    }

    @Test
    void getActor_blankUserId_treatedAsAbsent() {
        AlaUserProfile profile = mock(AlaUserProfile.class);
        when(profile.getUserId()).thenReturn("   ");

        assertThat(authService.getActor(profile, "1.2.3.4", "agent")).isEqualTo("1.2.3.4 (agent)");
    }

    @Test
    void isPermittedIp_nullIp_returnsFalse() throws Exception {
        setPermittedIps(List.of("127.0.0.1"));

        assertThat(authService.isPermittedIp(null)).isFalse();
    }

    @Test
    void isPermittedIp_blankIp_returnsFalse() throws Exception {
        setPermittedIps(List.of("127.0.0.1"));

        assertThat(authService.isPermittedIp("  ")).isFalse();
    }

    @Test
    void isPermittedIp_noConfiguredList_returnsFalse() throws Exception {
        setPermittedIps(null);

        assertThat(authService.isPermittedIp("127.0.0.1")).isFalse();
    }

    @Test
    void isPermittedIp_matchingIp_returnsTrue() throws Exception {
        setPermittedIps(List.of("127.0.0.1", "0:0:0:0:0:0:0:1"));

        assertThat(authService.isPermittedIp("127.0.0.1")).isTrue();
    }

    @Test
    void isPermittedIp_matchingIpWithWhitespaceInConfig_stillMatches() throws Exception {
        setPermittedIps(List.of(" 127.0.0.1 ", " 0:0:0:0:0:0:0:1 "));

        assertThat(authService.isPermittedIp("127.0.0.1")).isTrue();
    }

    @Test
    void isPermittedIp_nonMatchingIp_returnsFalse() throws Exception {
        setPermittedIps(List.of("127.0.0.1"));

        assertThat(authService.isPermittedIp("10.0.0.1")).isFalse();
    }
}
