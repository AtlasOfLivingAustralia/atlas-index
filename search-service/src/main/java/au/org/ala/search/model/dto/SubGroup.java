/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@AllArgsConstructor
public class SubGroup {
    public String group;
    public String subGroup;
}
