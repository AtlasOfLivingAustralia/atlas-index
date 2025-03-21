/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.dashboard.bie;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter
@Setter
public class TaxonConcept {
    public String nameString;
    public String guid;
    public String name;
    String imageCreator;
    String imageRights;
    String imageDataResourceUid;
    String largeImageUrl;
    String imageDataResourceUrl;
    String imageDataResourceName;
    String commonNameSingle;
    String family;
    String densitymap;
    String densitylegend;
    String thumbnail;

    // String guid
    String parentGuid;
    String scientificName;
    String nameComplete;
    String nameFormatted;
    String author;
    String nomenclaturalCode;
    String taxonomicStatus;
    String nomenclaturalStatus;
    String rankString;
    String nameAuthority;
    Integer rankID;
    String nameAccordingTo;
    String nameAccordingToID;
    String namePublishedIn;
    String namePublishedInYear;
    String namePublishedInID;
    String[] taxonRemarks;
    String provenance;
    String favourite;
    String infoSourceURL;
    String datasetURL;
}
