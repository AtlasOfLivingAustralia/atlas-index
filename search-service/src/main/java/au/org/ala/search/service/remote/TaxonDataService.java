/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.taxon.TaxonData;
import au.org.ala.search.repo.TaxonDataPostgresRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service for managing admin overrides for taxon data.
 * - Persists in postgresql database.
 * - Used by taxon-descriptions tool for custom descriptions.
 * - Replaces the old hidden images species list that overrides the default hidden images species list for taxon records in ES.
 * - Replaces the old preferred images species list that overrides the default preferred images species list for taxon records in ES.
 *
 * Future: create a process for admin to manage new names indexes where old taxonConceptIds
 *  are no longer valid.
 * Future: add process for admin to remove or fix the imageIds in this taxon data when they are no longer valid.
 */
@Service
public class TaxonDataService {
    protected final TaxonDataPostgresRepository taxonDataPostgresRepository;

    public TaxonDataService(TaxonDataPostgresRepository taxonDataPostgresRepository){
        this.taxonDataPostgresRepository = taxonDataPostgresRepository;
    }

    /**
     * Return true if successful, false if not.
     *
     * @param taxonConceptId
     * @param key
     * @param scientificName
     * @param value
     * @return
     */
    @Transactional
    public boolean createOrUpdate(String taxonConceptId, String key, String scientificName, String value) {
        if (StringUtils.isEmpty(taxonConceptId) || StringUtils.isEmpty(key)) {
            return false;
        }

        // delete record if updating with null or empty data
        if (StringUtils.isEmpty(value)) {
            delete(taxonConceptId, key);
            return true;
        }

        // get the current value
        String currentValue = get(taxonConceptId, key);

        if (StringUtils.compare(currentValue, value) == 0) {
            return true; // no change needed, successful
        }

        // update the existing record
        TaxonData taxonData = new TaxonData(taxonConceptId, key, scientificName, value);
        taxonDataPostgresRepository.save(taxonData);
        taxonDataPostgresRepository.flush();

        return true;
    }

    @Transactional(readOnly = true)
    public String get(String taxonConceptId, String key) {
        if (StringUtils.isEmpty(taxonConceptId) || StringUtils.isEmpty(key)) {
            return null;
        }
        return taxonDataPostgresRepository.getByTaxonConceptIdAndKey(taxonConceptId, key);
    }

    @Transactional()
    public void delete(String taxonConceptId, String key) {
        taxonDataPostgresRepository.deleteByTaxonConceptIdAndKey(taxonConceptId, key);
    }

    // Future: use paging or streaming
    @Transactional(readOnly = true)
    public List<TaxonData> findAllByKey (String key) {
        return taxonDataPostgresRepository.findAllByKey(key);
    }
}
