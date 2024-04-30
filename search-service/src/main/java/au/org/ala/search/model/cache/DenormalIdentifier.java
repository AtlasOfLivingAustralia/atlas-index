package au.org.ala.search.model.cache;

import au.org.ala.search.model.SearchItemIndex;
import lombok.experimental.SuperBuilder;

/*
Subset of SearchItemIndex for caching
 */
@SuperBuilder
public class DenormalIdentifier extends Denormal {
    public String guid;

    public DenormalIdentifier(SearchItemIndex item) {
        super(item.taxonGuid);
    }
}
