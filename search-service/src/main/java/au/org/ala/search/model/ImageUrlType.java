/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model;

public enum ImageUrlType {
    THUMBNAIL("/image/%s/thumbnail"), // use with String.format
    LARGE("/image/%s/large"), // use with String.format
    SMALL("/image/%s/original"), // use with String.format. same as bie-index
    METADATA("/ws/image/"); // use as a prefix

    public final String path;

    ImageUrlType(String path) {
        this.path = path;
    }
}
