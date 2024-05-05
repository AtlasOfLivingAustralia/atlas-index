package au.org.ala.search.model.dashboard.spatial;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter
@Setter
public class SpatialLayer {
    public String domain;
    public String type;
    public String classification1;
    public Boolean enabled;
}
