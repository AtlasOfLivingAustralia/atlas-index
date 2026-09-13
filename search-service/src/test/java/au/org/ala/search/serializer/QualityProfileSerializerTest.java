/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.serializer;

import au.org.ala.search.model.quality.QualityProfile;
import au.org.ala.search.util.Views;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link QualityProfileSerializer}. No Spring context, no containers — a plain
 * Jackson {@link ObjectMapper} with the serializer registered is used directly.
 */
class QualityProfileSerializerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    {
        SimpleModule module = new SimpleModule();
        module.addSerializer(QualityProfile.class, new QualityProfileSerializer());
        objectMapper.registerModule(module);
    }

    private QualityProfile sampleProfile() {
        QualityProfile qp = new QualityProfile();
        qp.setId(1L);
        qp.setShortName("test-profile");
        qp.setName("Test Profile");
        qp.setDisplayOrder(5L);
        qp.setDescription("A test profile");
        qp.setContactName("Jane Doe");
        qp.setContactEmail("jane@example.com");
        qp.setCategories(List.of());
        qp.setEnabled(true);
        qp.setDefault(false);
        qp.setDateCreated(new Date(1000L));
        qp.setLastUpdated(new Date(2000L));
        qp.setActor("test-actor");
        return qp;
    }

    @Test
    void serialize_defaultView_includesAllFields() throws Exception {
        QualityProfile qp = sampleProfile();

        String json = objectMapper.writeValueAsString(qp);
        ObjectNode node = (ObjectNode) objectMapper.readTree(json);

        assertThat(node.get("id").asLong()).isEqualTo(1L);
        assertThat(node.get("shortName").asText()).isEqualTo("test-profile");
        assertThat(node.get("name").asText()).isEqualTo("Test Profile");
        assertThat(node.get("displayOrder").asLong()).isEqualTo(5L);
        assertThat(node.get("description").asText()).isEqualTo("A test profile");
        assertThat(node.get("contactName").asText()).isEqualTo("Jane Doe");
        assertThat(node.get("contactEmail").asText()).isEqualTo("jane@example.com");
        assertThat(node.has("categories")).isTrue();
        assertThat(node.get("isDefault").asBoolean()).isFalse();
        assertThat(node.get("enabled").asBoolean()).isTrue();
        assertThat(node.get("dateCreated").asLong()).isEqualTo(1000L);
        assertThat(node.get("lastUpdated").asLong()).isEqualTo(2000L);
        assertThat(node.get("actor").asText()).isEqualTo("test-actor");
    }

    @Test
    void serialize_apiView_excludesInternalFields() throws Exception {
        QualityProfile qp = sampleProfile();

        String json = objectMapper.writerWithView(Views.Api.class).writeValueAsString(qp);
        ObjectNode node = (ObjectNode) objectMapper.readTree(json);

        assertThat(node.has("id")).isTrue();
        assertThat(node.has("shortName")).isTrue();
        assertThat(node.has("name")).isTrue();
        // internal/audit-only fields must be excluded from the API view
        assertThat(node.has("isDefault")).isFalse();
        assertThat(node.has("enabled")).isFalse();
        assertThat(node.has("dateCreated")).isFalse();
        assertThat(node.has("lastUpdated")).isFalse();
        assertThat(node.has("actor")).isFalse();
    }

    @Test
    void serialize_nullOptionalFields_omittedFromOutput() throws Exception {
        QualityProfile qp = new QualityProfile();
        qp.setId(2L);
        qp.setShortName("minimal");
        qp.setDateCreated(null);
        qp.setLastUpdated(null);
        // name, description, contactName, contactEmail, categories all left null too

        String json = objectMapper.writeValueAsString(qp);
        ObjectNode node = (ObjectNode) objectMapper.readTree(json);

        assertThat(node.has("name")).isFalse();
        assertThat(node.has("description")).isFalse();
        assertThat(node.has("contactName")).isFalse();
        assertThat(node.has("contactEmail")).isFalse();
        assertThat(node.has("categories")).isFalse();
        assertThat(node.has("dateCreated")).isFalse();
        assertThat(node.has("lastUpdated")).isFalse();
        assertThat(node.has("actor")).isFalse();
        // booleans are always written in the non-API view, even when false
        assertThat(node.has("isDefault")).isTrue();
        assertThat(node.has("enabled")).isTrue();
    }

    @Test
    void serialize_nullId_omitsIdField() throws Exception {
        QualityProfile qp = new QualityProfile();
        qp.setShortName("no-id-yet");

        String json = objectMapper.writeValueAsString(qp);
        ObjectNode node = (ObjectNode) objectMapper.readTree(json);

        assertThat(node.has("id")).isFalse();
    }
}
