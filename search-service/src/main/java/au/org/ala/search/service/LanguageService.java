package au.org.ala.search.service;

import au.org.ala.search.model.cache.LanguageInfo;
import au.org.ala.search.model.dto.IndexedField;
import au.org.ala.search.model.dto.Rank;
import au.org.ala.search.names.RankType;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class LanguageService {

    private static final Logger logger = LoggerFactory.getLogger(LanguageService.class);
    public Map<String, LanguageInfo> languageMapping;

    @Value("${languages.path}")
    private String languagesPath;

    @PostConstruct
    void init() {
        languageMapping = new ConcurrentHashMap<>();

        if (StringUtils.isNotEmpty(languagesPath)) {
            try {
                URL url = LanguageService.class.getResource(languagesPath);
                if (url == null) {
                    url = URI.create(languagesPath).toURL();
                }

                Map sources = new ObjectMapper().readValue(url, Map.class);

                for (Object item : sources.entrySet()) {
                    Map.Entry entry = (Map.Entry) item;
                    Map<String, String> values = (Map<String, String>) entry.getValue();

                    languageMapping.put(entry.getKey().toString(), new LanguageInfo(values.get("name"), values.get("uri")));
                }
            } catch (Exception e) {
                logger.error("Failed to read language.path:" + languagesPath);
            }
        }
    }

    public LanguageInfo getLanguageInfo(String language) {
        return languageMapping.get(language);
    }
}
