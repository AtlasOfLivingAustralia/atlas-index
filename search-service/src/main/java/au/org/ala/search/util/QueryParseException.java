/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

/**
 * Thrown when a query string cannot be parsed.
 */
public class QueryParseException extends RuntimeException {
    public QueryParseException(String message) {
        super(message);
    }
}

