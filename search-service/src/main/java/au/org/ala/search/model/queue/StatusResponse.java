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
    public StatusCode statusCode;
    public String message;

    public StatusResponse(Status status, String baseUrl) {
        switch (status.statusCode) {
            case QUEUED, RUNNING -> this.statusUrl = baseUrl + "?id=" + status.id;
            case FINISHED -> this.downloadUrl = baseUrl + "?id=" + status.id + "&download=true";
        }

        this.statusCode = status.statusCode;
        this.message = status.message;
    }
}
