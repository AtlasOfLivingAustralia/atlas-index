/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.sandbox.SandboxUpload;
import org.springframework.data.mongodb.repository.MongoRepository;


public interface SandboxMongoRepository extends MongoRepository<SandboxUpload, String> {
    void deleteByDataResourceUid(String dataResourceUid);
}
