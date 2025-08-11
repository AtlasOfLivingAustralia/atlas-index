/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.userdata.UserData;
import au.org.ala.search.repo.UserDataPostgresRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service for managing user data.
 */
@Service
public class UserDataService {
    protected final UserDataPostgresRepository userDataPostgresRepository;

    public UserDataService(UserDataPostgresRepository userDataPostgresRepository){
        this.userDataPostgresRepository = userDataPostgresRepository;
    }

    /**
     * Return true if successful, false if not.
     *
     * @param userId
     * @param key
     * @param value
     * @return
     */
    @Transactional
    public boolean createOrUpdate(String userId, String key, String value) {
        if (StringUtils.isEmpty(userId) || StringUtils.isEmpty(key)) {
            return false;
        }

        // delete record if updating with null or empty data
        if (StringUtils.isEmpty(value)) {
            delete(userId, key);
            return true;
        }

        // get the current value
        String currentValue = get(userId, key);

        if (StringUtils.compare(currentValue, value) == 0) {
            return true; // no change needed, successful
        }

        // update the existing record
        UserData userData = new UserData(userId, key, value);
        userDataPostgresRepository.save(userData);
        userDataPostgresRepository.flush();

        return true;
    }

    @Transactional(readOnly = true)
    public String get(String userId, String key) {
        if (StringUtils.isEmpty(userId) || StringUtils.isEmpty(key)) {
            return null;
        }
        return userDataPostgresRepository.getByUserIdAndKey(userId, key);
    }

    @Transactional()
    public void delete(String userId, String key) {
        userDataPostgresRepository.deleteUserDataByUserIdAndKey(userId, key);
    }

    @Transactional(readOnly = true)
    public long count() {
        return userDataPostgresRepository.count();
    }
}
