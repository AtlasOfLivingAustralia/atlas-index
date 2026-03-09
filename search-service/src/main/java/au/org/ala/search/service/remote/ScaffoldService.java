/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.logger.LogEventType;
import au.org.ala.search.model.logger.LogReasonType;
import au.org.ala.search.model.logger.LogSourceType;
import au.org.ala.search.repo.LogEventTypeRepository;
import au.org.ala.search.repo.LogReasonTypeRepository;
import au.org.ala.search.repo.LogSourceTypeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Generic scaffold service — provides paged GET, upsert (POST) and DELETE for
 * nominated reference tables. Adding a new table only requires registering a
 * new {@link TableDescriptor} in the constructor.
 *
 * <p>The GET response includes a {@code schema} block that the UI uses to
 * render the edit form without hard-coding field names or types.</p>
 */
@Slf4j
@Service
public class ScaffoldService {

    // -------------------------------------------------------------------------
    // Schema / field-type constants used by the UI
    // -------------------------------------------------------------------------
    public static final String TYPE_INT     = "int";
    public static final String TYPE_STRING  = "string";
    public static final String TYPE_BOOLEAN = "boolean";

    // -------------------------------------------------------------------------
    // Table descriptor — one per registered table
    // -------------------------------------------------------------------------

    /**
     * Describes a single editable table: its id field, its columns (for schema),
     * and the JPA repository that backs it.
     */
    public static class FieldDef {
        public final String name;
        public final String type;
        public final boolean required;
        public final boolean primaryKey;
        public final boolean readOnly; // shown but not editable (e.g. id managed by sequence)

        public FieldDef(String name, String type, boolean required, boolean primaryKey, boolean readOnly) {
            this.name = name;
            this.type = type;
            this.required = required;
            this.primaryKey = primaryKey;
            this.readOnly = readOnly;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", name);
            m.put("type", type);
            m.put("required", required);
            m.put("primaryKey", primaryKey);
            m.put("readOnly", readOnly);
            return m;
        }
    }

    public static class TableDescriptor {
        public final String tableName;
        public final String label;
        public final List<FieldDef> fields;
        public final JpaRepository<Object, Integer> repo;
        public final Class<Object> entityClass;

        @SuppressWarnings("unchecked")
        public <T> TableDescriptor(String tableName, String label, List<FieldDef> fields,
                                   JpaRepository<T, Integer> repo, Class<T> entityClass) {
            this.tableName = tableName;
            this.label = label;
            this.fields = fields;
            this.repo = (JpaRepository<Object, Integer>) repo;
            this.entityClass = (Class<Object>) entityClass;
        }

        public Map<String, Object> schemaMap() {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("table", tableName);
            s.put("label", label);
            List<Map<String, Object>> fieldList = new ArrayList<>();
            for (FieldDef f : fields) fieldList.add(f.toMap());
            s.put("fields", fieldList);
            return s;
        }
    }

    // -------------------------------------------------------------------------
    // Registry
    // -------------------------------------------------------------------------

    /** All registered tables, keyed by table name. Ordered for the UI select. */
    private final LinkedHashMap<String, TableDescriptor> registry = new LinkedHashMap<>();

    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public ScaffoldService(LogEventTypeRepository logEventTypeRepository,
                           LogReasonTypeRepository logReasonTypeRepository,
                           LogSourceTypeRepository logSourceTypeRepository,
                           AuditService auditService) {
        this.auditService = auditService;
        this.objectMapper = new ObjectMapper();

        register(new TableDescriptor("log_event_type", "Event Types",
                List.of(
                        new FieldDef("id",   TYPE_INT,    true,  true,  false),
                        new FieldDef("name", TYPE_STRING, true,  false, false)
                ), logEventTypeRepository, LogEventType.class));

        register(new TableDescriptor("log_reason_type", "Reason Types",
                List.of(
                        new FieldDef("id",           TYPE_INT,     true,  true,  false),
                        new FieldDef("rkey",         TYPE_STRING,  true,  false, false),
                        new FieldDef("name",         TYPE_STRING,  true,  false, false),
                        new FieldDef("defaultOrder", TYPE_INT,     false, false, false),
                        new FieldDef("deprecated",   TYPE_BOOLEAN, false, false, false)
                ), logReasonTypeRepository, LogReasonType.class));

        register(new TableDescriptor("log_source_type", "Source Types",
                List.of(
                        new FieldDef("id",   TYPE_INT,    true,  true,  false),
                        new FieldDef("name", TYPE_STRING, true,  false, false)
                ), logSourceTypeRepository, LogSourceType.class));
    }

