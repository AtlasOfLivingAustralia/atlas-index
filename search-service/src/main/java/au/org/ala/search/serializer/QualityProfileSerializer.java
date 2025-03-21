/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.serializer;

import au.org.ala.search.model.quality.QualityProfile;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;

import java.io.IOException;

public class QualityProfileSerializer extends StdSerializer<QualityProfile> {

    public QualityProfileSerializer() {
        this(null);
    }

    public QualityProfileSerializer(Class<QualityProfile> t) {
        super(t);
    }

    @Override
    public void serialize(QualityProfile qp,
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
        jsonGenerator.writeEndObject();
    }
}
