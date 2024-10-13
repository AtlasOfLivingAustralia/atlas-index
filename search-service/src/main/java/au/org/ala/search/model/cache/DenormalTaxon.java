package au.org.ala.search.model.cache;

import au.org.ala.search.model.SearchItemIndex;
import lombok.experimental.SuperBuilder;

/*
Subset of SearchItemIndex for caching
 */
@SuperBuilder
public class DenormalTaxon extends Denormal {
    public String guid;
    public String name;
    public String acceptedConceptID;
    public String scientificName;
    public String nameComplete;
    public String rank;
    public Integer rankID;
    public String taxonomicStatus;
    public String nameType;
    public String favourite;
    public String nameAccordingTo;
    public String namePublishedIn;
    public String source;
    public String datasetID;

    public DenormalTaxon(SearchItemIndex item) {
        super(item.parentGuid);
        this.guid = item.guid;
        this.name = item.name;
        this.acceptedConceptID = item.acceptedConceptID;
        this.scientificName = item.scientificName;
        this.nameComplete = item.nameComplete;
        this.rank = item.rank;
        this.rankID = item.rankID;
        this.taxonomicStatus = item.taxonomicStatus;
        this.nameType = item.nameType;
        this.favourite = item.favourite;
        this.nameAccordingTo = item.nameAccordingTo;
        this.namePublishedIn = item.namePublishedIn;
        this.source = item.source;
        this.datasetID = item.datasetID;
    }
}
