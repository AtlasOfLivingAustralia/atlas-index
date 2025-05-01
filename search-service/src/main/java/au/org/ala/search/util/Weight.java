/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import org.apache.commons.lang3.StringUtils;

public class Weight {
    public static double calcSearchWeight(SearchItemIndex item,
                                          double weightMin,
                                          double weightMax,
                                          double weightNorm,
                                          double commonStatusPriority) {
        return calcSearchWeight(item.idxtype, item.priority, item.taxonomicStatus, item.rankID, item.nameType, item.favourite, weightMin, weightMax, weightNorm, commonStatusPriority);
    }

    public static float calcSearchWeight(
            String idxtype,
            Integer priority,
            String taxonomicStatus,
            Integer rankID,
            String nameType,
            String favourite,
            double weightMin,
            double weightMax,
            double weightNorm,
            double commonStatusPriority) {
        double initialWeight = 1.0;
        if (priority != null) {
            initialWeight = switch (IndexDocType.valueOf(idxtype)) {
                case TAXON -> Math.max(weightMin, Math.min(weightMax, ((double) priority) / weightNorm));
                case COMMON -> ((double) priority) / commonStatusPriority;
                default -> initialWeight;
            };
        }
        double w = calcGlobal(initialWeight, idxtype, taxonomicStatus, rankID, nameType);

        w = _calcSearchWeight(w, idxtype, favourite);

        return (float) w;
    }

    public static double calcSuggestWeight(SearchItemIndex item,
                                           double weightMin,
                                           double weightMax,
                                           double weightNorm,
                                           double commonStatusPriority) {
        return calcSuggestWeight(item.idxtype, item.priority, item.taxonomicStatus, item.rankID, item.nameType, item.scientificName, weightMin, weightMax, weightNorm, commonStatusPriority);
    }

    public static float calcSuggestWeight(
            String idxtype,
            Integer priority,
            String taxonomicStatus,
            Integer rankID,
            String nameType,
            String scientificName,
            double weightMin,
            double weightMax,
            double weightNorm,
            double commonStatusPriority) {
        double initialWeight = 1.0;
        if (priority != null) {
            initialWeight = switch (IndexDocType.valueOf(idxtype)) {
                case TAXON -> Math.max(weightMin, Math.min(weightMax, ((double) priority) / weightNorm));
                case COMMON -> ((double) priority) / commonStatusPriority;
                default -> initialWeight;
            };
        }
        double w = calcGlobal(initialWeight, idxtype, taxonomicStatus, rankID, nameType);

        w = _calcSuggestWeight(w, scientificName);

        return (float) w;
    }

    private static double calcGlobal(double initialWeight, String idxtype, String taxonomicStatus, Integer rankID, String nameType) {
        // global
        double w = initialWeight;

        switch (IndexDocType.valueOf(idxtype)) {
            case TAXON -> w *= 2;
            case COMMON -> w *= 1.5;
            case TAXONVARIANT, IDENTIFIER -> w *= 0.01;
        }

        if (taxonomicStatus != null) {
            switch (taxonomicStatus) {
                case "accepted" -> w *= 2;
                case "misapplied", "miscellaneousLiterature" -> w *= 0.5;
                case "excluded", "invalid", "inferredExcluded" -> w *= 0.3;
                case "inferredSynonym" -> w *= 0.8;
                case "inferredInvalid" -> w *= 0.1;
            }
        }

        if (rankID != null) {
            if (rankID == 6000) w *= 2.5;
            if (rankID == 7000) w *= 1.8;
            if (rankID > 8001) w *= 0.5;
        }

        if ("hybrid".equals(nameType)) w *= 0.2;

        return w;
    }

    private static double _calcSearchWeight(double initialWeight, String idxtype, String favourite) {
        double w = initialWeight;

        if (favourite != null) {
            if (IndexDocType.COMMON.name().equals(idxtype)) {
                switch (favourite) {
                    case "interest" -> w *= 1.1;
                    case "preferred" -> w *= 1.5;
                    case "favourite" -> w *= 2.5;
                    case "iconic" -> w *= 10;
                }
            }

            if (IndexDocType.TAXON.name().equals(idxtype)) {
                switch (favourite) {
                    case "favourite" -> w *= 1.1;
                    case "iconic" -> w *= 1.5;
                }
            }
        }

        return w;
    }

    private static double _calcSuggestWeight(double initialWeight, String scientificName) {
        double w = initialWeight;

        if (StringUtils.isNotEmpty(scientificName) && scientificName.length() > 4) {
            w = w / (1.0 + Math.log(scientificName.length() * 0.01 + 1.0));
        }

        return w;
    }
}
