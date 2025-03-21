/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.serializer;

import au.org.ala.search.model.quality.QualityCategory;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;

import java.io.IOException;

public class QualityCategorySerializer extends StdSerializer<QualityCategory> {

    public QualityCategorySerializer() {
        this(null);
    }

    public QualityCategorySerializer(Class<QualityCategory> t) {
        super(t);
    }

    @Override
    public void serialize(QualityCategory qc,
                          JsonGenerator jsonGenerator,
                          SerializerProvider serializerProvider) throws IOException {
        jsonGenerator.writeStartObject();
        jsonGenerator.writeNumberField("id", qc.getId());
        jsonGenerator.writeBooleanField("enabled", qc.isEnabled());
        jsonGenerator.writeStringField("name", qc.getName());
        jsonGenerator.writeStringField("label", qc.getLabel());
        jsonGenerator.writeStringField("description", qc.getDescription());
        jsonGenerator.writeNumberField("displayOrder", qc.getDisplayOrder());
        jsonGenerator.writeObjectField("qualityFilters", qc.getQualityFilters());
        jsonGenerator.writeStringField("inverseFilter", qc.getInverseFilter());
        jsonGenerator.writeEndObject();
    }
}