    private void register(TableDescriptor descriptor) {
        registry.put(descriptor.tableName, descriptor);
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Returns a summary list of all registered tables (name + label) for the UI select.
     */
    public List<Map<String, String>> listTables() {
        List<Map<String, String>> result = new ArrayList<>();
        for (TableDescriptor td : registry.values()) {
            Map<String, String> m = new LinkedHashMap<>();
            m.put("table", td.tableName);
            m.put("label", td.label);
            result.add(m);
        }
        return result;
    }

    /**
     * Returns a paged result including schema metadata.
     * Response structure:
     * <pre>{
     *   "schema": { "table": ..., "label": ..., "fields": [...] },
     *   "content": [...],
     *   "totalElements": N,
     *   "totalPages": N,
     *   "number": N,
     *   "size": N
     * }</pre>
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getPage(String table, int page, int size) {
        TableDescriptor td = requireTable(table);

        Page<Object> pageResult = td.repo.findAll(PageRequest.of(page, size, Sort.by("id")));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("schema", td.schemaMap());
        response.put("content", pageResult.getContent());
        response.put("totalElements", pageResult.getTotalElements());
        response.put("totalPages", pageResult.getTotalPages());
        response.put("number", pageResult.getNumber());
        response.put("size", pageResult.getSize());
        return response;
    }

    /**
     * Upserts a row. The body is a plain {@code Map<String,Object>} whose keys match
     * the field names in the schema. Returns the saved entity.
     */
    @Transactional
    public Object upsert(String table, Map<String, Object> body, String actor) {
        TableDescriptor td = requireTable(table);

        Integer id = toInteger(body.get("id"));

        Object entity = objectMapper.convertValue(body, td.entityClass);

        // get diff before/after for audit
        Object before = td.repo.findById(id).orElse(null);
        Map<String, Object> diff = auditService.diffObjects(before, entity);
        if (diff == null) diff = new LinkedHashMap<>();

        Object saved = td.repo.save(entity);

        Object savedId = objectMapper.convertValue(saved, Map.class).get("id");

        // add savedId to diff, if needed
        String savedIdStr = String.valueOf(savedId);
        if (!savedIdStr.equals(String.valueOf(id))) {
            diff.put("id", savedId);
        }

        auditService.record(table, savedIdStr, table + "#" + savedIdStr, actor,
                before == null ? AuditService.ACTION_CREATE : AuditService.ACTION_UPDATE, diff);

        return saved;
    }

    /**
     * Deletes a row by id.
     */
    @Transactional
    public void delete(String table, int id, String actor) {
        TableDescriptor td = requireTable(table);

        // Capture before state for diff
        Object before = td.repo.findById(id).orElse(null);
        Map<String, Object> diff = auditService.diffObjects(before, null);

        td.repo.deleteById(id);

        auditService.record(table, String.valueOf(id), table + "#" + id,
                actor, AuditService.ACTION_DELETE, diff);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private TableDescriptor requireTable(String table) {
        TableDescriptor td = registry.get(table);
        if (td == null) {
            throw new IllegalArgumentException("Unknown table: " + table);
        }
        return td;
    }

    private Integer toInteger(Object value) {
        if (value == null) return null;
        if (value instanceof Integer i) return i;
        try { return Integer.parseInt(value.toString()); } catch (NumberFormatException e) { return null; }
    }
}
