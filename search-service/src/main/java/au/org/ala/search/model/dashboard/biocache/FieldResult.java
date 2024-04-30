package au.org.ala.search.model.dashboard.biocache;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter
@Setter
public class FieldResult {
    public String label;
    public String i18nCode;
    public Integer count;
    public String fq;
}
