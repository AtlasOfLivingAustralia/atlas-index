package au.org.ala.search.model.config;

public interface ConfigChangeListener {
    void onConfigChanged(ConfigData configData, ConfigData prevConfigData);
}
