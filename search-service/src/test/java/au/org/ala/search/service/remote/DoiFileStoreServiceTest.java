/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.doi.Doi;
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
 * Local-file-mode round-trip unit tests for {@link DoiFileStoreService}. No Spring context;
 * {@code fileStorePath} is set via reflection to a JUnit {@code @TempDir}.
 */
class DoiFileStoreServiceTest {

    @TempDir
    Path tempDir;

    private DoiFileStoreService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new DoiFileStoreService();
        Field f = DoiFileStoreService.class.getDeclaredField("fileStorePath");
        f.setAccessible(true);
        f.set(service, tempDir.toString());
    }

    private Doi doi(UUID uuid, String filename) {
        return Doi.builder().uuid(uuid).filename(filename).build();
    }

    @Test
    void copyToFileStore_thenGetFilePath_roundTripsFileContent() throws Exception {
        Doi doi = doi(UUID.randomUUID(), "report.pdf");
        File src = Files.writeString(tempDir.resolve("src.pdf"), "hello doi", StandardCharsets.UTF_8).toFile();

        boolean result = service.copyToFileStore(src, doi, false);

        assertThat(result).isTrue();
        File stored = new File(service.getFilePath(doi));
        assertThat(stored).exists();
        assertThat(Files.readString(stored.toPath(), StandardCharsets.UTF_8)).isEqualTo("hello doi");
    }

    @Test
    void copyToFileStore_withDeleteSource_deletesOriginal() throws Exception {
        Doi doi = doi(UUID.randomUUID(), "report2.pdf");
        File src = Files.writeString(tempDir.resolve("src2.pdf"), "content", StandardCharsets.UTF_8).toFile();

        boolean result = service.copyToFileStore(src, doi, true);

        assertThat(result).isTrue();
        assertThat(src).doesNotExist();
    }

    @Test
    void delete_existingFile_removesItAndReturnsTrue() throws Exception {
        Doi doi = doi(UUID.randomUUID(), "to-delete.pdf");
        File src = Files.writeString(tempDir.resolve("src3.pdf"), "bye", StandardCharsets.UTF_8).toFile();
        service.copyToFileStore(src, doi, false);

        boolean deleted = service.delete(doi);

        assertThat(deleted).isTrue();
        assertThat(new File(service.getFilePath(doi))).doesNotExist();
    }

    @Test
    void isS3_localPath_returnsFalse() {
        assertThat(service.isS3()).isFalse();
    }

    @Test
    void getFilePath_includesUuidAndFilenameSegments() {
        UUID uuid = UUID.randomUUID();
        Doi doi = doi(uuid, "myfile.csv");

        String path = service.getFilePath(doi);

        assertThat(path).isEqualTo(tempDir + "/" + uuid + "/myfile.csv");
    }

    @Test
    void createPresignedGetUrl_directPathConfigured_returnsDirectPathWithoutPresigning() throws Exception {
        Field f = DoiFileStoreService.class.getDeclaredField("directS3Path");
        f.setAccessible(true);
        f.set(service, "https://cdn.example.org/doi");
        UUID uuid = UUID.randomUUID();
        Doi doi = doi(uuid, "report.pdf");

        String url = service.createPresignedGetUrl(doi);

        assertThat(url).isEqualTo("https://cdn.example.org/doi/" + uuid + "/report.pdf");
    }
}
