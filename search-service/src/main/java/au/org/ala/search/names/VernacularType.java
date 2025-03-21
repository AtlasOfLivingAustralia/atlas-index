/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.names;

import lombok.Getter;

/**
 * From bie-index default-vernacular-name-status.json
 */
@Getter
public enum VernacularType {
    STANDARD("standard", 400),
    PREFERRED("preferred", 300),
    COMMON("common", 200),
    TRADITIONAL_KNOWLEDGE("traditionalKnowledge", 200, "indigenousKnowledge"),
    LEGISLATED("legislated", 500),
    LOCAL("local", 100),
    DEPRECATED("deprecated", 1);

    /**
     * The preferred term
     */
    private final String term;

    /**
     * Any other terms that might descript this name
     */
    private final String[] altTerms;

    /**
     * The name priority
     */
    private final int priority;

    VernacularType(String term, int priority, String... altTerms) {
        this.term = term;
        this.priority = priority;
        this.altTerms = altTerms;
    }

    public static VernacularType find(String name) {
        for (VernacularType type : VernacularType.values()) {
            if (type.term.equalsIgnoreCase(name)) {
                return type;
            } else if (type.altTerms != null) {
                for (String alt : type.altTerms) {
                    if (alt.equalsIgnoreCase(name)) {
                        return type;
                    }
                }
            }
        }
        return null;
    }
}
