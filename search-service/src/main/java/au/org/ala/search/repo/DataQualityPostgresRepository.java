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

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT * FROM quality_profile WHERE short_name = :shortName",
        nativeQuery = true
    )
    List<QualityProfile> findAllByShortName(@org.springframework.data.repository.query.Param("shortName") String shortName);

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT * FROM quality_profile",
        nativeQuery = true
    )
    List<QualityProfile> findAllNative();
}
