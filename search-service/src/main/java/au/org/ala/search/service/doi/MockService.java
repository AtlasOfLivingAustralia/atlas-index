/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.doi;

import au.org.ala.search.model.doi.MintRequest;
import au.org.ala.search.util.doi.ServiceResponse;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * For use when doi.minting.enabled=false. Simulates a DOI provider service when none is in use.
 *
 * From doi-service.
 */
@Service
public class MockService extends DoiProviderService {

    @Override
    String generateRequestPayload(String uuid, MintRequest.ProviderMetadata metadata, String landingPageUrl, String doi, Boolean active) {
        return "";
    }

    @Override
    ServiceResponse invokeCreateService(Object requestPayload, String landingPageUrl) {
        return successResponse();
    }

    @Override
    ServiceResponse invokeUpdateService(String doi, Object requestPayload, String landingPageUrl) {
        return successResponse();
    }

    // TODO: replace placeholder DOI with something indicating it's not externally minted
    ServiceResponse successResponse() {
        ServiceResponse response = new ServiceResponse(200, "", "ABC");
        response.setDoi("10.1000/" + UUID.randomUUID());
        return response;
    }
}
