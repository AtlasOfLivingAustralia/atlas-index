/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.service.remote.BiocacheApiService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.service.remote.TaxonDataService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link TaxonUpdateRunner#buildImageCache()}. No Spring context — constructor
 * dependencies are Mockito mocks.
 */
class TaxonUpdateRunnerTest {

    private BiocacheApiService biocacheApiService;
    private TaxonDataService taxonDataService;
    private TaxonUpdateRunner runner;

    @BeforeEach
    void setUp() throws Exception {
        biocacheApiService = mock(BiocacheApiService.class);
        taxonDataService = mock(TaxonDataService.class);
        runner = new TaxonUpdateRunner(
                mock(ElasticService.class), biocacheApiService, mock(LogService.class), taxonDataService);

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
    void clearCache_emptiesAllMaps(@TempDir Path tempDir) throws Exception {
        writeLeftRightCsv(tempDir, "guid1,100,200\n");
        when(biocacheApiService.getFacet(any(), eq((String) null), eq("lft"))).thenReturn(List.of("100"));
        when(biocacheApiService.getFacet(any(), eq("pref1"), eq("lft"))).thenReturn(List.of("100"));
        when(biocacheApiService.queryImages(any(), any())).thenReturn(new String[]{"image1"});
        runner.buildImageCache();
        assertThat(runner.getImageCache()).isNotEmpty();

        runner.clearCache();

        assertThat(runner.getImageCache()).isEmpty();
        assertThat(runner.getLftImageCache()).isEmpty();
        assertThat(runner.getUpdatingImageCounter().get()).isEqualTo(0);
    }
}
