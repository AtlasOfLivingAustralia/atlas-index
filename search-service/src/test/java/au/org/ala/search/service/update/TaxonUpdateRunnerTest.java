/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.remote.BiocacheApiService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.service.remote.TaxonDataService;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import jakarta.json.Json;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link TaxonUpdateRunner#buildImageCache()}. No Spring context — constructor
 * dependencies are Mockito mocks.
 */
class TaxonUpdateRunnerTest {

    private ElasticService elasticService;
    private BiocacheApiService biocacheApiService;
    private TaxonDataService taxonDataService;
    private TaxonUpdateRunner runner;

    @BeforeEach
    void setUp() throws Exception {
        elasticService = mock(ElasticService.class);
        biocacheApiService = mock(BiocacheApiService.class);
        taxonDataService = mock(TaxonDataService.class);
        runner = new TaxonUpdateRunner(
                elasticService, biocacheApiService, mock(LogService.class), taxonDataService);

        setField("preferred", new String[]{"pref1"});
        setField("requiredFq", "spatiallyValid:true");
        setField("cachingThreadPoolSize", 2);

        when(taxonDataService.findAllByKey(any())).thenReturn(List.of());
    }

    private void setField(String name, Object value) throws Exception {
        Field f = TaxonUpdateRunner.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(runner, value);
    }

    private void writeLeftRightCsv(Path tempDir, String content) throws Exception {
        Path csv = tempDir.resolve("lsid-left-right.csv");
        Files.writeString(csv, content);
        setField("leftRightCsvPath", csv.toString());
    }

    @Test
    void buildImageCache_taxonWithImageAndPreferredMatch_populatesBothCaches(@TempDir Path tempDir) throws Exception {
        writeLeftRightCsv(tempDir, "guid1,100,200\n");

        when(biocacheApiService.getFacet(eq("images:* AND spatiallyValid:true"), eq((String) null), eq("lft")))
                .thenReturn(List.of("100"));
        when(biocacheApiService.getFacet(eq("images:* AND spatiallyValid:true"), eq("pref1"), eq("lft")))
                .thenReturn(List.of("100"));
        when(biocacheApiService.queryImages(eq("lft:[100 TO 200]"), any()))
                .thenReturn(new String[]{"image1", "image2"});

        runner.buildImageCache();

        assertThat(runner.getImageCache()).containsEntry("guid1", "100,200");
        assertThat(runner.getLftImageCache()).containsEntry("guid1", "image1,image2");
    }

    @Test
    void buildImageCache_lftNotInImageFacet_excludedFromImageCache(@TempDir Path tempDir) throws Exception {
        writeLeftRightCsv(tempDir, "guid1,100,200\n");

        // "100" is NOT in the "has an image" facet result -> row is filtered out entirely
        when(biocacheApiService.getFacet(eq("images:* AND spatiallyValid:true"), eq((String) null), eq("lft")))
                .thenReturn(List.of());
        when(biocacheApiService.getFacet(eq("images:* AND spatiallyValid:true"), eq("pref1"), eq("lft")))
                .thenReturn(List.of());

        runner.buildImageCache();

        assertThat(runner.getImageCache()).isEmpty();
        assertThat(runner.getLftImageCache()).isEmpty();
    }

    @Test
    void buildImageCache_lftInImageFacetButNotPreferred_imageCachedButNoLftImage(@TempDir Path tempDir) throws Exception {
        writeLeftRightCsv(tempDir, "guid1,100,200\n");

        when(biocacheApiService.getFacet(eq("images:* AND spatiallyValid:true"), eq((String) null), eq("lft")))
                .thenReturn(List.of("100"));
        // preferred facet does NOT include "100" -> getImageFor finds no matching preferredSets entry
        when(biocacheApiService.getFacet(eq("images:* AND spatiallyValid:true"), eq("pref1"), eq("lft")))
                .thenReturn(List.of());

        runner.buildImageCache();

        assertThat(runner.getImageCache()).containsEntry("guid1", "100,200");
        assertThat(runner.getLftImageCache()).isEmpty();
    }

    @Test
    void buildImageCache_blankLftInCsv_rowSkipped(@TempDir Path tempDir) throws Exception {
        writeLeftRightCsv(tempDir, "guid1,,200\n");

        when(biocacheApiService.getFacet(any(), eq((String) null), eq("lft"))).thenReturn(List.of());
        when(biocacheApiService.getFacet(any(), eq("pref1"), eq("lft"))).thenReturn(List.of());

        runner.buildImageCache();

        assertThat(runner.getImageCache()).isEmpty();
    }

