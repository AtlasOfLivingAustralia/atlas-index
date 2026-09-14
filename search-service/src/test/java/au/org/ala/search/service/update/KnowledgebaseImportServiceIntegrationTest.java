/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.remote.ElasticService;
import com.github.tomakehurst.wiremock.WireMockServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end coverage of {@link KnowledgebaseImportService#run()} against a WireMock-stubbed
 * sitemap XML and article HTML page (Jsoup-fetched — WireMock works transparently since Jsoup
 * uses standard HTTP under the hood) and a real (Testcontainers) Elasticsearch instance: verifies
 * a page listed in the sitemap is scraped (title/body/breadcrumb-derived classification) and
 * indexed, and a stale existing document not present in the sitemap is deleted.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class KnowledgebaseImportServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static final WireMockServer wireMockServer = new WireMockServer(0);

    static {
        wireMockServer.start();
    }

    @Autowired
    private KnowledgebaseImportService knowledgebaseImportService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;


    @AfterAll
    static void stopWireMock() {
        wireMockServer.stop();
    }

    @DynamicPropertySource
    static void wireMockProperties(DynamicPropertyRegistry registry) {
        registry.add("knowledgebase.url", () -> "http://localhost:" + wireMockServer.port());
    }

    @Test
    void run_importsPageFromSitemapAndRemovesStaleOne() {
        String baseUrl = "http://localhost:" + wireMockServer.port();
        String pageUrl = baseUrl + "/support/faq/test-article";
        String staleId = baseUrl + "/support/faq/stale-article";

        SearchItemIndex stale = SearchItemIndex.builder()
                .id(staleId)
                .guid(staleId)
                .idxtype("KNOWLEDGEBASE")
                .name("Stale Article")
                .modified(new Date())
                .build();
        elasticService.flushImmediately(new ArrayList<>(List.of(elasticService.buildIndexQuery(stale))));
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        wireMockServer.stubFor(get(urlEqualTo("/support/sitemap.xml"))
                .willReturn(ok("""
                        <?xml version="1.0" encoding="UTF-8"?>
                        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                          <url>
                            <loc>%s</loc>
                            <lastmod>2024-01-01T10:00:00+10:00</lastmod>
                          </url>
                        </urlset>
                        """.formatted(pageUrl)).withHeader("Content-Type", "application/xml")));

        wireMockServer.stubFor(get(urlEqualTo("/support/faq/test-article"))
                .willReturn(ok("""
                        <html>
                          <body>
                            <nav class="breadcrumb">
                              <a href="/">Home</a>
                              <a href="/support/faq">FAQ</a>
                              <a href="/support/faq/sub">Sub Category</a>
                            </nav>
                            <div class="content">
                              <h2 class="heading">Test Article Title</h2>
                            </div>
                            <article class="article-body">
                              <p>This is the article body content.</p>
                            </article>
                          </body>
                        </html>
                        """).withHeader("Content-Type", "text/html")));

        knowledgebaseImportService.run().join();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            SearchItemIndex indexed = elasticService.getDocument(pageUrl);
            assertThat(indexed).isNotNull();
            assertThat(indexed.getName()).isEqualTo("Test Article Title");
            assertThat(indexed.getDescription()).contains("This is the article body content.");
            assertThat(indexed.getClassification1()).containsExactly("FAQ");
            assertThat(indexed.getClassification2()).isEqualTo("Sub Category");
            assertThat(indexed.getClassification()).isEqualTo("FAQ|Sub Category");
            assertThat(indexed.getIdxtype()).isEqualTo("KNOWLEDGEBASE");
        });

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() ->
                assertThat(elasticService.getDocument(staleId)).isNull());

        wireMockServer.verify(getRequestedFor(urlEqualTo("/support/sitemap.xml")));
        wireMockServer.verify(getRequestedFor(urlEqualTo("/support/faq/test-article")));
    }
}
