/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.cache.*;
import au.org.ala.search.service.SpeciesGroupService;
import au.org.ala.search.service.remote.LogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Map;
import java.util.zip.GZIPInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class DwCADenormaliseImportServiceTest {
    @Test
    void nestedNamesRetainTheirOwnDatasetIdsAndOriginalSources(@TempDir Path tempDir) throws Exception {
        DwCADenormaliseImportService service = new DwCADenormaliseImportService(
                mock(SpeciesGroupService.class), mock(LogService.class));
        ReflectionTestUtils.setField(service, "commonNamePath", tempDir.resolve("missing.csv").toString());
        ReflectionTestUtils.setField(service, "priorityNorm", 100);
        service.setCache(new DenormalCache(
                new DenormalTaxon[]{
                        DenormalTaxon.builder().guid("synonym").scientificName("Synonym")
                                .acceptedConceptID("accepted").datasetID("dr2").source("Other").build()
                },
                new DenormalIdentifier[]{
                        DenormalIdentifier.builder().key("accepted").guid("identifier")
                                .datasetID("dr3").source("Other").build()
                },
                new DenormalVariant[]{
                        DenormalVariant.builder().key("accepted").scientificName("Variant")
                                .datasetID("dr4").source("Other").build()
                },
                new DenormalVernacular[]{
                        DenormalVernacular.builder().key("accepted").name("Common")
                                .datasetID("dr5").source("Other").build()
                },
                Map.of()));
        SearchItemIndex item = SearchItemIndex.builder().guid("accepted")
                .scientificName("Accepted").datasetID("dr1").rank("species").build();

        service.denormalizeItemOnly(item);

        for (Map.Entry<String, String> entry : Map.of(
                item.synonymData, "dr2",
                item.identifierData, "dr3",
                item.variantData, "dr4",
                item.vernacularData, "dr5").entrySet()) {
            try (GZIPInputStream input = new GZIPInputStream(
                    new ByteArrayInputStream(Base64.getDecoder().decode(entry.getKey())))) {
                var rows = new ObjectMapper().readTree(input);
                assertThat(rows.size()).isEqualTo(1);
                assertThat(rows.get(0).get("datasetID").asText()).isEqualTo(entry.getValue());
                assertThat(rows.get(0).get("source").asText()).isEqualTo("Other");
            }
        }
    }
}
