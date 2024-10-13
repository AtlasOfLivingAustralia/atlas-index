package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.cache.*;
import au.org.ala.search.model.dto.DatasetInfo;
import au.org.ala.search.model.dto.Rank;
import au.org.ala.search.names.*;
import au.org.ala.search.service.LanguageService;
import au.org.ala.search.service.LegacyService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.util.TitleCapitaliser;
import jakarta.annotation.PostConstruct;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.text.StringEscapeUtils;
import org.gbif.dwc.ArchiveFile;
import org.gbif.dwc.record.Record;
import org.gbif.dwc.terms.DcTerm;
import org.gbif.dwc.terms.DwcTerm;
import org.gbif.dwc.terms.GbifTerm;
import org.gbif.dwc.terms.Term;
import org.gbif.nameparser.api.NameParser;
import org.gbif.nameparser.api.ParsedName;
import org.gbif.nameparser.api.UnparsableNameException;
import org.gbif.utils.file.ClosableIterator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.lang.reflect.Field;
import java.util.*;
import java.util.concurrent.CompletableFuture;

import static au.org.ala.search.names.ALATerm.TaxonVariant;
import static org.gbif.dwc.terms.DwcTerm.Taxon;
import static org.gbif.dwc.terms.GbifTerm.Identifier;
import static org.gbif.dwc.terms.GbifTerm.VernacularName;

@Service
public class DwCAImportRunner {
    private static final TaskType taskType = TaskType.DWCA;

    private static final Logger logger = LoggerFactory.getLogger(DwCAImportRunner.class);
    protected final ElasticService elasticService;
    protected final LogService logService;
    protected final DwCADenormaliseImportService dwCADenormaliseImportService;
    protected final LegacyService legacyService;
    protected final LanguageService languageService;
    Set<Term> TAXON_ALREADY_INDEXED;
    Set<Term> IN_SCHEMA;
    NameParser nameParser = new PhraseNameParser();
    @Value("${commonName.defaultLanguage}")
    private String commonNameDefaultLanguage;
    @Value("${vernacularName.preferredStatus}")
    private String vernacularNamePreferredStatus;

    public DwCAImportRunner(ElasticService elasticService, LogService logService, DwCADenormaliseImportService dwCADenormaliseImportService, LegacyService legacyService, LanguageService languageService) {
        this.elasticService = elasticService;
        this.logService = logService;
        this.dwCADenormaliseImportService = dwCADenormaliseImportService;
        this.legacyService = legacyService;
        this.languageService = languageService;
    }

    @PostConstruct
    void init() {
        initSets();
    }

    private void initSets() {
        TAXON_ALREADY_INDEXED = Set.of(
                new Term[]{
                        DwcTerm.taxonID,
                        DwcTerm.datasetID,
                        DwcTerm.acceptedNameUsageID,
                        DwcTerm.parentNameUsageID,
                        DwcTerm.scientificName,
                        DwcTerm.taxonRank,
                        DwcTerm.scientificNameAuthorship,
                        DwcTerm.taxonomicStatus,
                        ALATerm.nameComplete,
                        ALATerm.nameFormatted,
                        DwcTerm.taxonRemarks,
                        DcTerm.provenance,
                        GbifTerm.nameType
                });
        IN_SCHEMA = Set.of(
                new Term[]{
                        DwcTerm.taxonID, DwcTerm.nomenclaturalCode, DwcTerm.establishmentMeans, DwcTerm.taxonomicStatus,
                        DwcTerm.taxonConceptID, DwcTerm.scientificNameID, DwcTerm.nomenclaturalStatus, DwcTerm.nameAccordingTo, DwcTerm.nameAccordingToID,
                        DwcTerm.namePublishedIn, DwcTerm.namePublishedInID, DwcTerm.namePublishedInYear,
                        DwcTerm.taxonRemarks, DwcTerm.lifeStage, DwcTerm.sex, DwcTerm.locationID, DwcTerm.locality, DwcTerm.countryCode,
                        DcTerm.source, DcTerm.language, DcTerm.license, DcTerm.format, DcTerm.rights, DcTerm.rightsHolder, DcTerm.temporal,
                        ALATerm.status, ALATerm.nameID, ALATerm.nameFormatted, ALATerm.nameComplete, ALATerm.priority,
                        ALATerm.verbatimNomenclaturalCode, ALATerm.verbatimNomenclaturalStatus, ALATerm.verbatimTaxonomicStatus,
                        DwcTerm.datasetName, DcTerm.provenance,
                        GbifTerm.isPlural, GbifTerm.isPreferredName, GbifTerm.organismPart, ALATerm.labels,
                        GbifTerm.nameType
                });
    }

