/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.dashboard.DashboardData;
import au.org.ala.search.model.dashboard.Record;
import au.org.ala.search.model.dashboard.Table;
import au.org.ala.search.model.dashboard.TableRow;
import au.org.ala.search.service.remote.ElasticService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.tomakehurst.wiremock.WireMockServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Coverage of each {@link DashboardService} section's <b>successful</b> logic — the code paths
 * that only execute when the external HTTP call actually succeeds (parsing responses, computing
 * counts, building table rows) — as opposed to {@code DashboardServiceIntegrationTest}, which
 * covers the graceful-degradation/failure-logging contract with every URL left blank.
 * <p>
 * All of {@code DashboardService}'s {@code addXyz(...)}/{@code getXyz(...)} methods were changed
 * from {@code private} to package-private specifically to support this test class: each section
 * is called directly with a fresh {@link DashboardData}, stubbing only the 1-6 endpoints relevant
 * to that one section, rather than needing all ~40 endpoints stubbed simultaneously just to reach
 * one section via the full {@link DashboardService#run()}.
 * <p>
 * A single shared WireMock server backs every external-URL property. {@code digivol.url} is
 * pointed at it <i>without</i> a trailing slash (unlike the real
 * {@code https://volunteer.ala.org.au/} value) to avoid a doubled-slash URL mismatch, since
 * {@code DashboardService} concatenates {@code digivolUrl + "/index/stats?..."} directly.
 * {@code bhl.apikey} is overridden to a non-blank placeholder so {@code addBhl} — otherwise
 * entirely skipped when blank, per test properties — actually runs.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@au.org.ala.search.test.SuppressExpectedLogging({
        "au.org.ala.search.service.update.DashboardService",
        "au.org.ala.search.service.remote.StaticFileStoreService"
})
class DashboardServiceCoverageIntegrationTest extends AbstractIntegrationTestContainers {

    private static final WireMockServer wireMockServer = new WireMockServer(0);

    static {
        wireMockServer.start();
    }

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;


    @AfterAll
    static void stopWireMock() {
        wireMockServer.stop();
    }

    @BeforeEach
    void resetStubs() {
        wireMockServer.resetAll();
    }

    @DynamicPropertySource
    static void wireMockProperties(DynamicPropertyRegistry registry) throws Exception {
        Path dataDir = Files.createTempDirectory("dashboard-service-coverage-test-data");
        Path staticDir = Files.createTempDirectory("dashboard-service-coverage-test-static");
        registry.add("data.dir", dataDir::toString);
        registry.add("static.filestore.path", staticDir::toString);

        registry.add("biocache.url", () -> "http://localhost:" + wireMockServer.port());
        registry.add("biocache.uiUrl", () -> "http://localhost:" + wireMockServer.port() + "/ui");
        registry.add("collections.url", () -> "http://localhost:" + wireMockServer.port());
        registry.add("bhl.getstats.url", () -> "http://localhost:" + wireMockServer.port() + "/bhlstats?apikey=<apikey>");
        registry.add("bhl.apikey", () -> "test-api-key");
        // no trailing slash, unlike the real "https://volunteer.ala.org.au/" — avoids a doubled
        // slash since DashboardService concatenates digivolUrl + "/index/stats?..." directly.
        registry.add("digivol.url", () -> "http://localhost:" + wireMockServer.port());
        registry.add("logger.url", () -> "http://localhost:" + wireMockServer.port());
        registry.add("spatial.url", () -> "http://localhost:" + wireMockServer.port());
        registry.add("images.url", () -> "http://localhost:" + wireMockServer.port());
        registry.add("userdetails.url", () -> "http://localhost:" + wireMockServer.port());
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private Table firstTable(DashboardData data, String key) {
        Record record = data.data.get(key);
        assertThat(record).as("record for key " + key).isNotNull();
        assertThat(record.tables).as("tables for key " + key).isNotEmpty();
        return record.tables.get(0);
    }

    private TableRow rowNamed(Table table, String name) {
        return table.rows.stream().filter(r -> name.equals(r.name)).findFirst()
                .orElseThrow(() -> new AssertionError("no row named " + name + " in " + table.rows));
    }

    @Test
    void addKingdoms_parsesFacetResultsIntoTableRows() {
        wireMockServer.stubFor(get(urlEqualTo("/occurrence/facets?q=*:*&facets=kingdom&flimit=-1&facet=true"))
                .willReturn(okJson("""
                        [ { "count": 10, "fieldResult": [
                            { "label": "Animalia", "fq": "kingdom:Animalia", "count": 10 }
                        ] } ]
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addKingdoms(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "kingdoms");
        TableRow row = rowNamed(table, "Animalia");
        assertThat(row.url).isEqualTo("kingdom:Animalia");
        assertThat(row.values).containsExactly(10);
    }

    @Test
    void addOccurrenceCount_setsRecordCountFromTotalRecords() {
        wireMockServer.stubFor(get(urlEqualTo("/occurrences/search?q=*:*&pageSize=0"))
                .willReturn(okJson("""
                        { "totalRecords": 12345 }
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addOccurrenceCount(data);

        assertThat(errors).isZero();
        Record record = data.data.get("occurrenceCount");
        assertThat(record.count).isEqualTo(12345);
    }

    @Test
    void addBasisOfRecord_parsesNestedFacetResultsIntoTableRows() {
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrences/search?q=basisOfRecord:*&facet=true&facets=basisOfRecord&pageSize=0&fsort=count"))
                .willReturn(okJson("""
                        { "totalRecords": 500, "facetResults": [ { "fieldResult": [
                            { "i18nCode": "basisOfRecord.PreservedSpecimen", "fq": "basisOfRecord:PreservedSpecimen", "count": 500 }
                        ] } ] }
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addBasisOfRecord(data);

        assertThat(errors).isZero();
        Record record = data.data.get("basisOfRecord");
        assertThat(record.count).isEqualTo(500);
        TableRow row = rowNamed(firstTable(data, "basisOfRecord"), "basisOfRecord.PreservedSpecimen");
        assertThat(row.values).containsExactly(500);
    }

    @Test
    void addDatasets_aggregatesCollectoryCountsAndMostRecentDataset() {
        wireMockServer.stubFor(get(urlEqualTo("/ws/dataResource/count/resourceType?public=true"))
                .willReturn(okJson("""
                        { "total": 100, "groups": { "records": 80, "species-list": 10, "document": 5 } }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo("/ws/institution/count")).willReturn(okJson("""
                { "total": 7 }
                """)));
        wireMockServer.stubFor(get(urlEqualTo("/ws/collection/count")).willReturn(okJson("""
                { "total": 20 }
                """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?q=data_resource_uid:*&facets=data_resource_uid&flimit=0&facet=true"))
                .willReturn(okJson("""
                        [ { "count": 3, "fieldResult": [] } ]
                        """)));
        wireMockServer.stubFor(get(urlEqualTo("/ws/dataResource")).willReturn(okJson("""
                [
                  { "uid": "dr1", "uri": "http://collectory/dr1", "name": "DR One" },
                  { "uid": "dr20", "uri": "http://collectory/dr20", "name": "DR Twenty" }
                ]
                """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addDatasets(data);

        assertThat(errors).isZero();
        Record record = data.data.get("datasets");
        assertThat(record.count).isEqualTo(100);
        // dr20 > dr1 numerically, so it's the "most recent"
        assertThat(record.mostRecent).containsEntry("url", "http://collectory/dr20").containsEntry("name", "DR Twenty");

        Table table = firstTable(data, "datasets");
        assertThat(rowNamed(table, "institutions").values).containsExactly(7);
        assertThat(rowNamed(table, "collections").values).containsExactly(20);
        assertThat(rowNamed(table, "dataResources").values).containsExactly(80);
        assertThat(rowNamed(table, "descriptionOnly").values).containsExactly(80 - 3);
        assertThat(rowNamed(table, "speciesLists").values).containsExactly(10);
        assertThat(rowNamed(table, "documents").values).containsExactly(5);
    }

    @Test
    void addBhl_parsesXmlStatsResponse() {
        wireMockServer.stubFor(get(urlEqualTo("/bhlstats?apikey=test-api-key"))
                .willReturn(aResponse().withHeader("Content-Type", "text/xml").withBody("""
                        <?xml version="1.0" encoding="UTF-8"?>
                        <Response>
                          <Status>ok</Status>
                          <TitleCount>1</TitleCount>
                          <ItemCount>2</ItemCount>
                          <PageCount>3</PageCount>
                        </Response>
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addBhl(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "bhl");
        assertThat(rowNamed(table, "pages").values).containsExactly(3);
        assertThat(rowNamed(table, "volumes").values).containsExactly(2);
        assertThat(rowNamed(table, "titles").values).containsExactly(1);
    }

    @Test
    void addBhl_apiErrorStatus_returnsOneError() {
        wireMockServer.stubFor(get(urlEqualTo("/bhlstats?apikey=test-api-key"))
                .willReturn(aResponse().withHeader("Content-Type", "text/xml").withBody("""
                        <?xml version="1.0" encoding="UTF-8"?>
                        <Response>
                          <Status>error</Status>
                          <ErrorMessage>bad api key</ErrorMessage>
                        </Response>
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addBhl(data);

        assertThat(errors).isEqualTo(1);
        assertThat(data.data).doesNotContainKey("bhl");
    }

    @Test
    void addDigivol_aggregatesFiveProjectTypeCalls() {
        wireMockServer.stubFor(get(urlEqualTo(
                "/index/stats?disableHonourBoard=true&disableStats=false&institutionId=-1&maxContributors=0&projectId=-1"))
                .willReturn(okJson("""
                        { "transcriberCount": 50, "totalTasks": 200, "completedTasks": 150 }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/index/stats?disableHonourBoard=true&disableStats=false&institutionId=-1&maxContributors=0&projectId=-1&projectType=audio"))
                .willReturn(okJson("""
                        { "completedTasks": 10 }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/index/stats?disableHonourBoard=true&disableStats=false&institutionId=-1&maxContributors=0&projectId=-1&projectType=fieldnotes"))
                .willReturn(okJson("""
                        { "completedTasks": 20 }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/index/stats?disableHonourBoard=true&disableStats=false&institutionId=-1&maxContributors=0&projectId=-1&projectType=specimens"))
                .willReturn(okJson("""
                        { "completedTasks": 30 }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/index/stats?disableHonourBoard=true&disableStats=false&institutionId=-1&maxContributors=0&projectId=-1&projectType=cameratraps"))
                .willReturn(okJson("""
                        { "completedTasks": 40 }
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addDigivol(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "digivol");
        assertThat(rowNamed(table, "volunteers").values).containsExactly(50);
        assertThat(rowNamed(table, "expeditionTasksTotal").values).containsExactly(200);
        assertThat(rowNamed(table, "expeditionTasksCompleted").values).containsExactly(150);
        assertThat(rowNamed(table, "specimenLabelsTranscribed").values).containsExactly(30);
        assertThat(rowNamed(table, "fieldnotesTranscribed").values).containsExactly(20);
        assertThat(rowNamed(table, "audioTranscribed").values).containsExactly(10);
        assertThat(rowNamed(table, "cameraTrapsTranscribed").values).containsExactly(40);
    }

    @Test
    void addRecordsByDate_computesLatestDatesAndDecadeBuckets() {
        wireMockServer.stubFor(get(urlEqualTo("/occurrences/search?q=*:*&sort=eventDate&dir=desc&facet=true&pageSize=1"))
                .willReturn(okJson("""
                        { "occurrences": [ { "eventDate": 1700000000000 } ] }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo("/occurrences/search?q=images:*&sort=eventDate&dir=desc&facet=true&pageSize=1"))
                .willReturn(okJson("""
                        { "occurrences": [ { "eventDate": 1700000001000 } ] }
                        """)));

        String[] decades = {"1600", "1700", "1800", "1900", "2000"};
        String[] ranges = {
                "occurrence_year:[1600-01-01T00:00:00Z TO 1699-12-31T23:59:59Z]",
                "occurrence_year:[1700-01-01T00:00:00Z TO 1799-12-31T23:59:59Z]",
                "occurrence_year:[1800-01-01T00:00:00Z TO 1899-12-31T23:59:59Z]",
                "occurrence_year:[1900-01-01T00:00:00Z TO 1999-12-31T23:59:59Z]",
                "occurrence_year:[2000-01-01T00:00:00Z TO 2099-12-31T23:59:59Z]"
        };
        int[] counts = {1, 2, 3, 4, 5};
        for (int i = 0; i < decades.length; i++) {
            wireMockServer.stubFor(get(urlEqualTo("/occurrences/search?q=*:*&fq=" + enc(ranges[i]) + "&pageSize=0"))
                    .willReturn(okJson("{ \"totalRecords\": " + counts[i] + " }")));
        }

        DashboardData data = new DashboardData();
        int errors = dashboardService.addRecordsByDate(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "recordsByDate");
        assertThat(rowNamed(table, "latestRecord").values[0]).asString().isNotEmpty();
        assertThat(rowNamed(table, "lastImageAdded").values[0]).asString().isNotEmpty();
        assertThat(rowNamed(table, "1600s").values).containsExactly(1);
        assertThat(rowNamed(table, "1700s").values).containsExactly(2);
        assertThat(rowNamed(table, "1800s").values).containsExactly(3);
        assertThat(rowNamed(table, "1900s").values).containsExactly(4);
        assertThat(rowNamed(table, "2000s").values).containsExactly(5);
    }

    @Test
    void addUsageStats_computesDownloadAndViewCountsExcludingTesting() {
        wireMockServer.stubFor(get(urlEqualTo("/service/totalsByType")).willReturn(okJson("""
                { "totals": { "1000": { "events": 5, "records": 50 } } }
                """)));
        wireMockServer.stubFor(get(urlEqualTo("/service/reasonBreakdown?eventId=1002")).willReturn(okJson("""
                { "all": { "events": 100, "records": 1000, "reasonBreakdown": {
                    "testing": { "events": 10, "records": 100 },
                    "research": { "events": 90, "records": 900 }
                } } }
                """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addUsageStats(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "usageStats");
        assertThat(rowNamed(table, "recordsDownloaded").values).containsExactly(900L);
        assertThat(rowNamed(table, "numberOfDownloads").values).containsExactly(90L);
        assertThat(rowNamed(table, "recordsViewed").values).containsExactly(50L);
    }

    @Test
    void addEmailDownloads_parsesAllFourCategories() {
        wireMockServer.stubFor(get(urlEqualTo("/service/emailBreakdown?eventId=1002")).willReturn(okJson("""
                { "all": { "emailBreakdown": {
                    "edu": { "events": 1, "records": 10 },
                    "gov": { "events": 2, "records": 20 },
                    "other": { "events": 3, "records": 30 },
                    "unspecified": { "events": 4, "records": 40 }
                } } }
                """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addEmailDownloads(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "emailDownloads");
        assertThat(rowNamed(table, "edu").values).containsExactly(1L, 10L);
        assertThat(rowNamed(table, "gov").values).containsExactly(2L, 20L);
        assertThat(rowNamed(table, "other").values).containsExactly(3L, 30L);
        assertThat(rowNamed(table, "unspecified").values).containsExactly(4L, 40L);
    }

    @Test
    void addReasonDownloads_excludesTestingAndListsOtherReasons() {
        wireMockServer.stubFor(get(urlEqualTo("/service/reasonBreakdown?eventId=1002")).willReturn(okJson("""
                { "all": { "events": 100, "records": 1000, "reasonBreakdown": {
                    "testing": { "events": 10, "records": 100 },
                    "research": { "events": 90, "records": 900 }
                } } }
                """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addReasonDownloads(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "reasonDownloads");
        assertThat(rowNamed(table, "totals").values).containsExactly(90L, 900L);
        assertThat(rowNamed(table, "research").values).containsExactly(90L, 900L);
        assertThat(table.rows.stream().anyMatch(r -> "testing".equals(r.name))).isFalse();
    }

    @Test
    void addSpecimenTypes_parsesWithAndWithoutImageFacets() {
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrences/search?q=typeStatus:*&pageSize=0&facet=true&flimit=1000&facets=typeStatus"))
                .willReturn(okJson("""
                        { "facetResults": [ { "fieldResult": [
                            { "label": "Holotype", "fq": "typeStatus:Holotype", "count": 5 }
                        ] } ] }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrences/search?q=typeStatus:*&pageSize=0&facet=true&flimit=1000&facets=typeStatus&fq=multimedia:Image"))
                .willReturn(okJson("""
                        { "facetResults": [ { "fieldResult": [
                            { "label": "Holotype", "fq": "typeStatus:Holotype", "count": 2 }
                        ] } ] }
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addSpecimenTypes(data);

        assertThat(errors).isZero();
        Record record = data.data.get("specimenTypes");
        assertThat(record.tables).hasSize(2);
        Table withoutImages = record.tables.stream().filter(t -> "AllSpecimenOccurrences".equals(t.name)).findFirst().orElseThrow();
        Table withImages = record.tables.stream().filter(t -> "SpecimenOccurrencesWithImages".equals(t.name)).findFirst().orElseThrow();
        assertThat(rowNamed(withoutImages, "Holotype").values).containsExactly(5);
        assertThat(rowNamed(withImages, "Holotype").values).containsExactly(2);
    }

    @Test
    void addConservation_looksUpSpeciesCountPerConservationStatus() {
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrences/search?q=stateConservation:*&pageSize=0&facet=true&facets=stateConservation&flimit=1000&fsort=count"))
                .willReturn(okJson("""
                        { "facetResults": [ { "fieldResult": [
                            { "label": "Endangered", "fq": "stateConservation:Endangered", "count": 7 }
                        ] } ] }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?q=" + enc("stateConservation:Endangered") + "&fq=species:*&facets=species&pageSize=0&flimit=0"))
                .willReturn(okJson("""
                        [ { "count": 3, "fieldResult": [] } ]
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addConservation(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "conservation");
        TableRow row = rowNamed(table, "Endangered");
        assertThat(row.url).isEqualTo("http://localhost:" + wireMockServer.port() + "/ui/occurrences/search?q=stateConservation:Endangered");
        assertThat(row.values).containsExactly(3);
    }

    @Test
    void addFacet_decade_includesBefore1850BucketAndSpeciesCounts() {
        String before1850Fq = enc("decade:[* TO 1840]");
        String decadeFilterFq = enc("decade:[1850 TO *]");
        String fieldFq = "decade:1990";

        wireMockServer.stubFor(get(urlEqualTo("/occurrences/search?q=" + before1850Fq + "&pageSize=0&"))
                .willReturn(okJson("""
                        { "totalRecords": 2 }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?q=" + before1850Fq + "&fq=species:*&facets=species&pageSize=0&flimit=0"))
                .willReturn(okJson("""
                        [ { "count": 1, "fieldResult": [] } ]
                        """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrences/search?q=decade:*&pageSize=0&facet=true&facets=decade&flimit=-1&fq=" + decadeFilterFq))
                .willReturn(okJson("""
                        { "facetResults": [ { "fieldResult": [
                            { "label": "1990", "fq": "decade:1990", "count": 50 }
                        ] } ] }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?q=" + enc(fieldFq) + "&fq=species:*&facets=species&pageSize=0&flimit=0"))
                .willReturn(okJson("""
                        [ { "count": 20, "fieldResult": [] } ]
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addFacet(data, "decade");

        assertThat(errors).isZero();
        Table table = firstTable(data, "decade");
        assertThat(rowNamed(table, "before 1850").values).containsExactly(2, 1);
        assertThat(rowNamed(table, "1990").values).containsExactly(50, 20);
    }

    @Test
    void addFacet_nonDecadeFacet_parsesFieldResultsWithSpeciesCounts() {
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrences/search?q=dataProviderUid:*&pageSize=0&facet=true&facets=dataProviderUid&flimit=-1"))
                .willReturn(okJson("""
                        { "facetResults": [ { "fieldResult": [
                            { "label": "dp1", "fq": "dataProviderUid:dp1", "count": 30 }
                        ] } ] }
                        """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?q=" + enc("dataProviderUid:dp1") + "&fq=species:*&facets=species&pageSize=0&flimit=0"))
                .willReturn(okJson("""
                        [ { "count": 12, "fieldResult": [] } ]
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addFacet(data, "dataProviderUid");

        assertThat(errors).isZero();
        Table table = firstTable(data, "dataProviderUid");
        assertThat(rowNamed(table, "dp1").values).containsExactly(30, 12);
    }

    @Test
    void addFacet_nestedFacetCallReturnsEmptyArray_getFirstCountFallsBackToZero() {
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrences/search?q=institutionUid:*&pageSize=0&facet=true&facets=institutionUid&flimit=-1"))
                .willReturn(okJson("""
                        { "facetResults": [ { "fieldResult": [
                            { "label": "in1", "fq": "institutionUid:in1", "count": 5 }
                        ] } ] }
                        """)));
        // an empty array response (no facet results at all) exercises getFirstCount(...)'s
        // "biocacheFacets == null || biocacheFacets.isEmpty()" -> return 0 fallback branch.
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?q=" + enc("institutionUid:in1") + "&fq=species:*&facets=species&pageSize=0&flimit=0"))
                .willReturn(okJson("[]")));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addFacet(data, "institutionUid");

        assertThat(errors).isZero();
        Table table = firstTable(data, "institutionUid");
        assertThat(rowNamed(table, "in1").values).containsExactly(5, 0);
    }

    @Test
    void addStates_groupsIntoConfiguredStatesOtherAndNotProvided() {
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrences/search?q=stateProvince:*&pageSize=0&facet=true&facets=stateProvince&flimit=-1"))
                .willReturn(okJson("""
                        { "facetResults": [ { "fieldResult": [
                            { "label": "New South Wales", "i18nCode": "stateProvince.nsw", "fq": "stateProvince:New South Wales", "count": 100 },
                            { "label": "Foreign Country", "i18nCode": "stateProvince.foreign", "fq": "stateProvince:Foreign", "count": 5 },
                            { "label": "", "i18nCode": "stateProvince.novalue", "fq": "-stateProvince:*", "count": 3 }
                        ] } ] }
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addStates(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "states");
        assertThat(rowNamed(table, "New South Wales").values).containsExactly(100);
        assertThat(rowNamed(table, "otherStates").values).containsExactly(5);
        assertThat(rowNamed(table, "notProvided").values).containsExactly(3);
    }

    @Test
    void addSpecies_buildsTwelveSpeciesTablesWithRealEsLookup() {
        // Pre-seed a TAXON document matching one of the two guids returned by the (shared, for
        // all 12 speciesGroup calls) facet stub, to exercise both the "found in ES" (common name
        // filled in) and "not found" (blank common name, label used as scientific name) branches.
        SearchItemIndex known = SearchItemIndex.builder()
                .id("species-table-known")
                .guid("urn:lsid:species-table:known")
                .idxtype("TAXON")
                .name("Testus knownus")
                .commonNameSingle("Known Test Species")
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(elasticService.buildIndexQuery(known))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        // urlPathEqualTo + query-param matchers (flimit=6, facets=taxonConceptID are common to
        // every one of the 12 speciesGroup calls) — one stub serves all 12, regardless of the
        // "q=speciesGroup:X" value, since we want identical, assertable data for every group.
        wireMockServer.stubFor(get(urlPathEqualTo("/occurrences/search"))
                .withQueryParam("flimit", equalTo("6"))
                .withQueryParam("facets", equalTo("taxonConceptID"))
                .willReturn(okJson("""
                        { "facetResults": [ { "fieldResult": [
                            { "label": "urn:lsid:species-table:known", "count": 40 },
                            { "label": "urn:lsid:species-table:unknown", "count": 5 }
                        ] } ] }
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addSpecies(data);

        assertThat(errors).isZero();
        Record record = data.data.get("species");
        // allLifeforms, plants, animals, birds, reptiles, arthropods, mammals, fishes, insects,
        // amphibians, bacteria, fungi
        assertThat(record.tables).hasSize(12);

        Table allLifeforms = record.tables.stream().filter(t -> "AllLifeforms".equals(t.name)).findFirst().orElseThrow();
        assertThat(allLifeforms.rows).anySatisfy(row -> {
            assertThat(row.name).contains("Testus knownus").contains("Known Test Species");
            assertThat(row.values).containsExactly(40);
        });
        assertThat(allLifeforms.rows).anySatisfy(row -> {
            assertThat(row.name).isEqualTo("urn:lsid:species-table:unknown - ");
            assertThat(row.values).containsExactly(5);
        });
    }

    @Test
    void addSpatialLayers_countsByTypeDomainAndClassification() {
        wireMockServer.stubFor(get(urlEqualTo("/fields?q=")).willReturn(okJson("""
                [
                  { "enabled": true, "layer": { "enabled": true, "type": "Contextual", "domain": "Terrestrial", "classification1": "Vegetation" } },
                  { "enabled": true, "layer": { "enabled": true, "type": "Raster", "domain": "Marine", "classification1": "Climate" } },
                  { "enabled": false, "layer": { "enabled": true, "type": "Contextual", "domain": "Terrestrial", "classification1": "Ignored" } },
                  { "enabled": true, "layer": { "enabled": true, "type": "Raster", "domain": "Terrestrial, Marine", "classification1": "Vegetation" } },
                  { "enabled": true, "layer": { "enabled": true, "type": "Raster", "domain": "Terrestrial", "classification1": null } }
                ]
                """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addSpatialLayers(data);

        assertThat(errors).isZero();
        Record record = data.data.get("spatialLayers");
        assertThat(record.count).isEqualTo(4); // contextual(1) + raster(3)
        Table table = firstTable(data, "spatialLayers");
        assertThat(rowNamed(table, "contextualLayers").values).containsExactly(1);
        assertThat(rowNamed(table, "rasterLayers").values).containsExactly(3);
        assertThat(rowNamed(table, "terrestrialLayers").values).containsExactly(3);
        assertThat(rowNamed(table, "marineLayers").values).containsExactly(2);
        assertThat(rowNamed(table, "Vegetation").values).containsExactly(2);
        assertThat(rowNamed(table, "Climate").values).containsExactly(1);
        // the disabled field's classification ("Ignored") must not appear at all
        assertThat(table.rows.stream().anyMatch(r -> "Ignored".equals(r.name))).isFalse();
    }

    @Test
    void addImage_aggregatesImageTotalsAndFacetCounts() {
        wireMockServer.stubFor(get(urlEqualTo("/ws/search?max=0")).willReturn(okJson("""
                { "totalImageCount": 999 }
                """)));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?facets=taxon_name&pageSize=0&q=multimedia:Image&fq=taxon_name:*&flimit=0"))
                .willReturn(okJson("[ { \"count\": 111 } ]")));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?q=multimedia:Image%20AND%20(rank:species%20OR%20rank:subspecies)&facets=taxon_name&fq=taxon_name:*&pageSize=0&flimit=0"))
                .willReturn(okJson("[ { \"count\": 222 } ]")));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?q=multimedia:Image%20AND%20rank:subspecies&facets=taxon_name&fq=taxon_name:*&pageSize=0&flimit=0"))
                .willReturn(okJson("[ { \"count\": 333 } ]")));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?facets=taxon_name&fq=taxon_name:*&pageSize=0&q=multimedia:Image&fq=dataHubUid:dh6&flimit=0"))
                .willReturn(okJson("[ { \"count\": 444 } ]")));
        wireMockServer.stubFor(get(urlEqualTo(
                "/occurrence/facets?facets=taxon_name&fq=taxon_name:*&pageSize=0&q=multimedia:Image&fq=provenance:%22Individual%20sightings%22&flimit=0"))
                .willReturn(okJson("[ { \"count\": 555 } ]")));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addImage(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "image");
        assertThat(rowNamed(table, "imagesTotal").values).containsExactly(999);
        assertThat(rowNamed(table, "taxaWithImages").values).containsExactly(111);
        assertThat(rowNamed(table, "speciesWithImages").values).containsExactly(222);
        assertThat(rowNamed(table, "subspeciesWithImages").values).containsExactly(333);
        assertThat(rowNamed(table, "digivolTaxaWithImages").values).containsExactly(444);
        assertThat(rowNamed(table, "czTaxaWithImages").values).containsExactly(555);
    }

    @Test
    void addCollections_sumsMapFeatureCollectionCountsPerFilter() {
        wireMockServer.stubFor(get(urlEqualTo("/public/mapFeatures?filters=all")).willReturn(okJson("""
                { "features": [ { "properties": { "collectionCount": 10 } } ] }
                """)));
        wireMockServer.stubFor(get(urlEqualTo("/public/mapFeatures?filters=fauna%2Centomology")).willReturn(okJson("""
                { "features": [ { "properties": { "collectionCount": 3 } } ] }
                """)));
        wireMockServer.stubFor(get(urlEqualTo("/public/mapFeatures?filters=entomology")).willReturn(okJson("""
                { "features": [ { "properties": { "collectionCount": 2 } } ] }
                """)));
        wireMockServer.stubFor(get(urlEqualTo("/public/mapFeatures?filters=microbes")).willReturn(okJson("""
                { "features": [ { "properties": { "collectionCount": 1 } } ] }
                """)));
        wireMockServer.stubFor(get(urlEqualTo("/public/mapFeatures?filters=plants")).willReturn(okJson("""
                { "features": [ { "properties": { "collectionCount": 4 } } ] }
                """)));
        wireMockServer.stubFor(get(urlEqualTo("/public/mapFeatures?filters=fungi")).willReturn(okJson("""
                { "features": [ { "properties": { "collectionCount": 5 } } ] }
                """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addCollections(data);

        assertThat(errors).isZero();
        Record record = data.data.get("collections");
        assertThat(record.count).isEqualTo(10);
        Table table = firstTable(data, "collections");
        assertThat(rowNamed(table, "fauna").values).containsExactly(3);
        assertThat(rowNamed(table, "insects").values).containsExactly(2);
        assertThat(rowNamed(table, "microbes").values).containsExactly(1);
        assertThat(rowNamed(table, "plants").values).containsExactly(4);
        assertThat(rowNamed(table, "fungi").values).containsExactly(5);
    }

    @Test
    void run_fullPipeline_allExternalDependenciesSucceed_writesCompleteSummaryAndDashboardJson() throws Exception {
        // biocache
        wireMockServer.stubFor(get(urlEqualTo("/occurrence/facets?q=*:*&facets=kingdom&flimit=-1&facet=true"))
                .willReturn(okJson("[ { \"count\": 1, \"fieldResult\": [ { \"label\": \"Animalia\", \"fq\": \"kingdom:Animalia\", \"count\": 1 } ] } ]")));
        wireMockServer.stubFor(get(urlEqualTo("/occurrences/search?q=*:*&pageSize=0")).willReturn(okJson("{ \"totalRecords\": 100 }")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrences/search?q=basisOfRecord:*&facet=true&facets=basisOfRecord&pageSize=0&fsort=count"))
                .willReturn(okJson("{ \"totalRecords\": 50, \"facetResults\": [ { \"fieldResult\": [ { \"i18nCode\": \"x\", \"fq\": \"basisOfRecord:x\", \"count\": 50 } ] } ] }")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrences/search?q=*:*&sort=eventDate&dir=desc&facet=true&pageSize=1"))
                .willReturn(okJson("{ \"occurrences\": [ { \"eventDate\": 1700000000000 } ] }")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrences/search?q=images:*&sort=eventDate&dir=desc&facet=true&pageSize=1"))
                .willReturn(okJson("{ \"occurrences\": [ { \"eventDate\": 1700000001000 } ] }")));
        String[] ranges = {
                "occurrence_year:[1600-01-01T00:00:00Z TO 1699-12-31T23:59:59Z]",
                "occurrence_year:[1700-01-01T00:00:00Z TO 1799-12-31T23:59:59Z]",
                "occurrence_year:[1800-01-01T00:00:00Z TO 1899-12-31T23:59:59Z]",
                "occurrence_year:[1900-01-01T00:00:00Z TO 1999-12-31T23:59:59Z]",
                "occurrence_year:[2000-01-01T00:00:00Z TO 2099-12-31T23:59:59Z]"
        };
        for (String range : ranges) {
            wireMockServer.stubFor(get(urlEqualTo("/occurrences/search?q=*:*&fq=" + enc(range) + "&pageSize=0"))
                    .willReturn(okJson("{ \"totalRecords\": 1 }")));
        }
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrences/search?q=typeStatus:*&pageSize=0&facet=true&flimit=1000&facets=typeStatus"))
                .willReturn(okJson("{ \"facetResults\": [ { \"fieldResult\": [ { \"label\": \"Holotype\", \"fq\": \"typeStatus:Holotype\", \"count\": 1 } ] } ] }")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrences/search?q=typeStatus:*&pageSize=0&facet=true&flimit=1000&facets=typeStatus&fq=multimedia:Image"))
                .willReturn(okJson("{ \"facetResults\": [ { \"fieldResult\": [ { \"label\": \"Holotype\", \"fq\": \"typeStatus:Holotype\", \"count\": 1 } ] } ] }")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrences/search?q=stateConservation:*&pageSize=0&facet=true&facets=stateConservation&flimit=1000&fsort=count"))
                .willReturn(okJson("{ \"facetResults\": [ { \"fieldResult\": [ { \"label\": \"Endangered\", \"fq\": \"stateConservation:Endangered\", \"count\": 1 } ] } ] }")));
        wireMockServer.stubFor(get(urlPathEqualTo("/occurrence/facets"))
                .withQueryParam("fq", equalTo("species:*"))
                .willReturn(okJson("[ { \"count\": 1, \"fieldResult\": [] } ]")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrences/search?q=" + enc("decade:[* TO 1840]") + "&pageSize=0&"))
                .willReturn(okJson("{ \"totalRecords\": 0 }")));
        for (String facet : List.of("decade", "dataProviderUid", "institutionUid", "speciesGroup")) {
            String fq = "decade".equals(facet) ? "&fq=" + enc("decade:[1850 TO *]") : "";
            wireMockServer.stubFor(get(urlEqualTo(
                            "/occurrences/search?q=" + facet + ":*&pageSize=0&facet=true&facets=" + facet + "&flimit=-1" + fq))
                    .willReturn(okJson("{ \"facetResults\": [ { \"fieldResult\": [ { \"label\": \"v1\", \"fq\": \"" + facet + ":v1\", \"count\": 1 } ] } ] }")));
        }
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrences/search?q=stateProvince:*&pageSize=0&facet=true&facets=stateProvince&flimit=-1"))
                .willReturn(okJson("{ \"facetResults\": [ { \"fieldResult\": [ { \"label\": \"New South Wales\", \"i18nCode\": \"x\", \"fq\": \"stateProvince:New South Wales\", \"count\": 1 } ] } ] }")));
        wireMockServer.stubFor(get(urlPathEqualTo("/occurrences/search"))
                .withQueryParam("flimit", equalTo("6"))
                .withQueryParam("facets", equalTo("taxonConceptID"))
                .willReturn(okJson("{ \"facetResults\": [ { \"fieldResult\": [ { \"label\": \"urn:lsid:full-pipeline:1\", \"count\": 1 } ] } ] }")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrence/facets?facets=taxon_name&pageSize=0&q=multimedia:Image&fq=taxon_name:*&flimit=0"))
                .willReturn(okJson("[ { \"count\": 1 } ]")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrence/facets?q=multimedia:Image%20AND%20(rank:species%20OR%20rank:subspecies)&facets=taxon_name&fq=taxon_name:*&pageSize=0&flimit=0"))
                .willReturn(okJson("[ { \"count\": 1 } ]")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrence/facets?q=multimedia:Image%20AND%20rank:subspecies&facets=taxon_name&fq=taxon_name:*&pageSize=0&flimit=0"))
                .willReturn(okJson("[ { \"count\": 1 } ]")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrence/facets?facets=taxon_name&fq=taxon_name:*&pageSize=0&q=multimedia:Image&fq=dataHubUid:dh6&flimit=0"))
                .willReturn(okJson("[ { \"count\": 1 } ]")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrence/facets?facets=taxon_name&fq=taxon_name:*&pageSize=0&q=multimedia:Image&fq=provenance:%22Individual%20sightings%22&flimit=0"))
                .willReturn(okJson("[ { \"count\": 1 } ]")));
        wireMockServer.stubFor(get(urlEqualTo(
                        "/occurrence/facets?q=data_resource_uid:*&facets=data_resource_uid&flimit=0&facet=true"))
                .willReturn(okJson("[ { \"count\": 1, \"fieldResult\": [] } ]")));

        // collectory
        wireMockServer.stubFor(get(urlEqualTo("/ws/dataResource/count/resourceType?public=true"))
                .willReturn(okJson("{ \"total\": 10, \"groups\": { \"records\": 8, \"species-list\": 1, \"document\": 1 } }")));
        wireMockServer.stubFor(get(urlPathEqualTo("/ws/dataResource/count/resourceType"))
                .withQueryParam("createdBefore", matching(".*"))
                .willReturn(okJson("{ \"total\": 9 }")));
        wireMockServer.stubFor(get(urlEqualTo("/ws/institution/count")).willReturn(okJson("{ \"total\": 1 }")));
        wireMockServer.stubFor(get(urlEqualTo("/ws/collection/count")).willReturn(okJson("{ \"total\": 1 }")));
        wireMockServer.stubFor(get(urlEqualTo("/ws/dataResource")).willReturn(okJson(
                "[ { \"uid\": \"dr1\", \"uri\": \"http://collectory/dr1\", \"name\": \"DR One\" } ]")));
        wireMockServer.stubFor(get(urlPathEqualTo("/public/mapFeatures"))
                .willReturn(okJson("{ \"features\": [ { \"properties\": { \"collectionCount\": 1 } } ] }")));

        // bhl
        wireMockServer.stubFor(get(urlEqualTo("/bhlstats?apikey=test-api-key"))
                .willReturn(aResponse().withHeader("Content-Type", "text/xml").withBody(
                        "<Response><Status>ok</Status><TitleCount>1</TitleCount><ItemCount>1</ItemCount><PageCount>1</PageCount></Response>")));

        // digivol
        wireMockServer.stubFor(get(urlPathEqualTo("/index/stats")).willReturn(okJson(
                "{ \"transcriberCount\": 1, \"totalTasks\": 1, \"completedTasks\": 1 }")));

        // logger
        wireMockServer.stubFor(get(urlEqualTo("/service/totalsByType")).willReturn(okJson("{ \"totals\": {} }")));
        wireMockServer.stubFor(get(urlEqualTo("/service/reasonBreakdown?eventId=1002")).willReturn(okJson(
                "{ \"all\": { \"events\": 10, \"records\": 100, \"reasonBreakdown\": {} } }")));
        wireMockServer.stubFor(get(urlEqualTo("/service/emailBreakdown?eventId=1002")).willReturn(okJson(
                "{ \"all\": { \"emailBreakdown\": { \"edu\": {\"events\":1,\"records\":1}, \"gov\": {\"events\":1,\"records\":1}, \"other\": {\"events\":1,\"records\":1}, \"unspecified\": {\"events\":1,\"records\":1} } } }")));

        // spatial
        wireMockServer.stubFor(get(urlEqualTo("/fields?q=")).willReturn(okJson(
                "[ { \"enabled\": true, \"layer\": { \"enabled\": true, \"type\": \"Contextual\", \"domain\": \"Terrestrial\", \"classification1\": \"Vegetation\" } } ]")));

        // images
        wireMockServer.stubFor(get(urlEqualTo("/ws/search?max=0")).willReturn(okJson("{ \"totalImageCount\": 1 }")));

        // userdetails (species count uses biocacheWsUrl + dashboard.summarySpeciesCountQuery)
        wireMockServer.stubFor(get(urlPathEqualTo("/occurrence/facets"))
                .withQueryParam("facets", equalTo("species"))
                .withQueryParam("fsort", equalTo("count"))
                .willReturn(okJson("[ { \"count\": 1, \"fieldResult\": [ { \"count\": 42 } ] } ]")));
        wireMockServer.stubFor(get(urlEqualTo("/ws/getUserStats")).willReturn(okJson(
                "{ \"totalUsers\": 500, \"totalUsersOneYearAgo\": 400 }")));

        Boolean result = dashboardService.run().join();
        assertThat(result).isTrue();

        String dataDir = (String) org.springframework.test.util.ReflectionTestUtils.getField(dashboardService, "dataDir");
        File dashboardJson = new File(dataDir, "dashboard.json");
        File summaryJson = new File(dataDir, "summary.json");
        assertThat(dashboardJson).exists();
        assertThat(summaryJson).exists();

        Map<String, Object> summary = new ObjectMapper().readValue(summaryJson, Map.class);
        assertThat(summary).containsKeys("userCounts", "speciesCounts", "recordCounts", "datasetCounts", "downloadCounts");
        
        Map<String, Object> userCounts = (Map<String, Object>) summary.get("userCounts");
        assertThat(((Number) userCounts.get("count")).intValue()).isEqualTo(500);
        assertThat(((Number) userCounts.get("count1YA")).intValue()).isEqualTo(400);
        
        Map<String, Object> datasetCounts = (Map<String, Object>) summary.get("datasetCounts");
        assertThat(((Number) datasetCounts.get("count")).intValue()).isEqualTo(10);
        assertThat(((Number) datasetCounts.get("count1YA")).intValue()).isEqualTo(9);
    }

    @Test
    void load_existingValidDashboardJson_returnsParsedData() throws Exception {
        String dataDir = (String) org.springframework.test.util.ReflectionTestUtils.getField(dashboardService, "dataDir");
        File dashboardJson = new File(dataDir, "dashboard.json");
        Files.writeString(dashboardJson.toPath(), """
                { "data": { "kingdoms": { "count": 7 } } }
                """);

        DashboardData loaded = dashboardService.load();

        assertThat(loaded.data).containsKey("kingdoms");
        assertThat(loaded.data.get("kingdoms").count).isEqualTo(7);

        Files.deleteIfExists(dashboardJson.toPath());
    }

    @Test
    void load_malformedExistingDashboardJson_returnsEmptyDashboardData() throws Exception {
        String dataDir = (String) org.springframework.test.util.ReflectionTestUtils.getField(dashboardService, "dataDir");
        File dashboardJson = new File(dataDir, "dashboard.json");
        Files.writeString(dashboardJson.toPath(), "{ not valid json ");

        DashboardData loaded = dashboardService.load();

        assertThat(loaded.data).isEmpty();

        Files.deleteIfExists(dashboardJson.toPath());
    }

    @Test
    void run_staticFileStoreCopyFails_incrementsErrorCountButRunStillCompletes() throws Exception {
        // Point the (real, local-mode) StaticFileStoreService at a path that cannot be written to
        // (a file, not a directory) so copyToFileStore(...) fails gracefully (catches its own
        // exception, returns false) — hitting DashboardService.run()'s "!save(...)" branch
        // (errorCount++, "Failed to save to fileStore") without an IOException escaping.
        Object staticFileStoreService = org.springframework.test.util.ReflectionTestUtils.getField(dashboardService, "staticFileStoreService");
        String originalPath = (String) org.springframework.test.util.ReflectionTestUtils.getField(staticFileStoreService, "fileStorePath");
        File notADirectory = File.createTempFile("dashboard-service-not-a-dir", ".tmp");
        org.springframework.test.util.ReflectionTestUtils.setField(staticFileStoreService, "fileStorePath", notADirectory.getAbsolutePath());
        try {
            Boolean result = dashboardService.run().join();
            assertThat(result).isTrue(); // run() itself still completes/returns true
        } finally {
            org.springframework.test.util.ReflectionTestUtils.setField(staticFileStoreService, "fileStorePath", originalPath);
            notADirectory.delete();
        }
    }

    @Test
    void run_dataDirUnwritable_outerCatchReturnsFalse() throws Exception {
        // Point data.dir at a path whose parent doesn't exist, so FileUtils.writeStringToFile(...)
        // throws IOException from within save() (not caught by any inner try/catch), which
        // propagates up to run()'s own outer catch (IOException), returning false.
        Object originalDataDir = org.springframework.test.util.ReflectionTestUtils.getField(dashboardService, "dataDir");
        org.springframework.test.util.ReflectionTestUtils.setField(dashboardService, "dataDir",
                "/nonexistent-parent-" + java.util.UUID.randomUUID() + "/nested");
        try {
            Boolean result = dashboardService.run().join();
            assertThat(result).isFalse();
        } finally {
            org.springframework.test.util.ReflectionTestUtils.setField(dashboardService, "dataDir", originalDataDir);
        }
    }

    @Test
    void addSpatialLayers_layerDisabled_alsoSkipped() {
        wireMockServer.stubFor(get(urlEqualTo("/fields?q=")).willReturn(okJson("""
                [
                  { "enabled": true, "layer": { "enabled": false, "type": "Contextual", "domain": "Terrestrial", "classification1": "Ignored" } },
                  { "enabled": true, "layer": { "enabled": true, "type": "Contextual", "domain": "Terrestrial", "classification1": "Vegetation" } }
                ]
                """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addSpatialLayers(data);

        assertThat(errors).isZero();
        Table table = firstTable(data, "spatialLayers");
        assertThat(table.rows.stream().anyMatch(r -> "Ignored".equals(r.name))).isFalse();
        assertThat(rowNamed(table, "contextualLayers").values).containsExactly(1);
    }

    @Test
    void addSpeciesTable_recordWithNullTables_initializesTablesList() {
        wireMockServer.stubFor(get(urlPathEqualTo("/occurrences/search"))
                .withQueryParam("flimit", equalTo("6"))
                .withQueryParam("facets", equalTo("taxonConceptID"))
                .willReturn(okJson("""
                        { "facetResults": [ { "fieldResult": [] } ] }
                        """)));

        Record record = new Record();
        assertThat(record.tables).isNull();

        int errors = dashboardService.addSpeciesTable(record, "test group", "*");

        assertThat(errors).isZero();
        assertThat(record.tables).isNotNull().hasSize(1);
    }

    @Test
    void addSpecies_unexpectedRuntimeExceptionFromSpeciesTable_isCaughtByOuterCatch() {
        // An empty "facetResults" array (as opposed to a facetResults entry with an empty
        // fieldResult) makes addSpeciesTable's own `result.facetResults.getFirst()` throw
        // NoSuchElementException — a RuntimeException, NOT an IOException, so it is NOT caught by
        // addSpeciesTable's own (IOException-only) catch block, and instead propagates up into
        // addSpecies()'s outer `catch (Exception e)`.
        wireMockServer.stubFor(get(urlPathEqualTo("/occurrences/search"))
                .withQueryParam("flimit", equalTo("6"))
                .withQueryParam("facets", equalTo("taxonConceptID"))
                .willReturn(okJson("""
                        { "facetResults": [] }
                        """)));

        DashboardData data = new DashboardData();
        int errors = dashboardService.addSpecies(data);

        assertThat(errors).isEqualTo(1);
        assertThat(data.data).doesNotContainKey("species");
    }
}
