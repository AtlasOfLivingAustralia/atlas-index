package au.org.ala.search.service;

import au.org.ala.ws.security.profile.AlaUserProfile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.stereotype.Service;

import java.security.Principal;
import java.util.List;

@Service
public class AuthService {

    @Value("#{'${security.admin.role}'.split(',')}")
    private List<String> adminRoles;

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
        // Principal needs to on of the following:
        //  1) ROLE_ADMIN
        AlaUserProfile alaUserProfile;

        if (principal instanceof PreAuthenticatedAuthenticationToken) {
            alaUserProfile =
                    (AlaUserProfile) ((PreAuthenticatedAuthenticationToken) principal).getPrincipal();
        } else if (principal instanceof AlaUserProfile) {
            alaUserProfile = (AlaUserProfile) principal;
        } else {
            return false;
        }

        if (alaUserProfile == null) return false;
        return (alaUserProfile.getRoles() != null && hasAdminRole(alaUserProfile));
    }
}
