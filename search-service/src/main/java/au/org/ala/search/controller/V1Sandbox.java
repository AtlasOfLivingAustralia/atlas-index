/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.model.dto.SandboxIngress;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.Status;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.SandboxService;
import au.org.ala.search.service.queue.QueueService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;

/**
 * bie-index API services, minus some admin services
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class V1Sandbox {
    private static final Logger logger = LoggerFactory.getLogger(V1Sandbox.class);

    final
    SandboxService sandboxService;
    private final AuthService authService;
    private final QueueService queueService;

    public V1Sandbox(SandboxService sandboxService, AuthService authService, QueueService queueService) {
        this.sandboxService = sandboxService;
        this.authService = authService;
        this.queueService = queueService;
    }

    @SecurityRequirement(name = "JWT")
    @PostMapping(path = {"/v1/sandbox/upload"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SandboxIngress> upload(
            // file upload
            @RequestPart(name = "file") MultipartFile file,
            @RequestPart(name = "datasetName") String datasetName,
            @AuthenticationPrincipal Principal principal) {
        try {
            String userId = authService.getUserId(principal);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            SandboxIngress sandboxIngress = sandboxService.upload(file, datasetName, userId);
            return ResponseEntity.ok(sandboxIngress);
        } catch (Exception e) {
            logger.error("Error uploading file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).header("error", e.getMessage()).build();
        }
    }

    @SecurityRequirement(name = "JWT")
    @DeleteMapping(path = {"/v1/sandbox/upload"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> delete(
            @RequestParam String id,
            @AuthenticationPrincipal Principal principal) {
        // Delete from uploads directory and SOLR
        boolean isAdmin = authService.isAdmin(principal);

        SandboxIngress sandboxIngress = sandboxService.delete(id, authService.getUserId(principal), isAdmin);
        return ResponseEntity.ok(sandboxIngress);
    }

    @SecurityRequirement(name = "JWT")
    @PostMapping(path = {"/v1/sandbox/ingress"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Status> ingest(
            @RequestBody SandboxIngress sandboxIngress,
            @AuthenticationPrincipal Principal principal) {
        // assign the authenticated userId to the sandboxIngress
        String userId = authService.getUserId(principal);
        if (userId == null) {
            // Should not happen
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        sandboxIngress.setUserId(userId);

        Status status = sandboxService.ingress(sandboxIngress);
        return ResponseEntity.ok(status);
    }

    @GetMapping(path = {"/v1/sandbox/ingress"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Status> progress(
            @RequestParam String id) {
        QueueItem item = queueService.get(id);
        if (item != null) {
            Status status = item.getStatus();
            status.setId(item.getId());
            return ResponseEntity.ok(item.getStatus());
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}
