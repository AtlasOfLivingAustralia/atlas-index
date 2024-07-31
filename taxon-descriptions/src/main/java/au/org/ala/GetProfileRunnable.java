package au.org.ala;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

class GetProfileRunnable implements Runnable {

    String id;
    Map map;
    List<String> fields;
    List<AtomicInteger> fieldCounts;
    Map<String, Map<String, String>> properties;

    public GetProfileRunnable(String id, Map map, List<String> fields, List<AtomicInteger> fieldCounts, Map<String, Map<String, String>> properties) {
        this.id = id;
        this.map = map;
        this.fields = fields;
        this.fieldCounts = fieldCounts;
        this.properties = properties;
    }

    @Override
    public void run() {
        try {
            String guid = (String) map.get("guid");
            if (StringUtils.isNotEmpty(guid)) {

                long startTime = System.nanoTime();
                String uuid = (String) map.get("uuid");

                // additional parameters make it faster
                String response = FetchData.alaGet(FetchData.profilesUrl + "/api/opus/" + id + "/profile/" + uuid + "?includeImages=false&onlyContent=true&fullClassification=false");
                Map profile = (Map) new ObjectMapper().readValue(response, Map.class);

                Map<String, String> doc = properties.get(guid);
                if (doc == null) {
                    doc = new HashMap<>();
                    properties.put(guid, doc);

                    if (properties.size() % 200 == 0) {
                        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " - " + properties.size() + " - " + id + " - " + guid);
                    }
                }

                doc.put("url", FetchData.profilesUrl + "/opus/" + id + "/profile/" + uuid);

                for (Map attribute : (List<Map>) profile.get("attributes")) {
                    for (int i = 0; i < fields.size(); i++) {
                        String field = fields.get(i);
                        // set the field if it is not already set
                        if (attribute.get("title").equals(field) && !properties.containsKey(field) && attribute.get("text") != null) {
                            doc.put(field, attribute.get("text").toString());
                            fieldCounts.get(i).incrementAndGet();
                            break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.out.println(e.getMessage());
            e.printStackTrace();
        }
    }
}
