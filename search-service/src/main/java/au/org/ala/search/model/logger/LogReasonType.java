/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.logger;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@NoArgsConstructor
@SuperBuilder
@Data
@Entity
@Table(name = "log_reason_type")
public class LogReasonType {
    @Id
    @Column(nullable = false)
    private Integer id;

    @Column
    private String rkey;

    @Column
    private String name;

    @JsonIgnore
    @Column(name = "default_order")
    private Integer defaultOrder;

    @JsonIgnore
    @Column(name = "is_deprecated", columnDefinition = "smallint")
    private Short isDeprecated;

    @JsonProperty("deprecated")
    public boolean isDeprecated() {
        return isDeprecated != null && isDeprecated != 0;
    }

    @JsonProperty("deprecated")
    public void setDeprecated(boolean deprecated) {
        this.isDeprecated = deprecated ? (short) 1 : (short) 0;
    }
}
