/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util.doi;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic unit tests for {@link ServiceResponse}. No Spring context, no containers.
 */
class ServiceResponseTest {

    @Test
    void successConstructor_setsHttpStatusOkAndDoi() {
        ServiceResponse response = new ServiceResponse("10.1234/abcd");

        assertThat(response.getHttpStatus()).isEqualTo(200);
        assertThat(response.getDoi()).isEqualTo("10.1234/abcd");
        assertThat(response.getError()).isNull();
        assertThat(response.getProviderErrorCode()).isNull();
    }

    @Test
    void errorConstructor_setsFieldsDirectly() {
        ServiceResponse response = new ServiceResponse(500, "Internal error", "ERR-42");

        assertThat(response.getHttpStatus()).isEqualTo(500);
        assertThat(response.getError()).isEqualTo("Internal error");
        assertThat(response.getProviderErrorCode()).isEqualTo("ERR-42");
        assertThat(response.getDoi()).isNull();
    }

    @Test
    void getErrorMessage_statusOnly_noErrorOrProviderCode() {
        ServiceResponse response = new ServiceResponse(404, null, null);

        assertThat(response.getErrorMessage())
                .isEqualTo("The service invocation returned HTTP 404");
    }

    @Test
    void getErrorMessage_withErrorOnly() {
        ServiceResponse response = new ServiceResponse(400, "Bad request", null);

        assertThat(response.getErrorMessage())
                .isEqualTo("The service invocation returned HTTP 400 and error 'Bad request'");
    }

    @Test
    void getErrorMessage_withProviderErrorCodeOnly() {
        ServiceResponse response = new ServiceResponse(400, null, "ERR-1");

        assertThat(response.getErrorMessage())
                .isEqualTo("The service invocation returned HTTP 400 with error code ERR-1");
    }

    @Test
    void getErrorMessage_withErrorAndProviderErrorCode() {
        ServiceResponse response = new ServiceResponse(400, "Bad request", "ERR-1");

        assertThat(response.getErrorMessage())
                .isEqualTo("The service invocation returned HTTP 400 and error 'Bad request' with error code ERR-1");
    }

    @Test
    void getErrorMessage_withEmptyStringError_treatedAsAbsent() {
        ServiceResponse response = new ServiceResponse(400, "", "");

        assertThat(response.getErrorMessage())
                .isEqualTo("The service invocation returned HTTP 400");
    }

    @Test
    void settersMutateState() {
        ServiceResponse response = new ServiceResponse("10.1234/abcd");
        response.setHttpStatus(503);
        response.setDoi("10.9999/zzzz");
        response.setError("Service unavailable");
        response.setProviderErrorCode("SVC-503");

        assertThat(response.getHttpStatus()).isEqualTo(503);
        assertThat(response.getDoi()).isEqualTo("10.9999/zzzz");
        assertThat(response.getError()).isEqualTo("Service unavailable");
        assertThat(response.getProviderErrorCode()).isEqualTo("SVC-503");
    }
}
