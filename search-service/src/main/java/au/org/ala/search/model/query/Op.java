package au.org.ala.search.model.query;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
public class Op {
    public List<Term> terms = new ArrayList<>();
    public boolean andOp = false; // true==AND, false==OR
}