    @Async("processExecutor")
    public CompletableFuture<Integer> importDwcARowType(
            ArchiveFile archive,
            Map<String, DatasetInfo> attributionMap,
            String defaultDatasetName,
            Date modified,
            DenormalCache cacheOnly) {
        Term term = archive.getRowType();

        logService.log(taskType, "Importing " + term.simpleName());

        List<IndexQuery> buffer = new ArrayList<>();
        int counter = 0;

        // when cacheOnly is supplied, only cache, do not index in ES
        if (cacheOnly != null) {
            int totalRecords = 0;
            try (ClosableIterator<Record> iter = archive.iterator()) {
                while (iter.hasNext()) {
                    iter.next();
                    totalRecords++;
                }
            } catch (Exception e) {
                logService.log(taskType, "failed to count number of rows of: " + term.simpleName());
                logger.error("failed to count number of rows of: " + term.simpleName());
            }

            switch (term) {
                case Taxon -> cacheOnly.cacheTaxon = new DenormalTaxon[totalRecords];
                case VernacularName -> cacheOnly.cacheVernacular = new DenormalVernacular[totalRecords];
                case Identifier -> cacheOnly.cacheIdentifier = new DenormalIdentifier[totalRecords];
                default -> {
                    if (term.simpleName().equals("TaxonVariant")) {
                        cacheOnly.cacheVariant = new DenormalVariant[totalRecords];
                    } else {
                        logService.log(taskType, "Unable to import an archive of type " + term.simpleName());
                        return CompletableFuture.completedFuture(0);
                    }
                }
            }
        }

        int pos = 0;
        try (ClosableIterator<Record> iter = archive.iterator()) {
            while (iter.hasNext()) {
                Record record = iter.next();
                SearchItemIndex searchItemIndex = null;

                switch (term) {
                    case Taxon -> {
                        if (cacheOnly != null) {
                            cacheOnly.cacheTaxon[pos++] = buildDenormalTaxon(record);
                        } else {
                            searchItemIndex = buildTaxonRecord(record, attributionMap, defaultDatasetName, modified);
                            dwCADenormaliseImportService.denormalizeItemOnly(searchItemIndex);
                        }
                    }
                    case VernacularName -> {
                        if (cacheOnly != null) {
                            cacheOnly.cacheVernacular[pos++] = buildDenormalVernacular(record);
                        } else {
                            searchItemIndex = buildVernacularRecord(record, attributionMap, defaultDatasetName, modified);
                        }
                    }
                    case Identifier -> {
                        if (cacheOnly != null) {
                            cacheOnly.cacheIdentifier[pos++] = buildDenormalIdentifier(record);
                        } else {
                            searchItemIndex = buildIdentifierRecord(record, attributionMap, defaultDatasetName, modified);
                        }
                    }
                    default -> {
                        if (term.simpleName().equals("TaxonVariant")) {
                            if (cacheOnly != null) {
                                cacheOnly.cacheVariant[pos++] = buildDenormalVariant(record);
                            } else {
                                searchItemIndex = buildTaxonVariantRecord(record, attributionMap, defaultDatasetName, modified);
                            }
                        } else {
                            logService.log(taskType, "failed to load, DwCA type not supported: " + term.simpleName());
                            logger.warn("DwCA type not supported by import: " + term);
                            return CompletableFuture.completedFuture(0);
                        }
                    }
                }

                if (searchItemIndex != null) {
                    buffer.add(elasticService.buildIndexQuery(searchItemIndex));

                    if (buffer.size() >= 1000) {
                        counter += buffer.size();
                        elasticService.flush(new ArrayList<>(buffer));
                        buffer.clear();

                        if (counter % 100000 == 0) {
                            logService.log(taskType, term.simpleName() + " import progress: " + counter);
                        }
                    }
                }
            }
        } catch (Exception e) {
            logService.log(taskType, "failed to load: " + term.simpleName());
            logger.error("failed to load: " + term.simpleName(), e);
        }

        counter += buffer.size();
        elasticService.flush(buffer);

        logService.log(taskType, term.simpleName() + (cacheOnly != null ? " cached "  + pos: " indexing finished: " + counter));

        return CompletableFuture.completedFuture(counter);
    }

