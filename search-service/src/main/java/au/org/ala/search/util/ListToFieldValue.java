/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import java.util.Map;

@FunctionalInterface
public interface ListToFieldValue {
    String convert(Map<String, Object> it);
}
