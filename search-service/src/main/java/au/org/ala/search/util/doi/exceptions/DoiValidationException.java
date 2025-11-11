/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util.doi.exceptions;

import org.springframework.validation.Errors;

import java.util.UUID;

public class DoiValidationException extends Exception {

    final UUID uuid;
    final String doi;
    final Errors errors;

    public DoiValidationException(UUID uuid, String doi, Errors errors) {
        super(errors.toString());
        this.uuid = uuid;
        this.doi = doi;
        this.errors = errors;
    }

    @Override
    public Throwable fillInStackTrace() {
        return this;
    }
}
