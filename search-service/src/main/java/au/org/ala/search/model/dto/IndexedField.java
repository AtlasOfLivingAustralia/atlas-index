package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
@AllArgsConstructor
public class IndexedField {
    String name;
    String dataType;
    Boolean indexed;
    Boolean stored;

    @Deprecated
    String numberDistinctValues;
}
