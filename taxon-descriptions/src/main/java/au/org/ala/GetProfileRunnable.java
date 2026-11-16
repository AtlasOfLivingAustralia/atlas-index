package au.org.ala;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
                    doc = new LinkedHashMap<>();
                    properties.put(guid, doc);

                    if (properties.size() % 200 == 0) {
                        System.out.println(new SimpleDateFormat("HH:mm:ss:SSS").format(new Date()) + " - " + properties.size() + " - " + id + " - " + guid);
                    }
                }

                doc.put("url", FetchData.profilesUrl + "/opus/" + id + "/profile/" + uuid);

                List<Map> attributes = (List<Map>) profile.get("attributes");
                if (attributes != null) {
                    Map<String, String> attributeByTitle = new HashMap<>();
                    for (Map attribute : attributes) {
                        Object title = attribute.get("title");
                        Object text = attribute.get("text");
                        if (title != null && text != null) {
                            attributeByTitle.putIfAbsent(title.toString(), text.toString());
                        }
                    }

                    for (int i = 0; i < fields.size(); i++) {
                        String field = fields.get(i);
                        String text = attributeByTitle.get(field);
                        if (text == null) {
                            for (Map.Entry<String, String> entry : attributeByTitle.entrySet()) {
                                if (entry.getKey().equalsIgnoreCase(field)) {
                                    text = entry.getValue();
                                    break;
                                }
                            }
                        }
                        if (text != null && !doc.containsKey(field)) {
                            doc.put(field, text);
                            fieldCounts.get(i).incrementAndGet();
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
