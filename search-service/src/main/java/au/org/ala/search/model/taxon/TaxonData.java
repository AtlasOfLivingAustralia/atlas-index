/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.taxon;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

/**
 * Store for admin overrides of taxon data.
 * - taxon hero descriptions
 * - preferred images
 * - hidden images
 *
 * Future: history of changes, reasons for changes, user who made changes, a process for names index changes, etc.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@NoArgsConstructor
@Data
@SuperBuilder
@Jacksonized
@Entity
@Table(name = "taxon_data")
@IdClass(TaxonDataId.class)
public class TaxonData {
    @Id
    public String taxonConceptId;
    @Id
    public String key;
    public String scientificName;
    public String value;
    public String kingdom;
    public String family;

    public TaxonData(String taxonConceptId, String key, String scientificName, String family, String kingdom, String value) {
        this.taxonConceptId = taxonConceptId;
        this.key = key;
        this.scientificName = scientificName;
        this.value = value;
        this.family = family;
        this.kingdom = kingdom;
    }
}
