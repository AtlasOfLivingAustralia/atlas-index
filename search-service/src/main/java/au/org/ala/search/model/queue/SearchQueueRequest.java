package au.org.ala.search.model.queue;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter
@Setter
public class SearchQueueRequest extends QueueRequest {
    public String[] q;
    public String[] fl;
}
