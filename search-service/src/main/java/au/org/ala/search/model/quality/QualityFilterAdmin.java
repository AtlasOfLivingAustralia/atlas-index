package au.org.ala.search.model.quality;

import au.org.ala.search.serializer.QualityFilterSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

/**
 * Same as QualityFilter but with the default marshaller
 */
@SuperBuilder
@NoArgsConstructor
@Getter
@Setter
public class QualityFilterAdmin {
    Long id;
    boolean enabled;
    String description;
    String filter;
    Long displayOrder;
    String inverseFilter;

    public QualityFilterAdmin(QualityFilter qualityFilter) {
        this.id = qualityFilter.id;
        this.enabled = qualityFilter.enabled;
        this.description = qualityFilter.description;
        this.filter = qualityFilter.filter;
        this.displayOrder = qualityFilter.displayOrder;
        this.inverseFilter = qualityFilter.inverseFilter;
    }
}
