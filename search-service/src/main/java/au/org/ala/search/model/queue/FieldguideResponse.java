/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.queue;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;
import lombok.Setter;

import java.net.MalformedURLException;
import java.net.URI;
import java.util.Locale;

/**
 * Response object for field guide V1 API requests.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
@Setter
public class FieldguideResponse {
    public String statusUrl;
    public String downloadUrl;
    public String status;

    public FieldguideResponse(QueueItem queueItem, String baseUrl) throws MalformedURLException {
        switch (queueItem.status) {
            case QUEUED, RUNNING -> this.statusUrl = baseUrl + "/v1/fieldguide/status/" + queueItem.id;
            case FINISHED -> this.downloadUrl = baseUrl + "/v1/fieldguide/download/" + queueItem.id;
        }
        this.status = queueItem.status.name().toLowerCase();
    }
}
