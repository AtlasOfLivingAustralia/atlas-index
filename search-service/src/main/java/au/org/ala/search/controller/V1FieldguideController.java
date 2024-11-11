package au.org.ala.search.controller;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.dto.FieldguideRequest;
import au.org.ala.search.model.queue.*;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.queue.QueueService;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.web.UserDetails;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.security.Principal;

import static io.swagger.v3.oas.annotations.enums.ParameterIn.*;

/**
 * bie-index API services, minus some admin services
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class V1FieldguideController {

    @Autowired
    private AuthService authService;

    @Autowired
    private QueueService queueService;

    @Value("${fieldguide.validateEmail}")
    private Boolean validateEmail;

    @Value("#{'${openapi.servers}'.split(',')[0]}")
    private String baseUrl;

    @Autowired
    private DownloadFileStoreService downloadFileStoreService;

    @Operation(
            method = "POST",
            tags = "fieldguide",
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
    @SecurityRequirement(name = "JWT")
    @PostMapping(path = "/v1/generate", produces = MediaType.APPLICATION_JSON_VALUE, consumes = MediaType.APPLICATION_JSON_VALUE)
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
        //initiate generation of an offline field guide
        String validEmail;
        if (validateEmail) {
            // use logged in user's email
            validEmail = authService.getEmail(principal);

            // validate against registered user emails
            if (validEmail == null) {
                UserDetails userDetails = authService.getUserForEmailAddress(email);
                if (userDetails != null && !userDetails.getLocked()) {
                    validEmail = userDetails.getEmail();
                }
            }
        } else {
            validEmail = email;
        }

        if (validateEmail == null) {
            return ResponseEntity.badRequest().build();
        } else {
            Status status = queueService.add(FieldguideQueueRequest
                    .builder()
                    .taskType(TaskType.FIELDGUIDE)
                    .email(validEmail)
                    .filename(file)
                    .title(params.title)
                    .id(params.guids.toArray(new String[0]))
                    .sourceUrl(params.link)
                    .build());

            try {
                if (status.statusCode == StatusCode.ERROR) {
                    return ResponseEntity.badRequest().body(new FieldguideResponse(status));
                }
                return ResponseEntity.ok().body(new FieldguideResponse(status));
            } catch (MalformedURLException e) {
                return ResponseEntity.internalServerError().build();
            }
        }
    }

    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    @Getter
    public class FieldguideResponse {
        String status;
        URL statusUrl;
        URL downloadUrl;

        FieldguideResponse(Status status) throws MalformedURLException {
            this.status = status.statusCode.name().toLowerCase();
            if (status.id != null) {
                this.statusUrl = URI.create(baseUrl + "/v1/status/" + status.id).toURL();
                if (status.statusCode == StatusCode.FINISHED) {
                    this.downloadUrl = URI.create(baseUrl + "/v1/download/" + status.id).toURL();
                }
            }
        }
    }

    @Operation(
            method = "GET",
            tags = "fieldguide",
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
    @GetMapping(path = "/v1/status/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<FieldguideResponse> status(
            @Parameter(
                    name = "id",
                    in = PATH,
                    description = "Id of the fieldguide",
                    schema = @Schema(implementation = String.class),
                    required = true
            )
            @PathVariable(name = "id") String id) {
        //status of an offline field guide
        QueueItem status = queueService.get(id);
        if (status != null) {
            try {
                return ResponseEntity.ok(new FieldguideResponse(status.getStatus()));
            } catch (MalformedURLException e) {
                return ResponseEntity.internalServerError().build();
            }
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(
            method = "GET",
            tags = "fieldguide",
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
    @GetMapping(path = "/v1/download/{downloadId}", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<?> offline(
            @Parameter(
                    name = "downloadId",
                    in = PATH,
                    description = "downloadId of the fieldguide",
                    schema = @Schema(implementation = String.class),
                    required = true
            )
            @PathVariable(name = "downloadId") String id) {
        //offline generated field guide download
        QueueItem queueItem = queueService.get(id);
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
                                .header("content-disposition", "attachment; filename=" + queueItem.queueRequest.filename)
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
