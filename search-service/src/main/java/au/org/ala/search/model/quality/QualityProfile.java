package au.org.ala.search.model.quality;

import au.org.ala.search.serializer.QualityCategorySerializer;
import au.org.ala.search.serializer.QualityProfileSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import org.springframework.data.annotation.Id;

import java.util.Date;
import java.util.List;

@NoArgsConstructor
@Getter
@Setter
@SuperBuilder
@Jacksonized
@Data
@JsonSerialize(using = QualityProfileSerializer.class)
@org.springframework.data.mongodb.core.mapping.Document(collection = "dqprofile")
public class QualityProfile {
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
    List<QualityCategory> categories;
}
