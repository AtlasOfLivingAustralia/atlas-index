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
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.concurrent.TimeUnit;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end coverage of {@link WordpressImportService#run()} against a WireMock-stubbed
 * two-level sitemap (a root {@code sitemapindex} pointing at one child {@code urlset} sitemap,
 * exercising the BFS queue traversal in {@code listPages}) and an article HTML page fetched
 * with {@code contentOnlyParams} appended, plus a real (Testcontainers) Elasticsearch instance.
 * Verifies the article is indexed with title/body/category/image extracted from the page, and
 * that a non-article page (missing the {@code og:type=article} meta tag) is correctly skipped.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WordpressImportServiceIntegrationTest extends AbstractIntegrationTestContainers {

    private static final WireMockServer wireMockServer = new WireMockServer(0);

    @Autowired
    private WordpressImportService wordpressImportService;

    @Autowired
    private ElasticService elasticService;

    @Autowired
    private ElasticsearchOperations elasticsearchOperations;

    @BeforeAll
    static void startWireMock() {
        wireMockServer.start();
    }

    @AfterAll
    static void stopWireMock() {
        wireMockServer.stop();
    }

    @DynamicPropertySource
    static void wireMockProperties(DynamicPropertyRegistry registry) {
        registry.add("wordpress.url", () -> "http://localhost:" + wireMockServer.port());
    }

    @Test
    void run_traversesSitemapIndexAndImportsArticleSkippingNonArticlePage() {
        String baseUrl = "http://localhost:" + wireMockServer.port();
        String articleUrl = baseUrl + "/news/test-post";
        String nonArticleUrl = baseUrl + "/news/landing-page";

        wireMockServer.stubFor(get(urlEqualTo("/xmlsitemap.xml"))
                .willReturn(ok("""
                        <?xml version="1.0" encoding="UTF-8"?>
                        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                          <sitemap>
                            <loc>%s/post-sitemap.xml</loc>
                          </sitemap>
                        </sitemapindex>
                        """.formatted(baseUrl)).withHeader("Content-Type", "application/xml")));

        wireMockServer.stubFor(get(urlEqualTo("/post-sitemap.xml"))
                .willReturn(ok("""
                        <?xml version="1.0" encoding="UTF-8"?>
                        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                          <url>
                            <loc>%s</loc>
                            <lastmod>2024-01-01T10:00:00+10:00</lastmod>
                          </url>
                          <url>
                            <loc>%s</loc>
                            <lastmod>2024-01-01T10:00:00+10:00</lastmod>
                          </url>
                        </urlset>
                        """.formatted(articleUrl, nonArticleUrl)).withHeader("Content-Type", "application/xml")));

        wireMockServer.stubFor(get(urlEqualTo("/news/test-post?content-only=1&categories=1"))
                .willReturn(ok("""
                        <html>
                          <head>
                            <title>Test Post Title</title>
                            <meta property="og:type" content="article"/>
                            <meta property="article:section" content="News"/>
                          </head>
                          <body>
                            <main>
                              <article>
                                <p>This is the article body content.</p>
                                <img src="/images/post.jpg"/>
                              </article>
                            </main>
                          </body>
                        </html>
                        """).withHeader("Content-Type", "text/html")));

        wireMockServer.stubFor(get(urlEqualTo("/news/landing-page?content-only=1&categories=1"))
                .willReturn(ok("""
                        <html>
                          <head><title>Landing Page</title></head>
                          <body><main>Some landing content, not an article.</main></body>
                        </html>
                        """).withHeader("Content-Type", "text/html")));

        wordpressImportService.run().join();
        elasticsearchOperations.indexOps(SearchItemIndex.class).refresh();

        await().atMost(10, TimeUnit.SECONDS).untilAsserted(() -> {
            SearchItemIndex indexed = elasticService.getDocument(articleUrl);
            assertThat(indexed).isNotNull();
            assertThat(indexed.getName()).isEqualTo("Test Post Title");
            assertThat(indexed.getDescription()).contains("This is the article body content.");
            assertThat(indexed.getClassification1()).containsExactly("News");
            assertThat(indexed.getImage()).isEqualTo("/images/post.jpg");
            assertThat(indexed.getIdxtype()).isEqualTo("WORDPRESS");
        });

        assertThat(elasticService.getDocument(nonArticleUrl)).isNull();

        wireMockServer.verify(getRequestedFor(urlEqualTo("/xmlsitemap.xml")));
        wireMockServer.verify(getRequestedFor(urlEqualTo("/post-sitemap.xml")));
        wireMockServer.verify(getRequestedFor(urlEqualTo("/news/test-post?content-only=1&categories=1")));
        wireMockServer.verify(getRequestedFor(urlEqualTo("/news/landing-page?content-only=1&categories=1")));
    }
}
