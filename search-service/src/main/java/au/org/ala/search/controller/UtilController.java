/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.controller;

import au.org.ala.search.service.auth.WebService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.http.entity.ContentType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Utility, non-versioned, API. Subject to change, removal, etc
 */
@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
public class UtilController {
    private static final Logger logger = LoggerFactory.getLogger(UtilController.class);
    protected final WebService webService;
    @Value("${austraits.url}")
    public String austraitsUrl;

    public UtilController(WebService webService) {
        this.webService = webService;
    }

    @Tag(name = "unsupported")
    @GetMapping("/trait-count")
    public ResponseEntity<?> austraitsCount(
            @RequestParam(name = "taxon", required = true) String taxon,
            @RequestParam(name = "APNI_ID", required = false) String id
    ) {
        Map resp = webService.get(austraitsUrl + "/trait-count?taxon=" + URLEncoder.encode(taxon, StandardCharsets.UTF_8) + (id != null ? "&APNI_ID=" + id : ""), null, ContentType.APPLICATION_JSON, false, false, null);
        if (((Integer) resp.get("statusCode")) != 200) {
            return ResponseEntity.status((Integer) resp.get("statusCode")).body(resp.get("resp"));
        }
        return ResponseEntity.ok(resp.get("resp"));
    }

    @Tag(name = "unsupported")
    @GetMapping("/trait-summary")
    public ResponseEntity<?> austraitsSummary(
            @RequestParam(name = "taxon", required = true) String taxon,
            @RequestParam(name = "APNI_ID", required = false) String id
    ) {
        Map resp = webService.get(austraitsUrl + "/trait-summary?taxon=" + URLEncoder.encode(taxon, StandardCharsets.UTF_8) + (id != null ? "&APNI_ID=" + id : ""), null, ContentType.APPLICATION_JSON, false, false, null);
        if (((Integer) resp.get("statusCode")) != 200) {
            return ResponseEntity.status((Integer) resp.get("statusCode")).body(resp.get("resp"));
        }
        return ResponseEntity.ok(resp.get("resp"));
    }

    @Tag(name = "unsupported")
    @GetMapping(path = "/download-taxon-data", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<?> austraitsDownload(
            @RequestParam(name = "taxon", required = true) String taxon,
            @RequestParam(name = "APNI_ID", required = false) String id
    ) {
        Map resp = webService.get(austraitsUrl + "/download-taxon-data?taxon=" + URLEncoder.encode(taxon, StandardCharsets.UTF_8) + (id != null ? "&APNI_ID=" + id : ""), null, ContentType.TEXT_PLAIN, false, false, null);
        if (((Integer) resp.get("statusCode")) != 200) {
            return ResponseEntity.status((Integer) resp.get("statusCode")).body(resp.get("resp"));
        }
        return ResponseEntity.ok()
                .header("content-type", "text/csv")
                .header("content-disposition", "attachment;filename=" + taxon.replace(" ", "_") + ".csv")
                .body(resp.get("resp"));
    }
}
