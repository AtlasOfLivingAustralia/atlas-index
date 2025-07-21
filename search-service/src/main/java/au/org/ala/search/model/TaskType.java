/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model;

import au.org.ala.search.model.config.ConfigData;
import au.org.ala.search.model.quality.QualityProfile;

/**
 * Represents the type of task that can be performed by the system.
 *
 * At this stage, the task types are categorized into four main categories:
 * - Ingestion: Tasks related to ingesting or updating data in the search index.
 * - Consumer: Tasks that handle requests from end users, such as field guides or search downloads.
 * - Broadcast: Tasks that broadcast messages to all nodes, such as resetting particular caches.
 * - Leader Only: Tasks that are restricted to the leader node, such as data quality admin operations.
 *
 * Each task type has a description, a category, and an optional payload type.
 */
public enum TaskType {
    // Ingestion
    ALL("update search index from all data sources", TaskType.Category.INGESTION, null, true),
    DWCA("replace all TAXON, COMMON, IDENTIFIER, TAXONVARIANT records with contents of dwca.dir (empty index only)", TaskType.Category.INGESTION, null, false),
    BIOCACHE("update accepted TAXON records with count and image values from biocache.wsUrl", TaskType.Category.INGESTION, null, true),
    DIGIVOL("update DIGIVOL records with data from digivol.url", TaskType.Category.INGESTION, null, true),
    AREA("update LOCALITY, REGION and DISTRIBUTION records with data from spatial.url", TaskType.Category.INGESTION, null, true),
    BIOCOLLECT("update BIOCOLLECT records with data from biocollect.url", TaskType.Category.INGESTION, null, true),
    COLLECTIONS("update COLLECTION, INSTITUTION, DATAPROVIDER, DATARESOURCE records with data from collections.url", TaskType.Category.INGESTION, null, true),
    KNOWLEDGEBASE("update KNOWLEDGEBASE records with data from knowledgebase.url", TaskType.Category.INGESTION, null, true),
    LAYER("update LAYER records with data from spatial.url", TaskType.Category.INGESTION, null, true),
    WORDPRESS("update WORDPRESS records with data from wordpress.url", TaskType.Category.INGESTION, null, true),
    LISTS("update LIST records and update fields image, hiddenImages_s, preferred, data.conservation_*, data.attributes_* with data from lists.url", TaskType.Category.INGESTION, null, true),
    SITEMAP("generate new sitemap.xml and children and publish to sitemap.path", TaskType.Category.INGESTION, null, true),
    DASHBOARD("update dashboard files used by the dashboard UI", TaskType.Category.INGESTION, null, true),
    TAXON_DESCRIPTION("import taxon hero descriptions into the search index from data.filestore.path/data.file.descriptions.name", TaskType.Category.INGESTION, null, false),

    // Consumers TODO: add payload types for these tasks
    FIELDGUIDE("consumer of fieldguide requests", TaskType.Category.CONSUMER, null, false),
    SEARCH_DOWNLOAD("consumer of search download requests", TaskType.Category.CONSUMER, null, false),
    SANDBOX("consumer of sandbox ingress request", TaskType.Category.CONSUMER, null, false),

    // Broadcast
    CACHE_RESET_ALL("reset all caches", TaskType.Category.BROADCAST, null, true),
    CACHE_RESET_COLLECTORY("reset collectory caches", TaskType.Category.BROADCAST, null, true),
    CACHE_RESET_LISTS("reset lists caches", TaskType.Category.BROADCAST, null, true),
    CACHE_RESET_DATA_QUALITY("reset data quality caches", TaskType.Category.BROADCAST, null, true),
    CONFIG_CHANGE("broadcast dynamic config change to all nodes", TaskType.Category.BROADCAST, ConfigData.class, true),

    // Leader only tasks
    DATA_QUALITY_DELETE("delete data quality item", TaskType.Category.LEADER_ONLY, QualityProfile.class, false),
    DATA_QUALITY_SAVE("save/update data quality item", TaskType.Category.LEADER_ONLY, QualityProfile.class, false)
    ;

    public final String description;
    public final Category category;
    public final Class <?> payloadType; // optional DTO
    public final boolean schedulable; // whether this task can be scheduled

    TaskType(String description, Category category, Class <?> payloadType, boolean schedulable) {
        this.description = description;
        this.category = category;
        this.payloadType = payloadType;
        this.schedulable = schedulable;
    }

    public enum Category {
        INGESTION,
        CONSUMER,
        BROADCAST,
        LEADER_ONLY
    }
}
