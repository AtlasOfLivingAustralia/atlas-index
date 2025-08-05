/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.taxon.TaxonData;
import au.org.ala.search.model.userdata.UserData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;


/**
 * Repository interface for managing taxon override data in Postgresql.
 *
 * This is intended for use by TaxonDataService only.
 */
public interface TaxonDataPostgresRepository extends JpaRepository<TaxonData, String> {
    @Query(value = "SELECT value FROM taxon_data WHERE taxon_concept_id = :taxonConceptId AND key = :key", nativeQuery = true)
    String getByTaxonConceptIdAndKey(String taxonConceptId, String key);

    @Modifying
    @Query(value = "DELETE FROM taxon_data WHERE taxon_concept_id = :taxonConceptId AND key = :key", nativeQuery = true)
    void deleteByTaxonConceptIdAndKey(String taxonConceptId, String key);

    @Query(value = "SELECT * FROM taxon_data WHERE key = :key", nativeQuery = true)
    List<TaxonData> findAllByKey(String key);
}


