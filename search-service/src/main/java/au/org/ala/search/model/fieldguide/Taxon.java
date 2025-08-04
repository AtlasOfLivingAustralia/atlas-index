/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.fieldguide;

import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

@NoArgsConstructor
@SuperBuilder
@Jacksonized
@JacksonXmlRootElement(localName = "taxon")
public class Taxon {
    public String guid;
    public String scientificName;
    public String commonName;
    public String thumbnailUrl;
    public String imageUrl;
    public int imgWidth;
    public int imgHeight;
    public String datasetName;
    public String datasetID;
    public String imageId;
    public String imageDataResourceURL;
    public String imageDataResourceName;
    public String imageDataResourceUid;
    public String imageCreator;
    public String imageRights;
    public String imageLicence;
    public String imageLicenceUrl;
}
