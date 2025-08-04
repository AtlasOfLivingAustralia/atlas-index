/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.userdata.UserData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;


/**
 * Repository interface for managing configuration data in Postgresql.
 *
 * This is intended for use by ConfigService only.
 */
public interface UserDataPostgresRepository extends JpaRepository<UserData, String> {
    @Query(value = "SELECT value FROM userdata WHERE user_id = :userId AND key = :key", nativeQuery = true)
    String getByUserIdAndKey(String userId, String key);

    @Modifying
    @Query(value = "DELETE FROM userdata WHERE user_id = :userId AND key = :key", nativeQuery = true)
    void deleteUserDataByUserIdAndKey(String userId, String key);
}


