package au.org.ala.search.service.remote;

import au.org.ala.search.LeadershipStatus;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.config.ConfigChangeListener;
import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.model.config.ConfigValidationListener;
import au.org.ala.search.repo.ConfigDataPostgresRepository;
import au.org.ala.search.service.queue.BroadcastService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for managing configuration data stored in MongoDB.
 * - handles retrieval of the latest and history of a dynamic configuration key.
 * - managers listeners of configuration changes.
 */
@Slf4j
@Service
public class ConfigService {
    private final ConfigDataPostgresRepository configDataPostgresRepository;
    private final ResourceLoader resourceLoader;
    private final Map<String, Set<ConfigChangeListener>> listeners = new ConcurrentHashMap<>();
    private final Map<String, Set<ConfigValidationListener>> validationListeners = new ConcurrentHashMap<>();

    @Value("${dynamic-config-defaults.path}")
    private String dynamicConfigDefaultsPath;

    public ConfigService(ConfigDataPostgresRepository configDataPostgresRepository, ResourceLoader resourceLoader) {
        this.configDataPostgresRepository = configDataPostgresRepository;
        this.resourceLoader = resourceLoader;
    }

    @PostConstruct
    public void init() {
        // open the dynamic config defaults file and load it into the database
        try {
            // read the properties file containing the defaults, and iterate line by line
            Resource resource = resourceLoader.getResource(dynamicConfigDefaultsPath);
            Properties properties = new Properties();
            try (InputStream input = resource.getInputStream()) {
                properties.load(input);
            }

            for (String key : properties.stringPropertyNames()) {
                ConfigData cd = get(key);
                if (cd != null) {
                    // If the config already exists, skip it
                    continue;
                }

                String value = properties.getProperty(key);
                String notes = "Default value loaded from " + dynamicConfigDefaultsPath;

                ConfigData newConfigData = ConfigData.builder().id(key)
                        .value(value)
                        .notes(notes)
                        .updated(new Date())
                        .build();

                configDataPostgresRepository.save(newConfigData);
            }
        } catch (Exception e) {
            log.error("Failed to load dynamic config defaults from {}: {}", dynamicConfigDefaultsPath, e.getMessage(), e);
        }
    }

    public ConfigData get(String id) {
        return configDataPostgresRepository.findById(id).orElse(null);
    }

    // throws a description of the error if the config data is not valid
    public void save(ConfigData configData) {
        // Enforce mandatory fields and non-empty data fields
        if (StringUtils.isEmpty(configData.id) || StringUtils.isEmpty(configData.value)) {
            throw new IllegalArgumentException("Config data must contain an 'id' and 'value'.");
        }

        ConfigData prevConfigData = get(configData.id);

        // compare with previous config data for "value" changes
        if (prevConfigData != null) {
            if (StringUtils.equals(prevConfigData.value, configData.value)) {
                // No change in value, save the notes if changed
                if (!StringUtils.equals(configData.notes, prevConfigData.notes)) {
                    prevConfigData.setNotes(configData.notes);
                    configDataPostgresRepository.save(prevConfigData);
                }
                return;
            }
        }

        if (!triggerValidation(configData)) {
            throw new IllegalArgumentException("Config value is invalid.");
        }

        configData.setUpdated(new Date());
        configDataPostgresRepository.save(configData);

        // Broadcast the change, for any node that listens for config changes
        try {
            if (BroadcastService.getInstance() != null) {
                BroadcastService.getInstance().sendMessage(TaskType.CONFIG_CHANGE, prevConfigData); // new config data is in the db
            } else {
                log.warn("BroadcastService is not initialized, cannot broadcast config change for {}", configData.id);
            }
        } catch (Exception e) {
            log.error("Failed to broadcast config change for {}: {}", configData.id, e.getMessage(), e);
        }
    }

    public void registerListener(String key, ConfigChangeListener listener, ConfigValidationListener validation) {
        if (listener != null) {
            listeners.computeIfAbsent(key, k -> Collections.synchronizedSet(new HashSet<>())).add(listener);
        }

        if (validation != null) {
            validationListeners.computeIfAbsent(key, k -> Collections.synchronizedSet(new HashSet<>())).add(validation);
        }
    }

    // triggered by BroadcastService when a config change is received
    public void triggerListeners(ConfigData configData, ConfigData prevConfigData) {
        Set<ConfigChangeListener> keyListeners = listeners.get(configData.id);
        if (keyListeners != null) {
            // copy into an array on the off chance keyListeners is modified during iteration
            for (ConfigChangeListener listener : new ArrayList<>(keyListeners)) {
                listener.onConfigChanged(configData, prevConfigData);
            }
        }
    }

    private boolean triggerValidation(ConfigData configData) {
        Set<ConfigValidationListener> keyValidationListeners = validationListeners.get(configData.id);
        if (keyValidationListeners != null) {
            // copy into an array on the off chance keyListeners is modified during iteration
            for (ConfigValidationListener validationListener : new ArrayList<>(keyValidationListeners)) {
                if (!validationListener.isValid(configData.value)) {
                    return false;
                }
            }
        }
        return true;
    }

    public List<ConfigData> getAll() {
        return configDataPostgresRepository.findAll();
    }
}
