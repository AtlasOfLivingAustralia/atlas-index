package au.org.ala.search.model.cache;

import au.org.ala.search.model.SearchItemIndex;
import lombok.experimental.SuperBuilder;

/*
Subset of SearchItemIndex for caching
 */
@SuperBuilder
public class DenormalVariant extends Denormal {
    public String scientificName;
    public String nameComplete;
    public Integer priority;
    public String nameAccordingTo;
    public String namePublishedIn;
    public String source;
    public String datasetID;
    public String nameFormatted;

    public DenormalVariant(SearchItemIndex item) {
        super(item.taxonGuid);
        this.scientificName = item.scientificName;
        this.nameComplete = item.nameComplete;
        this.priority = item.priority;
        this.nameAccordingTo = item.nameAccordingTo;
        this.namePublishedIn = item.namePublishedIn;
        this.source = item.source;
        this.datasetID = item.datasetID;
        this.nameFormatted = item.nameFormatted;
    }
}
