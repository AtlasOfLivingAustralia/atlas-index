package au.org.ala.search.model.queue;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
public class FieldguideQueueRequest extends QueueRequest {
    public String title;
    public String [] id;
}
