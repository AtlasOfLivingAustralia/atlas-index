/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util.doi;

import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpStatus;

@Getter
@Setter
public class ServiceResponse {
    int httpStatus;
    String doi;
    String providerErrorCode;
    String error;

    public ServiceResponse(String doi) {
        httpStatus = HttpStatus.SC_OK;
        this.doi = doi;
    }

    public ServiceResponse(int httpStatus, String error, String providerErrorCode) {
        this.httpStatus = httpStatus;
        this.error = error;
        this.providerErrorCode = providerErrorCode;
    }

    public String getErrorMessage() {
        String message = "The service invocation returned HTTP " + httpStatus;

        if (StringUtils.isNotEmpty(error)) {
            message += " and error '" + error + "'";
        }
        if (StringUtils.isNotEmpty(providerErrorCode)) {
            message += " with error code " + providerErrorCode;
        }

        return message;
    }
}