    @Test
    void buildImageCache_multipleRows_onlyMatchingLftIncluded(@TempDir Path tempDir) throws Exception {
        writeLeftRightCsv(tempDir, "guid1,100,200\nguid2,300,400\n");

        when(biocacheApiService.getFacet(eq("images:* AND spatiallyValid:true"), eq((String) null), eq("lft")))
                .thenReturn(List.of("100")); // only guid1's lft has an image
        when(biocacheApiService.getFacet(eq("images:* AND spatiallyValid:true"), eq("pref1"), eq("lft")))
                .thenReturn(List.of("100"));
        when(biocacheApiService.queryImages(eq("lft:[100 TO 200]"), any()))
                .thenReturn(new String[]{"image1"});

        runner.buildImageCache();

        assertThat(runner.getImageCache()).containsOnlyKeys("guid1");
        assertThat(runner.getLftImageCache()).containsEntry("guid1", "image1");
    }

    @Test
    void buildOccurrenceCountCache_sumsHierarchicalLftRangesAndCachesExplicitZero(@TempDir Path tempDir) throws Exception {
        writeLeftRightCsv(tempDir,
                "genus1,100,200\n"
                        + "species1,110,110\n"
                        + "species2,150,150\n"
                        + "emptySpecies,250,260\n"
                        + "badRow,,300\n");
        when(biocacheApiService.getLftCounts()).thenReturn(Map.of(100, 5L, 110, 30L, 150, 12L, 300, 99L));

        boolean ok = runner.buildOccurrenceCountCache();

        assertThat(ok).isTrue();
        assertThat(runner.getOccurrenceCountCache()).containsExactlyInAnyOrderEntriesOf(Map.of(
                "genus1", 47,
                "species1", 30,
                "species2", 12,
                "emptySpecies", 0
        ));
    }

    @Test
    @SuppressWarnings("unchecked")
    void updateForList_preservesUnresolvedTaxonCount_andClearsVerifiedZero(@TempDir Path tempDir) throws Exception {
        writeLeftRightCsv(tempDir, "verifiedZero,250,260\n");
        when(biocacheApiService.getLftCounts()).thenReturn(Map.of(100, 10L));
        assertThat(runner.buildOccurrenceCountCache()).isTrue();

        Hit<SearchItemIndex> unresolvedHit = mock(Hit.class);
        when(unresolvedHit.id()).thenReturn("doc-unresolved");
        when(unresolvedHit.fields()).thenReturn(Map.of(
                "guid", JsonData.of(Json.createArrayBuilder().add("missingFromCsv").build()),
                "occurrenceCount", JsonData.of(Json.createArrayBuilder().add(15).build())
        ));

        Hit<SearchItemIndex> verifiedZeroHit = mock(Hit.class);
        when(verifiedZeroHit.id()).thenReturn("doc-zero");
        when(verifiedZeroHit.fields()).thenReturn(Map.of(
                "guid", JsonData.of(Json.createArrayBuilder().add("verifiedZero").build()),
                "occurrenceCount", JsonData.of(Json.createArrayBuilder().add(15).build())
        ));

        Integer updateCount = runner.updateForList(List.of(unresolvedHit, verifiedZeroHit)).join();

        assertThat(updateCount).isEqualTo(1);
        ArgumentCaptor<List<UpdateQuery>> captor = ArgumentCaptor.forClass(List.class);
        verify(elasticService).update(captor.capture());
        List<UpdateQuery> sentUpdates = captor.getValue();
        assertThat(sentUpdates).hasSize(1);
        assertThat(sentUpdates.get(0).getId()).isEqualTo("doc-zero");
        assertThat(sentUpdates.get(0).getDocument()).containsEntry("occurrenceCount", null);
    }

    @Test
    void buildOccurrenceCountCache_biocacheError_returnsFalse(@TempDir Path tempDir) throws Exception {
        writeLeftRightCsv(tempDir, "guid1,100,200\n");
        when(biocacheApiService.getLftCounts()).thenReturn(null);

        assertThat(runner.buildOccurrenceCountCache()).isFalse();
        assertThat(runner.getOccurrenceCountCache()).isEmpty();
    }

    @Test
    void clearCache_emptiesAllMaps(@TempDir Path tempDir) throws Exception {
        writeLeftRightCsv(tempDir, "guid1,100,200\n");
        when(biocacheApiService.getFacet(any(), eq((String) null), eq("lft"))).thenReturn(List.of("100"));
        when(biocacheApiService.getFacet(any(), eq("pref1"), eq("lft"))).thenReturn(List.of("100"));
        when(biocacheApiService.queryImages(any(), any())).thenReturn(new String[]{"image1"});
        when(biocacheApiService.getLftCounts()).thenReturn(Map.of(100, 42L));
        runner.buildImageCache();
        runner.buildOccurrenceCountCache();
        assertThat(runner.getImageCache()).isNotEmpty();
        assertThat(runner.getOccurrenceCountCache()).isNotEmpty();

        runner.clearCache();

        assertThat(runner.getImageCache()).isEmpty();
        assertThat(runner.getLftImageCache()).isEmpty();
        assertThat(runner.getOccurrenceCountCache()).isEmpty();
        assertThat(runner.getUpdatingImageCounter().get()).isEqualTo(0);
    }
}
