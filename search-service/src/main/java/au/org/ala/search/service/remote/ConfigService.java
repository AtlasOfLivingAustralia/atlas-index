package au.org.ala.search.service.remote;

import au.org.ala.search.model.config.ConfigChangeListener;
import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.model.config.ConfigValidationListener;
import au.org.ala.search.repo.ConfigDataMongoRepository;
import jakarta.annotation.PostConstruct;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for managing configuration data stored in MongoDB.
 * - handles retrieval of the latest and history of a dynamic configuration key.
 * - managers listeners of configuration changes.
 */
@Service
public class ConfigService {
    private final ConfigDataMongoRepository configDataMongoRepository;
    private final Map<String, List<ConfigChangeListener>> listeners = new ConcurrentHashMap<>();
    private final Map<String, List<ConfigValidationListener>> validationListeners = new ConcurrentHashMap<>();

    public ConfigService(ConfigDataMongoRepository repo) {
        this.configDataMongoRepository = repo;
    }

    @PostConstruct
    public void init() {
        // TODO: if absent, add default values into the db
    }

    public String get(String key) {
        ConfigData cd = configDataMongoRepository.getLatest(key);
        if (cd != null && cd.getData() != null) {
            return cd.getData().value;
        }
        return null;
    }

    public List<ConfigData> history(String key) {
        return configDataMongoRepository.findAllByKeyOrderByCreatedDesc(key);
    }

    public void save(ConfigData configData) {
        // Enforce mandatory fields and non-empty data fields
        if (configData.getData() == null
                || StringUtils.isEmpty(configData.getData().description)
                || StringUtils.isEmpty(configData.getData().userId)) {
            throw new IllegalArgumentException("Config data must contain 'description', 'userId'.");
        }
        if (configData.getKey() == null || configData.getKey().isEmpty()) {
            throw new IllegalArgumentException("Config key must not be null or empty.");
        }

        ConfigData prevConfigData = configDataMongoRepository.getLatest(configData.getKey());

        // compare with previous config data for "value" changes
        if (prevConfigData != null && prevConfigData.getData() != null) {
            String prevValue = prevConfigData.getData().value;
            String newValue = configData.getData().value;
            if (newValue.equals(prevValue)) {
                // No change in value, do not save
                return;
            }
        }

        if (!triggerValidation(configData)) {
            throw new IllegalArgumentException("Config value is invalid.");
        }

        configData.setCreated(java.time.LocalDateTime.now());
        configDataMongoRepository.save(configData);

        // Apply the configuration change to the system
        triggerListeners(configData, prevConfigData);
    }

    public void registerListener(String key, ConfigChangeListener listener, ConfigValidationListener validation) {
        if (listener != null) {
            listeners.computeIfAbsent(key, k -> Collections.synchronizedList(new ArrayList<>())).add(listener);
        }

        if (validation != null) {
            validationListeners.computeIfAbsent(key, k -> Collections.synchronizedList(new ArrayList<>())).add(validation);
        }
    }

    private void triggerListeners(ConfigData configData, ConfigData prevConfigData) {
        List<ConfigChangeListener> keyListeners = listeners.get(configData.getKey());
        if (keyListeners != null) {
            for (ConfigChangeListener listener : keyListeners) {
                listener.onConfigChanged(configData, prevConfigData);
            }
        }
    }

    private boolean triggerValidation(ConfigData configData) {
        List<ConfigValidationListener> keyValidationListeners = validationListeners.get(configData.getKey());
        if (keyValidationListeners != null) {
            for (ConfigValidationListener validationListener : keyValidationListeners) {
                if (!validationListener.isValid(configData.getData().value)) {
                    return false;
                }
            }
        }
        return true;
    }

}
