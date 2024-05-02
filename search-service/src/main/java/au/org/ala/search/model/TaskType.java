package au.org.ala.search.model;

public enum TaskType {
    ALL("update search index from all data sources"),
    DWCA("replace all TAXON, COMMON, IDENTIFIER, TAXONVARIANT records with contents of dwca.dir"),
    BIOCACHE("update accepted TAXON records with count and image values from biocache.wsUrl"),
    AREA("update LOCALITY and REGION records with data from spatial.url"),
    BIOCOLLECT("update BIOCOLLECT records with data from biocollect.url"),
    COLLECTIONS("update COLLECTION, INSTITUTION, DATAPROVIDER, DATARESOURCE records with data from collections.url"),
    KNOWLEDGEBASE("update KNOWLEDGEBASE records with data from knowledgebase.url"),
    LAYER("update LAYER records with data from spatial.url"),
    WORDPRESS("update WORDPRESS records with data from wordpress.url"),
    LISTS("update LIST records and update fields wikiUrl_s, image, hiddenImages_s, preferred, data.conservation_*, data.attributes_* with data from lists.url"),
    SITEMAP("generate new sitemap.xml and children and publish to sitemap.path"),

    // TODO: implement TaskType.RECORD event code
    // - addition of text field + lastmod date for each. to hold a JSON blob
    // - code to fetch this information for a single record (to be of use by a call to /species/{taxonID})
    // - code to update a single record for all of these fields (or just one of these fields)
    // - code to bulk update all of these fields (or a subset with long expiry, e.g. prep for receiving a site crawl)
    RECORD("update a single record's dynamic data, e.g. wiki, profiles, bhl, genbank, distributions, distributions, counts, images (biocache), geographical extents"),

    DASHBOARD("update dashboard.json used by the dashboard UI"),

    // Consumers
    FIELDGUIDE("consumer of fieldguide requests");

    public final String description;

    TaskType(String description) {
        this.description = description;
    }
}
