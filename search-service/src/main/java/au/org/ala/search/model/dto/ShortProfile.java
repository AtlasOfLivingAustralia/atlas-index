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
