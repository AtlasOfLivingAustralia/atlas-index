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
import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Local-file-mode round-trip unit tests for {@link DataFileStoreService}. No Spring context; the
 * {@code @Value}-injected {@code fileStorePath} field is set via reflection to a JUnit
 * {@code @TempDir}, and {@code s3Region} is left blank so {@code init()} (never invoked here,
 * since it is only relevant to S3 mode) would be a no-op.
 */
class DataFileStoreServiceTest {

    @TempDir
    Path tempDir;

    private DataFileStoreService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new DataFileStoreService();
        setField("fileStorePath", tempDir.toString());
    }

    private void setField(String name, Object value) throws Exception {
        Field f = DataFileStoreService.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(service, value);
    }

    @Test
    void copyToFileStore_thenGet_roundTripsFileContent() throws Exception {
        File src = Files.writeString(tempDir.resolve("src.txt"), "hello data", StandardCharsets.UTF_8).toFile();

        boolean result = service.copyToFileStore(src, "dest.txt", false);

        assertThat(result).isTrue();
        File retrieved = service.get("dest.txt");
        assertThat(retrieved).exists();
        assertThat(Files.readString(retrieved.toPath(), StandardCharsets.UTF_8)).isEqualTo("hello data");
    }

    @Test
    void copyToFileStore_withDeleteSource_deletesOriginal() throws Exception {
        File src = Files.writeString(tempDir.resolve("src2.txt"), "content", StandardCharsets.UTF_8).toFile();

        boolean result = service.copyToFileStore(src, "dest2.txt", true);

        assertThat(result).isTrue();
        assertThat(src).doesNotExist();
        assertThat(service.get("dest2.txt")).exists();
    }

    @Test
    void get_missingFile_throwsIOException() {
        assertThatThrownBy(() -> service.get("does-not-exist.txt"))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("File not found");
    }

    @Test
    void retrieveFileLastModified_existingFile_returnsLastModifiedTime() throws Exception {
        File src = Files.writeString(tempDir.resolve("timestamped-src.txt"), "x", StandardCharsets.UTF_8).toFile();
        service.copyToFileStore(src, "timestamped.txt", false);

        long lastModified = service.retrieveFileLastModified("timestamped.txt");

        assertThat(lastModified).isGreaterThan(0L);
    }

    @Test
    void retrieveFileLastModified_missingFile_throwsIOException() {
        assertThatThrownBy(() -> service.retrieveFileLastModified("missing.txt"))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("File not found");
    }

    @Test
    void cleanupFile_localMode_doesNotDeleteFile() throws Exception {
        // cleanupFile() only deletes the file if fileStorePath.startsWith("s3") — in local mode
        // it must be a no-op, since the returned File *is* the file in the store, not a temp copy.
        File src = Files.writeString(tempDir.resolve("keep-src.txt"), "keep me", StandardCharsets.UTF_8).toFile();
        service.copyToFileStore(src, "keep.txt", false);
        File retrieved = service.get("keep.txt");

        service.cleanupFile(retrieved);

        assertThat(retrieved).exists();
    }
}
