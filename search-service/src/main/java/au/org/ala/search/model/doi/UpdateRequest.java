/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.doi;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateRequest {
    MintRequest.ProviderMetadata providerMetadata;
    String customLandingPageUrl;
    String title;
    String authors;
    String description;
    String applicationUrl;
    Map applicationMetadata;
    String fileUrl;
    Boolean active;
}
