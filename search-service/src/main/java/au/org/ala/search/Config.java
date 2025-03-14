package au.org.ala.search;

import au.org.ala.search.model.SearchItemIndex;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;
import org.springframework.data.elasticsearch.client.ClientConfiguration;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration;
import org.springframework.data.elasticsearch.core.convert.ElasticsearchCustomConversions;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;
import java.util.*;

@Configuration
public class Config extends ElasticsearchConfiguration {
    private static final Logger logger = LoggerFactory.getLogger(Config.class);

    @Value("${elastic.host}")
    private String elasticHost;

    @Value("${elastic.timeout}")
    private Long elasticTimeout;

    @NotNull
    @Override
    public ClientConfiguration clientConfiguration() {
        return ClientConfiguration.builder()
                .connectedTo(elasticHost)
                .withSocketTimeout(elasticTimeout)
                .build();
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    @Bean
    @Override
    public ElasticsearchCustomConversions elasticsearchCustomConversions() {
        return new ElasticsearchCustomConversions(
                Arrays.asList(new SearchItemIndexToElasticsearchConverter(), new ElasticsearchToSearchItemIndexConverter()));
    }

    @WritingConverter
    public class SearchItemIndexToElasticsearchConverter implements Converter<SearchItemIndex, Map<String, Object>> {
        @Override
        public Map<String, Object> convert(SearchItemIndex source) {
            Map<String, Object> target = new HashMap<>();

            for (int i = 0; i < SearchItemIndex.class.getFields().length; i++) {
                try {
                    Field f = SearchItemIndex.class.getFields()[i];
                    Object obj = f.get(source);
                    if (obj == null) {
                        continue;
                    }

                    // use name to detect dynamic fields
                    if (f.getName().endsWith("Fields")) {
                        // convert to map
                        Map<String, String> fields = (Map<String, String>) obj;
                        if (fields != null) {
                            target.putAll(fields);
                        }
                    } else {
                        target.put(f.getName(), obj);
                    }
                } catch (Exception ignored) {
                }
            }

            return target;
        }
    }

    @ReadingConverter
    public class ElasticsearchToSearchItemIndexConverter implements Converter<Map<String, Object>, SearchItemIndex> {
        @Override
        public SearchItemIndex convert(Map<String, Object> source) {
            SearchItemIndex target = new SearchItemIndex();

            // standard fields
            for (int i = 0; i < SearchItemIndex.class.getFields().length; i++) {
                Field f = SearchItemIndex.class.getFields()[i];
                try {
                    Object obj = source.get(f.getName());

                    if (obj == null) {
                        continue;
                    }

                    if (f.getType().equals(Date.class)) {
                        obj = new Date((Long) obj);
                    } else if (obj instanceof List && f.getType().equals(String[].class)) {
                        obj = ((List) obj).toArray(new String[0]);
                    }

                    f.set(target, obj);
                } catch (Exception ignored) {
                    logger.error("Failed to set field: " + f.getName());
                }
            }

            for (Map.Entry<String, Object> key : source.entrySet()) {
                try {
                    // check for dynamic fields, default to standard fields
                    if (key.getKey().startsWith("sds_")) {
                        if (target.sdsFields == null) {
                            target.sdsFields = new HashMap<>();
                        }
                        target.sdsFields.put(key.getKey(), key.getValue().toString());
                    } else if (key.getKey().startsWith("iucn_")) {
                        if (target.iucnFields == null) {
                            target.iucnFields = new HashMap<>();
                        }
                        target.iucnFields.put(key.getKey(), key.getValue().toString());
                    } else if (key.getKey().startsWith("conservation_")) {
                        if (target.conservationFields == null) {
                            target.conservationFields = new HashMap<>();
                        }
                        target.conservationFields.put(key.getKey(), key.getValue().toString());
                    } else if (key.getKey().startsWith("rk")) {
                        if (target.rkFields == null) {
                            target.rkFields = new HashMap<>();
                        }
                        target.rkFields.put(key.getKey(), key.getValue().toString());
                    } else {
                        Field f = SearchItemIndex.class.getField(key.getKey());

                        if (f.getType().equals(Date.class)) {
                            f.set(target, new Date((Long) key.getValue()));
                        } else if (key.getValue() instanceof List && f.getType().equals(String[].class)) {
                            f.set(target, ((List) key.getValue()).toArray(new String[0]));
                        } else {
                            f.set(target, key.getValue());
                        }
                    }
                } catch (NoSuchFieldException | IllegalAccessException e) {
                    // This error can be thrown when a field was added to elasticsearch but was not yet added to the
                    // model SearchItemIndex.
                    logger.warn("Failed to set field: " + key.getKey());
                }
            }

            return target;
        }
    }
}
