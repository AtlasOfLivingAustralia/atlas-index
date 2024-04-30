package au.org.ala.search.model.dashboard.collectory;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@NoArgsConstructor
@Getter
@Setter
public class CollectionsSearch {
    public Integer total;
    public Map<String, Integer> groups;

    public List<Feature> features;
}
