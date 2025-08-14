/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.service.auth.WebService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.entity.ContentType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Biocache service API
 */
@Slf4j
@Service
public class BiocacheApiService {

    final WebService webService;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${biocache.url}")
    private String biocacheWsUrl;

    public BiocacheApiService(WebService webService) {
        this.webService = webService;
    }

    /**
     * Get counts via taxon guids.
     *
     * <p>If the connection to the biocache fails, then an empty map is returned.
     *
     * <p>A standard filter query is applied to the
     *
     * @param guids The list of guids to get
     * @return A map of guid -> count
     */
    public Map<String, Integer> counts(List<String> guids) {
        MultiValueMap<String, String> map = new LinkedMultiValueMap<>(2);
        map.add("guids", StringUtils.join(guids, ","));
        map.add("separator", ",");

        // Performance: Switch to use an occurrences/search query to retrieve the entire facet and counts for the lft
        //  field. Then use lsid-left-right.csv to determine the actual counts for the guids.
        //  e.g. occurrences/search?q=lft:*&facets=lft&pageSize=0&flimit=-1, sort lft, and
        //  then count the returned facet occurrence value for the lft/rgt range of a given lsid.
        ResponseEntity<Map> response = restTemplate.exchange(
                biocacheWsUrl + "/occurrences/taxaCount",
                HttpMethod.POST,
                new HttpEntity<>(map, new HttpHeaders()),
                Map.class);

        if (response.getStatusCode() == HttpStatus.OK) {
            return (Map<String, Integer>) response.getBody();
        }
        return null;
    }

    public Map getSpeciesImages() {
        Map resp = webService.get(biocacheWsUrl + "/index/speciesImages", null, ContentType.APPLICATION_JSON, true, false, null);
        if (((Integer) resp.get("statusCode")) != 200) {
            log.error("failed to get {}/index/speciesImages, statusCode: {}", biocacheWsUrl, resp.get("statusCode"));
        }
        return (Map) resp.get("resp");
    }

    public Map<String, Integer> entityCounts(String facet) {
        Map resp = webService.get(biocacheWsUrl + "/occurrences/search?q=" + facet + ":*&pageSize=0&flimit=-1&facets=" + facet, null, ContentType.APPLICATION_JSON, false, false, null);
        if (((Integer) resp.get("statusCode")) != 200) {
            log.error("failed to get biocache facets for: {}, statusCode: {}", facet, resp.get("statusCode"));
            return null;
        }

        Map<String, Integer> result = new HashMap();
        List facetResults = (List) ((Map) resp.get("resp")).get("facetResults");
        for (Object item : (List) ((Map) (facetResults.get(0))).get("fieldResult")) {
            Map<String, Object> map = (Map<String, Object>) item;

            // Normally "label" is will have the value required for the facet, however entities like dataResourceUid
            // replace the ID with the name. Extract the ID from the "i18nCode" instead.
            String i18nCode = map.get("i18nCode").toString();
            result.put(i18nCode.substring(i18nCode.indexOf('.') + 1), (Integer) map.get("count"));
        }

        return result;
    }

    public List<String> getFacet(String q, String fq, String facet) throws UnsupportedEncodingException {
        List<String> result = new ArrayList<>();

        String fqTerm = fq == null ? "" : "&fq=" + URLEncoder.encode(fq, StandardCharsets.UTF_8);
        String url = biocacheWsUrl + "/occurrences/search?q=" + URLEncoder.encode(q, StandardCharsets.UTF_8) + fqTerm + "&pageSize=0&flimit=-1&facets=" + facet;
        Map resp = webService.get(url, null, ContentType.APPLICATION_JSON, false, false, null);
        if (((Integer) resp.get("statusCode")) != 200) {
            log.error("Failed biocache facet for url: {}", url);
            return result;
        }

        List facetResults = (List) ((Map) resp.get("resp")).get("facetResults");
        if (facetResults == null || facetResults.isEmpty()) {
            log.warn("No facet results found for url: {}", url);
            return result;
        }

        for (Object item : (List) ((Map) (facetResults.get(0))).get("fieldResult")) {
            Map<String, Object> map = (Map<String, Object>) item;
            result.add(map.get("label").toString());
        }

        return result;
    }

    /**
     * Image field query that will return up to 3 values for the given field, each for a different occurrence.
     *
     * @param q either this or fqs must contain 'images:*'
     * @param fqs either this or q must contain 'images:*'
     * @return
     * @throws UnsupportedEncodingException
     */
    public String[] queryImages(String q, String[] fqs) throws UnsupportedEncodingException {
        String field = "images";
        String formattedQ = URLEncoder.encode(q, StandardCharsets.UTF_8);
        StringBuilder formattedFq = new StringBuilder();
        for (String fq : fqs) {
            formattedFq.append("&fq=").append(URLEncoder.encode(fq, StandardCharsets.UTF_8));
        }
        String url = biocacheWsUrl + "/occurrences/search?q=" + formattedQ + formattedFq + "&pageSize=3&fl=" + field;
        Map resp = webService.get(url, null, ContentType.APPLICATION_JSON, false, false, null);
        if (((Integer) resp.get("statusCode")) != 200) {
            log.error("failed to get biocache response for: {}", url);
            return null;
        }

        List occurrences = (List) ((Map) resp.get("resp")).get("occurrences");
        if (occurrences == null || occurrences.isEmpty()) {
            return null;
        }

        // no need to check for nulls because due to the function comment
        String [] result = new String[occurrences.size()];
        for (int i = 0; i < occurrences.size(); i++) {
            Map occurrence = (Map) occurrences.get(i);
            if (occurrence.containsKey(field)) {
                List images = (List) occurrence.get(field);
                result[i] = (String) images.get(0);
            }
        }

        return result;
    }
}
