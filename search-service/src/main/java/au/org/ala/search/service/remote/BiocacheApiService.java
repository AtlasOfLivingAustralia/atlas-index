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
import org.springframework.stereotype.Service;

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

    @Value("${biocache.url}")
    private String biocacheWsUrl;

    @Value("${biocache.counts.fq:}")
    private String biocacheCountsFq;

    public BiocacheApiService(WebService webService) {
        this.webService = webService;
    }

    /**
     * Fetch occurrence counts grouped by {@code lft} from biocache-ws, applying {@code biocache.counts.fq}
     * (e.g. occurrenceStatus, spatiallyValid, and qualityProfile).
     *
     * <p>Returns {@code null} if the biocache request fails so callers can abort rather than
     * overwriting existing counts with zeros.
     *
     * @return A map of {@code lft -> count} (positive counts only), or {@code null} on error
     */
    public Map<Integer, Long> getLftCounts() {
        String url = biocacheWsUrl + "/occurrences/search?q=lft:*"
                + (StringUtils.isNotEmpty(biocacheCountsFq) ? biocacheCountsFq : "")
                + "&facets=lft&pageSize=0&flimit=-1";
        Map resp = webService.get(url, null, ContentType.APPLICATION_JSON, false, false, null);
        if (resp == null || !Integer.valueOf(200).equals(resp.get("statusCode"))) {
            log.error("Failed to get biocache lft counts for url: {}, statusCode: {}",
                    url, resp != null ? resp.get("statusCode") : "null");
            return null;
        }

        Map<Integer, Long> result = new HashMap<>();
        Map body = (Map) resp.get("resp");
        List facetResults = body != null ? (List) body.get("facetResults") : null;
        if (facetResults == null || facetResults.isEmpty()) {
            log.warn("No lft facet results found for url: {}", url);
            return result;
        }

        List fieldResult = (List) ((Map) facetResults.get(0)).get("fieldResult");
        if (fieldResult == null) {
            return result;
        }

        for (Object item : fieldResult) {
            Map<String, Object> map = (Map<String, Object>) item;
            Object label = map.get("label");
            Object count = map.get("count");
            if (label != null && count instanceof Number) {
                try {
                    int lft = Integer.parseInt(label.toString().trim());
                    long c = ((Number) count).longValue();
                    if (c > 0) {
                        result.put(lft, c);
                    }
                } catch (NumberFormatException ignored) {
                }
            }
        }

        return result;
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
