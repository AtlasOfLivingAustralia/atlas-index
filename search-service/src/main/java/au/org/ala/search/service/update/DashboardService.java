package au.org.ala.search.service.update;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.dashboard.Record;
import au.org.ala.search.model.dashboard.*;
import au.org.ala.search.model.dashboard.bie.BieSearch;
import au.org.ala.search.model.dashboard.biocache.BiocacheSearch;
import au.org.ala.search.model.dashboard.biocache.FieldResult;
import au.org.ala.search.model.dashboard.biocache.SpeciesCount;
import au.org.ala.search.model.dashboard.collectory.CollectionsSearch;
import au.org.ala.search.model.dashboard.collectory.DataResource;
import au.org.ala.search.model.dashboard.collectory.Feature;
import au.org.ala.search.model.dashboard.digivol.DigivolSearch;
import au.org.ala.search.model.dashboard.images.ImageStatistics;
import au.org.ala.search.model.dashboard.logger.LoggerSearch;
import au.org.ala.search.model.dashboard.spatial.SpatialField;
import au.org.ala.search.service.remote.LogService;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * TODO: Document the remote services used in this class comment. There are also some things to check:
 * 1. species with conservation status, filter out "not supplied"
 * 2. digivol, fetch all numbers
 * 3. images numbers vary greatly from dashboard.ala
 * 4. speciesgroup, filter out not supplied
 * 5. usage stats, records downloaded is wrong
 */
@Service
public class DashboardService {
    private static final TaskType taskType = TaskType.DASHBOARD;
    private static final Logger logger = LoggerFactory.getLogger(DashboardService.class);

    private final LogService logService;

    ObjectMapper objectMapper = new ObjectMapper();

    @Value("${data.dir}")
    private String dataDir;

    @Value("${logger.url}")
    private String loggerUrl;

    // TODO: use elasticService instead of bieUrl
    @Value("${bie.url}")
    private String bieUrl;
    @Value("${bie.uiUrl}")
    private String bieUiUrl;

    @Value("${biocache.uiUrl}")
    private String biocacheUiUrl;

    @Value("${biocache.url}")
    private String biocacheWsUrl;

    @Value("${collections.url}")
    private String collectoryUrl;

    @Value("${bhl.url}")
    private String bhlUrl;
    @Value("${bhl.image.url}")
    private String bhlImageUrl;

    @Value("${digivol.url}")
    private String digivolUrl;
    @Value("${digivol.image.url}")
    private String digivolImageUrl;

    @Value("${spatial.url}")
    private String spatialUrl;

    @Value("${images.url}")
    private String imagesUrl;

    public DashboardService(LogService logService) {
        this.logService = logService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        logService.log(taskType, "Starting");
        int errorCount = 0;
        try {
            DashboardData existingData = load();
            errorCount = update(existingData);
            save(existingData);

            logService.log(taskType, "Finished, errors: " + errorCount);
        } catch (IOException e) {
            logService.log(taskType, "Failed to save: " + dataDir + "/dashboard.json, errors:" + (errorCount + 1));
            logger.error("failed to save: " + dataDir + "/dashboard.json");
        }

        return CompletableFuture.completedFuture(true);
    }

    private DashboardData load() {
        File file = new File(dataDir + "/dashboard.json");
        if (file.exists()) {
            try {
                return objectMapper.readValue(IOUtils.toString(file.toURI(), StandardCharsets.UTF_8), DashboardData.class);
            } catch (IOException e) {
                logService.log(taskType, "cannot read: " + dataDir + "/dashboard.json");
                logger.error("cannot read: " + dataDir + "/dashboard.json");
            }
        }

        return new DashboardData();
    }

