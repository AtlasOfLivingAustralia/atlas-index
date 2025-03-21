/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.query;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
public class Op {
    public List<Term> terms = new ArrayList<>();
    public boolean andOp = false; // true==AND, false==OR
}
