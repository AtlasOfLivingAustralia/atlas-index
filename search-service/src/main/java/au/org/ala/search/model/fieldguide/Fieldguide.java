/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.fieldguide;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

import java.util.List;

@NoArgsConstructor
@SuperBuilder
@Jacksonized
@JacksonXmlRootElement(localName = "fieldguide")
public class Fieldguide {
    public String title;
    public String sourceUrl;
    public String groupTitle;

    @JacksonXmlElementWrapper(useWrapping = false)
    @JacksonXmlProperty(localName = "group")
    public List<Group> groups;

    public String fieldguideHeaderPg1;
    public String dataLink;
    public String baseUrl;
    public String fieldguideBannerOtherPages;
    public String fieldguideSpeciesUrl;
    public String collectoryUrl;
    public String formattedDate;
    public String biocacheMapUrl;
    public String biocacheLegendUrl;
}
