/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.remote.ElasticService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.File;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.zip.GZIPInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end coverage of {@link SitemapService#run()} against a real (Testcontainers)
 * Elasticsearch instance and a real {@link au.org.ala.search.service.remote.SitemapFileStoreService}
 * pointed at a local temp directory (via a {@code sitemap.filestore.path} property override —
 * this is local-file mode, not S3: {@code SitemapFileStoreService} only builds an S3 client when
 * the path starts with {@code "s3"} or {@code sitemap.s3.region} is set, neither of which apply
 * here). Verifies a seeded, accepted TAXON document is written into a gzipped sitemap page file
 * and the sitemap index file references it. Also verifies that {@code removeObsoleteFiles()}
 * correctly deletes a stale gzipped page file left over from a hypothetical previous, larger run
 * (this was previously broken: {@code removeObsoleteFiles()} called {@code
 * sitemapFileStoreService.deleteFile("sitemap" + i + ".xml")} — missing the {@code .gz} suffix —
 * while sitemap page files are actually written with a {@code .xml.gz} name (see {@code
 * write()}), so it never matched an existing file and the cleanup loop exited immediately).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SitemapServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static Path tempDir;

    @Autowired
    private SitemapService sitemapService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;

    @DynamicPropertySource
    static void fileStoreProperties(DynamicPropertyRegistry registry) throws IOException {
        tempDir = Files.createTempDirectory("sitemap-test");
        registry.add("sitemap.filestore.path", () -> tempDir.toString());
    }

    @Test
    void run_writesSitemapPageAndIndex_removesStaleGzFile() throws Exception {
        // a leftover file from a hypothetical previous, larger run. removeObsoleteFiles() is
        // expected to clean this up once the current run only produces one page.
        File staleFile = new File(tempDir.toFile(), "sitemap1.xml.gz");
        Files.writeString(staleFile.toPath(), "stale content");
        assertThat(staleFile).exists();

        SearchItemIndex taxon = SearchItemIndex.builder()
                .id("taxon-1")
                .guid("urn:lsid:test:taxon-1")
                .idxtype("TAXON")
                .taxonomicStatus("accepted")
                .scientificName("Testus specificus")
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(elasticService.buildIndexQuery(taxon))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        sitemapService.run().join();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            File sitemapPage = new File(tempDir.toFile(), "sitemap0.xml.gz");
            assertThat(sitemapPage).exists();

            String content = gunzip(sitemapPage);
            assertThat(content).contains("<urlset");
            assertThat(content).contains(URLEncoder.encode("Testus specificus", StandardCharsets.UTF_8));

            File sitemapIndex = new File(tempDir.toFile(), "sitemap.xml");
            assertThat(sitemapIndex).exists();
            String indexContent = Files.readString(sitemapIndex.toPath());
            assertThat(indexContent).contains("<sitemapindex");
            assertThat(indexContent).contains("sitemap0.xml.gz");

            assertThat(staleFile).doesNotExist();
        });
    }

    private static String gunzip(File file) throws IOException {
        try (GZIPInputStream gis = new GZIPInputStream(Files.newInputStream(file.toPath()))) {
            return new String(gis.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
