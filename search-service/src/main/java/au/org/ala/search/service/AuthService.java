package au.org.ala.search.service;

import au.org.ala.userdetails.UserDetailsClient;
import au.org.ala.web.UserDetails;
import au.org.ala.ws.security.profile.AlaUserProfile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.stereotype.Service;
import retrofit2.Call;
import retrofit2.Response;

import java.security.Principal;
import java.util.List;
import java.util.Optional;

@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    @Autowired
    private UserDetailsClient userDetailsClient;

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

    public UserDetails getUserForEmailAddress(String email) {
        Call<UserDetails> call = userDetailsClient.getUserDetails(email, true);
        try {
            Response<UserDetails> response = call.execute();

            if (response.isSuccessful()) {
                return response.body();
            }
        } catch (Exception ex) {
            logger.error("Exception caught trying get find user details for $userId.", ex);
        }

        return null;
    }
}
