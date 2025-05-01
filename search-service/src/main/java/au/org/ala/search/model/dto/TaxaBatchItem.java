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
public class TaxaBatchItem {
    String guid;
    String name;
    String scientificName;
    String author;
    String nameComplete;
    String rank;
    String kingdom;
    String phylum;
    String classs;
    String order;
    String family;
    String genus;
    String datasetName;
    String datasetID;
    String hiddenImages;
    String thumbnailUrl;
    String smallImageUrl;
    String largeImageUrl;
    String linkIdentifier;
    String commonNameSingle;
}
