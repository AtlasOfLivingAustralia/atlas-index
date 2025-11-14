/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.doi;

public enum DoiProvider {
    ANDS, // deprecated but old data may still reference it
    DATACITE,
    ALA // same as DATACITE, legacy name
}