    SearchItemIndex buildVernacularRecord(
            Record core,
            Map<String, DatasetInfo> attributionMap,
            String defaultDatasetName,
            Date modified) {
        String taxonID = core.id();
        String vernacularName = core.value(DwcTerm.vernacularName);
        if (StringUtils.isBlank(vernacularName)) {
            logService.log(taskType, "Invalid vernacular name for taxon " + taxonID + " ...skipping");
            return null;
        }

        String nameID = core.value(ALATerm.nameID);
        String status = null;
        int priority = VernacularType.COMMON.getPriority();
        VernacularType vernacularType = VernacularType.find(core.value(ALATerm.status).toUpperCase());
        if (vernacularType != null) {
            status = vernacularType.getTerm();
            priority = vernacularType.getPriority();
        }

        String language = StringUtils.isNotEmpty(core.value(DcTerm.language)) ? core.value(DcTerm.language) : commonNameDefaultLanguage;
        String languageName = null;
        String languageUri = null;
        if (StringUtils.isNotEmpty(language)) {
            LanguageInfo li = languageService.getLanguageInfo(language);

            // silently skip if language is not found
            if (li != null) {
                languageName = li.name;
                languageUri = li.uri;
            }
        }

        String source = core.value(DcTerm.source);
        String datasetID = core.value(DwcTerm.datasetID);
        String temporal = core.value(DcTerm.temporal);
        String locationID = core.value(DwcTerm.locationID);
        String locality = core.value(DwcTerm.locality);
        String countryCode = core.value(DwcTerm.countryCode);
        String sex = core.value(DwcTerm.sex);
        String lifeStage = core.value(DwcTerm.lifeStage);
        String isPlural = core.value(GbifTerm.isPlural);
        String isPreferred = core.value(GbifTerm.isPreferredName);
        if (status == null && "true".equalsIgnoreCase(isPreferred)) {
            status = vernacularNamePreferredStatus;
        }
        String organismPart = core.value(GbifTerm.organismPart);
        String taxonRemarks = core.value(DwcTerm.taxonRemarks);
        String[] taxonRemarksList = StringUtils.isEmpty(taxonRemarks) ? null : taxonRemarks.split("\\|");
        String provenance = core.value(DcTerm.provenance);
        String[] provenanceList = StringUtils.isEmpty(provenance) ? null : provenance.split("\\|");
        String labels = core.value(ALATerm.labels);
        TitleCapitaliser capitaliser =
                TitleCapitaliser.create(
                        StringUtils.isNotEmpty(language) ? language : commonNameDefaultLanguage);
        vernacularName = capitaliser.capitalise(vernacularName);

        DatasetInfo attribution = attributionMap.getOrDefault(datasetID, null);

        String id = UUID.randomUUID().toString();

        return SearchItemIndex.builder()
                .id(id)
                .guid(id)
                .idxtype(IndexDocType.COMMON.name())
                .name(vernacularName)
                .modified(modified)
                .taxonGuid(taxonID)
                .datasetID(datasetID)
                .status(status)
                .priority(priority)
                .nameID(nameID)
                .language(StringUtils.isNotEmpty(language) ? language : commonNameDefaultLanguage)
                .languageName(languageName)
                .languageUri(languageUri)
                .source(source)
                .temporal(temporal)
                .locationID(locationID)
                .locality(locality)
                .countryCode(countryCode)
                .sex(sex)
                .lifeStage(lifeStage)
                .isPlural(Boolean.valueOf(isPlural))
                .organismPart(organismPart)
                .taxonRemarks(taxonRemarksList)
                .provenance(provenanceList)
                .labels(labels)
                .datasetName(attribution != null ? attribution.datasetName : defaultDatasetName)
                .rightsHolder(attribution != null ? attribution.rightsHolder : null)
                .build();
    }

