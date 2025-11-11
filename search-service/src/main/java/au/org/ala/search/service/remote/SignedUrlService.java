/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.doi.*;
import au.org.ala.search.model.url.SignedUrl;
import au.org.ala.search.model.url.UrlType;
import au.org.ala.search.repo.SignedUrlPostgresRepository;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.util.*;

/**
 * Signed URL Service. Handles creation of signed URLs, e.g. downloading DOI files from local storage (s3 has its own signing).
 *
 */
@Slf4j
@Service
public class SignedUrlService {

    private static final String PATH = "/v2/signed?id=";
    private final DoiFileStoreService doiFileStoreService;

    @Value("#{'${openapi.servers}'.split(',')[0]}")
    private String baseUrl;

    final SignedUrlPostgresRepository signedUrlPostgresRepository;

    public SignedUrlService(SignedUrlPostgresRepository signedUrlPostgresRepository, DoiFileStoreService doiFileStoreService) {
        this.signedUrlPostgresRepository = signedUrlPostgresRepository;
        this.doiFileStoreService = doiFileStoreService;
    }

    /**
     * create a signed url record
     *
     * @param urlType of signed url, added to data with key "type"
     * @param expiresAt in epoch milliseconds
     * @param data Map of data to store in the signed url blob
     * @return
     */
    @Transactional
    public String createUrl(UrlType urlType, Long expiresAt, Map<String, Object> data) {
        data.put("type", urlType.name());
        SignedUrl signedUrl = SignedUrl.builder()
                .expiresAt(expiresAt)
                .blob(data)
                .build();

        signedUrl = signedUrlPostgresRepository.save(signedUrl);
        return baseUrl + PATH + signedUrl.getId().toString();
    }

    // hourly cleanup of expired signed urls
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void deleteExpiredSignedUrls() {
        long now = System.currentTimeMillis();
        log.debug("Deleting expired signed urls older than {}", now);
        signedUrlPostgresRepository.deleteOlderThan(now);
    }

    public ResponseEntity<InputStreamResource> getSignedUrl(UUID id) {
        SignedUrl signedUrl = signedUrlPostgresRepository.findByIdNative(id);
        if (signedUrl == null) {
            return ResponseEntity.notFound().build();
        }

        // check expiry
        long now = System.currentTimeMillis();
        if (signedUrl.getExpiresAt() < now) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> blob = signedUrl.getBlob();

        // get the type so that the correct action can be taken, only DOI downloads supported currently
        String type = (String) blob.get("type");
        if (type.equals(UrlType.DOI_DOWNLOAD.name())) {
            Doi doi = Doi.builder().uuid(UUID.fromString((String) blob.get("uuid"))).filename((String) blob.get("filename")).build();
            File file = new File(doiFileStoreService.getFilePath(doi));

            String filename = doi.getFilename();
            if (file.exists()) {
                try {
                    InputStreamResource inputStreamResource = new InputStreamResource(new FileInputStream(file));

                    return ResponseEntity.ok()
                            .header("content-disposition", "attachment; filename=" + filename + ";")
                            .contentLength(file.length())
                            .contentType(MediaType.APPLICATION_PDF)
                            .body(inputStreamResource);
                } catch (FileNotFoundException ignored) {
                }
            }
            return ResponseEntity.notFound().build();
        } else {
            return ResponseEntity.internalServerError().build();
        }
    }
}
