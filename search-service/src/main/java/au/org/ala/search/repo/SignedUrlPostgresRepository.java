/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.repo;

import au.org.ala.search.model.url.SignedUrl;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

/**
 * Repository for signed URLs, for authorised access to DOI downloads, etc.
 */
public interface SignedUrlPostgresRepository extends JpaRepository<SignedUrl, String> {

    @Query(value = "SELECT * FROM signed_url WHERE id = :id", nativeQuery = true)
    SignedUrl findByIdNative(@Param("id") UUID uuid);

    // deletes expired urls
    @Modifying
    @Query(value = "DELETE FROM signed_url WHERE expires_at < :expiresAt", nativeQuery = true)
    void deleteOlderThan(@Param("expiresAt") long expiresAt);
}
