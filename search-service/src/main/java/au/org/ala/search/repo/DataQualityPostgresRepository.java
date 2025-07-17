/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.quality.QualityProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DataQualityPostgresRepository extends JpaRepository<QualityProfile, Long> {
    // This repository interface will automatically provide CRUD operations for QualityProfile entities.
    // Additional custom query methods can be defined here if needed.

    List<QualityProfile> findAllByShortName(String shortName);
}
