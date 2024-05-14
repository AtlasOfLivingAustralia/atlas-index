package au.org.ala.search.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@NoArgsConstructor
@Getter
@Setter
public class FieldguideRequest {
    public String title;
    public List<String> guids;
    public String link;
}
