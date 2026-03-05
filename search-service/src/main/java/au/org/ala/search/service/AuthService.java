/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.userdetails.UserDetailsClient;
import au.org.ala.web.UserDetails;
import au.org.ala.ws.security.profile.AlaUserProfile;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.stereotype.Service;
import retrofit2.Call;
import retrofit2.Response;

import java.security.Principal;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
public class AuthService {

    private final UserDetailsClient userDetailsClient;

    @Value("#{'${security.admin.role}'.split(',')}")
    private List<String> adminRoles;

    @Value("#{'${logger.permitted.ips:}'.split(',')}")
    private List<String> permittedIps;

    public AuthService(UserDetailsClient userDetailsClient) {
        this.userDetailsClient = userDetailsClient;
    }

    public boolean hasAdminRole(AlaUserProfile alaUserProfile) {
        if (alaUserProfile == null) return false;
        if (alaUserProfile.getRoles() == null) return false;
        if (adminRoles == null) return false;
        for (String role : alaUserProfile.getRoles()) {
            if (adminRoles.contains(role)) {
                return true;
            }
        }
        return false;
    }

    public boolean isAdmin(Principal principal) {
        AlaUserProfile alaUserProfile;

        if (principal instanceof PreAuthenticatedAuthenticationToken) {
            alaUserProfile = (AlaUserProfile) ((PreAuthenticatedAuthenticationToken) principal).getPrincipal();
        } else if (principal instanceof AlaUserProfile) {
            alaUserProfile = (AlaUserProfile) principal;
        } else {
            return false;
        }

        if (alaUserProfile == null) return false;
        return (alaUserProfile.getRoles() != null && hasAdminRole(alaUserProfile));
    }

    public String getEmail(Principal principal) {
        if (principal instanceof PreAuthenticatedAuthenticationToken) {
            return ((AlaUserProfile) ((PreAuthenticatedAuthenticationToken) principal).getPrincipal()).getEmail();
        } else if (principal instanceof AlaUserProfile) {
            return ((AlaUserProfile) principal).getEmail();
        } else {
            return null;
        }
    }

    public String getUserId(Principal principal) {
        if (principal instanceof PreAuthenticatedAuthenticationToken) {
            return ((AlaUserProfile) ((PreAuthenticatedAuthenticationToken) principal).getPrincipal()).getUserId();
        } else if (principal instanceof AlaUserProfile) {
            return ((AlaUserProfile) principal).getUserId();
        } else {
            return null;
        }
    }

    public UserDetails getUserForEmailAddress(String email) {
        Call<UserDetails> call = userDetailsClient.getUserDetails(email, true);
        try {
            Response<UserDetails> response = call.execute();

            if (response.isSuccessful()) {
                return response.body();
            }
        } catch (Exception ex) {
            log.error("Exception caught trying get find user details for $userId.", ex);
        }

        return null;
    }

    public Set<String> getRoles(Principal principal) {
        if (principal instanceof PreAuthenticatedAuthenticationToken) {
            return ((AlaUserProfile) ((PreAuthenticatedAuthenticationToken) principal).getPrincipal()).getRoles();
        } else if (principal instanceof AlaUserProfile) {
            return ((AlaUserProfile) principal).getRoles();
        } else {
            return null;
        }
    }

    /**
     * Returns true if the given IP address is in the configured permitted IPs list.
     * The list is set via the {@code logger.permitted.ips} property (comma-delimited).
     */
    public boolean isPermittedIp(String ip) {
        if (ip == null || ip.isBlank()) return false;
        if (permittedIps == null) return false;
        for (String permitted : permittedIps) {
            String trimmed = permitted.trim();
            if (!trimmed.isEmpty() && trimmed.equals(ip.trim())) {
                return true;
            }
        }
        return false;
    }
}
