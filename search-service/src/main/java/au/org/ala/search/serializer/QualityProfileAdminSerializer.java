package au.org.ala.search.serializer;

import au.org.ala.search.model.quality.QualityProfileAdmin;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;

import java.io.IOException;

public class QualityProfileAdminSerializer extends StdSerializer<QualityProfileAdmin> {

    public QualityProfileAdminSerializer() {
        this(null);
    }

    public QualityProfileAdminSerializer(Class<QualityProfileAdmin> t) {
        super(t);
    }

    @Override
    public void serialize(QualityProfileAdmin qp,
                          JsonGenerator jsonGenerator,
                          SerializerProvider serializerProvider) throws IOException {
        jsonGenerator.writeStartObject();
        jsonGenerator.writeNumberField("id", qp.getId());
        jsonGenerator.writeStringField("name", qp.getName());
        jsonGenerator.writeStringField("shortName", qp.getShortName());
        jsonGenerator.writeNumberField("displayOrder", qp.getDisplayOrder());
        jsonGenerator.writeStringField("description", qp.getDescription());
        jsonGenerator.writeStringField("contactName", qp.getContactName());
        jsonGenerator.writeStringField("contactEmail", qp.getContactEmail());
        jsonGenerator.writeObjectField("categories", qp.getCategories());

        // The default serializer translates the field "isDefault" to "default", and this is a problem
        jsonGenerator.writeObjectField("isDefault", qp.isDefault());
        jsonGenerator.writeBooleanField("enabled", qp.isEnabled());
        if (qp.getDateCreated() != null) {
            jsonGenerator.writeNumberField("dateCreated", qp.getDateCreated().getTime());
        }
        if (qp.getLastUpdated() != null) {
            jsonGenerator.writeNumberField("lastUpdated", qp.getLastUpdated().getTime());
        }

        jsonGenerator.writeEndObject();
    }
}
