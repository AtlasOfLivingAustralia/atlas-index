package au.org.ala.search.model.queue;

import au.org.ala.search.model.dto.SandboxIngress;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter
@Setter
public class SandboxQueueRequest extends QueueRequest {
    public SandboxIngress sandboxIngress;
}
