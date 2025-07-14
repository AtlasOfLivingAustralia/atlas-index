/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.model.userdata.UserData;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

/**
 * Repository interface for managing configuration data in MongoDB.
 *
 * This is intended for use by ConfigService only.
 */
public interface ConfigDataMongoRepository extends MongoRepository<ConfigData, String> {
    /**
     * Get the latest configuration data by its key.
     *
     * @param key the key of the configuration data to retrieve.
     * @return the most recent ConfigData for the given key
     */
    @Query(value = "{ 'key': ?0 }", sort = "{ 'created': -1 }")
    ConfigData getLatest(String key);

    List<ConfigData> findAllByKeyOrderByCreatedDesc(String key);
}
