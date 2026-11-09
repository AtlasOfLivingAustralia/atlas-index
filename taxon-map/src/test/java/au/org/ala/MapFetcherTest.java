/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class MapFetcherTest {

    private static final String ACACIA_GUID = "https://id.biodiversity.org.au/taxon/apni/51788513";
    private static final String ACACIA_DEALBATA_GUID = "https://id.biodiversity.org.au/node/apni/2902581";
    private static final String ACACIA_SUBSP_GUID = "https://id.biodiversity.org.au/taxon/apni/51436549";
    private static final String FABACEAE_GUID = "https://id.biodiversity.org.au/taxon/apni/51788514";
    private static final String ZERO_OCC_GUID = "https://id.biodiversity.org.au/taxon/apni/99999999";
    private static final String UNLISTED_GUID = "https://id.biodiversity.org.au/taxon/apni/11111111";

    @BeforeEach
    void setUp() {
        MapFetcher.hexBinColours = new ArrayList<>();
        MapFetcher.hexBinColours.add(new Object[]{"FFC577", 1});
        MapFetcher.hexBinColours.add(new Object[]{"E28946", 10});
        MapFetcher.hexBinColours.add(new Object[]{"D36B3D", 100});
        MapFetcher.hexBinColours.add(new Object[]{"C44D34", 1000});
        MapFetcher.hexBinColours.add(new Object[]{"802937", null});
    }

    @Test
    void computeOccurrenceCountsFromLftFacet_sumsSubtreeForGenusAndHigherTaxa() throws Exception {
        // Biocache returns fieldResult ordered by count descending (not lft ascending).
        // Acacia genus has lft=528105, rgt=531197:
        //   - 5129 records matched directly at genus rank (lft=528105)
        //   - 500000 records on child species (lft=529426)
        //   - 437328 records on child subspecies (lft=530947)
        // Total across [528105, 531197] = 942457.
        // Fabaceae family [522098, 531198] has 0 direct records at lft=522098, plus another genus at lft=525000 (1000 records).
        String facetJson = """
                {
                  "pageSize": 0,
                  "totalRecords": 943500,
                  "facetResults": [
                    {
                      "fieldName": "lft",
                      "fieldResult": [
                        { "label": "529426", "count": 500000 },
                        { "label": "530947", "count": 437328 },
                        { "label": "528105", "count": 5129 },
                        { "label": "525000", "count": 1000 },
                        { "label": "100", "count": 43 }
                      ]
                    }
                  ]
                }
                """;

        String leftRightCsv = String.join("\n",
                "\"" + FABACEAE_GUID + "\",\"522098\",\"531198\"",
                "\"" + ACACIA_GUID + "\",\"528105\",\"531197\"",
                "\"" + ACACIA_DEALBATA_GUID + "\",\"529426\",\"529426\"",
                "\"" + ACACIA_SUBSP_GUID + "\",\"530947\",\"530947\"",
                "\"" + ZERO_OCC_GUID + "\",\"600000\",\"600010\"",
                "\"" + UNLISTED_GUID + "\",\"100\",\"100\""
        );

        Set<String> targetGuids = Set.of(
                FABACEAE_GUID,
                ACACIA_GUID,
                ACACIA_DEALBATA_GUID,
                ACACIA_SUBSP_GUID,
                ZERO_OCC_GUID
        );

        Map<String, Integer> counts = MapFetcher.computeOccurrenceCountsFromLftFacet(
                facetJson,
                new StringReader(leftRightCsv),
                targetGuids
        );

        // Genus Acacia includes direct genus records (5,129) + child species/subspecies records = 942,457
        assertEquals(942457, counts.get(ACACIA_GUID));
        // Family Fabaceae has 0 direct records at lft=522098, but sums all descendants in [522098, 531198]
        assertEquals(943457, counts.get(FABACEAE_GUID));
        // Leaf taxa (left == right) get their exact lft count
        assertEquals(500000, counts.get(ACACIA_DEALBATA_GUID));
        assertEquals(437328, counts.get(ACACIA_SUBSP_GUID));
        // Zero-occurrence taxon is omitted from map (defaults to 0)
        assertFalse(counts.containsKey(ZERO_OCC_GUID));
        // Taxon not in targetGuids is not included
        assertFalse(counts.containsKey(UNLISTED_GUID));
    }

    @Test
    void scaledHexBinValues_scalesCorrectlyForGenusCount() {
        List<Object[]> unscaled = MapFetcher.scaledHexBinValues(5129);
        assertEquals(1, unscaled.get(0)[1]);
        assertEquals(10, unscaled.get(1)[1]);
        assertEquals(100, unscaled.get(2)[1]);
        assertEquals(1000, unscaled.get(3)[1]);
        assertNull(unscaled.get(4)[1]);

        List<Object[]> scaledForAcacia = MapFetcher.scaledHexBinValues(942457);
        assertEquals(20, scaledForAcacia.get(0)[1]);
        assertEquals(200, scaledForAcacia.get(1)[1]);
        assertEquals(2000, scaledForAcacia.get(2)[1]);
        assertEquals(20000, scaledForAcacia.get(3)[1]);
        assertNull(scaledForAcacia.get(4)[1]);
    }
}
