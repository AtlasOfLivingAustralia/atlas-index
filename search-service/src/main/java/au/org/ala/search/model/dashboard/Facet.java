package au.org.ala.search.model.dashboard;

import au.org.ala.search.model.dashboard.biocache.FieldResult;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@NoArgsConstructor
@Getter
@Setter
public class Facet {
    public Integer count;
    public List<FieldResult> fieldResult;
}
