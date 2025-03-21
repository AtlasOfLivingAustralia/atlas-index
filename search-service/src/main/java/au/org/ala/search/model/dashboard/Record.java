/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.dashboard;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;
import java.util.List;
import java.util.Map;

@NoArgsConstructor
@Getter
@Setter
public class Record {
    public Date date = new Date();
    public Integer count;
    public String url;
    public String imageUrl;
    public List<Table> tables;
    public Map<String, String> mostRecent;
}
