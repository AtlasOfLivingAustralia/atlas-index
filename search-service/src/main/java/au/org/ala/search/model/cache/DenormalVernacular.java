package au.org.ala.search.model.cache;

import au.org.ala.search.model.SearchItemIndex;
import lombok.experimental.SuperBuilder;

/*
Subset of SearchItemIndex for caching
 */
@SuperBuilder
public class DenormalVernacular extends Denormal {
    public String guid;
    public String name;

    public DenormalVernacular(SearchItemIndex item) {
        super(item.taxonGuid);
        this.guid = item.guid;
        this.name = item.name;
    }
}
