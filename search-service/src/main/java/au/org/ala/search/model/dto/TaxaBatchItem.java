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
    String wikiUrl;
    String hiddenImages;
    String thumbnailUrl;
    String smallImageUrl;
    String largeImageUrl;
    String linkIdentifier;
    String commonNameSingle;
}
