/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.queue;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;
import lombok.Setter;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
@Setter
public class StatusResponse {
    public String statusUrl;
    public String downloadUrl;
    public String cancelUrl;
    public StatusCode statusCode;
    public String message;

    public StatusResponse(QueueItem queueItem, String baseUrl) {
        switch (queueItem.status) {
            case QUEUED, RUNNING -> {
                this.statusUrl = baseUrl + "?id=" + queueItem.id;
                this.cancelUrl = baseUrl + "?id=" + queueItem.id + "&cancel=true";
            }
            case FINISHED -> this.downloadUrl = baseUrl + "?id=" + queueItem.id + "&download=true";
        }

        this.statusCode = queueItem.status;
        this.message = queueItem.statusMessage;
    }
}
