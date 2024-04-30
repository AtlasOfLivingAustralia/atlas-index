package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Setter
@NoArgsConstructor
public class SpeciesGroup {
    public String speciesGroup;
    public String taxonRank;
    public String facetName; // for Plants, not used anywhere
    public List<Taxa> taxa;
}