    DenormalVernacular buildDenormalVernacular(
            Record core) {
        String taxonID = core.id();
        String vernacularName = core.value(DwcTerm.vernacularName);
        if (StringUtils.isBlank(vernacularName)) {
            logService.log(taskType, "Invalid vernacular name for taxon " + taxonID + " ...skipping");
            return null;
        }
        String language = StringUtils.isNotEmpty(core.value(DcTerm.language)) ? core.value(DcTerm.language) : commonNameDefaultLanguage;

        TitleCapitaliser capitaliser =
                TitleCapitaliser.create(
                        StringUtils.isNotEmpty(language) ? language : commonNameDefaultLanguage);
        vernacularName = capitaliser.capitalise(vernacularName);

        String id = UUID.randomUUID().toString();

        String source = core.value(DcTerm.source); // This is the source URL
        String datasetID = core.value(DwcTerm.datasetID); // This is the datasetID, get the name using dataResourceUid

        return DenormalVernacular.builder()
                .guid(id)
                .name(vernacularName)
                .key(taxonID) // taxonID is stored in key for DenormalVernacular
                .source(source)
                .datasetID(datasetID)
                .status(core.value(ALATerm.status))
                .language(language)
                .build();
    }

    SearchItemIndex buildIdentifierRecord(
            Record core,
            Map<String, DatasetInfo> attributionMap,
            String defaultDatasetName,
            Date modified) {
        String taxonID = core.id();
        String identifier = core.value(DcTerm.identifier);
        String title = core.value(DcTerm.title);
        String subject = core.value(DcTerm.subject);
        String format = core.value(DcTerm.format);
        String source = core.value(DcTerm.source);
        String datasetID = core.value(DwcTerm.datasetID);
        String idStatus = core.value(ALATerm.status);
        String status = IdentifierStatus.UNKNOWN.getName();
        Integer priority = IdentifierStatus.UNKNOWN.getPriority();
        try {
            status = IdentifierStatus.valueOf(idStatus.toUpperCase()).getName();
            priority = IdentifierStatus.valueOf(idStatus.toUpperCase()).getPriority();
        } catch (Exception ignored) {
        }

        String provenance = core.value(DcTerm.provenance);
        String[] provenanceList = StringUtils.isEmpty(provenance) ? null : provenance.split("\\|");

        DatasetInfo attribution = attributionMap.getOrDefault(datasetID, null);

        String id = UUID.randomUUID().toString();

        return SearchItemIndex.builder()
                .id(id)
                .guid(identifier)
                .idxtype(IndexDocType.IDENTIFIER.name())
                .name(title)
                .modified(modified)
                .taxonGuid(taxonID)
                .datasetID(datasetID)
                .status(status)
                .priority(priority)
                .subject(subject)
                .format(format)
                .source(source)
                .provenance(provenanceList)
                .datasetName(attribution != null ? attribution.datasetName : defaultDatasetName)
                .rightsHolder(attribution != null ? attribution.rightsHolder : null)
                .build();
    }

    DenormalIdentifier buildDenormalIdentifier(
            Record core) {
        String taxonID = core.id();
        String identifier = core.value(DcTerm.identifier);

        return DenormalIdentifier.builder()
                .guid(identifier)
                .key(taxonID) // taxonGuid is key for DenormalIdentifier
                .scientificName(core.value(DwcTerm.scientificName))
                .source(core.value(DcTerm.source))
                .datasetID(core.value(DwcTerm.datasetID))
                .nameAccordingTo(core.value(DwcTerm.nameAccordingTo))
                .namePublishedIn(core.value(DwcTerm.namePublishedIn))
                .build();
    }

    SearchItemIndex buildTaxonVariantRecord(
            Record record,
            Map<String, DatasetInfo> attributionMap,
            String defaultDatasetName,
            Date modified) {
        SearchItemIndex item = buildTaxonRecord(record, attributionMap, defaultDatasetName, modified);

        item.setIdxtype(IndexDocType.TAXONVARIANT.name());
        if (StringUtils.isEmpty(item.taxonomicStatus)) {
            item.taxonomicStatus = "inferredAccepted";
        }
        item.setTaxonGuid(record.id());
        item.setGuid(record.value(DwcTerm.taxonID));
        if (StringUtils.isNotEmpty(record.value(ALATerm.priority))) {
            item.setPriority(Integer.parseInt(record.value(ALATerm.priority)));
        }

        return item;
    }

