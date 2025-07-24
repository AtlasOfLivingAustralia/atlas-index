/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.queue;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
public class FieldguideQueueRequest {
    public String title; // Title of the field guide, e.g. "Australian Birds"
    public String[] id; // Array of GUIDs to include in the field guide, e.g. ["urn:lsid:ala.org.au:dataset:1234", "urn:lsid:ala.org.au:dataset:5678"]
    public String sourceUrl; // Optional URL to the source of the field guide, e.g. the webpage that generated it
    public String sortBy; // Optional comma-delimited list. Supported values; family, genus, species, commonName
    public String filename; // Optional filename for the zip file, e.g. "Australian_Birds.pdf"
}
