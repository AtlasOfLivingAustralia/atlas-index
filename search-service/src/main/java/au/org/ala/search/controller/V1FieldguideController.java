/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.dto.FieldguideRequest;
import au.org.ala.search.model.queue.*;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.queue.ConsumerQueue;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.QueueDataService;
import au.org.ala.web.UserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.security.Principal;
import java.util.UUID;

import static io.swagger.v3.oas.annotations.enums.ParameterIn.PATH;
import static io.swagger.v3.oas.annotations.enums.ParameterIn.QUERY;

/**
 * bie-index API services, minus some admin services
 */
@Tag(name = "Fieldguide", description = "APIs for generating fieldguides")
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class V1FieldguideController {

    private final AuthService authService;
    private final ConsumerQueue consumerQueue;
    private final QueueDataService queueDataService;

    @Value("${fieldguide.validateEmail}")
    private Boolean validateEmail;

    @Value("#{'${openapi.servers}'.split(',')[0]}")
    private String baseUrl;

    private final DownloadFileStoreService downloadFileStoreService;

    public V1FieldguideController(AuthService authService, ConsumerQueue consumerQueue, QueueDataService queueDataService, DownloadFileStoreService downloadFileStoreService) {
        this.authService = authService;
        this.consumerQueue = consumerQueue;
        this.queueDataService = queueDataService;
        this.downloadFileStoreService = downloadFileStoreService;
    }

    @Operation(
            method = "POST",
            operationId = "generate",
            summary = "Initiate the generation of a fieldguide",
            description = "Initiate the generation of a fieldguide",
            requestBody = @RequestBody(
                    description = "Fieldguide parameters",
                    required = true,
                    content = {
                            @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = FieldguideRequest.class)
                            )
                    }
            ),
            responses = {
                    @ApiResponse(
                            description = "Status of the fieldguide (`queued`, `running`, `finished`) and statusUrl or downloadUrl",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(implementation = FieldguideResponse.class)
                                    )
                            }
                    ),
                    @ApiResponse(
                            description = "no email provided",
                            responseCode = "400"
                    )
            }
    )
    @Deprecated
    @SecurityRequirement(name = "JWT")
    @SecurityRequirement(name = "openIdConnect")
    // excluding "consumes = MediaType.APPLICATION_JSON_VALUE" from PostMapping to make it compatible with the current downloads-plugin
    @PostMapping(path = "/v1/fieldguide/generate", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<FieldguideResponse> offline(
            @org.springframework.web.bind.annotation.RequestBody FieldguideRequest params,
            @Parameter(
                    name = "email",
                    in = QUERY,
                    description = "User email address",
                    schema = @Schema(implementation = String.class),
                    required = true
            )
            @RequestParam(name = "email") String email,
            @Parameter(
                    name = "file",
                    in = QUERY,
                    description = "filename of the generated file",
                    schema = @Schema(implementation = String.class)
            )
            @RequestParam(name = "file", required = false) String file,
            @AuthenticationPrincipal Principal principal) {
        String userId = authService.getEmail(principal);
        String validEmail = authService.getUserId(principal);
        if (validateEmail) {
            // validate against registered user emails when no principal
            if (validEmail == null) {
                UserDetails userDetails = authService.getUserForEmailAddress(email);
                if (userDetails != null && !userDetails.getLocked()) {
                    validEmail = userDetails.getEmail();
                    userId = userDetails.getUserId();
                }
            }
        } else if (StringUtils.isEmpty(validEmail)) {
            validEmail = email;
            userId = "-1"; // anonymous user
        }

        FieldguideQueueRequest fieldguideQueueRequest = FieldguideQueueRequest
                .builder()
                .filename(file)
                .title(params.title)
                .id(params.guids.toArray(new String[0]))
                .sourceUrl(params.link)
                .build();
        QueueItem queueItem = consumerQueue.add(QueueRequest
                .builder()
                .taskType(TaskType.FIELDGUIDE)
                .email(validEmail)
                .fieldguideQueueRequest(fieldguideQueueRequest)
                .build(), userId);

        FieldguideResponse response = new FieldguideResponse(queueItem, baseUrl);

        // update status for the old value
        if (queueItem.status == StatusCode.QUEUED) {
            response.setStatus("inQueue");
        }

        if (queueItem.status == StatusCode.ERROR) {
            return ResponseEntity.badRequest().body(response);
        }
        return ResponseEntity.ok().body(response);
    }

    @Operation(
            method = "GET",
            operationId = "status",
            summary = "Show the status of a fieldguide",
            description = "Show the status of a  fieldguide",
            responses = {
                    @ApiResponse(
                            description = "Status of the fieldguide (`queued`, `running`, `finished`) and statusUrl or downloadUrl",
                            responseCode = "200",
                            content = {
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(implementation = FieldguideResponse.class)
                                    )
                            }
                    )
            }
    )
    @Deprecated
    @GetMapping(path = "/v1/fieldguide/status/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<FieldguideResponse> status(
            @Parameter(
                    name = "id",
                    in = PATH,
                    description = "Id of the fieldguide",
                    schema = @Schema(implementation = String.class),
                    required = true
            )
            @PathVariable(name = "id") String id) {
        QueueItem item = queueDataService.get(UUID.fromString(id));
        if (item != null) {
            FieldguideResponse response = new FieldguideResponse(item, baseUrl);
            // update status for the old value
            if ("queued".equals(response.status)) {
                response.setStatus("inQueue");
            }

            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(
            method = "GET",
            operationId = "download",
            summary = "Download a fieldguide",
            description = "Download a fieldguide",
            responses = {
                    @ApiResponse(
                            description = "Fieldguide as a PDF",
                            responseCode = "200",
                            content = {
                                    @Content(mediaType = "application/pdf",
                                            schema = @Schema(
                                                    type = "string",
                                                    format = "binary"
                                            )
                                    )
                            }
                    ),
                    @ApiResponse(
                            description = "Redirect to PDF",
                            responseCode = "302"
                    )
            }
    )
    @Deprecated
    @GetMapping(path = "/v1/fieldguide/download/{downloadId}", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<?> offline(
            @Parameter(
                    name = "downloadId",
                    in = PATH,
                    description = "downloadId of the fieldguide",
                    schema = @Schema(implementation = String.class),
                    required = true
            )
            @PathVariable(name = "downloadId") String id) {
        QueueItem queueItem = queueDataService.get(UUID.fromString(id));
        if (queueItem != null) {
            if (downloadFileStoreService.isS3()) {
                return ResponseEntity
                        .status(HttpStatus.TEMPORARY_REDIRECT)
                        .header("Location", downloadFileStoreService.createPresignedGetUrl(queueItem))
                        .build();
            } else {
                File file = new File(downloadFileStoreService.getFilePath(queueItem));

                if (file.exists()) {
                    try {
                        InputStreamResource inputStreamResource = new InputStreamResource(new FileInputStream(file));

                        return ResponseEntity.ok()
                                .header("content-disposition", "attachment; filename=" + queueItem.queueRequest.fieldguideQueueRequest.filename)
                                .contentLength(file.length())
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(inputStreamResource);
                    } catch (FileNotFoundException ignored) {
                    }
                }
            }
        }

        return ResponseEntity.notFound().build();
    }
}