    SearchItemIndex buildTaxonRecord(
            Record core,
            Map<String, DatasetInfo> attributionMap,
            String defaultDatasetName,
            Date modified) {

        String datasetID = core.value(DwcTerm.datasetID);
        String taxonRank =
                (StringUtils.isNotEmpty(core.value(DwcTerm.taxonRank)) ? core.value(DwcTerm.taxonRank) : "")
                        .toLowerCase();
        String scientificName = core.value(DwcTerm.scientificName);
        String parentNameUsageID = core.value(DwcTerm.parentNameUsageID);
        String scientificNameAuthorship = core.value(DwcTerm.scientificNameAuthorship);
        String nameComplete = core.value(ALATerm.nameComplete);
        String nameFormatted = core.value(ALATerm.nameFormatted);

        Integer taxonRankID = getTaxonRankID(taxonRank);

        String taxonID = core.id();
        String acceptedNameUsageID = core.value(DwcTerm.acceptedNameUsageID);

        boolean synonym =
                acceptedNameUsageID != null
                        && !taxonID.equals(acceptedNameUsageID)
                        && StringUtils.isNotEmpty(acceptedNameUsageID);
        String defaultTaxonomicStatus = synonym ? "inferredSynonym" : "inferredAccepted";
        String taxonomicStatus =
                StringUtils.isNotEmpty(core.value(DwcTerm.taxonomicStatus))
                        ? core.value(DwcTerm.taxonomicStatus)
                        : defaultTaxonomicStatus;

        String nameType = core.value(GbifTerm.nameType);
        String taxonRemarks = core.value(DwcTerm.taxonRemarks);
        String[] taxonRemarksList = StringUtils.isEmpty(taxonRemarks) ? null : taxonRemarks.split("\\|");
        String provenance = core.value(DcTerm.provenance);
        String[] provenanceList = StringUtils.isEmpty(provenance) ? null : provenance.split("\\|");

        // See if we can get a name type
        if (StringUtils.isEmpty(nameType)) {
            try {
                org.gbif.nameparser.api.Rank parseRank = taxonRankID > 0 && RankType.getForId(taxonRankID) != null ? RankType.getForId(taxonRankID).getCbRank() : null;
                ParsedName pn = nameParser.parse(scientificName, parseRank);
                nameType = pn != null && pn.getType() != null ? pn.getType().name().toLowerCase() : null;
                if (pn instanceof ALAParsedName && StringUtils.isNotEmpty(((ALAParsedName) pn).phraseVoucher)) {
                    nameType = "phraseName";
                }
            } catch (UnparsableNameException ex) {
                nameType = ex.getType() != null ? ex.getType().name().toLowerCase() : "unknown";
            } catch (Exception ex) {
                nameType = "unknown";
            }
        }

        DatasetInfo attribution = attributionMap.getOrDefault(datasetID, null);

        // fetch the id created when caching
        String id = UUID.randomUUID().toString();

        // dynamic values container
        Map<String, String> dynamic = new HashMap<>();

        SearchItemIndex item = SearchItemIndex.builder()
                .id(id)
                .guid(taxonID)
                .name(scientificName)
                .idxtype(IndexDocType.TAXON.name())
                .description(scientificNameAuthorship)
                .modified(modified)
                .taxonomicStatus(taxonomicStatus)
                .datasetID(datasetID)
                .parentGuid(parentNameUsageID)
                .rank(taxonRank)
                .rankID(taxonRankID > 0 ? taxonRankID : null)
                .scientificName(scientificName)
                .scientificNameAuthorship(scientificNameAuthorship)
                .nameComplete(buildNameComplete(nameComplete, scientificName, scientificNameAuthorship))
                .nameFormatted(
                        buildNameFormatted(
                                nameFormatted, nameComplete, scientificName, scientificNameAuthorship, taxonRank))
                .taxonRemarks(taxonRemarksList)
                .provenance(provenanceList)
                .nameType(nameType)
                .acceptedConceptID(synonym ? acceptedNameUsageID : null)
                .parentGuid(parentNameUsageID)
                .datasetName(attribution != null ? attribution.datasetName : defaultDatasetName)
                .rightsHolder(attribution != null ? attribution.rightsHolder : null).build();


        // index additional fields that are supplied in the record
        core.terms()
                .forEach(
                        term -> {
                            if (!TAXON_ALREADY_INDEXED.contains(term)) {
                                if (IN_SCHEMA.contains(term)) {
                                    try {
                                        Field field = SearchItemIndex.class.getField(term.simpleName());
                                        if (field.getType().equals(Integer.class)) {
                                            field.set(item, Integer.valueOf(core.value(term)));
                                        } else {
                                            field.set(item, core.value(term));
                                        }
                                    } catch (NoSuchFieldException | IllegalAccessException ignored) {
                                        logger.error("error setting field: " + term.simpleName());
                                    }
                                } else {
                                    //use a dynamic field extension
                                    dynamic.put(term.simpleName() + "_s", core.value(term));
                                }
                            }
                        });
        if (!dynamic.isEmpty()) {
            item.setData(dynamic);
        }

        return item;
    }

