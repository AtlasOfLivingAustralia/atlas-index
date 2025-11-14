/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.doi.*;
import au.org.ala.search.repo.DoiDataPostgresRepository;
import au.org.ala.search.service.doi.DataCiteService;
import au.org.ala.search.service.doi.DoiProviderService;
import au.org.ala.search.service.doi.MockService;
import au.org.ala.search.util.doi.exceptions.DoiMintingException;
import au.org.ala.search.util.doi.exceptions.DoiValidationException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

/**
 * DOI Service. Handles minting and updating DOIs via different providers. Interfaces with the DOI data repository,
 * file store and provider services.
 *
 */
@Slf4j
@Service
public class DoiService {

    // TODO: add admin log events using logService and taskType for provider exceptions, not other bugs
    private static final TaskType taskType = TaskType.DOI_REQUEST;

    static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

    final DoiDataPostgresRepository doiDataPostgresRepository;
    final DoiFileStoreService doiFileStoreService;
    final LogService logService;
    final MockService mockService;
    private final DataCiteService dataCiteService;

    @Value("${doi.minting.enabled}")
    public Boolean mintingEnabled;

    public DoiService(DoiDataPostgresRepository doiDataPostgresRepository, DoiFileStoreService doiFileStoreService, LogService logService, MockService mockService, DataCiteService dataCiteService) {
        this.doiDataPostgresRepository = doiDataPostgresRepository;
        this.doiFileStoreService = doiFileStoreService;
        this.logService = logService;
        this.mockService = mockService;
        this.dataCiteService = dataCiteService;
    }

    @Transactional
    public MintResponse mintDoi(
            DoiProvider doiProvider,
            MintRequest.ProviderMetadata providerMetadata,
            String title,
            String authors,
            String description,
            List<String> licence,
            String applicationUrl,
            String fileUrl,
            MultipartFile file,
            Map<String, Object> applicationMetadata,
            String customLandingPageUrl,
            String defaultDoi,
            String userId,
            Boolean active,
            List<String> authorisedRoles,
            String displayTemplate
    ) throws Exception {
        if (doiProvider == null) {
            throw new IllegalArgumentException("Provider must not be null");
        }
        log.debug("Trying to mint with provider: {}", doiProvider);

        if (defaultDoi == null) {
            // only checking title, should probably do more validation
            if (providerMetadata == null || StringUtils.isEmpty(providerMetadata.title)) {
                throw new IllegalArgumentException("No provider metadata has been sent");
            }
        }
        if (applicationUrl == null || applicationUrl.isEmpty()) {
            throw new IllegalArgumentException("No url to the original application has been sent");
        }

        if (defaultDoi != null && doiDataPostgresRepository.findByDoiNative(defaultDoi) != null) {
            throw new DoiMintingException("DOI " + defaultDoi + " already exists in service!", null);
        }

        UUID uuid = UUID.randomUUID();

        Doi entity = Doi.builder()
                .uuid(uuid)
                .customLandingPageUrl(customLandingPageUrl)
                .title(title)
                .authors(authors)
                .description(description)
                .licence(licence)
                .provider(doiProvider)
                .providerMetadata(providerMetadata.toMap())
                .applicationMetadata(applicationMetadata)
                .applicationUrl(applicationUrl)
                .userId(userId)
                .authorisedRoles(authorisedRoles)
                .displayTemplate(displayTemplate)
                .active(active != null ? active : true)
                .build();

        entity.setDoi("tmp_" + UUID.randomUUID());

        Date now = new Date();
        entity.setDateCreated(now);
        entity.setDateMinted(now);

        // save the entity before proceeding
        saveEntity(entity, file, fileUrl, uuid, now);

        String uuidString = uuid.toString();
        String doi = null;
        try {
            doi = defaultDoi != null ? defaultDoi : getProviderService(doiProvider).mintDoi(uuidString, providerMetadata, customLandingPageUrl, entity.getActive());
            entity.setDoi(doi);

            doiDataPostgresRepository.updateDoi(entity.getId(), doi);
        } catch (Exception e) {
            log.error("Error minting DOI {} for UUID {}: {}", doi, uuid, e.getMessage());
            throw new DoiMintingException("Error minting DOI " + doi + ": " + e.getMessage(), e);
        }

        // validate that it is in the DB
        Doi savedDoi = doiDataPostgresRepository.findByDoiNative(doi);
        if (!doi.equals(savedDoi.getDoi())) {
            throw new DoiValidationException(entity.getUuid(), doi, null);
        }

        return new MintResponse(uuid.toString(), doi, null, getProviderService(doiProvider).generateLandingPageUrl(uuidString, customLandingPageUrl), getProviderService(doiProvider).generateLandingPageUrl(uuidString, null),  "ok");
    }

