package au.org.ala.search.model.config;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ConfigValue {
    public String userId;
    public String value; // empty string values are allowed
    public String description;
}
