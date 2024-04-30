package au.org.ala.search.model.dashboard.biocache;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@NoArgsConstructor
@Getter
@Setter
public class FacetResults {
    public List<FieldResult> fieldResult;
}
