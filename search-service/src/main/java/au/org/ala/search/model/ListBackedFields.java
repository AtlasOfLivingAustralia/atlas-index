/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model;

/**
 * Enum for list-backed (and other repository) fields.
 */
public enum ListBackedFields {
    HIDDEN("hiddenImages_s"),
    IMAGE("image"),
    NOT_FOUND(""),
    NATIVE_INTRODUCED("nativeIntroduced"), // JSON map of " Place: Status" pairs
    HERO_DESCRIPTION("heroDescription"), // HTML content that is the hero description
    DESCRIPTIONS("descriptions"); // JSON description content for the local or S3 file and the taxon description override file

    final public String field;

    ListBackedFields(String field) {
        this.field = field;
    }

    public static ListBackedFields find(String field) {
        for (ListBackedFields lbf : ListBackedFields.values()) {
            if (lbf.field.equals(field)) {
                return lbf;
            }
        }

        return NOT_FOUND;
    }
}
