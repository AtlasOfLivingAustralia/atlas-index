/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.userdata.UserData;
import au.org.ala.search.repo.UserDataMongoRepository;
import com.nimbusds.jwt.JWTClaimsSet;
import org.springframework.stereotype.Service;

import java.text.ParseException;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Service for managing user data.
 * <p>
 * Supports
 * 1. User JWT
 */
@Service
public class UserDataService {
    protected final UserDataMongoRepository userDataMongoRepository;

    public UserDataService(UserDataMongoRepository userDataMongoRepository) {
        this.userDataMongoRepository = userDataMongoRepository;
    }

    public UserData createOrUpdate(String userId, String uuid, String json) {
        // delete record if updating with null data
        if (json == null) {
            delete(userId, uuid);
            return new UserData(userId, null, null);
        }

        // validate JWT
        LocalDateTime expiryDate = null;
        try {
            JWTClaimsSet jwt = JWTClaimsSet.parse(json);
            expiryDate = LocalDateTime.ofInstant(jwt.getExpirationTime().toInstant(), ZoneId.systemDefault());
            if (expiryDate.isBefore(LocalDateTime.now())) {
                return null;
            }
        } catch (ParseException e) {
            return null;
        }

        UserData userData = null;

        if (uuid == null) {
            userData = new UserData(userId, json, expiryDate);
        } else {
            userData = get(uuid);
            if (userData == null || !userData.getUserId().equals(userId)) {
                return null;
            }

            userData.setData(json);
            userData.setExpiryDate(expiryDate);
        }

        return userDataMongoRepository.save(userData);
    }

    public UserData get(String id) {
        return userDataMongoRepository.findById(id).orElse(null);
    }

    public boolean delete(String id, String userId) {
        UserData userData = get(id);

        if (userData == null || !userData.getUserId().equals(userId)) {
            return false;
        }

        userDataMongoRepository.deleteById(id);
        return true;
    }
}
