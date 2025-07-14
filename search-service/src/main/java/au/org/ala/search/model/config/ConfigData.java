/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * This is the modifiable search-service config.
 * - Changes are expected.
 * - It is not appropriate to restart each instance of the search-service for each change.
 * - Changes will be to be made by admin via the API. e.g. with admin-ui.
 * - Defaults may or may not be provided.
 * - Change history is supported.
 *
 * e.g. key/value
 * dashboard.enabled={ value: true, description: "Enable the dashboard", userId: "123" }
 * dashboard.schedule={ value : 0 0 12 * * ?, description: "Schedule for the dashboard to run at noon every day", userId: "m2m" }
 *
 */
@Getter
@Setter
@Document(collection = "config")
@CompoundIndexes({
    @CompoundIndex(name = "key_created_idx", def = "{'key': 1, 'created': -1}") // for quick retrieval of latest config by key
})
public class ConfigData {
    @Id
    private String uuid;
    private String key;
    private LocalDateTime created;
    private ConfigValue data;

    public ConfigData(String key, LocalDateTime created, ConfigValue data) {
        this.uuid = UUID.randomUUID().toString();
        this.key = key;
        this.created = created;
        this.data = data;
    }
}
