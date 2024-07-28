package au.org.ala.search.model.sandbox;

import au.org.ala.search.model.quality.QualityCategory;
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
//@JsonSerialize(using = QualityProfileSerializer.class)
@org.springframework.data.mongodb.core.mapping.Document(collection = "sandbox")
public class SandboxUpload {
    @Id
    String id;
    String description = "";
    String userId;
    String dataResourceUid;
}
