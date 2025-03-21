/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.userdata.UserData;
import org.springframework.data.mongodb.repository.MongoRepository;


public interface UserDataMongoRepository extends MongoRepository<UserData, String> {
    void deleteById(String id);
}
