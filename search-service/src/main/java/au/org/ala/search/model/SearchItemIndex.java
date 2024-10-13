package au.org.ala.search.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Mapping;
import org.springframework.data.elasticsearch.annotations.Setting;

import java.util.Date;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Document(indexName = "#{@environment.getProperty('elastic.index')}", createIndex = false)
@Setting(settingPath = "/elasticsearch/settings.json")
@Mapping(mappingPath = "/elasticsearch/mappings.json")
@NoArgsConstructor
@Data
@SuperBuilder
public class SearchItemIndex {
    @Id
    public String id;
    public String guid;
    public String idxtype;
    public String name;
    public String description;
    public Date modified;
    public Integer priority;
    public Float searchWeight;
    public Float suggestWeight;
    public Integer occurrenceCount;
    public String taxonomicStatus;
    public String linkIdentifier;
    public String layerId;
    public String fieldId;
    public String centroid;
    public String fieldName;
    public Double areaKm;
    public String bbox;
    public String projectType;
    public String image;
    public String containsActivity;
    public String dateCreated;
    public String keywords;
    public String datasetID;
    public String rights;
    public String license;
    public String acronym;
    public String resourceType;
    public String taxonGuid;
    public String status;
    public String nameID;
    public String language;
    public String languageName;
    public String languageUri;
    public String source;
    public String temporal;
    public String locationID;
    public String locality;
    public String countryCode;
    public String sex;
    public String lifeStage;
    public Boolean isPlural;
    public String organismPart;
    public String[] taxonRemarks;
    public String[] provenance;
    public String labels;
    public String datasetName;
    public String rightsHolder;
    public String subject;
    public String format;
    public String parentGuid;
    public String rank;
    public Integer rankID;
    public String scientificName;
    public String scientificNameAuthorship;
    public String nameComplete;
    public String nameFormatted;
    public String acceptedNameUsageID;
    public String acceptedConceptID;
    public String nameType;
    public String classification1;
    public String classification2;
    public String domain;
    public String type;
    public String[] commonName;
    public String commonNameSingle;
    public Integer itemCount;
    public Boolean isAuthoritative;
    public Boolean isInvasive;
    public Boolean isThreatened;
    public String region;
    public String hiddenImages_s;
    public String favourite;
    public String wikiUrl_s;
    public Map<String, String> data;
    public String[] speciesGroup;
    public String[] speciesSubgroup;
    public String taxonID;
    public String nomenclaturalCode;
    public String establishmentMeans;
    public String taxonConceptID;
    public String scientificNameID;
    public String nomenclaturalStatus;
    public String nameAccordingTo;
    public String nameAccordingToID;
    public String namePublishedIn;
    public String namePublishedInID;
    public String namePublishedInYear;
    public String verbatimNomenclaturalCode;
    public String verbatimNomenclaturalStatus;
    public String verbatimTaxonomicStatus;
    public String isPreferredName;
    public String acceptedConceptName;
    public String[] nameVariant;
    public String[] additionalIdentifiers;
    public String[] additionalNames_m_s;
    public String synonymData; // JSON object with synonym data for species page names tab
    public String variantData; // JSON object with variant data for species page names tab
    public String identifierData; // JSON object with variant data for species page names tab
    public String vernacularData; // JSON object with vernacular data for species page names tab
}
