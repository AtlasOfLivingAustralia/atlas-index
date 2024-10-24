package au.org.ala.search.service.remote;

import au.org.ala.search.service.auth.WebService;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.entity.ContentType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Biocache service API
 */
@Service
public class BiocacheService {

    private static final Logger logger = LoggerFactory.getLogger(BiocacheService.class);
    final WebService webService;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${biocache.url}")
    private String biocacheWsUrl;

    public BiocacheService(WebService webService) {
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
            logger.error("failed to get " + biocacheWsUrl + "/index/speciesImages, statusCode: " + resp.get("statusCode"));
        }
        return (Map) resp.get("resp");
    }

    public Map<String, Integer> entityCounts(String facet) {
        Map resp = webService.get(biocacheWsUrl + "/occurrences/search?q=" + facet + ":*&pageSize=0&flimit=-1&facets=" + facet, null, ContentType.APPLICATION_JSON, false, false, null);
        if (((Integer) resp.get("statusCode")) != 200) {
            logger.error("failed to get biocache facets for: " + facet + ", statusCode: " + resp.get("statusCode"));
            return null;
        }

        Map<String, Integer> result = new HashMap();
        List facetResults = (List) ((Map) resp.get("resp")).get("facetResults");
        for (Object item : (List) ((Map)(facetResults.get(0))).get("fieldResult")) {
            Map<String, Object> map = (Map<String, Object>) item;

            // Normally "label" is will have the value required for the facet, however entities like dataResourceUid
            // replace the ID with the name. Extract the ID from the "i18nCode" instead.
            String i18nCode = map.get("i18nCode").toString();
            result.put(i18nCode.substring(i18nCode.indexOf('.') + 1), (Integer) map.get("count"));
        }

        return result;
    }
}
