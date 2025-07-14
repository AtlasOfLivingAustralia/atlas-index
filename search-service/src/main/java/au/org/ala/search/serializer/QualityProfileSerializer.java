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

// Flattens the QualityProfile object for serialization, including only the necessary fields.
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
        if (qp.getData().getShortName() != null) jsonGenerator.writeStringField("shortName", qp.getData().getShortName());
        if (qp.getData().getDisplayOrder() != null) jsonGenerator.writeNumberField("displayOrder", qp.getData().getDisplayOrder());
        if (qp.getData().getDescription() != null) jsonGenerator.writeStringField("description", qp.getData().getDescription());
        if (qp.getData().getContactName() != null) jsonGenerator.writeStringField("contactName", qp.getData().getContactName());
        if (qp.getData().getContactEmail() != null) jsonGenerator.writeStringField("contactEmail", qp.getData().getContactEmail());
        jsonGenerator.writeObjectField("categories", qp.getData().getCategories());
        jsonGenerator.writeEndObject();
    }
}