    DenormalTaxon buildDenormalTaxon(Record core) {
        String taxonRank =
                (StringUtils.isNotEmpty(core.value(DwcTerm.taxonRank)) ? core.value(DwcTerm.taxonRank) : "")
                        .toLowerCase();
        String scientificName = core.value(DwcTerm.scientificName);
        String parentNameUsageID = core.value(DwcTerm.parentNameUsageID);
        String scientificNameAuthorship = core.value(DwcTerm.scientificNameAuthorship);
        String nameComplete = core.value(ALATerm.nameComplete);

        Integer taxonRankID = getTaxonRankID(taxonRank);

        String taxonID = core.id();
        String acceptedNameUsageID = core.value(DwcTerm.acceptedNameUsageID);

        boolean synonym = acceptedNameUsageID != null && !taxonID.equals(acceptedNameUsageID) && StringUtils.isNotEmpty(acceptedNameUsageID);
        String defaultTaxonomicStatus = synonym ? "inferredSynonym" : "inferredAccepted";
        String taxonomicStatus = StringUtils.isNotEmpty(core.value(DwcTerm.taxonomicStatus)) ? core.value(DwcTerm.taxonomicStatus) : defaultTaxonomicStatus;

        String nameType = core.value(GbifTerm.nameType);

        // See if we can get a name type
        if (StringUtils.isEmpty(nameType)) {
            try {
                org.gbif.nameparser.api.Rank parseRank = taxonRankID > 0 && RankType.getForId(taxonRankID) != null ? RankType.getForId(taxonRankID).getCbRank() : null;
                ParsedName pn = nameParser.parse(scientificName, parseRank);
                nameType = pn != null && pn.getType() != null ? pn.getType().name().toLowerCase() : null;
                if (pn instanceof ALAParsedName
                        && StringUtils.isNotEmpty(((ALAParsedName) pn).phraseVoucher)) {
                    nameType = "phraseName";
                }
            } catch (UnparsableNameException ex) {
                nameType = ex.getType() != null ? ex.getType().name().toLowerCase() : "unknown";
            } catch (Exception ex) {
                nameType = "unknown";
            }
        }

        return DenormalTaxon.builder()
                .guid(taxonID)
                .name(scientificName)
                .taxonomicStatus(taxonomicStatus)
                .key(parentNameUsageID) // parentGuid is assigned to key for DenormalTaxon
                .rank(taxonRank)
                .rankID(taxonRankID > 0 ? taxonRankID : null)
                .scientificName(scientificName)
                .nameComplete(buildNameComplete(nameComplete, scientificName, scientificNameAuthorship))
                .nameType(nameType)
                .acceptedConceptID(synonym ? acceptedNameUsageID : null)
                .nameAccordingTo(core.value(DwcTerm.nameAccordingTo))
                .namePublishedIn(core.value(DwcTerm.namePublishedIn))
                .source(core.value(DcTerm.source))
                .datasetID(core.value(DwcTerm.datasetID))
                .build();
    }

    DenormalVariant buildDenormalVariant(Record core) {
        String scientificName = core.value(DwcTerm.scientificName);
        String scientificNameAuthorship = core.value(DwcTerm.scientificNameAuthorship);
        String nameComplete = core.value(ALATerm.nameComplete);

        Integer priority = null;
        if (StringUtils.isNotEmpty(core.value(ALATerm.priority))) {
            priority = Integer.parseInt(core.value(ALATerm.priority));
        }

        return DenormalVariant.builder()
                .key(core.id()) // taxonGuid is assigned to key for DenormalTaxon
                .scientificName(scientificName)
                .nameComplete(buildNameComplete(nameComplete, scientificName, scientificNameAuthorship))
                .priority(priority)
                .source(core.value(DcTerm.source))
                .datasetID(core.value(DwcTerm.datasetID))
                .namePublishedIn(core.value(DwcTerm.namePublishedIn))
                .nameAccordingTo(core.value(DwcTerm.nameAccordingTo))
                .build();
    }

