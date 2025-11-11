/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util.doi.exceptions;

public class DoiNotFoundException extends RuntimeException {

    String id;

    public DoiNotFoundException(String id) {
        super("$id not found");
        this.id = id;
    }

    @Override
    public Throwable fillInStackTrace() {
        return this;
    }
}
