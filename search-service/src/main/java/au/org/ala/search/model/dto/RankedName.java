/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@AllArgsConstructor
@Getter
public class RankedName {
    public String name;
    public String rank;

    @Override
    public int hashCode() {
        return (rank + " " + name).hashCode();
    }

    @Override
    public boolean equals(Object obj) {
        if (obj instanceof RankedName rn) {
            return (rank + " " + name).equals(rn.rank + " " + rn.name);
        }
        return false;
    }
}
