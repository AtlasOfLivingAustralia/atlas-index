package au.org.ala.search.model.quality;

import au.org.ala.search.serializer.QualityProfileAdminSerializer;
import au.org.ala.search.serializer.QualityProfileSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import org.springframework.data.annotation.Id;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Same as QualityProfile but with the default marshaller
 */
@NoArgsConstructor
@Getter
@Setter
@SuperBuilder
@Jacksonized
@Data
@JsonSerialize(using = QualityProfileAdminSerializer.class)
public class QualityProfileAdmin {
    @Id
    Long id;
    String name = "";
    String shortName = "";
    String description;
    String contactName;
    String contactEmail;
    boolean enabled = false;
    boolean isDefault = false;
    Long displayOrder = 0L;
    Date dateCreated = new Date();
    Date lastUpdated = new Date();
    List<QualityCategoryAdmin> categories;

    public QualityProfileAdmin(QualityProfile qualityProfile) {
        this.id = qualityProfile.id;
        this.name = qualityProfile.name;
        this.shortName = qualityProfile.shortName;
        this.description = qualityProfile.description;
        this.contactName = qualityProfile.contactName;
        this.contactEmail = qualityProfile.contactEmail;
        this.enabled = qualityProfile.enabled;
        this.isDefault = qualityProfile.isDefault;
        this.displayOrder = qualityProfile.displayOrder;
        this.dateCreated = qualityProfile.dateCreated;
        this.lastUpdated = qualityProfile.lastUpdated;
        this.categories = new ArrayList<>();
        if (qualityProfile.categories != null) {
            for (QualityCategory category : qualityProfile.categories) {
                this.categories.add(new QualityCategoryAdmin(category));
            }
        }
    }
}
