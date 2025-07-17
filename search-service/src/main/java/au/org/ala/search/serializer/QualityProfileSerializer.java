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
import au.org.ala.search.util.Views;

// Customize Views.Api responses.
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
        boolean isApi = serializerProvider.getActiveView() == Views.Api.class;

        jsonGenerator.writeStartObject();

        if (qp.getId() != null) jsonGenerator.writeNumberField("id", qp.getId());
        if (qp.getShortName() != null) jsonGenerator.writeStringField("shortName", qp.getShortName());
        if (qp.getName() != null) jsonGenerator.writeStringField("name", qp.getName());
        if (qp.getDisplayOrder() != null)
            jsonGenerator.writeNumberField("displayOrder", qp.getDisplayOrder());
        if (qp.getDescription() != null)
            jsonGenerator.writeStringField("description", qp.getDescription());
        if (qp.getContactName() != null)
            jsonGenerator.writeStringField("contactName", qp.getContactName());
        if (qp.getContactEmail() != null)
            jsonGenerator.writeStringField("contactEmail", qp.getContactEmail());
        if (qp.getCategories() != null)
            jsonGenerator.writeObjectField("categories", qp.getCategories());

        if (!isApi) {
            jsonGenerator.writeBooleanField("isDefault", qp.isDefault());
            jsonGenerator.writeBooleanField("enabled", qp.isEnabled());
            if (qp.getDateCreated() != null)
                jsonGenerator.writeStringField("dateCreated", qp.getDateCreated().toString());
            if (qp.getLastUpdated() != null)
                jsonGenerator.writeStringField("lastUpdated", qp.getLastUpdated().toString());
        }

        jsonGenerator.writeEndObject();
    }
}
