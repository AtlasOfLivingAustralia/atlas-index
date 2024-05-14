package au.org.ala.search.model.quality;

import au.org.ala.search.serializer.QualityFilterSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
@JsonSerialize(using = QualityFilterSerializer.class)
public class QualityFilter {
    Long id;
    boolean enabled;
    String description;
    String filter;
    Long displayOrder;
    String inverseFilter;
}
