package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Set;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Setter
@NoArgsConstructor
public class SpeciesGroup {
    public String name;
    public String rank;
    public Set<String> included;
    public Set<String> excluded;
    public String parent;
}
