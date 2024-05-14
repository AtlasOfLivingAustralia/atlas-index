package au.org.ala.search.model.queue;

import au.org.ala.search.model.TaskType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
public class DownloadRequest {
    public String filename;
    public String sourceUrl;
    public String description;
    public String email;
    public TaskType taskType;
}
