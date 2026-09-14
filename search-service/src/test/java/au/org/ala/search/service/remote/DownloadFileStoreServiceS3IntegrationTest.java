/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.QueueRequest;
import au.org.ala.search.model.queue.SearchQueueRequest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.localstack.LocalStackContainer;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.async.AsyncResponseTransformer;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import java.io.File;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * S3-mode round-trip integration test for {@link DownloadFileStoreService} — backed by a real S3-compatible
 * endpoint (LocalStack, via Testcontainers) rather than mocking the AWS SDK.
 */
@Testcontainers
class DownloadFileStoreServiceS3IntegrationTest {

    private static final String BUCKET = "test-download-bucket";

    private static final LocalStackContainer LOCALSTACK =
            new LocalStackContainer(DockerImageName.parse("localstack/localstack:3.4"))
                    .withServices("s3");

    private static S3AsyncClient verificationClient;

    @BeforeAll
    static void startContainerAndCreateBucket() {
        LOCALSTACK.start();

        verificationClient = S3AsyncClient.builder()
                .endpointOverride(LOCALSTACK.getEndpoint())
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(LOCALSTACK.getAccessKey(), LOCALSTACK.getSecretKey())))
                .region(Region.of(LOCALSTACK.getRegion()))
                .forcePathStyle(true)
                .build();

        verificationClient.createBucket(CreateBucketRequest.builder().bucket(BUCKET).build()).join();
    }

    @AfterAll
    static void stopContainer() {
        if (verificationClient != null) {
            verificationClient.close();
        }
        LOCALSTACK.stop();
    }

    private DownloadFileStoreService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new DownloadFileStoreService();
        setField("fileStorePath", "s3://" + BUCKET + "/downloads");
        setField("s3Region", LOCALSTACK.getRegion());
        setField("s3AccessKey", LOCALSTACK.getAccessKey());
        setField("s3SecretKey", LOCALSTACK.getSecretKey());
        setField("s3Endpoint", LOCALSTACK.getEndpoint().toString());
        setField("duration", 30);
        setField("directS3Path", "");
        invokeInit();
    }

    private void setField(String name, Object value) throws Exception {
        Field f = DownloadFileStoreService.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(service, value);
    }

    private void invokeInit() throws Exception {
        Method init = DownloadFileStoreService.class.getDeclaredMethod("init");
        init.setAccessible(true);
        init.invoke(service);
    }

    private QueueItem searchQueueItem(UUID id) {
        SearchQueueRequest searchQueueRequest = new SearchQueueRequest();
        searchQueueRequest.filename = "results.csv";
        searchQueueRequest.q = new String[]{"kangaroo"};
        searchQueueRequest.fl = new String[]{"guid"};
        return QueueItem.builder()
                .id(id)
                .queueRequest(QueueRequest.builder()
                        .taskType(TaskType.SEARCH_DOWNLOAD)
                        .searchQueueRequest(searchQueueRequest)
                        .build())
                .build();
    }

    @Test
    void isS3_s3Path_returnsTrue() {
        assertThat(service.isS3()).isTrue();
    }

    @Test
    void copyToFileStore_thenDelete_roundTripsAgainstRealS3Endpoint(@TempDir Path tempDir) throws Exception {
        QueueItem item = searchQueueItem(UUID.randomUUID());
        File src = Files.writeString(tempDir.resolve("src.zip"), "s3 zip bytes", StandardCharsets.UTF_8).toFile();
        String key = "downloads/search/" + item.id + ".zip";

        boolean copied = service.copyToFileStore(src, item, false);
        assertThat(copied).isTrue();

        // Verify object actually exists in the (LocalStack) S3 bucket, independent of the
        // service under test, and that its content matches what was uploaded.
        String content = verificationClient.getObject(builder -> builder.bucket(BUCKET).key(key),
                        AsyncResponseTransformer.<GetObjectResponse>toBytes())
                .join()
                .asString(StandardCharsets.UTF_8);
        assertThat(content).isEqualTo("s3 zip bytes");

        boolean deleted = service.delete(item);
        assertThat(deleted).isTrue();

        assertThatThrownBy(() -> verificationClient.getObject(builder -> builder.bucket(BUCKET).key(key),
                        AsyncResponseTransformer.<GetObjectResponse>toBytes())
                .join())
                .hasCauseInstanceOf(NoSuchKeyException.class);
    }

    @Test
    void copyToFileStore_withDeleteSource_deletesLocalOriginal(@TempDir Path tempDir) throws Exception {
        QueueItem item = searchQueueItem(UUID.randomUUID());
        File src = Files.writeString(tempDir.resolve("src2.zip"), "content", StandardCharsets.UTF_8).toFile();

        boolean copied = service.copyToFileStore(src, item, true);

        assertThat(copied).isTrue();
        assertThat(src).doesNotExist();
    }

    @Test
    void createPresignedGetUrl_withCustomEndpoint_generatesWorkingPresignedUrl(@TempDir Path tempDir) throws Exception {
        QueueItem item = searchQueueItem(UUID.randomUUID());
        File src = Files.writeString(tempDir.resolve("presign-src.zip"), "presigned content", StandardCharsets.UTF_8).toFile();
        service.copyToFileStore(src, item, false);

        String presignedUrl = service.createPresignedGetUrl(item);

        assertThat(presignedUrl).isNotBlank();
        assertThat(presignedUrl).contains(LOCALSTACK.getEndpoint().getHost());
        assertThat(presignedUrl).contains("/" + BUCKET + "/downloads/search/" + item.id + ".zip");

        try (HttpClient httpClient = HttpClient.newHttpClient()) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(presignedUrl))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.body()).isEqualTo("presigned content");
        }
    }
}
