/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.banner;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for updating a banner entry via the admin API.
 */
@Data
@NoArgsConstructor
public class BannerRequest {

    @Schema(description = "UI section name, e.g. global, regions, search, dashboard, specimens, admin", example = "global", requiredMode = Schema.RequiredMode.REQUIRED)
    public String section;

    @Schema(description = "Banner message text. Use an empty string to clear the banner.", example = "Scheduled maintenance on Saturday")
    public String message;

    @Schema(description = "Severity level: INFO, WARNING or ERROR", example = "WARNING", allowableValues = {"INFO", "WARNING", "ERROR"})
    public String severity;
}

