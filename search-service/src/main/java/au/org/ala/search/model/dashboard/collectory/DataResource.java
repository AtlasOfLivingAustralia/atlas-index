package au.org.ala.search.model.dashboard.collectory;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter
@Setter
public class DataResource {

    public String uri;
    public String name;
    public String websiteUrl;
    public String creator;
    public String dataResourceUid;
    public String rights;
}