    private void save(DashboardData data) throws IOException {
        // save data.json
        FileUtils.writeStringToFile(new File(dataDir + "/data.json"), objectMapper.writeValueAsString(data), "UTF-8");

        // save csv files
        List<File> csvFiles = new ArrayList<>();
        for (Map.Entry<String, Record> entry : data.data.entrySet()) {
            if (entry.getValue().tables != null) {
                for (Table table : entry.getValue().tables) {
                    File file = new File(dataDir + "/" + entry.getKey() + (table.name != null ? table.name : "") + ".csv");
                    csvFiles.add(file);

                    BufferedWriter bw = new BufferedWriter(new FileWriter(file));

                    if (table.header != null) {
                        bw.write(StringUtils.join(table.header, ","));
                        bw.write('\n');
                    }
                    for (TableRow tableRow : table.rows) {
                        bw.write(tableRow.name);
                        bw.write(',');
                        bw.write(StringUtils.join(tableRow.values, ","));
                        bw.write('\n');
                    }

                    bw.flush();
                    bw.close();
                }
            }
        }

        // save zipped csv files
        ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(dataDir + "/dashboard.zip"));
        for (File file : csvFiles) {
            zos.putNextEntry(new ZipEntry(file.getName()));
            byte[] bytes = FileUtils.readFileToByteArray(file);
            zos.write(bytes, 0, bytes.length);
            zos.closeEntry();
        }
        zos.close();
    }

    private int update(DashboardData dashboardData) {
        int errorCount = 0;
        errorCount += addOccurrenceCount(dashboardData);
        errorCount += addDatasets(dashboardData);
        errorCount += addBasisOfRecord(dashboardData);
        errorCount += addBhl(dashboardData);
        errorCount += addDigivol(dashboardData);
        errorCount += addRecordsByDate(dashboardData);
        errorCount += addNationalSpeciesLists(dashboardData);
        errorCount += addUsageStats(dashboardData);
        errorCount += addEmailDownloads(dashboardData);
        errorCount += addReasonDownloads(dashboardData);
        errorCount += addSpecimenTypes(dashboardData);
        errorCount += addConservation(dashboardData);
        errorCount += addFacet(dashboardData, "decade");
        errorCount += addStates(dashboardData);
        errorCount += addFacet(dashboardData, "dataProviderUid");
        errorCount += addFacet(dashboardData, "institutionUid");
        errorCount += addFacet(dashboardData, "speciesGroup");
        errorCount += addSpecies(dashboardData);
        errorCount += addSpatialLayers(dashboardData);
        errorCount += addImage(dashboardData);
        errorCount += addCollections(dashboardData);

        return errorCount;
    }

    private ImageStatistics getImage(String url) throws IOException {
        return objectMapper.readValue(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), ImageStatistics.class);
    }

    private List<SpatialField> getSpatialFields(String url) throws IOException {
        return Arrays.asList(objectMapper.readValue(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), SpatialField[].class));
    }

    private BiocacheSearch getBiocache(String url) throws IOException {
        return objectMapper.readValue(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), BiocacheSearch.class);
    }

    private List<SpeciesCount> getBiocacheGroup(String url) throws IOException {
        return Arrays.asList(objectMapper.readValue(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), SpeciesCount[].class));
    }

    private BieSearch getBie(String url) throws IOException {
        return objectMapper.readValue(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), BieSearch.class);
    }

    private LoggerSearch getLogger(String url) throws IOException {
        return objectMapper.readValue(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), LoggerSearch.class);
    }

    private CollectionsSearch getCollection(String url) throws IOException {
        return objectMapper.readValue(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), CollectionsSearch.class);
    }

    private List<DataResource> getDataResourceList(String url) throws IOException {
        return Arrays.asList(objectMapper.readValue(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), DataResource[].class));
    }

    private List<Facet> getBiocacheFacets(String url) throws IOException {
        return Arrays.asList(objectMapper.readValue(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), Facet[].class));
    }

    private DigivolSearch getDigivol(String url) throws IOException {
        return objectMapper.readValue(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), DigivolSearch.class);
    }

    private int addOccurrenceCount(DashboardData dashboardData) {
        if (StringUtils.isEmpty(biocacheWsUrl)) {
            logService.log(taskType, "skipping occurrenceCount");
            return 0;
        }
        try {
            logService.log(taskType, "updating occurrenceCount");
            Record record = new Record();
            record.url = biocacheUiUrl;
            record.count = getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&pageSize=0").totalRecords;

            dashboardData.data.put("occurrenceCount", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update occurrenceCount: " + e.getMessage());
            logger.error("failed to update occurrenceCount: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addBasisOfRecord(DashboardData dashboardData) {
        if (StringUtils.isEmpty(biocacheWsUrl)) {
            logService.log(taskType, "skipping basisOfRecord");
            return 0;
        }
        try {
            logService.log(taskType, "updating basisOfRecord");
            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"basisOfRecord", "occurrenceCount"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            BiocacheSearch result = getBiocache(biocacheWsUrl + "/occurrences/search?q=basisOfRecord:*&facet=true&facets=basisOfRecord&pageSize=0&fsort=count");
            record.count = result.totalRecords;
            for (FieldResult facet : result.facetResults.getFirst().fieldResult) {
                table.rows.add(new TableRow(facet.i18nCode,
                        biocacheUiUrl + "/occurrences/search?q=" + facet.fq, new Integer[]{facet.count}));
            }

            dashboardData.data.put("basisOfRecord", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update basisOfRecord: " + e.getMessage());
            logger.error("failed to update basisOfRecord: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addDatasets(DashboardData dashboardData) {
        if (StringUtils.isEmpty(collectoryUrl)) {
            logService.log(taskType, "skipping datasets");
            return 0;
        }
        try {
            logService.log(taskType, "updating datasets");
            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"datasetType", "datasetCount"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            record.count = getCollection(collectoryUrl + "/ws/dataResource/count/resourceType?public=true").total;

            table.rows.add(new TableRow("institutions", bieUrl + "/search?q=idxtype:%22INSTITUTION%22",
                    new Integer[]{getCollection(collectoryUrl + "/ws/institution/count").total}));

            table.rows.add(new TableRow("collections",
                    collectoryUrl + "/collections",
                    new Integer[]{getCollection(collectoryUrl + "/ws/collection/count").total}));

            table.rows.add(new TableRow("dataResources",
                    collectoryUrl + "/datasets#filters=resourceType%3Arecords",
                    new Integer[]{getCollection(collectoryUrl + "/ws/dataResource/count/resourceType?public=true").groups.get("records")}));

            table.rows.add(new TableRow("institutions",
                    collectoryUrl + "/datasets#filters=resourceType%3Arecords%3Bstatus%3AdataAvailable",
                    new Integer[]{getBiocacheFacets(biocacheWsUrl + "/occurrence/facets?q=*:*&facets=data_resource_uid&flimit=0&facet=true").getFirst().count}));

            table.rows.add(new TableRow("descriptionOnly",
                    null,
                    new Integer[]{getCollection(collectoryUrl + "/ws/dataResource/count/resourceType?public=true").groups.get("records")
                            - getBiocacheFacets(biocacheWsUrl + "/occurrence/facets?q=*:*&facets=data_resource_uid&flimit=0&facet=true").getFirst().count}));

            table.rows.add(new TableRow("speciesLists",
                    collectoryUrl + "/datasets#filters=resourceType%3Aspecies-list",
                    new Integer[]{getCollection(collectoryUrl + "/ws/dataResource/count/resourceType?public=true").groups.get("species-list")}));

            table.rows.add(new TableRow("documents",
                    collectoryUrl + "/datasets#filters=resourceType%3Adocument",
                    new Integer[]{getCollection(collectoryUrl + "/ws/dataResource/count/resourceType?public=true").groups.get("document")}));

            table.rows.add(new TableRow("harvestedWebsites",
                    collectoryUrl + "/datasets#filters=resourceType%3Awebsite",
                    new Integer[]{getCollection(collectoryUrl + "/ws/dataResource/count/resourceType?public=true").groups.get("website")}));

            List<DataResource> dataResources = getDataResourceList(collectoryUrl + "/ws/dataResource");
            record.mostRecent = new HashMap<>();
            record.mostRecent.put("url", dataResources.getLast().uri);
            record.mostRecent.put("name", dataResources.getLast().name);

            dashboardData.data.put("datasets", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update datasets: " + e.getMessage());
            logger.error("failed to update datasets: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addBhl(DashboardData dashboardData) {
        if (StringUtils.isEmpty(bhlUrl)) {
            logService.log(taskType, "skipping bhl");
            return 0;
        }
        try {
            logService.log(taskType, "updating bhl");
            String html = IOUtils.toString(URI.create(bhlUrl), StandardCharsets.UTF_8);
            int startidx = html.indexOf("onlinestats");
            String[] block = html.substring(startidx, startidx + 500).replaceAll(",", "").split("<strong>");

            int titles = Integer.parseInt(block[1].substring(0, block[1].indexOf("<")));
            int volumes = Integer.parseInt(block[2].substring(0, block[2].indexOf("<")));
            int pages = Integer.parseInt(block[3].substring(0, block[3].indexOf("<")));

            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"item", "itemCount"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            record.url = bhlUrl;
            record.imageUrl = bhlImageUrl;

            table.rows.add(new TableRow("pages", null, new Integer[]{pages}));
            table.rows.add(new TableRow("volumes", null, new Integer[]{volumes}));
            table.rows.add(new TableRow("titles", null, new Integer[]{titles}));

            dashboardData.data.put("bhl", record);

            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update bhl: " + e.getMessage());
            logger.error("failed to update bhl: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addDigivol(DashboardData dashboardData) {
        if (StringUtils.isEmpty(digivolUrl)) {
            logService.log(taskType, "skipping digivol");
            return 0;
        }
        try {
            logService.log(taskType, "updating digivol");
            Record record = new Record();
            Table table = new Table();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            record.url = digivolUrl;
            record.imageUrl = digivolImageUrl;

            DigivolSearch audio = getDigivol(digivolUrl + "/index/stats?disableHonourBoard=true&disableStats=false&institutionId=-1&maxContributors=0&projectId=-1&projectType=audio");
            DigivolSearch fieldNotes = getDigivol(digivolUrl + "/index/stats?disableHonourBoard=true&disableStats=false&institutionId=-1&maxContributors=0&projectId=-1&projectType=fieldnotes");
            DigivolSearch specimens = getDigivol(digivolUrl + "/index/stats?disableHonourBoard=true&disableStats=false&institutionId=-1&maxContributors=0&projectId=-1&projectType=specimens");
            DigivolSearch cameraTraps = getDigivol(digivolUrl + "/index/stats?disableHonourBoard=true&disableStats=false&institutionId=-1&maxContributors=0&projectId=-1&projectType=cameratraps");

            table.header = Arrays.stream(new String[]{"type", "audio", "cameraTraps", "fieldNotes", "specimens"}).toList();
            table.rows.add(new TableRow("transcriberCount", null, new Integer[]{audio.transcriberCount, cameraTraps.transcriberCount, fieldNotes.transcriberCount, specimens.transcriberCount}));
            table.rows.add(new TableRow("tasks", null, new Integer[]{audio.completedTasks,
                    cameraTraps.totalTasks,
                    fieldNotes.totalTasks,
                    specimens.totalTasks}));
            table.rows.add(new TableRow("tasksCompleted", null, new Integer[]{audio.completedTasks,
                    cameraTraps.completedTasks,
                    fieldNotes.completedTasks,
                    specimens.completedTasks}));

            dashboardData.data.put("digivol", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update digivol: " + e.getMessage());
            logger.error("failed to update digivol: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addRecordsByDate(DashboardData dashboardData) {
        if (StringUtils.isEmpty(biocacheWsUrl)) {
            logService.log(taskType, "skipping recordsByDate");
            return 0;
        }
        try {
            logService.log(taskType, "updating recordsByDate");
            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"group", "occurrenceCount or eventDate"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            BiocacheSearch byDate = getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&sort=eventDate&dir=desc&facet=true&pageSize=1");
            BiocacheSearch imageByDate = getBiocache(biocacheWsUrl + "/occurrences/search?q=images:*&sort=eventDate&dir=desc&facet=true&pageSize=1");

            Date lastEventDate = null;
            if (byDate.occurrences != null && !byDate.occurrences.isEmpty()) {
                lastEventDate = new Date(byDate.occurrences.getFirst().eventDate);
            }

            Date lastImageEventDate = null;
            if (imageByDate.occurrences != null && !imageByDate.occurrences.isEmpty()) {
                lastImageEventDate = new Date(imageByDate.occurrences.getFirst().eventDate);
            }

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd hh:mm");

            table.rows.add(new TableRow("latestRecord", null, new String[]{lastEventDate != null ? sdf.format(lastEventDate) : ""}));
            table.rows.add(new TableRow("lastImageAdded", null, new String[]{lastImageEventDate != null ? sdf.format(lastImageEventDate) : ""}));

            table.rows.add(new TableRow("1600s",
                    biocacheUiUrl + "/occurrences/search?q=*:*&fq=occurrence_year:[1600-01-01T00:00:00Z+TO+1699-12-31T23:59:59Z]",
                    new Integer[]{getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&fq=occurrence_year:[1600-01-01T00:00:00Z+TO+1699-12-31T23:59:59Z]&pageSize=0").totalRecords}));

            table.rows.add(new TableRow("1700s",
                    biocacheUiUrl + "/occurrences/search?q=*:*&fq=occurrence_year:[1700-01-01T00:00:00Z+TO+1799-12-31T23:59:59Z]",
                    new Integer[]{getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&fq=occurrence_year:[1700-01-01T00:00:00Z+TO+1799-12-31T23:59:59Z]&pageSize=0").totalRecords}));

            table.rows.add(new TableRow("1800s",
                    biocacheUiUrl + "/occurrences/search?q=*:*&fq=occurrence_year:[1800-01-01T00:00:00Z+TO+1899-12-31T23:59:59Z]",
                    new Integer[]{getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&fq=occurrence_year:[1800-01-01T00:00:00Z+TO+1899-12-31T23:59:59Z]&pageSize=0").totalRecords}));

            table.rows.add(new TableRow("1900s",
                    biocacheUiUrl + "/occurrences/search?q=*:*&fq=occurrence_year:[1900-01-01T00:00:00Z+TO+1999-12-31T23:59:59Z]",
                    new Integer[]{getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&fq=occurrence_year:[1900-01-01T00:00:00Z+TO+1999-12-31T23:59:59Z]&pageSize=0").totalRecords}));

            table.rows.add(new TableRow("2000s",
                    biocacheUiUrl + "/occurrences/search?q=*:*&fq=occurrence_year:[2000-01-01T00:00:00Z+TO+2099-12-31T23:59:59Z]",
                    new Integer[]{getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&fq=occurrence_year:[2000-01-01T00:00:00Z+TO+2099-12-31T23:59:59Z]&pageSize=0").totalRecords}));

            dashboardData.data.put("recordsByDate", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update recordsByDate: " + e.getMessage());
            logger.error("failed to update recordsByDate: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addNationalSpeciesLists(DashboardData dashboardData) {
        if (StringUtils.isEmpty(bieUrl)) {
            logService.log(taskType, "skipping nationalSpeciesLists");
            return 0;
        }
        try {
            logService.log(taskType, "updating nationalSpeciesLists");
            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"nameType", "nameCount"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            table.rows.add(new TableRow("acceptedNames", null,
                    new Integer[]{getBie(bieUrl + "/search?q=(taxonomicStatus:accepted%20OR%20taxonomicStatus:inferredAccepted)&fq=idxtype:TAXON").searchResults.totalRecords}));
            table.rows.add(new TableRow("synonyms", null,
                    new Integer[]{getBie(bieUrl + "/search?q=-(taxonomicStatus:accepted%20OR%20taxonomicStatus:inferredAccepted)&fq=idxtype:TAXON").searchResults.totalRecords}));
            table.rows.add(new TableRow("speciesNames", null,
                    new Integer[]{getBie(bieUrl + "/search?q=(taxonomicStatus:accepted%20OR%20taxonomicStatus:inferredAccepted)&fq=idxtype:TAXON&fq=rankID:7000").searchResults.totalRecords}));
            table.rows.add(new TableRow("speciesWithRecords", null,
                    new Integer[]{getBie(bieUrl + "/search?q=(taxonomicStatus:accepted%20OR%20taxonomicStatus:inferredAccepted)&fq=idxtype:TAXON&fq=rankID:7000&fq=occurrenceCount:%5B0%20TO%20*%5D").searchResults.totalRecords}));

            dashboardData.data.put("nationalSpeciesLists", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update nationalSpeciesLists: " + e.getMessage());
            logger.error("failed to update nationalSpeciesLists: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addUsageStats(DashboardData dashboardData) {
        if (StringUtils.isEmpty(loggerUrl)) {
            logService.log(taskType, "skipping usageStats");
            return 0;
        }
        try {
            logService.log(taskType, "updating usageStats");
            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"type", "count"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            LoggerSearch totals = getLogger(loggerUrl + "/service/totalsByType");
            LoggerSearch reasons = getLogger(loggerUrl + "/service/reasonBreakdown?eventId=1002");

            table.rows.add(new TableRow("recordsDownloaded", null,
                    new Long[]{reasons.all.records - reasons.all.reasonBreakdown.get("testing").records}));
            table.rows.add(new TableRow("numberOfDownloads", null,
                    new Long[]{reasons.all.events - reasons.all.reasonBreakdown.get("testing").events}));
            table.rows.add(new TableRow("recordsViewed", null,
                    new Long[]{totals.totals.get("1000").records}));

            dashboardData.data.put("usageStats", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update usageStats: " + e.getMessage());
            logger.error("failed to update usageStats: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addEmailDownloads(DashboardData dashboardData) {
        if (StringUtils.isEmpty(loggerUrl)) {
            logService.log(taskType, "skipping emailDownloads");
            return 0;
        }
        try {
            logService.log(taskType, "updating emailDownloads");
            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"type", "eventCount", "occurrenceCount"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            LoggerSearch reasons = getLogger(loggerUrl + "/service/emailBreakdown?eventId=1002");

            table.rows.add(new TableRow("totals", null,
                    new Long[]{reasons.all.events, reasons.all.records}));
            table.rows.add(new TableRow("edu", null,
                    new Long[]{reasons.all.emailBreakdown.get("edu").events, reasons.all.emailBreakdown.get("edu").records}));
            table.rows.add(new TableRow("gov", null,
                    new Long[]{reasons.all.emailBreakdown.get("gov").events, reasons.all.emailBreakdown.get("gov").records}));
            table.rows.add(new TableRow("other", null,
                    new Long[]{reasons.all.emailBreakdown.get("other").events, reasons.all.emailBreakdown.get("other").records}));
            table.rows.add(new TableRow("unspecified", null,
                    new Long[]{reasons.all.emailBreakdown.get("unspecified").events, reasons.all.emailBreakdown.get("unspecified").records}));

            dashboardData.data.put("emailDownloads", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update emailDownloads: " + e.getMessage());
            logger.error("failed to update emailDownloads: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addReasonDownloads(DashboardData dashboardData) {
        if (StringUtils.isEmpty(loggerUrl)) {
            logService.log(taskType, "skipping reasonDownloads");
            return 0;
        }
        try {
            logService.log(taskType, "updating reasonDownloads");
            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"type", "eventCount", "occurrenceCount"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            LoggerSearch reasons = getLogger(loggerUrl + "/service/reasonBreakdown?eventId=1002");

            table.rows.add(new TableRow("totals", null,
                    new Long[]{reasons.all.events, reasons.all.records}));

            for (String reason : reasons.all.reasonBreakdown.keySet()) {
                table.rows.add(new TableRow(reason, null,
                        new Long[]{reasons.all.reasonBreakdown.get(reason).events, reasons.all.reasonBreakdown.get(reason).records}));
            }

            dashboardData.data.put("reasonDownloads", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update reasonDownloads: " + e.getMessage());
            logger.error("failed to update reasonDownloads: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addSpecimenTypes(DashboardData dashboardData) {
        if (StringUtils.isEmpty(biocacheWsUrl)) {
            logService.log(taskType, "skipping specimenTypes");
            return 0;
        }
        try {
            logService.log(taskType, "updating specimenTypes");
            Record record = new Record();
            Table withImagesTable = new Table("SpecimenOccurrencesWithImages");
            withImagesTable.header = Arrays.stream(new String[]{"typeStatus", "occurrenceCount"}).toList();
            Table withoutImagesTable = new Table("AllSpecimenOccurrences");
            withoutImagesTable.header = Arrays.stream(new String[]{"typeStatus", "occurrenceCount"}).toList();
            withoutImagesTable.rows = new ArrayList<>();
            withImagesTable.rows = new ArrayList<>();
            record.tables = Arrays.stream(new Table[]{withoutImagesTable, withImagesTable}).toList();

            BiocacheSearch withoutImages = getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&pageSize=0&facet=true&flimit=1000&facets=typeStatus");
            for (FieldResult field : withoutImages.facetResults.getFirst().fieldResult) {
                withoutImagesTable.rows.add(new TableRow(field.label,
                        biocacheUiUrl + "/occurrences/search?q=" + field.fq,
                        new Integer[]{field.count}));
            }

            BiocacheSearch withImages = getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&pageSize=0&facet=true&flimit=1000&facets=typeStatus&fq=multimedia:Image");
            for (FieldResult field : withImages.facetResults.getFirst().fieldResult) {
                withImagesTable.rows.add(new TableRow(field.label,
                        biocacheUiUrl + "/occurrences/search?q=" + field.fq,
                        new Integer[]{field.count}));
            }

            dashboardData.data.put("specimenTypes", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update specimenTypes: " + e.getMessage());
            logger.error("failed to update specimenTypes: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addConservation(DashboardData dashboardData) {
        if (StringUtils.isEmpty(biocacheWsUrl)) {
            logService.log(taskType, "skipping conservation");
            return 0;
        }
        try {
            logService.log(taskType, "updating conservation");
            Record record = new Record();
            Table table = new Table();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            BiocacheSearch result = getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&pageSize=0&facet=true&facets=stateConservation&flimit=1000&fsort=count");

            table.header = Arrays.stream(new String[]{"conservationStatus", "speciesCount"}).toList();
            for (FieldResult field : result.facetResults.getFirst().fieldResult) {
                table.rows.add(new TableRow(field.label,
                        biocacheUiUrl + "/occurrences/search?q=" + field.fq,
                        new Integer[]{getFirstCount(getBiocacheFacets(biocacheWsUrl + "/occurrence/facets?q=" + URLEncoder.encode(field.fq, StandardCharsets.UTF_8) + "&facets=species&pageSize=0&flimit=0"))}));
            }

            dashboardData.data.put("conservation", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update conservation: " + e.getMessage());
            logger.error("failed to update conservation: " + e.getMessage());
            return 1; // 1 error
        }
    }


    private int addFacet(DashboardData dashboardData, String facet) {
        if (StringUtils.isEmpty(biocacheWsUrl)) {
            logService.log(taskType, "skipping facet: " + facet);
            return 0;
        }
        try {
            logService.log(taskType, "updating facet: " + facet);
            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{facet, "occurrenceCount", "speciesCount"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            BiocacheSearch result = getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&pageSize=0&facet=true&facets=" + facet + "&flimit=-1");
            for (FieldResult field : result.facetResults.getFirst().fieldResult) {
                int speciesCount = getFirstCount(getBiocacheFacets(biocacheWsUrl + "/occurrence/facets?q=" + URLEncoder.encode(field.fq, StandardCharsets.UTF_8) + "&facets=species&pageSize=0&flimit=0"));
                table.rows.add(new TableRow(field.label,
                        biocacheUiUrl + "/occurrences/search?q=" + field.fq,
                        new Integer[]{field.count, speciesCount}));
            }

            dashboardData.data.put(facet, record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update " + facet + ": " + e.getMessage());
            logger.error("failed to update " + facet + ": " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addStates(DashboardData dashboardData) {
        if (StringUtils.isEmpty(biocacheWsUrl)) {
            logService.log(taskType, "skipping states");
            return 0;
        }
        try {
            logService.log(taskType, "updating states");
            // TODO: move states to config
            List<String> states = Arrays.stream(new String[]{"Australian Capital Territory", "New South Wales", "South Australia", "Northern Territory", "Western Australia", "Victoria", "Queensland", "Tasmania"}).toList();
            int otherCount = 0;
            int notProvided = 0;

            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"stateTerritory", "occurrenceCount"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            BiocacheSearch result = getBiocache(biocacheWsUrl + "/occurrences/search?q=*:*&pageSize=0&facet=true&facets=stateProvince&flimit=-1");
            for (FieldResult field : result.facetResults.getFirst().fieldResult) {
                if (states.contains(field.label)) {
                    table.rows.add(new TableRow(field.label,
                            biocacheUiUrl + "/occurrences/search?q=" + field.fq,
                            new Integer[]{field.count}));
                } else if ("stateProvince.novalue".equals(field.i18nCode)) {
                    notProvided = field.count;
                } else {
                    otherCount += field.count;
                }
            }

            if (otherCount != 0) {
                table.rows.add(new TableRow("otherStates", null,
                        new Integer[]{otherCount}));
            }

            if (notProvided != 0) {
                table.rows.add(new TableRow("notProvided",
                        biocacheUiUrl + "/occurrences/search?q=-stateProvince:*",
                        new Integer[]{notProvided}));
            }

            dashboardData.data.put("states", record);

            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update states: " + e.getMessage());
            logger.error("failed to update states: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addSpeciesTable(Record record, String name, String speciesGroup) {
        if (StringUtils.isEmpty(biocacheWsUrl)) {
            logService.log(taskType, "skipping speciesTable: " + speciesGroup);
            return 0;
        }
        try {
            logService.log(taskType, "updating speciesTable: " + speciesGroup);
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"taxonConcept - commonName", "occurrenceCount"}).toList();
            table.name = StringUtils.capitalize(name);
            table.rows = new ArrayList<>();
            if (record.tables == null) {
                record.tables = new ArrayList<>();
            }
            record.tables.add(table);

            BiocacheSearch result = getBiocache(biocacheWsUrl + "/occurrences/search?q=speciesGroup:" + speciesGroup + "&pageSize=0&flimit=6&facets=taxonConceptID&fsort=count");

            for (FieldResult field : result.facetResults.getFirst().fieldResult) {
                BieSearch bieSearch = getBie(bieUrl + "/species/" + URLEncoder.encode(field.label, StandardCharsets.UTF_8));
                String commonName = "";
                if (bieSearch.commonNames != null && !bieSearch.commonNames.isEmpty()) {
                    // TODO: update to use bieSearch.commonNameSingle
                    commonName = bieSearch.commonNames.getFirst().nameString;
                }

                table.rows.add(new TableRow(bieSearch.taxonConcept.nameString + " - " + commonName,
                        bieUiUrl + "/species/" + field.label,
                        new Integer[]{field.count}));
            }
            return 0;
        } catch (IOException e) {
            logService.log(taskType, "failed to update speciesTable: " + e.getMessage());
            logger.error("failed to update speciesTable: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addSpecies(DashboardData dashboardData) {
        try {
            logService.log(taskType, "updating species");
            Record record = new Record();
            record.tables = new ArrayList<>();

            int errorCount = 0;
            errorCount += addSpeciesTable(record, "allLifeforms", "*");
            errorCount += addSpeciesTable(record, "plants", "Plants");
            errorCount += addSpeciesTable(record, "animals", "Animals");
            errorCount += addSpeciesTable(record, "birds", "Birds");
            errorCount += addSpeciesTable(record, "reptiles", "Reptiles");
            errorCount += addSpeciesTable(record, "arthropods", "Arthropods");
            errorCount += addSpeciesTable(record, "mammals", "Mammals");
            errorCount += addSpeciesTable(record, "fishes", "Fishes");
            errorCount += addSpeciesTable(record, "insects", "Insects");
            errorCount += addSpeciesTable(record, "amphibians", "Amphibians");
            errorCount += addSpeciesTable(record, "bacteria", "Bacteria");
            errorCount += addSpeciesTable(record, "fungi", "Fungi");

            dashboardData.data.put("species", record);
            return errorCount;
        } catch (Exception e) {
            logService.log(taskType, "failed to update species: " + e.getMessage());
            logger.error("failed to update species: " + e.getMessage());
            return 1; // 1 error
        }
    }


    private int addSpatialLayers(DashboardData dashboardData) {
        try {
            logService.log(taskType, "updating spatialLayers");
            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"layerType or layerClassification", "layerCount"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            List<SpatialField> fields = getSpatialFields(spatialUrl + "/fields?q=");

            int contextualLayers = 0;
            int rasterLayers = 0;
            int terrestrialLayers = 0;
            int marineLayers = 0;
            Map<String, Integer> others = new HashMap<>();

            for (SpatialField field : fields) {
                if ("Contextual".equals(field.layer.type)) {
                    contextualLayers++;
                } else {
                    rasterLayers++;
                }
                if (field.layer.domain.contains("Marine")) {
                    marineLayers++;
                }
                if (field.layer.domain.contains("Terrestrial")) {
                    terrestrialLayers++;
                }
                if (others.containsKey(field.layer.classification1)) {
                    others.put(field.layer.classification1, others.get(field.layer.classification1) + 1);
                } else {
                    others.put(field.layer.classification1, 1);
                }
            }

            record.count = contextualLayers + rasterLayers;
            table.rows.add(new TableRow("contextualLayers", null, new Integer[]{contextualLayers}));
            table.rows.add(new TableRow("rasterLayers", null, new Integer[]{rasterLayers}));
            table.rows.add(new TableRow("terrestrialLayers", null, new Integer[]{terrestrialLayers}));
            table.rows.add(new TableRow("marineLayers", null, new Integer[]{marineLayers}));

            others.forEach((k, v) -> table.rows.add(new TableRow(k, null, new Integer[]{v})));

            dashboardData.data.put("spatialLayers", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update spatialLayers: " + e.getMessage());
            logger.error("failed to update spatialLayers: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private int addImage(DashboardData dashboardData) {
        try {
            logService.log(taskType, "updating image");
            Record record = new Record();
            Table table = new Table();
            table.header = Arrays.stream(new String[]{"group", "imageCount or speciesCount"}).toList();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            table.rows.add(new TableRow("imagesTotal", null,
                    new Integer[]{getImage(imagesUrl + "/ws/getRepositoryStatistics").imageCount}));
            table.rows.add(new TableRow("taxaWithImages", null,
                    new Integer[]{getFirstCount(getBiocacheFacets(biocacheWsUrl + "/occurrence/facets?facets=scientificName&pageSize=0&q=multimedia:Image&flimit=0"))}));
            table.rows.add(new TableRow("speciesWithImages", null,
                    new Integer[]{getFirstCount(getBiocacheFacets(biocacheWsUrl + "/occurrence/facets?q=multimedia:Image%20AND%20(rank:species%20OR%20rank:subspecies)&facets=scientificName&pageSize=0&flimit=0"))}));
            table.rows.add(new TableRow("subspeciesWithImages", null,
                    new Integer[]{getFirstCount(getBiocacheFacets(biocacheWsUrl + "/occurrence/facets?q=multimedia:Image%20AND%20rank:subspecies&facets=scientificName&pageSize=0&flimit=0"))}));
            table.rows.add(new TableRow("digivolTaxaWithImages", null,
                    new Integer[]{getFirstCount(getBiocacheFacets(biocacheWsUrl + "/occurrence/facets?facets=scientificName&pageSize=0&q=multimedia:Image&fq=dataHubUid:dh6&flimit=0"))}));
            table.rows.add(new TableRow("czTaxaWithImages", null,
                    new Integer[]{getFirstCount(getBiocacheFacets(biocacheWsUrl + "/occurrence/facets?facets=scientificName&pageSize=0&q=multimedia:Image&fq=provenance:%22Individual%20sightings%22&flimit=0"))}));

            dashboardData.data.put("image", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update image: " + e.getMessage());
            logger.error("failed to update image: " + e.getMessage());
            return 1; // 1 error
        }
    }

    private Integer getFirstCount(List<Facet> biocacheFacets) {
        if (biocacheFacets != null && !biocacheFacets.isEmpty()) {
            return biocacheFacets.getFirst().count;
        }

        return 0;
    }

    private int getCollectionSize(String filter) throws IOException {
        CollectionsSearch collectionsSearch = getCollection(collectoryUrl + "/public/mapFeatures?filters=" + filter);

        int count = 0;

        for (Feature feature : collectionsSearch.features) {
            if (feature.properties.collectionCount != null && feature.properties.collectionCount != 0) {
                count += feature.properties.collectionCount;
            }
        }

        return count;
    }

    private int addCollections(DashboardData dashboardData) {
        try {
            logService.log(taskType, "updating collections");
            Record record = new Record();
            Table table = new Table();
            table.rows = new ArrayList<>();
            record.tables = new ArrayList<>();
            record.tables.add(table);

            record.count = getCollectionSize("all");

            table.header = new ArrayList<>();
            table.header.add("collectionType");
            table.header.add("collectionCount");

            table.rows.add(new TableRow("fauna", collectoryUrl + "?start=fauna",
                    new Integer[]{getCollectionSize("fauna%2Centomology")}));
            table.rows.add(new TableRow("insects", collectoryUrl + "?start=insects",
                    new Integer[]{getCollectionSize("entomology")}));
            table.rows.add(new TableRow("microbes", collectoryUrl + "?start=microbes",
                    new Integer[]{getCollectionSize("microbes")}));
            table.rows.add(new TableRow("plants", collectoryUrl + "?start=plants",
                    new Integer[]{getCollectionSize("plants")}));
            table.rows.add(new TableRow("fungi", collectoryUrl + "?start=fungi",
                    new Integer[]{getCollectionSize("fungi")}));

            dashboardData.data.put("collections", record);
            return 0;
        } catch (Exception e) {
            logService.log(taskType, "failed to update collections: " + e.getMessage());
            logger.error("failed to update collections: " + e.getMessage());
            return 1; // 1 error
        }
    }
}

