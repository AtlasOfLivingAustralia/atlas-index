package au.org.ala.search.model.query;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
public class Term {
    public Op op;
    public boolean negate = false;
    public String field;
    public String value;
}
