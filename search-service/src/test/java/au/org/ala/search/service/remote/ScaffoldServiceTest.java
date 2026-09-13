/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.repo.LogEventTypeRepository;
import au.org.ala.search.repo.LogReasonTypeRepository;
import au.org.ala.search.repo.LogSourceTypeRepository;
import au.org.ala.search.repo.TaxonDataPostgresRepository;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/**
 * Pure-logic unit tests for {@link ScaffoldService}'s field/schema mapping and id
 * parsing/validation helpers. No Spring context, no containers, no database interaction —
 * the repository constructor dependencies are Mockito mocks that are never invoked by the
 * methods under test, and private helper methods are exercised via reflection.
 */
class ScaffoldServiceTest {

    private final ScaffoldService scaffoldService = new ScaffoldService(
            mock(LogEventTypeRepository.class),
            mock(LogReasonTypeRepository.class),
            mock(LogSourceTypeRepository.class),
            mock(TaxonDataPostgresRepository.class),
            new AuditService(null));

    @Test
    void fieldDef_toMap_includesAllProperties() {
        ScaffoldService.FieldDef field =
                new ScaffoldService.FieldDef("id", ScaffoldService.TYPE_INT, true, true, false);

        Map<String, Object> map = field.toMap();

        assertThat(map)
                .containsEntry("name", "id")
                .containsEntry("type", ScaffoldService.TYPE_INT)
                .containsEntry("required", true)
                .containsEntry("primaryKey", true)
                .containsEntry("readOnly", false);
    }

    @Test
    void tableDescriptor_schemaMap_includesTableLabelAndFields() {
        ScaffoldService.FieldDef idField =
                new ScaffoldService.FieldDef("id", ScaffoldService.TYPE_INT, true, true, false);
        ScaffoldService.FieldDef nameField =
                new ScaffoldService.FieldDef("name", ScaffoldService.TYPE_STRING, true, false, false);

        ScaffoldService.TableDescriptor descriptor = new ScaffoldService.TableDescriptor(
                "my_table", "My Table", List.of(idField, nameField),
                mock(LogEventTypeRepository.class), au.org.ala.search.model.logger.LogEventType.class);

        Map<String, Object> schema = descriptor.schemaMap();

        assertThat(schema).containsEntry("table", "my_table").containsEntry("label", "My Table");

        List<Map<String, Object>> fields =
                (List<Map<String, Object>>) schema.get("fields");
        assertThat(fields).hasSize(2);
        assertThat(fields.get(0)).containsEntry("name", "id");
        assertThat(fields.get(1)).containsEntry("name", "name");
    }

    private Object invokeRequireTable(String table) throws Exception {
        Method m = ScaffoldService.class.getDeclaredMethod("requireTable", String.class);
        m.setAccessible(true);
        try {
            return m.invoke(scaffoldService, table);
        } catch (java.lang.reflect.InvocationTargetException e) {
            throw (Exception) e.getCause();
        }
    }

    @Test
    void requireTable_knownTable_returnsDescriptor() throws Exception {
        Object descriptor = invokeRequireTable("log_event_type");

        assertThat(descriptor).isNotNull();
        Field tableNameField = descriptor.getClass().getField("tableName");
        assertThat(tableNameField.get(descriptor)).isEqualTo("log_event_type");
    }

    @Test
    void requireTable_unknownTable_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> invokeRequireTable("not_a_real_table"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown table");
    }

    @Test
    void listTables_includesAllRegisteredTables() {
        var tables = scaffoldService.listTables();

        assertThat(tables)
                .extracting(t -> t.get("table"))
                .contains("log_event_type", "log_reason_type", "log_source_type", "taxon_data");
    }

    private Object invokeParseId(Object descriptor, String rawId) throws Exception {
        Method m = ScaffoldService.class.getDeclaredMethod(
                "parseId", ScaffoldService.TableDescriptor.class, String.class);
        m.setAccessible(true);
        try {
            return m.invoke(scaffoldService, descriptor, rawId);
        } catch (java.lang.reflect.InvocationTargetException e) {
            throw (Exception) e.getCause();
        }
    }

    private Object requireTableDescriptor(String table) throws Exception {
        return invokeRequireTable(table);
    }

    @Test
    void parseId_simpleIntegerKey_parsesToInteger() throws Exception {
        Object descriptor = requireTableDescriptor("log_event_type");

        Object id = invokeParseId(descriptor, "42");

        assertThat(id).isEqualTo(42);
    }

    @Test
    void parseId_simpleIntegerKey_nonNumeric_returnsRawString() throws Exception {
        Object descriptor = requireTableDescriptor("log_event_type");

        Object id = invokeParseId(descriptor, "not-a-number");

        assertThat(id).isEqualTo("not-a-number");
    }

    @Test
    void parseId_compositeKey_splitsOnColonIntoIdObject() throws Exception {
        Object descriptor = requireTableDescriptor("taxon_data");

        Object id = invokeParseId(descriptor, "urn:lsid:example:123:mykey");

        // TaxonDataId(taxonConceptId, key) — for a 2-field composite key, parseId splits on the
        // *first* colon only: everything before it is taxonConceptId, the remainder is key.
        Field taxonConceptIdField = id.getClass().getField("taxonConceptId");
        Field keyField = id.getClass().getField("key");
        assertThat(taxonConceptIdField.get(id)).isEqualTo("urn");
        assertThat(keyField.get(id)).isEqualTo("lsid:example:123:mykey");
    }

    @Test
    void parseId_compositeKey_missingSeparator_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> {
            Object descriptor = requireTableDescriptor("taxon_data");
            invokeParseId(descriptor, "no-colon-here");
        })
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cannot parse composite id");
    }
}
