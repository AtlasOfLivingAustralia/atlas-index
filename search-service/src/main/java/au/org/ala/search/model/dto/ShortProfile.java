/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
@AllArgsConstructor
public class ShortProfile {
    String taxonID;
    String scientificName;
    String scientificNameAuthorship;
    String author;
    String rank;
    Integer rankID;
    String kingdom;
    String family;
    String commonName;
    String thumbnail;
    String imageURL;
}
