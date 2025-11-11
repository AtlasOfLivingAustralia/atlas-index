/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.queue;

import au.org.ala.search.model.doi.Doi;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

/**
 * Model for DOI queue request payload.
 *
 * Usage differs from other queue requests
 * - tasks performed immediately upon receiving the request and are not put into any queue
 * - much of the data model is defined by the request payload
 * - task logging operates as part of the request handling, not via queue processing
 */
@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
public class DoiQueueRequest {
    public Doi doi;
}
