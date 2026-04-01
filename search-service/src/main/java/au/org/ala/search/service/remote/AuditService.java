/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.audit.AuditEntry;
import au.org.ala.search.repo.AuditPostgresRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Records and retrieves audit history for admin-mutated entities.
 *
 * <p>Callers supply a pre-built diff map; this service serialises it to JSON and persists
 * the entry. All writes are best-effort — a failure is logged but never propagates to
 * the caller so that an audit failure never blocks a legitimate save/delete.
 */
@Slf4j
@Service
public class AuditService {

    public static final String TABLE_CONFIG     = "config";
    public static final String TABLE_BANNER     = "banner";
    public static final String TABLE_DQ         = "dq";
    public static final String TABLE_TAXON_DATA = "taxon_data";

    public static final String ACTION_CREATE = "CREATE";
    public static final String ACTION_UPDATE = "UPDATE";
    public static final String ACTION_DELETE = "DELETE";

    private static final int MAX_PAGE_SIZE = 200;

    private final AuditPostgresRepository auditRepo;
    private final ObjectMapper objectMapper;

    public AuditService(AuditPostgresRepository auditRepo) {
        this.auditRepo = auditRepo;
        this.objectMapper = new ObjectMapper();
    }

    // -------------------------------------------------------------------------
    // Write helpers
    // -------------------------------------------------------------------------

    /**
     * Records an audit entry.
     *
     * @param entityTable logical table name (use the TABLE_* constants)
     * @param entityId    primary key / identifier of the changed record
     * @param entityName  human-readable display name (may equal entityId)
     * @param actor       user id, email, or scope name
     * @param action      ACTION_CREATE, ACTION_UPDATE or ACTION_DELETE
     * @param diff        map of changed fields; each value is a {@code {"from":…,"to":…}} map
     */
    @Transactional
    public void record(String entityTable, String entityId, String entityName,
                       String actor, String action, Map<String, Object> diff) {
        try {
            String diffJson = null;
            if (diff != null && !diff.isEmpty()) {
                diffJson = objectMapper.writeValueAsString(diff);
            }

            AuditEntry entry = AuditEntry.builder()
                    .entityTable(entityTable)
                    .entityId(entityId)
                    .entityName(entityName)
                    .actor(actor)
                    .action(action)
                    .createdAt(new Date())
                    .diff(diffJson)
                    .build();

            auditRepo.save(entry);
        } catch (Exception e) {
            log.error("Failed to write audit entry for {}/{}: {}", entityTable, entityId, e.getMessage(), e);
        }
    }

    // -------------------------------------------------------------------------
    // Diff builders
    // -------------------------------------------------------------------------

    /**
     * Builds a diff map for a single changed field.
     * Returns null (no diff) if old and new are equal.
     */
    public static Map<String, Object> diff(String field, Object from, Object to) {
        if (from == null && to == null) return null;
        String fromStr = from == null ? null : String.valueOf(from);
        String toStr   = to   == null ? null : String.valueOf(to);
        if (StringUtils.equals(fromStr, toStr)) return null;
        Map<String, Object> change = new LinkedHashMap<>();
        change.put("from", fromStr);
        change.put("to", toStr);
        Map<String, Object> diff = new LinkedHashMap<>();
        diff.put(field, change);
        return diff;
    }

    /**
     * Merges two diff maps together (null-safe).
     */
    public static Map<String, Object> merge(Map<String, Object> a, Map<String, Object> b) {
        if (a == null) return b;
        if (b == null) return a;
        Map<String, Object> result = new LinkedHashMap<>(a);
        result.putAll(b);
        return result;
    }

