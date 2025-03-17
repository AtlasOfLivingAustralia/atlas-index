package au.org.ala.search.model;

public enum TaskType {
    // Ingestion
    ALL("update search index from all data sources"),
    DWCA("replace all TAXON, COMMON, IDENTIFIER, TAXONVARIANT records with contents of dwca.dir (empty index only)"),
    BIOCACHE("update accepted TAXON records with count and image values from biocache.wsUrl"),
    DIGIVOL("update DIGIVOL records with data from digivol.url"),
    AREA("update LOCALITY, REGION and DISTRIBUTION records with data from spatial.url"),
    BIOCOLLECT("update BIOCOLLECT records with data from biocollect.url"),
    COLLECTIONS("update COLLECTION, INSTITUTION, DATAPROVIDER, DATARESOURCE records with data from collections.url"),
    KNOWLEDGEBASE("update KNOWLEDGEBASE records with data from knowledgebase.url"),
    LAYER("update LAYER records with data from spatial.url"),
    WORDPRESS("update WORDPRESS records with data from wordpress.url"),
    LISTS("update LIST records and update fields image, hiddenImages_s, preferred, data.conservation_*, data.attributes_* with data from lists.url"),
    SITEMAP("generate new sitemap.xml and children and publish to sitemap.path"),
    DASHBOARD("update dashboard files used by the dashboard UI"),
    TAXON_DESCRIPTION("import taxon hero descriptions into the search index from data.filestore.path/data.file.descriptions.name"),

    // Consumers
    FIELDGUIDE("consumer of fieldguide requests"),
    SEARCH_DOWNLOAD("consumer of search download requests"),
    SANDBOX("consumer of sandbox ingress request"),

    // Generic tasks
    CACHE_RESET("reset local caches"),;

    public final String description;

    TaskType(String description) {
        this.description = description;
    }
}
