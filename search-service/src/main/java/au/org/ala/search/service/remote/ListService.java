package au.org.ala.search.service.remote;

import au.org.ala.search.model.dto.SetRequest;
import au.org.ala.search.service.auth.WebService;
import org.apache.http.entity.ContentType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * TODO: support new species-lists
 */
@Service
public class ListService {

    private static final Logger logger = LoggerFactory.getLogger(ListService.class);
    protected final WebService webService;
    private final RestTemplate restTemplate = new RestTemplate();
    @Value("${lists.url}")
    private String listsUrl;
    @Value("${lists.addPath}")
    private String listsAddPath;
    @Value("${lists.removePath}")
    private String listsRemovePath;

    @Value("${lists.search.max}")
    private Integer listsSearchMax;

    public ListService(WebService webService) {
        this.webService = webService;
    }

    // removes pages from existingPages as they are found
    public List<Map<String, Object>> authoritativeLists() {
        return list("isAuthoritative=eq:true");
    }

    public List<Map<String, Object>> list(String params) {
        ResponseEntity<Map> response =
                restTemplate.exchange(
                        listsUrl + "/ws/speciesList?" + params + "&max=" + listsSearchMax,
                        HttpMethod.GET,
                        null,
                        Map.class);

        if (response.getStatusCode() == HttpStatus.OK) {
            Map<String, Object> responseMap = response.getBody();
            return (List<Map<String, Object>>) responseMap.get("lists");
        } else {
            logger.error("failed to get lists for params: " + params);
        }

        return new ArrayList<>();
    }

    public List<Map<String, Object>> items(String listId) {
        ResponseEntity<List> response =
                restTemplate.exchange(
                        listsUrl + "/ws/speciesListItems/" + listId + "?includeKVP=true&max=" + listsSearchMax,
                        HttpMethod.GET,
                        null,
                        List.class);

        if (response.getStatusCode() == HttpStatus.OK) {
            return (List<Map<String, Object>>) response.getBody();
        } else {
            logger.error("failed to get list items: " + listId);
        }

        return new ArrayList<>();
    }


    public void updateItem(String listId, String listField, SetRequest setRequest) {
        // remove value
        try {
            URL url = URI.create(listsUrl + listsRemovePath).toURL();

            Map<String, Object> query = new HashMap<>();
            query.put("druid", listId);
            query.put("guid", setRequest.getTaxonID());

            webService.get(url.toString(), query, ContentType.APPLICATION_JSON, true, false, null);
        } catch (MalformedURLException e) {
            throw new RuntimeException(e);
        }

        // add value
        try {
            URL url = URI.create(listsUrl + listsAddPath).toURL();

            Map<String, Object> query = new HashMap<>();
            query.put("druid", listId);

            Map<String, Object> body = new HashMap<>();
            body.put("guid", setRequest.getTaxonID());
            body.put("rawScientificName", setRequest.getScientificName());
            body.put(listField, setRequest.getValue());

            webService.post(url.toString(), body, query, ContentType.APPLICATION_JSON, true, false, null);
        } catch (MalformedURLException e) {
            throw new RuntimeException(e);
        }
    }
}
