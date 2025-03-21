/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.sandbox;

import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import org.springframework.data.annotation.Id;


@NoArgsConstructor
@Getter
@Setter
@SuperBuilder
@Jacksonized
@Data
@org.springframework.data.mongodb.core.mapping.Document(collection = "sandbox")
public class SandboxUpload {
    @Id
    String id;
    String description = "";
    String userId;
    String dataResourceUid;
}