    private void saveEntity(Doi entity, MultipartFile file, String fileUrl, UUID uuid, Date now) throws Exception {
        try {
            entity.setLastUpdated(now);

            // Only save the file if we have one. Updates may not include a file.
            if (file != null) {
                File tempFile = File.createTempFile("upload-", file.getOriginalFilename());
                file.transferTo(tempFile);
                applyFileAttributes(tempFile, entity);
                doiFileStoreService.copyToFileStore(tempFile, entity, true);
            } else if (fileUrl != null) {
                File tempFile = fetchRemoteFile(fileUrl);
                applyFileAttributes(tempFile, entity);
                doiFileStoreService.copyToFileStore(tempFile, entity, true);
            }

            doiDataPostgresRepository.save(entity);
        } catch (Exception e) {
            // log and rethrow
            log.error("Error saving DOI entity for UUID {}: {}", uuid, e.getMessage());
            throw e;
        }
    }

    private void applyFileAttributes(File file, Doi doi) {
        try {
            String filename = file.getName();
            String contentType = Files.probeContentType(file.toPath());
            long fileSize = file.length();
            byte[] fileHash = computeSha256(file);

            doi.setFilename(filename);
            doi.setContentType(StringUtils.isNotEmpty(contentType) ? contentType : DEFAULT_CONTENT_TYPE);
            doi.setFileSize(fileSize);
            doi.setFileHash(fileHash);
        } catch (Exception e) {
            log.error("Error applying file attributes: {}", e.getMessage());
        }
    }

    public static byte[] computeSha256(File file) throws IOException, NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
        }
        return digest.digest();
    }

    private File fetchRemoteFile(String fileUrl) throws IOException {
        URL url = new URL(fileUrl);
        String suffix = fileUrl.contains(".") ? fileUrl.substring(fileUrl.lastIndexOf('.')) : ".tmp";
        File tempFile = File.createTempFile("remote-", suffix);
        try (InputStream in = url.openStream()) {
            Files.copy(in, tempFile.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        return tempFile;
    }

    public DoiProviderService getProviderService(DoiProvider doiProvider) {

        if (!mintingEnabled) {
            log.info("Using mock provider service");
            return mockService;
        }

        switch (doiProvider) {
            case DoiProvider.ANDS:
                throw new MissingResourceException("ANDS DOI provider is no longer supported. Perform edits manually.", DoiService.class.getName(), doiProvider.name());
            case DoiProvider.ALA:
            case DoiProvider.DATACITE:
                return dataCiteService;
        }

        throw new MissingResourceException("unsupported DoiProvider " + doiProvider, DoiService.class.getName(), doiProvider != null ? doiProvider.name() : "null");
    }

    public Doi updateDoi(String id, UpdateRequest updateRequest, MultipartFile file) throws Exception {
        Doi doi = doiDataPostgresRepository.findByIdNative(UUID.fromString(id));

        Date now = new Date();
        doi.setLastUpdated(now);

        // apply updateRequest fields to doi
        boolean needsUpdate = false;
        if (updateRequest.getTitle() != null) {
            needsUpdate = true;
            doi.setTitle(updateRequest.getTitle());
        }
        if (updateRequest.getAuthors() != null) {
            needsUpdate = true;
            doi.setAuthors(updateRequest.getAuthors());
        }
        if (updateRequest.getDescription() != null) {
            needsUpdate = true;
            doi.setDescription(updateRequest.getDescription());
        }
        if (updateRequest.getCustomLandingPageUrl() != null) {
            needsUpdate = true;
            doi.setCustomLandingPageUrl(updateRequest.getCustomLandingPageUrl());
        }
        if (updateRequest.getApplicationUrl() != null) {
            needsUpdate = true;
            doi.setApplicationUrl(updateRequest.getApplicationUrl());
        }
        if (updateRequest.getApplicationMetadata() != null) {
            needsUpdate = true;
            doi.setApplicationMetadata(updateRequest.getApplicationMetadata());
        }
        if (updateRequest.getProviderMetadata() != null) {
            needsUpdate = true;
            doi.setProviderMetadata(updateRequest.getProviderMetadata().toMap());
        }
        if (updateRequest.getActive() != null) {
            needsUpdate = true;
            doi.setActive(updateRequest.getActive());
        }

        // update db and provider only if needed
        if (needsUpdate || file != null || updateRequest.getFileUrl() != null) {
            saveEntity(doi, file, updateRequest.getFileUrl(), doi.getUuid(), now);

            if (updateRequest.getCustomLandingPageUrl() != null || updateRequest.getProviderMetadata() != null || doi.getActive() != null) {
                getProviderService(doi.getProvider()).updateDoi(doi.getDoi(), doi.getUuid().toString(), updateRequest.getProviderMetadata(), doi.getCustomLandingPageUrl(), doi.getActive());
            }
        }

        return doi;
    }
}