    /**
     * Produces a field-level diff between {@code before} and {@code after}.
     *
     * <ul>
     *   <li>Both objects are serialised to {@code Map<String,Object>} via Jackson.</li>
     *   <li>Nested maps are diffed recursively — only the leaf fields that actually
     *       changed are included, prefixed with their parent key path
     *       (e.g. {@code "categories[0].name"}).</li>
     *   <li>Lists are compared by their canonical JSON string. If the list changed
     *       the entry is stored as {@code { "from": <json>, "to": <json> }}.</li>
     *   <li>Returns {@code null} when there are no differences or both inputs are
     *       {@code null}.</li>
     * </ul>
     *
     * @param before object state before the change, or {@code null} for a create
     * @param after  object state after the change, or {@code null} for a delete
     * @return diff map, or {@code null} if nothing changed
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> diffObjects(Object before, Object after) {
        if (before == null && after == null) return null;
        try {
            ObjectMapper mapper = new ObjectMapper()
                    .registerModule(new JavaTimeModule())
                    .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                    .disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
            Map<String, Object> beforeMap = before != null
                    ? mapper.convertValue(before, Map.class) : new LinkedHashMap<>();
            Map<String, Object> afterMap = after != null
                    ? mapper.convertValue(after, Map.class) : new LinkedHashMap<>();

            Map<String, Object> result = new LinkedHashMap<>();
            deepDiff(beforeMap, afterMap, "", result, mapper);
            return result.isEmpty() ? null : result;
        } catch (Exception e) {
            log.warn("Failed to compute object diff: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Recursively walks {@code beforeMap} and {@code afterMap}, writing changed
     * leaf entries into {@code result} keyed by their dot-notation path.
     */
    @SuppressWarnings("unchecked")
    private void deepDiff(Map<String, Object> beforeMap, Map<String, Object> afterMap,
                          String prefix, Map<String, Object> result, ObjectMapper mapper) {
        // all keys from both sides
        LinkedHashMap<String, Object> allKeys = new LinkedHashMap<>(beforeMap);
        afterMap.forEach(allKeys::putIfAbsent);

        for (String key : allKeys.keySet()) {
            String path = prefix.isEmpty() ? key : prefix + "." + key;
            Object fromVal = beforeMap.get(key);
            Object toVal = afterMap.get(key);

            if (Objects.equals(fromVal, toVal)) {
                continue; // identical — skip
            }

            if (fromVal instanceof Map && toVal instanceof Map) {
                // recurse into nested map
                deepDiff((Map<String, Object>) fromVal, (Map<String, Object>) toVal,
                        path, result, mapper);

            } else if (fromVal instanceof List || toVal instanceof List) {
                List<?> fromList = fromVal instanceof List ? (List<?>) fromVal : List.of();
                List<?> toList   = toVal   instanceof List ? (List<?>) toVal   : List.of();
                diffLists(fromList, toList, path, result, mapper);

            } else {
                // scalar change
                Map<String, Object> change = new LinkedHashMap<>();
                change.put("from", fromVal);
                change.put("to",   toVal);
                result.put(path, change);
            }
        }
    }

