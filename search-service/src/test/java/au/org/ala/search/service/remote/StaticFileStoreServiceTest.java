/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Local-file-mode round-trip unit tests for {@link StaticFileStoreService}. No Spring context;
 * {@code fileStorePath} is set via reflection to a JUnit {@code @TempDir}.
 */
class StaticFileStoreServiceTest {

    @TempDir
    Path tempDir;

    private StaticFileStoreService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new StaticFileStoreService();
        Field f = StaticFileStoreService.class.getDeclaredField("fileStorePath");
        f.setAccessible(true);
        f.set(service, tempDir.toString());
    }

    @Test
    void copyToFileStore_thenGet_roundTripsFileContent() throws Exception {
        File src = Files.writeString(tempDir.resolve("src.txt"), "hello static", StandardCharsets.UTF_8).toFile();

        boolean result = service.copyToFileStore(src, "dest.txt", false);

        assertThat(result).isTrue();
        File retrieved = service.get("dest.txt");
        assertThat(retrieved).exists();
        assertThat(Files.readString(retrieved.toPath(), StandardCharsets.UTF_8)).isEqualTo("hello static");
    }

    @Test
    void copyToFileStore_withDeleteSource_deletesOriginal() throws Exception {
        File src = Files.writeString(tempDir.resolve("src2.txt"), "content", StandardCharsets.UTF_8).toFile();

        boolean result = service.copyToFileStore(src, "dest2.txt", true);

        assertThat(result).isTrue();
        assertThat(src).doesNotExist();
    }

    @Test
    void get_missingFile_returnsNull() {
        assertThat(service.get("does-not-exist.txt")).isNull();
    }

    @Test
    void delete_existingFile_removesItAndReturnsTrue() throws Exception {
        File src = Files.writeString(tempDir.resolve("to-delete-src.txt"), "bye", StandardCharsets.UTF_8).toFile();
        service.copyToFileStore(src, "to-delete.txt", false);

        boolean deleted = service.delete("to-delete.txt");

        assertThat(deleted).isTrue();
        assertThat(service.get("to-delete.txt")).isNull();
    }

    @Test
    void cleanupFile_localMode_doesNotDeleteFile() throws Exception {
        File src = Files.writeString(tempDir.resolve("keep-src.txt"), "keep me", StandardCharsets.UTF_8).toFile();
        service.copyToFileStore(src, "keep.txt", false);
        File retrieved = service.get("keep.txt");

        service.cleanupFile(retrieved);

        assertThat(retrieved).exists();
    }
}
