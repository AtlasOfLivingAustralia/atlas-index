package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
@AllArgsConstructor
public class LongProfile {
    String identifier;
    String guid;
    String parentGuid;
    String name;
    String nameComplete;
    String[] commonName;
    String commonNameSingle;
    String rank;
    Integer rankId;
    String acceptedConceptGuid;
    String acceptedConceptName;
    String taxonomicStatus;
    String imageId;
    String imageUrl;
    String thumbnailUrl;
    String largeImageUrl;
    String smallImageUrl;
    String imageMetadataUrl;
    String kingdom;
    String phylum;
    String classs;
    String order;
    String family;
    String genus;
    String author;
    String linkIdentifier;
}
