package au.org.ala.search.model.dashboard.bie;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@NoArgsConstructor
@Getter
@Setter
public class BulkLookup {
    List<TaxonConcept> searchDTOList;
}
