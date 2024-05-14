package au.org.ala.search.model.queue;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.util.List;

@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
public class FieldguideDownloadRequest extends DownloadRequest {
    public String title;
    public String [] id;
}
