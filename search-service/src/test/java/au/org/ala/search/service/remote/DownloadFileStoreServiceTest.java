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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Local-file-mode round-trip unit tests for {@link DownloadFileStoreService}. No Spring context;
 * {@code fileStorePath} is set via reflection to a JUnit {@code @TempDir}.
 * <p>
 * For an S3-mode round trip against a real (LocalStack-backed) S3 endpoint, see
 * {@code DownloadFileStoreServiceS3IntegrationTest}.
 */
class DownloadFileStoreServiceTest {

    @TempDir
    Path tempDir;

    private DownloadFileStoreService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new DownloadFileStoreService();
        setField("fileStorePath", tempDir.toString());
        Files.createDirectories(tempDir.resolve("search"));
    }

    private void setField(String name, Object value) throws Exception {
        Field f = DownloadFileStoreService.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(service, value);
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
    void isS3_localPath_returnsFalse() {
        assertThat(service.isS3()).isFalse();
    }

    @Test
    void getFilePath_searchItem_usesSearchSubdirectoryAndZipExtension() {
        UUID id = UUID.randomUUID();
        QueueItem item = searchQueueItem(id);

        String path = service.getFilePath(item);

        assertThat(path).isEqualTo(tempDir + "/search/" + id + ".zip");
    }

    @Test
    void copyToFileStore_thenGetFilePath_roundTripsFileContent() throws Exception {
        QueueItem item = searchQueueItem(UUID.randomUUID());
        File src = Files.writeString(tempDir.resolve("src.zip"), "zip-bytes", StandardCharsets.UTF_8).toFile();

        boolean result = service.copyToFileStore(src, item, false);

        assertThat(result).isTrue();
        File stored = new File(service.getFilePath(item));
        assertThat(stored).exists();
        assertThat(Files.readString(stored.toPath(), StandardCharsets.UTF_8)).isEqualTo("zip-bytes");
    }

    @Test
    void copyToFileStore_withDeleteSource_deletesOriginal() throws Exception {
        QueueItem item = searchQueueItem(UUID.randomUUID());
        File src = Files.writeString(tempDir.resolve("src2.zip"), "content", StandardCharsets.UTF_8).toFile();

        boolean result = service.copyToFileStore(src, item, true);

        assertThat(result).isTrue();
        assertThat(src).doesNotExist();
    }

    @Test
    void delete_existingFile_removesItAndReturnsTrue() throws Exception {
        QueueItem item = searchQueueItem(UUID.randomUUID());
        File src = Files.writeString(tempDir.resolve("src3.zip"), "bye", StandardCharsets.UTF_8).toFile();
        service.copyToFileStore(src, item, false);

        boolean deleted = service.delete(item);

        assertThat(deleted).isTrue();
        assertThat(new File(service.getFilePath(item))).doesNotExist();
    }

    @Test
    void createPresignedGetUrl_directPathConfigured_returnsDirectPathWithoutPresigning() throws Exception {
        setField("directS3Path", "https://cdn.example.org/downloads");
        UUID id = UUID.randomUUID();
        QueueItem item = searchQueueItem(id);

        String url = service.createPresignedGetUrl(item);

        assertThat(url).isEqualTo("https://cdn.example.org/downloads/search/" + id + ".zip");
    }
}
