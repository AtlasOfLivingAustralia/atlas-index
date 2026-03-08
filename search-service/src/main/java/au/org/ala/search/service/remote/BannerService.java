/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.banner.BannerEntry;
import au.org.ala.search.repo.BannerPostgresRepository;
import au.org.ala.search.service.queue.BroadcastQueue;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
public class BannerService {

    @Value("#{'${banner.sections}'.split(',')}")
    private List<String> defaultSections;

    private final BannerPostgresRepository bannerPostgresRepository;
    private final AuditService auditService;

    /** In-memory cache of the last built response map. Null until first load. */
    private final AtomicReference<Map<String, Object>> cache = new AtomicReference<>();

    public BannerService(BannerPostgresRepository bannerPostgresRepository, AuditService auditService) {
        this.bannerPostgresRepository = bannerPostgresRepository;
        this.auditService = auditService;
    }

    @PostConstruct
    void init() {
        cacheRefresh();
    }

    /**
     * Refreshes the in-memory cache from the database.
     * Called on startup, on a schedule (in case a broadcast message is missed),
     * and whenever a banner is saved.
     */
    @Scheduled(fixedRate = 60 * 60 * 1000, initialDelay = 60 * 1000)
    public void cacheRefresh() {
        try {
            cache.set(buildMap());
            log.debug("Banner message cache refreshed");
        } catch (Exception e) {
            log.error("Failed to refresh banner message cache: {}", e.getMessage(), e);
        }
    }

    /**
     * Returns all banner entries as an ordered map keyed by section name.
     * Served from the in-memory cache; falls back to a live DB read if the cache
     * has not been populated yet.
     */
    public Map<String, Object> getAll() {
        Map<String, Object> cached = cache.get();
        if (cached != null) {
            return cached;
        }
        // shouldn't normally happen – @PostConstruct runs before requests are served
        return buildMap();
    }

    /** Reads fresh data from the DB and builds the response map. */
    @Transactional(readOnly = true)
    Map<String, Object> buildMap() {
        List<BannerEntry> entries = bannerPostgresRepository.findAll();
        Map<String, BannerEntry> bySection = new LinkedHashMap<>();
        for (BannerEntry e : entries) {
            bySection.put(e.getSection(), e);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        for (String section : defaultSections) {
            BannerEntry e = bySection.get(section);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("message",  e != null ? e.getMessage()  : "");
            entry.put("severity", e != null ? e.getSeverity() : "INFO");
            entry.put("updated",  e != null ? e.getUpdated().toString() : OffsetDateTime.now().toString());
            result.put(section, entry);
        }
        // include any extra sections present in the DB but not in the defaults list
        for (BannerEntry e : entries) {
            if (!result.containsKey(e.getSection())) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("message",  e.getMessage());
                entry.put("severity", e.getSeverity());
                entry.put("updated",  e.getUpdated().toString());
                result.put(e.getSection(), entry);
            }
        }
        return result;
    }

    /**
     * Saves (insert or update) a banner entry, refreshes the local cache, and
     * broadcasts a {@code CACHE_RESET_BANNER_MESSAGES} message so that all other
     * instances also refresh their caches.
     */
    @Transactional
    public void save(String section, String message, String severity, String actor) {
        if (section == null || section.isBlank()) {
            throw new IllegalArgumentException("section is required");
        }
        if (message == null) {
            message = "";
        }
        if (severity == null || severity.isBlank()) {
            severity = "INFO";
        }

        BannerEntry existing = bannerPostgresRepository.findById(section).orElse(null);
        BannerEntry entry = existing != null ? existing : new BannerEntry();

        // Build diff before mutating
        Map<String, Object> diff = AuditService.merge(
                AuditService.diff("message",  existing != null ? existing.getMessage()  : null, message),
                AuditService.diff("severity", existing != null ? existing.getSeverity() : null, severity));

        entry.setSection(section);
        entry.setMessage(message);
        entry.setSeverity(severity.toUpperCase());
        entry.setUpdated(OffsetDateTime.now());
        bannerPostgresRepository.save(entry);

        // Audit
        auditService.record(AuditService.TABLE_BANNER, section, section, actor, AuditService.ACTION_UPDATE, diff);

        // refresh local cache immediately so this instance is up-to-date
        cacheRefresh();

        // broadcast to all other instances
        try {
            if (BroadcastQueue.getInstance() != null) {
                BroadcastQueue.getInstance().sendMessage(TaskType.CACHE_RESET_BANNER_MESSAGES, null);
            } else {
                log.warn("BroadcastQueue not initialised – banner cache reset not broadcast");
            }
        } catch (Exception e) {
            log.error("Failed to broadcast banner cache reset: {}", e.getMessage(), e);
        }
    }
}
