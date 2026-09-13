/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.AdminIndex;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * Coverage of {@link DashboardService#run()}'s <b>graceful-degradation</b> contract: the
 * dashboard updater must remain stable — never throwing, never aborting the overall
 * {@code run()} — when one or more external dependencies fail, and each such failure must be
 * recorded as a queryable log entry in Elasticsearch (via {@link LogService}/{@link TaskType#DASHBOARD})
 * so operators can see what didn't update.
 * <p>
 * For coverage of each section's actual (successful) business logic — the code paths that only
 * run when the external call succeeds — see {@code DashboardServiceCoverageIntegrationTest},
 * which stubs realistic responses via WireMock for every external dependency.
 * <p>
 * Deliberately overrides every external-HTTP-API URL property (biocache, collectory, bhl,
 * digivol, logger, spatial, images) to blank — {@code DashboardService}'s own source explicitly
 * tolerates this: most {@code addXyz(...)} sections check {@code StringUtils.isEmpty(someUrl)}
 * and skip cleanly (0 errors, and a "skipping ..." log entry) when blank, and the remaining few
 * sections that aren't gated this way (e.g. {@code addSpatialLayers}/{@code addImage}/
 * {@code addCollections}) are still wrapped in their own try/catch that treats any failure
 * (including the resulting invalid/relative-URI errors) as "1 error" plus a "failed to update
 * ..." log entry, without aborting the overall {@code run()} — so leaving every URL blank lets
 * this test exercise the real, non-URL-gated pipeline (file writes, zipping,
 * {@code StaticFileStoreService} copy, and the one ES-backed section,
 * {@code addNationalSpeciesLists}) while also proving the failure-logging contract for the
 * ungated sections.
 * <p>
 * <b>Isolation:</b> this test asserts on the exact set of {@code TaskType.DASHBOARD} log entries
 * found via {@link LogService#getStatus}, which sorts by recency and returns only the top N
 * (500) documents. {@link AbstractIntegrationTestContainers}'s Elasticsearch container is a
 * single JVM-wide static singleton shared by every other test class's cached
 * {@code ApplicationContext} — and several of those other, still-cached contexts schedule this
 * exact same {@code DASHBOARD} task hourly via {@code SchedulerService} (whenever
 * {@code leadershipStatus.isLeader()}). Over a long full-suite run, those other contexts'
 * background cron firings keep writing newer {@code TaskType.DASHBOARD} log entries into the
 * shared index, which can push this test's own just-logged entries out of the top-500 recency
 * window before this test gets a chance to observe them — the empty-result-set flakiness
 * previously worked around by giving this class its own dedicated, early Surefire execution,
 * and later by giving this class its own dedicated, private {@code ElasticsearchContainer}.
 * <p>
 * Both {@link au.org.ala.search.model.AdminIndex} and
 * {@link au.org.ala.search.model.SearchItemIndex} resolve their index name from the
 * {@code elastic.adminIndex} / {@code elastic.index} properties via SpEL (see their
 * {@code @Document} annotations), and {@code ElasticService.init()} auto-creates whichever
 * index those properties resolve to on context startup. So instead of paying for a second,
 * dedicated Testcontainers Elasticsearch instance (doubling ES startup cost for the whole
 * {@code mvn test} run), this class simply reuses the single shared
 * {@link AbstractIntegrationTestContainers} cluster but overrides {@code elastic.adminIndex}
 * (and {@code elastic.index}, for the seeded TAXON docs) to unique, per-test-run index names —
 * giving this test the same "no other context can ever write into my index" isolation
 * guarantee, on one shared ES container rather than two.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@au.org.ala.search.test.SuppressExpectedLogging("au.org.ala.search.service.update.DashboardService")
class DashboardServiceIntegrationTest extends AbstractIntegrationTestContainers {

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;

    @Autowired
    private LogService logService;

    @DynamicPropertySource
    static void blankExternalUrlsAndTempDirs(DynamicPropertyRegistry registry) throws Exception {
        Path dataDir = Files.createTempDirectory("dashboard-service-test-data");
        Path staticDir = Files.createTempDirectory("dashboard-service-test-static");
        registry.add("data.dir", dataDir::toString);
        registry.add("static.filestore.path", staticDir::toString);

        registry.add("elastic.host", AbstractIntegrationTestContainers.elasticsearchContainer::getHttpHostAddress);
        registry.add("spring.datasource.url", AbstractIntegrationTestContainers.postgreSQLContainer::getJdbcUrl);
        registry.add("rabbitmq.host", AbstractIntegrationTestContainers.rabbitMQContainer::getHost);
        registry.add("rabbitmq.port", AbstractIntegrationTestContainers.rabbitMQContainer::getAmqpPort);

        // Dedicated, unique index names on the shared ES cluster — see class javadoc. This gives
        // this test the same "no other context's background activity can pollute my results"
        // guarantee as a private container, without starting a second Elasticsearch instance.
        String testRunId = java.util.UUID.randomUUID().toString();
        registry.add("elastic.adminIndex", () -> "admin-dashboard-test-" + testRunId);
        registry.add("elastic.index", () -> "search-dashboard-test-" + testRunId);

        registry.add("biocache.url", () -> "");
        registry.add("biocache.uiUrl", () -> "");
        registry.add("collections.url", () -> "");
        registry.add("bhl.getstats.url", () -> "");
        registry.add("bhl.apikey", () -> "");
        registry.add("digivol.url", () -> "");
        registry.add("logger.url", () -> "");
        registry.add("spatial.url", () -> "");
        registry.add("images.url", () -> "");
        registry.add("userdetails.url", () -> "http://localhost:1");
    }

    @Test
    void run_toleratesFailingExternalDependencies_andLogsFailuresToEs() throws Exception {
        // Seed a couple of TAXON documents so addNationalSpeciesLists() (not URL-gated, uses the
        // real ElasticService) produces non-zero counts.
        SearchItemIndex accepted = SearchItemIndex.builder()
                .id("dashboard-test-accepted")
                .guid("urn:lsid:dashboard-test:accepted")
                .idxtype("TAXON")
                .taxonomicStatus("accepted")
                .rankID(7000)
                .occurrenceCount(5)
                .scientificName("Testus acceptus")
                .name("Testus acceptus")
                .modified(new Date())
                .build();
        SearchItemIndex synonym = SearchItemIndex.builder()
                .id("dashboard-test-synonym")
                .guid("urn:lsid:dashboard-test:synonym")
                .idxtype("TAXON")
                .taxonomicStatus("synonym")
                .scientificName("Testus synonymus")
                .name("Testus synonymus")
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(
                elasticService.buildIndexQuery(accepted), elasticService.buildIndexQuery(synonym))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        Boolean result = dashboardService.run().join();
        assertThat(result).isTrue();

        String dataDir = (String) org.springframework.test.util.ReflectionTestUtils.getField(dashboardService, "dataDir");
        File dashboardJson = new File(dataDir, "dashboard.json");
        File dashboardZip = new File(dataDir, "dashboard.zip");

        assertThat(dashboardJson).exists();
        assertThat(dashboardZip).exists();
        // Note: summary.json is intentionally NOT asserted here — with every external URL blank,
        // DashboardService.save()'s summary.json section (dataset/species/user counts, all
        // fetched from the now-blank collectory/biocache/userdetails URLs) fails partway through
        // its own inner try/catch (see class javadoc), so summary.json is legitimately never
        // written in this scenario — this is the real, documented behaviour of the source, not a
        // test gap.

        Map<String, Object> dashboardJsonRoot = new ObjectMapper().readValue(dashboardJson, Map.class);

        Map<String, Object> dashboardData = (Map<String, Object>) dashboardJsonRoot.get("data");
        assertThat(dashboardData).containsKey("nationalSpeciesLists");

        Map<String, Object> nationalSpeciesLists = (Map<String, Object>) dashboardData.get("nationalSpeciesLists");

        List<Map<String, Object>> tables = (List<Map<String, Object>>) nationalSpeciesLists.get("tables");

        List<Map<String, Object>> rows = (List<Map<String, Object>>) tables.get(0).get("rows");
        assertThat(rows).anySatisfy(row -> assertThat(row.get("name")).isEqualTo("acceptedNames"));

        String staticFileStorePath = (String) org.springframework.test.util.ReflectionTestUtils.getField(
                org.springframework.test.util.ReflectionTestUtils.getField(dashboardService, "staticFileStoreService"),
                "fileStorePath");
        assertThat(new File(staticFileStorePath, "dashboard/dashboard.json")).exists();
        assertThat(new File(staticFileStorePath, "dashboard/dashboard.zip")).exists();

        // Prove the "operators can see what didn't update" contract: each of the currently-failing
        // (not URL-gated) sections, plus the summary.json save failure, must have logged a
        // "failed to update ..." message queryable via LogService/TaskType.DASHBOARD — not just
        // silently swallowed the exception.
        await().atMost(60, TimeUnit.SECONDS).untilAsserted(() -> {
            elasticsearchOperations.indexOps(AdminIndex.class).refresh();
            List<AdminIndex> logEntries = logService.getStatus(TaskType.DASHBOARD, 500);
            List<String> messages = logEntries.stream().map(AdminIndex::getMessage).toList();
            assertThat(messages).anySatisfy(m -> assertThat(m).contains("failed to update spatialLayers"));
            assertThat(messages).anySatisfy(m -> assertThat(m).contains("failed to update image"));
            assertThat(messages).anySatisfy(m -> assertThat(m).contains("failed to update collections"));
            assertThat(messages).anySatisfy(m -> assertThat(m).contains("Failed to save summary.json"));
            // And the URL-gated sections should report a clean skip, not a failure.
            assertThat(messages).anySatisfy(m -> assertThat(m).contains("skipping kingdoms"));
            assertThat(messages).anySatisfy(m -> assertThat(m).contains("skipping occurrenceCount"));
        });
    }
}
