/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.dto;

import au.org.ala.search.model.queue.StatusCode;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class SandboxIngress {
    String id; // id of the uploaded file that is one of DwCA, CSV, TSV
    String description; // user provided description of the file
    Boolean isDwCA; // true if the file is a Darwin Core Archive, ignoring headers
    String[] headers; // when isDwCA==false this corresponds to DwCA meta.xml for occurrences.txt
    StatusCode status; // upload status after queuing
    String sample; // when isDwCA==false this is the first 4 lines of the file uploaded
    String userId; // user id of the person who uploaded the file
    String dataResourceUid; // dataResourceUid as it is loaded into SOLR
}
