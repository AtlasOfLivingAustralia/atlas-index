/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.doi.Doi;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

/**
 * Repository interface for managing configuration data in Postgresql.
 *
 * This is intended for use by ConfigService only.
 */
public interface DoiDataPostgresRepository extends JpaRepository<Doi, String> {

    @Query(value = "SELECT * FROM doi WHERE uuid = :uuid", nativeQuery = true)
    Doi findByIdNative(@Param("uuid") UUID uuid);

    @Query(value = "SELECT * FROM doi WHERE doi = :doi", nativeQuery = true)
    Doi findByDoiNative(@Param("doi") String doi);

    @Query(
        value = "SELECT * FROM doi " +
                "WHERE (:userId IS NULL OR user_id = :userId) " +
                "AND (:title IS NULL OR title ILIKE '%' || :title || '%') " +
//                "AND (:authors IS NULL OR authors @> ARRAY[:authors]::text[]) " +
//                "AND (:licence IS NULL OR licence @> ARRAY[:licence]::text[]) " +
                "AND (:activeStatus IS NULL OR active = " +
                "CASE WHEN :activeStatus = 'all' THEN active ELSE (:activeStatus = 'active') END) ",
        countQuery = "SELECT count(*) FROM doi " +
                "WHERE (:userId IS NULL OR user_id = :userId) " +
                "AND (:title IS NULL OR title ILIKE '%' || :title || '%') " +
//                "AND (:authors IS NULL OR authors @> ARRAY[:authors]::text[]) " +
//                "AND (:licence IS NULL OR licence @> ARRAY[:licence]::text[]) " +
                "AND (:activeStatus IS NULL OR active = " +
                "CASE WHEN :activeStatus = 'all' THEN active ELSE (:activeStatus = 'active') END) ",
        nativeQuery = true
    )
    Page<Doi> listDoisNative(
        @Param("userId") String userId,
        @Param("title") String title,
//        @Param("authors") String authors,
//        @Param("licence") String licence,
        @Param("activeStatus") String activeStatus,
        Pageable pageable
        );

    @Modifying
    @Query(value = "UPDATE doi SET doi = :doi WHERE id = :id", nativeQuery = true)
    void updateDoi(@Param("id") Long id, @Param("doi") String doi);
}
