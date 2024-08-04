package au.org.ala.search.controller;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.dto.IndexedField;
import au.org.ala.search.model.dto.SandboxIngress;
import au.org.ala.search.model.queue.*;
import au.org.ala.search.service.AdminService;
import au.org.ala.search.service.AuthService;
import au.org.ala.search.service.LegacyService;
import au.org.ala.search.service.SandboxService;
import au.org.ala.search.service.auth.WebService;
import au.org.ala.search.service.queue.QueueService;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.http.entity.ContentType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.Nullable;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.UnsupportedEncodingException;
import java.net.MalformedURLException;
import java.net.URLEncoder;
import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
            // TODO: make the error message more meaningful
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @SecurityRequirement(name = "JWT")
    @DeleteMapping(path = {"/v1/sandbox/upload"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> delete(
            @RequestParam String id,
            @AuthenticationPrincipal Principal principal) {
        // Delete from uploads directory and SOLR
        // TODO: pass null as the userId when user is admin
        SandboxIngress sandboxIngress = sandboxService.delete(id, authService.getUserId(principal));
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
