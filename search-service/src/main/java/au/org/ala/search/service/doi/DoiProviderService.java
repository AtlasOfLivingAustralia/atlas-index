/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.doi;

import au.org.ala.search.model.doi.MintRequest;
import au.org.ala.search.util.doi.ServiceResponse;
import au.org.ala.search.util.doi.exceptions.DoiMintingException;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.xml.bind.JAXBException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;

/**
 * Abstract base class for interacting with DOI minting providers such as DATACITE. Each individual provider will have its
 * own subclass to handle provider-specific payload construction and service invocation.
 */
@Slf4j
public abstract class DoiProviderService {

    @Value("${doi.baseUrl}")
    protected String doiBaseUrl;

    /**
     * Mint a new DOI
     *
     * @param uuid Unique local identifier for the DOI - this is used to form the url that the doi will resolve to
     * @param metadata A map containing the provider-specific metadata, to be mapped onto the provider's web service api
     * @param customLandingPageUrl (defaults to null) A custom, application-specific landing page for the DOI to resolve to.
     * @return the new DOI if the minting process is successful
     * @throws DoiMintingException if the minting process fails for any reason
     * @throws IllegalArgumentException if uuid or metadata are null or empty
     */
    public String mintDoi(String uuid, MintRequest.ProviderMetadata metadata, String customLandingPageUrl, Boolean active) throws DoiMintingException, IllegalArgumentException {
        if (uuid == null || uuid.isEmpty()) {
            throw new IllegalArgumentException("uuid must not be null or empty");
        }
        if (metadata == null) {
            throw new IllegalArgumentException("metadata must not be null");
        }

        String landingPageUrl = generateLandingPageUrl(uuid, customLandingPageUrl);

        String requestPayload;
        try {
            requestPayload = generateRequestPayload(uuid, metadata, landingPageUrl, null, active);
        } catch (Exception e) {
            log.error("Failed to construct the provider request payload", e);
            throw new DoiMintingException("Failed to construct the provider request payload", e);
        }

        ServiceResponse response;
        try {
            response = invokeCreateService(requestPayload, landingPageUrl);
        } catch (Exception e) {
            log.error("Failed to invoke the provider mint web service", e);
            throw new DoiMintingException("Failed to invoke the provider mint web service", e);
        }

        if (response != null && response.getHttpStatus() == HttpStatus.SC_OK && StringUtils.isNotEmpty(response.getDoi())) {
            log.info("DOI {} generated for local id {}: resolves to {}", response.getDoi(), uuid, landingPageUrl);

            return response.getDoi();
        } else {
            throw new DoiMintingException("Failed to invoke the provider web mint service: " + response.getErrorMessage(), null);
        }
    }

    public void updateDoi(String doi, String uuid, MintRequest.ProviderMetadata metadata, String customLandingPageUrl, Boolean active) throws DoiMintingException {
        if (doi == null || doi.isEmpty()) {
            throw new IllegalArgumentException("doi must not be null or empty");
        }
        if (uuid == null || uuid.isEmpty()) {
            throw new IllegalArgumentException("uuid must not be null or empty");
        }
        if (metadata == null) {
            throw new IllegalArgumentException("metadata must not be null");
        }

        String landingPageUrl;
        if (customLandingPageUrl != null) {
            landingPageUrl = generateLandingPageUrl(uuid, customLandingPageUrl);
        } else {
            landingPageUrl = null;
        }

        String requestPayload;
        try {
            requestPayload = generateRequestPayload(uuid, metadata, landingPageUrl, doi, active);
        } catch (Exception e) {
            log.error("Failed to construct the provider request payload", e);
            throw new DoiMintingException("Failed to construct the provider request payload", e);
        }

        ServiceResponse response;
        try {
            response = invokeUpdateService(doi, requestPayload, landingPageUrl);
        } catch (Exception e) {
            log.error("Failed to invoke the provider update web service", e);
            throw new DoiMintingException("Failed to invoke the provider update web service", e);
        }

        if (response != null && response.getHttpStatus() == HttpStatus.SC_OK && StringUtils.isNotEmpty(response.getDoi())) {
            log.info("DOI {} generated for local id {}: resolves to {}", response.getDoi(), uuid, landingPageUrl);
        } else {
            throw new DoiMintingException("Failed to invoke the provider update web service: " + response.getErrorMessage(), null);
        }
    }

    /**
     * Convert the provider metadata Map into whatever format is required for the web service (e.g. JSON, XML, etc)
     *
     * @param uuid The local unique identifier for the DOI
     * @param metadata The provider metadata required by the DOI Provider
     * @param landingPageUrl The landing page that the DOI needs to resolve to
     * @return The payload for the DOI minting request to be sent to the provider
     */
    abstract String generateRequestPayload(String uuid, MintRequest.ProviderMetadata metadata, String landingPageUrl, String doi, Boolean active) throws Exception;

    /**
     * Invoke the DOI provider's minting service, passing it the payload constructed in {@link #generateRequestPayload(java.lang.String, MintRequest.ProviderMetadata, java.lang.String, java.lang.String, java.lang.Boolean)}
     *
     * @param requestPayload The payload required by the provider
     * @param landingPageUrl The landing page that the DOI needs to resolve to
     * @return ServiceResponse object containing the doi if successful, or the error message, httpStatus and/or provider-specific error code if the call failed
     */
    abstract ServiceResponse invokeCreateService(Object requestPayload, String landingPageUrl) throws JsonProcessingException, JAXBException;

    /**
     * Invoke the DOI provider's update service.  The request payload or landingPageUrl may be null, which indicates
     * that they do not need to be updated.
     *
     * @param requestPayload The payload required by the provider, may be null to indicate no update
     * @param landingPageUrl The landing page that the DOI needs to resolve to, may be null to indicate no update
     * @return ServiceResponse object containing the doi if successful, or the error message, httpStatus and/or provider-specific error code if the call failed
     */
    abstract ServiceResponse invokeUpdateService(String doi, Object requestPayload, String landingPageUrl) throws JsonProcessingException;

    /**
     * Construct the final landing page url for the DOI. If a custom landing page is provided, that will be used,
     * otherwise a generic ALA DOI service landing page will be used.
     *
     * @param uuid The local unique identifier for the DOI
     * @param customLandingPageUrl A custom (application-specific) landing page to use for the DOI if desired (defaults to null)
     * @return The final landing page URL for the DOI
     */
    public String generateLandingPageUrl(String uuid, String customLandingPageUrl) {
        if (uuid == null || uuid.isEmpty()) {
            throw new IllegalArgumentException("uuid must not be null or empty");
        }

        if (StringUtils.isBlank(customLandingPageUrl)) {
            return doiBaseUrl + "/doi/" + uuid;
        }

        return customLandingPageUrl;
    }

}
