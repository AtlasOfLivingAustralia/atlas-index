package au.org.ala.search.model.dashboard.biocache;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@NoArgsConstructor
@Getter
@Setter
public class BiocacheSearch {
    public Integer totalRecords;
    public List<FacetResults> facetResults;
    public List<Occurrence> occurrences;
}
