package au.org.ala.search.model.queue;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
public class Status {
    public String id;
    public StatusCode statusCode;
    public String message;
    public LocalDateTime lastUpdated;
}
