package au.org.ala.search.model.cache;

import au.org.ala.search.model.SearchItemIndex;
import lombok.experimental.SuperBuilder;

/*
Subset of SearchItemIndex for caching
 */
@SuperBuilder
public class DenormalIdentifier extends Denormal {
    public String guid;
    public String scientificName;
    public String nameAccordingTo;
    public String namePublishedIn;
    public String source;
    public String datasetID;

    public DenormalIdentifier(SearchItemIndex item) {
        super(item.taxonGuid);
        this.guid = item.guid;
        this.scientificName = item.scientificName;
        this.nameAccordingTo = item.nameAccordingTo;
        this.namePublishedIn = item.namePublishedIn;
        this.source = item.source;
        this.datasetID = item.datasetID;
    }
}
