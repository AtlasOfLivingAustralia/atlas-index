/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.logger;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LogEventVO {
    private String comment;
    private Integer eventTypeId;
    private String userIP;
    private String userAgent;
    private Map<String, Integer> recordCounts;
    private String userEmail;
    private String month;
    private Integer reasonTypeId;
    private Integer sourceTypeId;
    private String sourceUrl;
}

