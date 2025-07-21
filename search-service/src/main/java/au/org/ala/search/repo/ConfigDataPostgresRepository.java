/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.config.ConfigData;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository interface for managing configuration data in Postgresql.
 *
 * This is intended for use by ConfigService only.
 */
public interface ConfigDataPostgresRepository extends JpaRepository<ConfigData, String> {
}
