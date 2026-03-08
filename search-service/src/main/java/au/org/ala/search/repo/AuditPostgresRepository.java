/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.audit.AuditEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditPostgresRepository extends JpaRepository<AuditEntry, Long> {

    @Query(value =
            "SELECT * FROM audit_history" +
            " WHERE (CAST(:entityTable AS TEXT) IS NULL OR entity_table = :entityTable)" +
            "   AND (CAST(:entityId    AS TEXT) IS NULL OR entity_id    = :entityId)" +
            "   AND (CAST(:entityName  AS TEXT) IS NULL OR LOWER(entity_name) LIKE LOWER(CONCAT('%', :entityName, '%')))" +
            "   AND (CAST(:actor       AS TEXT) IS NULL OR LOWER(actor)       LIKE LOWER(CONCAT('%', :actor, '%')))" +
            "   AND (CAST(:action      AS TEXT) IS NULL OR action = :action)",
            countQuery =
            "SELECT COUNT(*) FROM audit_history" +
            " WHERE (CAST(:entityTable AS TEXT) IS NULL OR entity_table = :entityTable)" +
            "   AND (CAST(:entityId    AS TEXT) IS NULL OR entity_id    = :entityId)" +
            "   AND (CAST(:entityName  AS TEXT) IS NULL OR LOWER(entity_name) LIKE LOWER(CONCAT('%', :entityName, '%')))" +
            "   AND (CAST(:actor       AS TEXT) IS NULL OR LOWER(actor)       LIKE LOWER(CONCAT('%', :actor, '%')))" +
            "   AND (CAST(:action      AS TEXT) IS NULL OR action = :action)",
            nativeQuery = true)
    Page<AuditEntry> search(
            @Param("entityTable") String entityTable,
            @Param("entityId")    String entityId,
            @Param("entityName")  String entityName,
            @Param("actor")       String actor,
            @Param("action")      String action,
            Pageable pageable);
}
