/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.doi;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.doi.DoiPayloadBuilder;
import au.org.ala.search.model.doi.MintRequest;
import au.org.ala.search.service.remote.LogService;
import au.org.ala.search.util.doi.ServiceResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * DataCite DOI Provider Service implementation. Based on doi-service API.
 * <p>
 * TODO: review for exceptions and if retries are required
 *
 */
@Slf4j
@Service
public class DataCiteService extends DoiProviderService {

    private final LogService logService;

    @Autowired
    public DataCiteService(LogService logService) {
        this.logService = logService;
    }

    private String baseUrl;
    private String authHeader;
    private HttpClient httpClient;

    @Value("${datacite.doi.service.baseApiUrl}")
    String apiBaseUrl;
    @Value("${datacite.doi.service.user}")
    String apiUser;
    @Value("${datacite.doi.service.password}")
    String apiPassword;
    @Value("${datacite.doi.service.timeout}")
    Integer apiTimeout;

    @Value("${datacite.doi.service.prefix}") // 10.xxxx
    String prefix;
    @Value("${datacite.doi.service.shoulder}") // ala
    String shoulder;
    @Value("${doi.publicationLang}") // en
    String publicationLang;

    @PostConstruct
    public void init() {
        this.baseUrl = apiBaseUrl.endsWith("/") ? apiBaseUrl.substring(0, apiBaseUrl.length() - 1) : apiBaseUrl;
        String credentials = apiUser + ":" + apiPassword;
        this.authHeader = "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
        this.httpClient = HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(apiTimeout)).build();
    }

    public String generateRequestPayload(String uuid, MintRequest.ProviderMetadata metadata, String landingPageUrl, String doi, Boolean active) throws Exception {
        // metadata may be null when when updating existing DOIs
        List<String> creatorNames = null;
        List<String> titleNames = null;
        Integer publicationYear = null;
        List<String> subjects = null;
        Map<String, String> types = null;
        if (metadata != null) {
            // collect creator names
            creatorNames = new ArrayList<>();
            if (metadata.creators != null) {
                creatorNames.addAll(metadata.creators.stream().map(c -> c.name).toList());
            }
            if (metadata.authors != null) {
                creatorNames.addAll(metadata.authors);
            }

            // collect title names
            titleNames = new ArrayList<>();
            if (metadata.titles != null) {
                titleNames.addAll(metadata.titles.stream().map(t -> t.title).toList());
            }
            if (StringUtils.isNotEmpty(metadata.title)) {
                titleNames.add(metadata.title);
            }
            if (metadata.subtitle != null) {
                titleNames.add(metadata.subtitle);
            }

            publicationYear = StringUtils.isNotEmpty(metadata.publicationYear) ?
                    Integer.parseInt(metadata.publicationYear) : Calendar.getInstance().get(Calendar.YEAR);

            subjects = new ArrayList<>();
            if (metadata.subjects != null) {
                subjects.addAll(metadata.subjects);
            }

            types = Map.of(
                    "resourceType", metadata.resourceText,
                    "resourceTypeGeneral", DoiPayloadBuilder.ResourceType.fromValue(metadata.resourceType)
            );
        }

        String json = new DoiPayloadBuilder()
                .event(active ? DOIStatus.PUBLISH.value : DOIStatus.REGISTER.value)
                .doi(doi != null ? doi : prefix + "/" + shoulder + "." + uuid)
                .creators(creatorNames)
                .titles(titleNames)
                .publisher(metadata != null ? metadata.publisher : null)
                .publicationYear(publicationYear)
                .subjects(subjects)
                .contributors(metadata != null ? metadata.contributors : null)
                .descriptions(metadata != null ? metadata.descriptions : null)
                .types(types)
                .date(metadata != null ? metadata.createdDate : null, "Created")
                .language(publicationLang)
                .rightsList(metadata != null ? metadata.rights : null)
                .url(landingPageUrl)
                .build();

        return json;
    }

    @Override
    public ServiceResponse invokeCreateService(Object requestPayload, String landingPageUrl) throws JsonProcessingException {
        // extract doi from payload
        ObjectMapper mapper = new ObjectMapper();
        Map payloadMap = mapper.readValue((String) requestPayload, Map.class);
        Map dataMap = (Map) payloadMap.get("data");
        Map attributesMap = (Map) dataMap.get("attributes");
        String doi = (String) attributesMap.get("doi");

        try {
            createDOI((String) requestPayload, doi);
            return successResponse(doi);
        } catch (IOException | InterruptedException e) {
            log.error("Exception minting DOI {}, message: {}", doi, e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }

    @Override
    ServiceResponse invokeUpdateService(String doiS, Object requestPayload, String landingPageUrl) {
        try {
            updateDOI(doiS, (String) requestPayload);
            return successResponse(doiS);
        } catch (IOException | InterruptedException e) {
            log.error("Exception updating DOI {}, message: {}", doiS, e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }

    ServiceResponse successResponse(String doi) {
        ServiceResponse response = new ServiceResponse(HttpStatus.SC_OK, "", "");
        log.info("Success processing DOI {}", doi);
        response.setDoi(doi);
        return response;
    }

    /**
     * DOI Status enum representing the three possible states
     */
    public enum DOIStatus {
        HIDE("hide"), // Triggers a state move from findable to registered
        REGISTER("register"), // Triggers a state move from draft to registered
        PUBLISH("publish"); // Triggers a state move from draft or registered to findable

        private final String value;

        DOIStatus(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Get a DOI by its identifier. Needed when fetching existing DOI details when that doi is not findable.
     * <p>
     * TODO: currently not used, might be helpful as should there be a non-findable DOI due to an error elsewhere.
     *
     * @param doi The DOI identifier (e.g., "10.5072/example-doi")
     * @return JSON response as String
     * @throws IOException          if request fails
     * @throws InterruptedException if request is interrupted
     */
    public String getDOI(String doi) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/dois/" + doi))
                .header("Authorization", authHeader)
                .header("Content-Type", "application/vnd.api+json")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400) {
            throw new IOException("Failed to get DOI. Status: " + response.statusCode() + ", Body: " + response.body());
        }

        return response.body();
    }

    /**
     * Create a new DOI
     *
     * @param doiJson JSON payload for DOI creation (following DataCite JSON API format)
     * @return JSON response as String
     * @throws IOException          if request fails
     * @throws InterruptedException if request is interrupted
     */
    public String createDOI(String doiJson, String doi) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/dois"))
                .header("Authorization", authHeader)
                .header("Content-Type", "application/vnd.api+json")
                .POST(HttpRequest.BodyPublishers.ofString(doiJson))
                .build();

        log.info("DOI creation request body: {}", doiJson);

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 201) {
            logService.log(TaskType.DOI_REQUEST, "Failed to mint DOI with provider. Status: " + response.statusCode() + ", doi: " + doi + ", Body: " + response.body());
            throw new IOException("Failed to create DOI. Status: " + response.statusCode() + ", Body: " + response.body());
        }

        // log the response body
        log.info("DOI creation response body: {}", response.body());

        return response.body();
    }

    /**
     * Update an existing DOI
     *
     * @param doi     The DOI identifier (e.g., "10.5072/example-doi")
     * @param doiJson JSON payload for DOI update (following DataCite JSON API format)
     * @return JSON response as String
     * @throws IOException          if request fails
     * @throws InterruptedException if request is interrupted
     */
    public String updateDOI(String doi, String doiJson) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/dois/" + doi))
                .header("Authorization", authHeader)
                .header("Content-Type", "application/vnd.api+json")
                .PUT(HttpRequest.BodyPublishers.ofString(doiJson))
                .build();

        log.info("DOI update request body: {}", doiJson);

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            logService.log(TaskType.DOI_REQUEST, "Failed to update DOI with provider. Status: " + response.statusCode() + ", doi: " + doi + ", Body: " + response.body());
            throw new IOException("Failed to update DOI. Status: " + response.statusCode() + ", Body: " + response.body());
        }

        return response.body();
    }
}
