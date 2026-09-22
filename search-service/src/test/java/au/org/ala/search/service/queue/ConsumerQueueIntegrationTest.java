/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.queue;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.*;
import au.org.ala.search.repo.QueuePostgresRepository;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.QueueDataService;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;

import java.io.File;
import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * End-to-end integration tests for the RabbitMQ-backed consumer queue: {@link ConsumerQueue},
 * {@link au.org.ala.search.service.consumer.SearchConsumer}, and
 * {@link au.org.ala.search.service.consumer.FieldguideConsumer}.
 * <p>
 * Unlike {@code V2ControllerIntegrationTest} (which mocks {@link ConsumerQueue} entirely),
 * this test uses the real {@link ConsumerQueue} bean so that requests are actually persisted,
 * published to a real RabbitMQ {@code consumer} queue, consumed by the real
 * {@code @RabbitListener}, and processed by the real consumer implementations. Only
 * {@link ElasticService} is mocked (to avoid depending on a populated Elasticsearch index /
 * external image service calls), and the download file store is redirected to a fixed directory
 * under {@code target/}.
 * <p>
 * <b>Isolation:</b> this class extends {@link AbstractIntegrationTestContainers} and shares its
 * singleton RabbitMQ (as well as PostgreSQL/Elasticsearch) Testcontainers instance with every
 * other integration test class, rather than starting a dedicated broker of its own. This is safe
 * because:
 * <ul>
 *     <li>{@code rabbitmq.consumer.listener.auto-startup=false} in
 *     {@code src/test/resources/application.properties} disables {@link ConsumerQueue}'s
 *     {@code @RabbitListener} for every {@code @SpringBootTest} context by default (it would
 *     otherwise be a live, competing consumer on the shared {@code consumer} queue in every
 *     context that doesn't explicitly {@code @MockitoBean} {@link ConsumerQueue}, since it's a plain
 *     {@code @Service}). The property is re-enabled just below via {@code @TestPropertySource} so
 *     this class's listener is the only one actually running.</li>
 *     <li>{@link AbstractIntegrationTestContainers#purgeSharedRabbitQueuesBeforeEach()} "flushes"
 *     the queue before every {@code @Test} in every integration test class, so no stray message
 *     left behind by a previous test/class is sitting on the queue.</li>
 *     <li>{@code @DirtiesContext(classMode = AFTER_CLASS)} below "disconnects" this class's own
 *     listener once its tests finish, by having Spring evict and fully close its
 *     {@code ApplicationContext} (which stops/deregisters its {@code @RabbitListener} container)
 *     rather than leaving it cached and listening indefinitely for the rest of the JVM fork.</li>
 * </ul>
 * The only other test class that also re-enables and exercises the real listener,
 * {@link au.org.ala.search.LeaderElectionIntegrationTest}, uses this exact same pattern - see its
 * javadoc's "Known limitation" note.
 */
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestPropertySource(properties = {
        "download.filestore.path=target/consumer-queue-test-downloads",
        "fieldguide.template.path=target/consumer-queue-test-templates",
        "rabbitmq.consumer.listener.auto-startup=true"
})
public class ConsumerQueueIntegrationTest extends AbstractIntegrationTestContainers {

    private static final Path DOWNLOAD_DIR = Path.of("target/consumer-queue-test-downloads");
    private static final Path TEMPLATE_DIR = Path.of("target/consumer-queue-test-templates");

    @BeforeAll
    static void prepareFileStoreAndTemplates() throws Exception {
        Files.createDirectories(DOWNLOAD_DIR.resolve("search"));
        Files.createDirectories(DOWNLOAD_DIR.resolve("fieldguide"));

        // Apache FOP's default resource resolver cannot handle "classpath:" URLs (as used by
        // fop.xconf's font entries) unless "classpath:" is registered as a real java.net.URL
        // protocol, which this project does not do. In a normal (non-jar) test/dev run this
        // always fails, regardless of fieldguide.template.path, since fop.xconf's embed-url
        // values are fixed "classpath:" URIs. Work around it by copying the real templates
        // directory here and rewriting fop.xconf's font URIs to real file:// paths.
        Path templatesSrc = Path.of("src/main/resources/templates").toAbsolutePath();
        try (var files = Files.walk(templatesSrc)) {
            for (Path src : (Iterable<Path>) files::iterator) {
                Path dst = TEMPLATE_DIR.resolve(templatesSrc.relativize(src));
                if (Files.isDirectory(src)) {
                    Files.createDirectories(dst);
                } else {
                    Files.copy(src, dst, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
        String fopXconf = Files.readString(TEMPLATE_DIR.resolve("fop.xconf"), StandardCharsets.UTF_8)
                .replace("classpath:/templates/fonts/", TEMPLATE_DIR.resolve("fonts").toUri().toString());
        Files.writeString(TEMPLATE_DIR.resolve("fop.xconf"), fopXconf, StandardCharsets.UTF_8);
    }

    @MockitoBean
    private ElasticService elasticService;

    @Autowired
    private ConsumerQueue consumerQueue;

    @Autowired
    private QueueDataService queueDataService;

    @Autowired
    private QueuePostgresRepository queuePostgresRepository;

    @Autowired
    private DownloadFileStoreService downloadFileStoreService;

    @Autowired
    private BroadcastQueue broadcastQueue;

    private QueueItem awaitStatus(UUID id, StatusCode... anyOf) {
        return Awaitility.await()
                .atMost(20, TimeUnit.SECONDS)
                .pollInterval(200, TimeUnit.MILLISECONDS)
                .until(() -> queueDataService.get(id), item -> {
                    if (item == null) {
                        return false;
                    }
                    for (StatusCode status : anyOf) {
                        if (item.status == status) {
                            return true;
                        }
                    }
                    return false;
                });
    }

    @Test
    void searchDownload_endToEnd_producesFinishedZipWithCsvContent() throws Exception {
        when(elasticService.isValidField(anyString())).thenReturn(true);

        File csvFile = File.createTempFile("search-consumer-test", ".csv");
        try (FileWriter fw = new FileWriter(csvFile, StandardCharsets.UTF_8)) {
            fw.write("guid,scientificName\nurn:lsid:test:1,Testus scientificus\n");
        }
        when(elasticService.download(eq("kangaroo"), any(), eq("guid"), eq(false))).thenReturn(csvFile);

        String userId = "user-" + UUID.randomUUID();
        SearchQueueRequest searchQueueRequest = new SearchQueueRequest();
        searchQueueRequest.filename = "kangaroo-results";
        searchQueueRequest.q = new String[]{"kangaroo"};
        searchQueueRequest.fl = new String[]{"guid"};

        QueueItem submitted = consumerQueue.add(QueueRequest.builder()
                .taskType(TaskType.SEARCH_DOWNLOAD)
                .searchQueueRequest(searchQueueRequest)
                .build(), userId);

        assertThat(submitted.status).isEqualTo(StatusCode.QUEUED);
        assertThat(submitted.id).isNotNull();

        QueueItem finished = awaitStatus(submitted.id, StatusCode.FINISHED, StatusCode.ERROR);
        assertThat(finished.status).isEqualTo(StatusCode.FINISHED);

        File zipFile = new File(downloadFileStoreService.getFilePath(finished));
        assertThat(zipFile).exists();

        boolean foundEntry = false;
        try (ZipInputStream zis = new ZipInputStream(Files.newInputStream(zipFile.toPath()))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.getName().equals("kangaroo-results.csv")) {
                    foundEntry = true;
                    String content = new String(zis.readAllBytes(), StandardCharsets.UTF_8);
                    assertThat(content).contains("Testus scientificus");
                }
            }
        }
        assertThat(foundEntry).isTrue();
    }

    @Test
    void fieldguide_endToEnd_producesFinishedPdfFile() throws Exception {
        SearchItemIndex taxon1 = new SearchItemIndex();
        taxon1.guid = "urn:lsid:test:1";
        taxon1.scientificName = "Testus scientificus";
        taxon1.commonNameSingle = "Test creature";

        when(elasticService.getTaxon(anyString())).thenReturn(taxon1);

        String userId = "user-" + UUID.randomUUID();
        FieldguideQueueRequest fieldguideQueueRequest = new FieldguideQueueRequest();
        fieldguideQueueRequest.title = "Test Field Guide";
        fieldguideQueueRequest.filename = "test-guide";
        fieldguideQueueRequest.id = new String[]{"urn:lsid:test:1"};

        QueueItem submitted = consumerQueue.add(QueueRequest.builder()
                .taskType(TaskType.FIELDGUIDE)
                .email("test@example.org")
                .fieldguideQueueRequest(fieldguideQueueRequest)
                .build(), userId);

        assertThat(submitted.status).isEqualTo(StatusCode.QUEUED);

        QueueItem finished = awaitStatus(submitted.id, StatusCode.FINISHED, StatusCode.ERROR);
        assertThat(finished.status).as("statusMessage: %s", finished.statusMessage).isEqualTo(StatusCode.FINISHED);

        File pdfFile = new File(downloadFileStoreService.getFilePath(finished));
        assertThat(pdfFile).exists();
        assertThat(pdfFile.length()).isGreaterThan(0);

        byte[] header = new byte[4];
        try (var in = Files.newInputStream(pdfFile.toPath())) {
            int read = in.read(header);
            assertThat(read).isEqualTo(4);
        }
        assertThat(new String(header, StandardCharsets.US_ASCII)).isEqualTo("%PDF");
    }

    @Test
    void add_tooManyQueuedRequestsForUser_returnsErrorWithoutPersistingNewItem() {
        String userId = "user-" + UUID.randomUUID();

        // Directly seed 11 QUEUED items for the user (more than MAX_USER_QUEUE_SIZE = 10),
        // bypassing the queue/RabbitMQ so they are never actually consumed.
        SearchQueueRequest dummyRequest = new SearchQueueRequest();
        dummyRequest.filename = "dummy.csv";
        dummyRequest.q = new String[]{};
        dummyRequest.fl = new String[]{"guid"};
        QueueRequest dummyQueueRequest = QueueRequest.builder()
                .taskType(TaskType.SEARCH_DOWNLOAD)
                .searchQueueRequest(dummyRequest)
                .build();

        for (int i = 0; i < 11; i++) {
            queuePostgresRepository.save(QueueItem.builder()
                    .userId(userId)
                    .created(new Date())
                    .queueRequest(dummyQueueRequest)
                    .status(StatusCode.QUEUED)
                    .build());
        }
        queuePostgresRepository.flush();

        SearchQueueRequest newRequest = new SearchQueueRequest();
        newRequest.filename = "one-too-many.csv";
        newRequest.q = new String[]{};
        newRequest.fl = new String[]{"guid"};

        QueueItem result = consumerQueue.add(QueueRequest.builder()
                .taskType(TaskType.SEARCH_DOWNLOAD)
                .searchQueueRequest(newRequest)
                .build(), userId);

        assertThat(result.status).isEqualTo(StatusCode.ERROR);
        assertThat(result.statusMessage).contains("Too many requests in the queue for user");
        assertThat(result.id).isNull(); // never persisted

        assertThat(queuePostgresRepository.countByUserIdAndStatus(userId, StatusCode.QUEUED.name())).isEqualTo(11);
    }

    @Test
    @au.org.ala.search.test.SuppressExpectedLogging("au.org.ala.search.service.queue.ConsumerQueue")
    void cancel_viaBroadcastQueue_stopsMidFlightFieldguideGeneration() throws Exception {
        SearchItemIndex taxon = new SearchItemIndex();
        taxon.guid = "urn:lsid:test:1";
        taxon.scientificName = "Testus scientificus";
        taxon.commonNameSingle = "Test creature";

        // Slow down taxon lookups so the task is still RUNNING when the cancel message arrives.
        when(elasticService.getTaxon(anyString())).thenAnswer(invocation -> {
            Thread.sleep(200);
            return taxon;
        });

        String userId = "user-" + UUID.randomUUID();
        String[] ids = new String[40];
        for (int i = 0; i < ids.length; i++) {
            ids[i] = "urn:lsid:test:" + i;
        }

        FieldguideQueueRequest fieldguideQueueRequest = new FieldguideQueueRequest();
        fieldguideQueueRequest.title = "Slow Field Guide";
        fieldguideQueueRequest.filename = "slow-guide-" + UUID.randomUUID();
        fieldguideQueueRequest.id = ids;

        QueueItem submitted = consumerQueue.add(QueueRequest.builder()
                .taskType(TaskType.FIELDGUIDE)
                .email("test@example.org")
                .fieldguideQueueRequest(fieldguideQueueRequest)
                .build(), userId);

        assertThat(submitted.status).isEqualTo(StatusCode.QUEUED);

        // wait until the task actually starts running, then cancel it via the broadcast queue -
        // the same path used by V2Controller.download(cancel=true) / BroadcastQueue.receiveMessage.
        awaitStatus(submitted.id, StatusCode.RUNNING);

        broadcastQueue.sendMessage(TaskType.CANCEL_CONSUMER,
                QueueCancel.builder().id(submitted.id).message("test cancel").build());

        QueueItem cancelled = awaitStatus(submitted.id, StatusCode.CANCELLED, StatusCode.FINISHED, StatusCode.ERROR);
        assertThat(cancelled.status).isEqualTo(StatusCode.CANCELLED);
        assertThat(cancelled.statusMessage).isEqualTo("test cancel");
    }
}
