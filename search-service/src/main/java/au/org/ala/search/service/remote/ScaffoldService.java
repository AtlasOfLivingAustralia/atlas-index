/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.logger.LogEventType;
import au.org.ala.search.model.logger.LogReasonType;
import au.org.ala.search.model.logger.LogSourceType;
import au.org.ala.search.model.taxon.TaxonData;
import au.org.ala.search.model.taxon.TaxonDataId;
import au.org.ala.search.repo.LogEventTypeRepository;
import au.org.ala.search.repo.LogReasonTypeRepository;
import au.org.ala.search.repo.LogSourceTypeRepository;
import au.org.ala.search.repo.TaxonDataPostgresRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;

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
        public final boolean readOnly;

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
        public final JpaRepository<Object, Object> repo;
        public final Class<Object> entityClass;
        public final Sort sort;

        /** Extracts the repo id object from a row map. */
        public final Function<Map<String, Object>, Object> idFromMap;
        /** Converts the repo id to a display string. */
        public final Function<Object, String> idToString;

        /** Constructor for simple Integer PK tables. */
        @SuppressWarnings("unchecked")
        public <T> TableDescriptor(String tableName, String label, List<FieldDef> fields,
                                   JpaRepository<T, Integer> repo, Class<T> entityClass) {
            this.tableName   = tableName;
            this.label       = label;
            this.fields      = fields;
            this.repo        = (JpaRepository<Object, Object>) (JpaRepository<?, ?>) repo;
            this.entityClass = (Class<Object>) entityClass;
            this.sort        = Sort.by("id");
            this.idFromMap   = row -> {
                Object v = row.get("id");
                if (v == null) return null;
                if (v instanceof Integer i) return i;
                try { return Integer.parseInt(v.toString()); } catch (NumberFormatException e) { return null; }
            };
            this.idToString  = id -> id == null ? "null" : id.toString();
        }

        /** Constructor for composite-key tables. */
        @SuppressWarnings("unchecked")
        public <T, ID> TableDescriptor(String tableName, String label, List<FieldDef> fields,
                                       JpaRepository<T, ID> repo, Class<T> entityClass,
                                       Sort sort,
                                       Function<Map<String, Object>, ID> idFromMap,
                                       Function<ID, String> idToString) {
            this.tableName   = tableName;
            this.label       = label;
            this.fields      = fields;
            this.repo        = (JpaRepository<Object, Object>) (JpaRepository<?, ?>) repo;
            this.entityClass = (Class<Object>) entityClass;
            this.sort        = sort;
            this.idFromMap   = (Function<Map<String, Object>, Object>) (Function<?, ?>) idFromMap;
            this.idToString  = (Function<Object, String>) (Function<?, ?>) idToString;
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
                           TaxonDataPostgresRepository taxonDataPostgresRepository,
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

        // taxon_data has a composite key (taxonConceptId + key)
        Function<Map<String, Object>, TaxonDataId> taxonIdFromMap = row -> new TaxonDataId(
                row.get("taxonConceptId") != null ? row.get("taxonConceptId").toString() : null,
                row.get("key") != null ? row.get("key").toString() : null);
        Function<TaxonDataId, String> taxonIdToString = id -> id.taxonConceptId + ":" + id.key;
        register(new TableDescriptor("taxon_data", "Taxon Data",
                List.of(
                        new FieldDef("taxonConceptId", TYPE_STRING, true,  true,  false),
                        new FieldDef("key",            TYPE_STRING, true,  true,  false),
                        new FieldDef("scientificName", TYPE_STRING, false, false, false),
                        new FieldDef("kingdom",        TYPE_STRING, false, false, false),
                        new FieldDef("family",         TYPE_STRING, false, false, false),
                        new FieldDef("value",          TYPE_STRING, false, false, false)
                ),
                taxonDataPostgresRepository,
                TaxonData.class,
                Sort.by("taxonConceptId", "key"),
                taxonIdFromMap,
                taxonIdToString));
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

        Page<Object> pageResult = td.repo.findAll(PageRequest.of(page, size, td.sort));

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

        Object id = td.idFromMap.apply(body);
        String idStr = td.idToString.apply(id);

        Object entity = objectMapper.convertValue(body, td.entityClass);

        // get diff before save for audit
        Object before = id != null ? td.repo.findById(id).orElse(null) : null;
        Map<String, Object> diff = auditService.diffObjects(before, entity);
        if (diff == null) diff = new LinkedHashMap<>();

        Object saved = td.repo.save(entity);

        @SuppressWarnings("unchecked")
        Object savedId = td.idFromMap.apply(objectMapper.convertValue(saved, Map.class));
        String savedIdStr = td.idToString.apply(savedId);

        // record new id in diff if it changed (e.g. sequence-generated)
        if (!savedIdStr.equals(idStr)) {
            diff.put("id", savedIdStr);
        }

        auditService.record(table, savedIdStr, table + "#" + savedIdStr, actor,
                before == null ? AuditService.ACTION_CREATE : AuditService.ACTION_UPDATE, diff);

        return saved;
    }

    /**
     * Deletes a row by id.
     */
    @Transactional
    public void delete(String table, String rawId, String actor) {
        TableDescriptor td = requireTable(table);

        // Parse the raw id string back to the id object
        Object id = parseId(td, rawId);

        Object before = td.repo.findById(id).orElse(null);
        Map<String, Object> diff = auditService.diffObjects(before, null);

        td.repo.deleteById(id);

        auditService.record(table, rawId, table + "#" + rawId,
                actor, AuditService.ACTION_DELETE, diff);
    }

    @Transactional(readOnly = true)
    public long count(String table) {
        return requireTable(table).repo.count();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private TableDescriptor requireTable(String table) {
        TableDescriptor td = registry.get(table);
        if (td == null) throw new IllegalArgumentException("Unknown table: " + table);
        return td;
    }

    /**
     * Parses a raw id string (e.g. "42" or "lsid:xxx:yyy:val") back to the id
     * object expected by the repository.  For simple integer-keyed tables the
     * value is the integer itself.  For composite-key tables the string is
     * reconstructed by building a map from the PK fields (split on ":") and
     * calling {@code idFromMap}.
     */
    @SuppressWarnings("unchecked")
    private Object parseId(TableDescriptor td, String rawId) {
        List<FieldDef> pkFields = td.fields.stream().filter(f -> f.primaryKey).toList();
        if (pkFields.size() == 1) {
            // simple integer key — try direct integer parse
            try { return Integer.parseInt(rawId); } catch (NumberFormatException e) { return rawId; }
        }
        // composite key — rawId is "val1:val2:..." matching PK field order
        // Use the last N-1 colons as separators so values themselves may contain ":"
        // Split on first (pkFields.size()-1) colons
        Map<String, Object> map = new LinkedHashMap<>();
        String remaining = rawId;
        for (int i = 0; i < pkFields.size() - 1; i++) {
            int idx = remaining.indexOf(':');
            if (idx < 0) throw new IllegalArgumentException("Cannot parse composite id: " + rawId);
            map.put(pkFields.get(i).name, remaining.substring(0, idx));
            remaining = remaining.substring(idx + 1);
        }
        map.put(pkFields.get(pkFields.size() - 1).name, remaining);
        return td.idFromMap.apply(map);
    }
}