    /**
     * Diffs two lists with awareness that items can only be added to the end,
     * but may be deleted from any position.
     *
     * <ul>
     *   <li>If both lists contain only {@link Map} elements with an {@code "id"} field,
     *       elements are matched by identity ({@code id}) rather than by index, so a
     *       deletion in the middle does not cause every subsequent element to appear
     *       changed.</li>
     *   <li>Elements in {@code before} with no matching id in {@code after} are recorded
     *       as deletions.</li>
     *   <li>Elements in {@code after} with no matching id in {@code before} are recorded
     *       as additions (always at the end by contract).</li>
     *   <li>Matched pairs are recursed via {@link #deepDiff}.</li>
     *   <li>If either list contains non-map elements, or the maps have no {@code "id"}
     *       field, falls back to canonical JSON string comparison.</li>
     * </ul>
     */
    @SuppressWarnings("unchecked")
    private void diffLists(List<?> fromList, List<?> toList,
                           String path, Map<String, Object> result, ObjectMapper mapper) {
        boolean fromAllMaps = fromList.stream().allMatch(e -> e instanceof Map);
        boolean toAllMaps   = toList.stream().allMatch(e -> e instanceof Map);

        if (fromAllMaps && toAllMaps) {
            // Check whether maps have a usable "id" field for identity matching
            boolean hasIds = (!fromList.isEmpty() && ((Map<?,?>) fromList.get(0)).containsKey("id"))
                          || (!toList.isEmpty()   && ((Map<?,?>) toList.get(0)).containsKey("id"));

            if (hasIds) {
                // Build lookup: id -> {index, map} for each side
                Map<Object, Map<String, Object>> fromById = new LinkedHashMap<>();
                for (int i = 0; i < fromList.size(); i++) {
                    Map<String, Object> m = (Map<String, Object>) fromList.get(i);
                    Object id = m.get("id");
                    if (id != null) fromById.put(id, m);
                }
                Map<Object, Map<String, Object>> toById = new LinkedHashMap<>();
                for (int i = 0; i < toList.size(); i++) {
                    Map<String, Object> m = (Map<String, Object>) toList.get(i);
                    Object id = m.get("id");
                    if (id != null) toById.put(id, m);
                }

                // Deletions: in before but not in after
                int delIdx = 0;
                for (Map.Entry<Object, Map<String, Object>> entry : fromById.entrySet()) {
                    if (!toById.containsKey(entry.getKey())) {
                        String indexedPath = path + "[deleted:" + entry.getKey() + "]";
                        Map<String, Object> change = new LinkedHashMap<>();
                        change.put("from", entry.getValue());
                        change.put("to",   null);
                        result.put(indexedPath, change);
                    }
                    delIdx++;
                }

                // Matched: in both — recurse
                for (Map.Entry<Object, Map<String, Object>> entry : fromById.entrySet()) {
                    Map<String, Object> toMap = toById.get(entry.getKey());
                    if (toMap != null) {
                        String indexedPath = path + "[id:" + entry.getKey() + "]";
                        deepDiff(entry.getValue(), toMap, indexedPath, result, mapper);
                    }
                }

                // Additions: in after but not in before
                for (Map.Entry<Object, Map<String, Object>> entry : toById.entrySet()) {
                    if (!fromById.containsKey(entry.getKey())) {
                        String indexedPath = path + "[added:" + entry.getKey() + "]";
                        Map<String, Object> change = new LinkedHashMap<>();
                        change.put("from", null);
                        change.put("to",   entry.getValue());
                        result.put(indexedPath, change);
                    }
                }
                return;
            }

            // No id field — fall through to JSON string comparison
        }

        // Scalar, mixed, or map-without-id list — canonical JSON string comparison
        try {
            String fromJson = mapper.writeValueAsString(fromList);
            String toJson   = mapper.writeValueAsString(toList);
            if (!Objects.equals(fromJson, toJson)) {
                Map<String, Object> change = new LinkedHashMap<>();
                change.put("from", fromJson);
                change.put("to",   toJson);
                result.put(path, change);
            }
        } catch (Exception e) {
            log.warn("Failed to serialise list for diff at path {}: {}", path, e.getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Query
    // -------------------------------------------------------------------------

    /**
     * Returns a page of audit entries, always sorted most-recent first.
     *
     * @param entityTable optional filter on entity_table
     * @param entityId    optional exact filter on entity_id
     * @param entityName  optional partial (case-insensitive) filter on entity_name
     * @param page        zero-based page index
     * @param pageSize    records per page (capped at {@value #MAX_PAGE_SIZE})
     */
    @Transactional(readOnly = true)
    public Page<AuditEntry> search(String entityTable, String entityId, String entityName, String actor, String action,
                                   int page, int pageSize) {
        pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
        PageRequest pageable = PageRequest.of(page, pageSize, Sort.by(Sort.Direction.DESC, "created_at"));
        return auditRepo.search(
                StringUtils.isBlank(entityTable) ? null : entityTable.trim(),
                StringUtils.isBlank(entityId)    ? null : entityId.trim(),
                StringUtils.isBlank(entityName)  ? null : entityName.trim(),
                StringUtils.isBlank(actor)       ? null : actor.trim(),
                StringUtils.isBlank(action)      ? null : action.trim(),
                pageable);
    }
}







