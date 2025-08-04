/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.userdata;

import jakarta.persistence.Embeddable;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serializable;

/**
 * Represents a composite key for UserData entity.
 */
@Data
@EqualsAndHashCode
public class UserDataId implements Serializable {
    public String userId;
    public String key;

    public UserDataId(String userId, String id) {
        this.userId = userId;
        this.key = id;
    }
}
