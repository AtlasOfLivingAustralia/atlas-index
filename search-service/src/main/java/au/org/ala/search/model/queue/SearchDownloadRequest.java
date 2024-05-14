package au.org.ala.search.model.queue;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter
@Setter
public class SearchDownloadRequest extends DownloadRequest {
    public String[] q;
    public String[] fields;
}
