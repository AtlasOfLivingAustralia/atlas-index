package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
@AllArgsConstructor
public class ChildConcept {
    String guid;
    String parentGuid;
    String name;
    String nameComplete;
    String nameFormatted;
    String author;
    String rank;
    Integer rankID;
}
