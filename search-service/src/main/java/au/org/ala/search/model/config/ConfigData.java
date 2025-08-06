/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.config;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.Date;

/**
 * This is the modifiable search-service config.
 * - Changes will be to be made by admin via the API. e.g. with admin-ui.
 * - Listeners exist for validation and updating.
 * - No history.
 * - Has a notes field for comments, reasons for change, etc.
 *
 * e.g.
 * dashboard.enabled=true
 * dashboard.schedule=0 0 12 * * ?
 */
@NoArgsConstructor
@SuperBuilder
@Data
@Entity
@Table(name = "config")
public class ConfigData {
    @Id
    public String id;
    public Date updated; // the last time the value changed
    public String value; // text field for the configuration value, e.g. "true", "0 0 12 * * ?"
    public String notes; // text field for comments, reasons for change, etc.
}
