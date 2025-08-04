/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.userdata;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

@JsonIgnoreProperties(ignoreUnknown = true)
@NoArgsConstructor
@Data
@SuperBuilder
@Jacksonized
@Entity
@Table(name = "userdata")
@IdClass(UserDataId.class)
public class UserData {

    @Id
    public String userId;

    @Id
    public String key;

    public String value;

    public UserData(String userId, String key, String value) {
        this.userId = userId;
        this.key = key;
        this.value = value;
    }
}