    Integer getTaxonRankID(String taxonRank) {
        Rank tr = legacyService.taxonRanks.get(taxonRank);
        if (tr == null) {
            tr = legacyService.taxonRanks.values().stream()
                    .filter(v -> v.getOtherNames().contains(taxonRank))
                    .findAny()
                    .orElse(null);
        }

        return tr != null ? tr.getRankID() : -1;
    }

    /**
     * Build a complete name + author
     *
     * <p>Some names are funny. So if there is a name supplied used that. Otherwise, try to build the
     * name from scientific name + authorship
     *
     * @param nameComplete             The supplied complete name, if available
     * @param scientificName           The scientific name
     * @param scientificNameAuthorship The authorship
     * @return complete name
     */
    String buildNameComplete(
            String nameComplete, String scientificName, String scientificNameAuthorship) {
        if (StringUtils.isNotEmpty(nameComplete)) {
            return nameComplete;
        } else if (StringUtils.isNotEmpty(scientificNameAuthorship)) {
            return scientificName + " " + scientificNameAuthorship;
        } else {
            return scientificName;
        }
    }

    /**
     * Build an HTML formatted name
     *
     * <p>If a properly formatted name is supplied, then use that. Otherwise, try to build the name
     * from the supplied information. The HTMLised name is escaped and uses spans to encode formatting
     * information.
     *
     * @param nameFormatted            The formatted name, if available
     * @param nameComplete             The complete name, if available
     * @param scientificName           The scientific name
     * @param scientificNameAuthorship The name authorship
     * @param rank                     The taxon rank
     * @return The formatted name
     */
    String buildNameFormatted(
            String nameFormatted,
            String nameComplete,
            String scientificName,
            String scientificNameAuthorship,
            String rank) {
        String rankGroup = "unknown";
        if (legacyService.taxonRanks.containsKey(rank)
                && StringUtils.isNotEmpty(legacyService.taxonRanks.get(rank).getRankGroup())) {
            rankGroup = legacyService.taxonRanks.get(rank).getRankGroup();
        }

        String formattedCssClass =
                StringUtils.isNotEmpty(rank) ? "scientific-name rank-" + rankGroup : "scientific-name";

        if (StringUtils.isNotEmpty(nameFormatted)) {
            return nameFormatted;
        }

        if (StringUtils.isNotEmpty(nameComplete)) {
            int authorIndex =
                    StringUtils.isNotEmpty(scientificNameAuthorship)
                            ? nameComplete.indexOf(scientificNameAuthorship)
                            : -1;
            if (authorIndex <= 0) {
                return "<span class=\""
                        + formattedCssClass
                        + "\">"
                        + StringEscapeUtils.escapeHtml4(nameComplete)
                        + "</span>";
            }
            String preAuthor = nameComplete.substring(0, authorIndex).trim();
            String postAuthor =
                    nameComplete.substring(authorIndex + scientificNameAuthorship.length()).trim();
            String name = "<span class=\"" + formattedCssClass + "\">";
            if (StringUtils.isNotEmpty(preAuthor)) {
                name = name + "<span class=\"name\">" + StringEscapeUtils.escapeHtml4(preAuthor) + "</span> ";
            }
            name = name + "<span class=\"author\">" + StringEscapeUtils.escapeHtml4(scientificNameAuthorship) + "</span>";
            if (StringUtils.isNotEmpty(postAuthor)) {
                name = name + " <span class=\"name\">" + StringEscapeUtils.escapeHtml4(postAuthor) + "</span>";
            }
            name = name + "</span>";
            return name;
        }
        if (StringUtils.isNotEmpty(scientificNameAuthorship)) {
            return "<span class=\""
                    + formattedCssClass
                    + "\"><span class=\"name\">"
                    + StringEscapeUtils.escapeHtml4(scientificName)
                    + "</span> <span class=\"author\">"
                    + StringEscapeUtils.escapeHtml4(scientificNameAuthorship)
                    + "</span></span>";
        }

        return "<span class=\""
                + formattedCssClass
                + "\"><span class=\"name\">"
                + StringEscapeUtils.escapeHtml4(scientificName)
                + "</span></span>";
    }
}
