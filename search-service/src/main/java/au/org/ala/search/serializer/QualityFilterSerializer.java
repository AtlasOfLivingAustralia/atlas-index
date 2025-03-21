/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.serializer;

import au.org.ala.search.model.quality.QualityFilter;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;

import java.io.IOException;

public class QualityFilterSerializer extends StdSerializer<QualityFilter> {

    public QualityFilterSerializer() {
        this(null);
    }

    public QualityFilterSerializer(Class<QualityFilter> t) {
        super(t);
    }

    @Override
    public void serialize(QualityFilter qf,
                          JsonGenerator jsonGenerator,
                          SerializerProvider serializerProvider) throws IOException {
        jsonGenerator.writeStartObject();
        jsonGenerator.writeNumberField("id", qf.getId());
        jsonGenerator.writeBooleanField("enabled", qf.isEnabled());
        jsonGenerator.writeStringField("description", qf.getDescription());
        jsonGenerator.writeObjectField("filter", qf.getFilter());
        jsonGenerator.writeNumberField("displayOrder", qf.getDisplayOrder());
        jsonGenerator.writeEndObject();
    }
}
