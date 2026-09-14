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
 * Local-file-mode round-trip unit tests for {@link SitemapFileStoreService}. No Spring context;
 * {@code fileStorePath} is set via reflection to a JUnit {@code @TempDir}.
 */
class SitemapFileStoreServiceTest {

    @TempDir
    Path tempDir;

    private SitemapFileStoreService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new SitemapFileStoreService();
        Field f = SitemapFileStoreService.class.getDeclaredField("fileStorePath");
        f.setAccessible(true);
        f.set(service, tempDir.toString());
    }

    @Test
    void copyToFileStore_writesFileToDestination() throws Exception {
        File src = Files.writeString(tempDir.resolve("src.txt"), "hello sitemap", StandardCharsets.UTF_8).toFile();

        boolean result = service.copyToFileStore(src, "dest.txt", false);

        assertThat(result).isTrue();
        File dest = tempDir.resolve("dest.txt").toFile();
        assertThat(dest).exists();
        assertThat(Files.readString(dest.toPath(), StandardCharsets.UTF_8)).isEqualTo("hello sitemap");
    }

    @Test
    void copyToFileStore_withDeleteSource_deletesOriginal() throws Exception {
        File src = Files.writeString(tempDir.resolve("src2.txt"), "content", StandardCharsets.UTF_8).toFile();

        boolean result = service.copyToFileStore(src, "dest2.txt", true);

        assertThat(result).isTrue();
        assertThat(src).doesNotExist();
    }

    @Test
    void deleteFile_existingFile_removesItAndReturnsTrue() throws Exception {File src = Files.writeString(tempDir.resolve("to-delete-src.txt"), "bye", StandardCharsets.UTF_8).toFile();
        service.copyToFileStore(src, "to-delete.txt", false);

        boolean deleted = service.deleteFile("to-delete.txt");

        assertThat(deleted).isTrue();
        assertThat(tempDir.resolve("to-delete.txt")).doesNotExist();
    }

    @Test
    void deleteFile_missingFile_returnsFalse() {
        boolean deleted = service.deleteFile("does-not-exist.txt");

        assertThat(deleted).isFalse();
    }
}
