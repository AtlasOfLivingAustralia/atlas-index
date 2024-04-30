package au.org.ala.search.names;

/**
 * This is a copy from bie-index identifierStatus.json.
 */
public enum IdentifierStatus {
    PRIMARY(600, "primary", "The current primary identifier for something"),
    CURRENT(500, "current", "An alternative, currently used identifirt"),
    REPLACED(
            400,
            "replaced",
            "An identifier that has been replaced but may be referred to in outdated documents"),
    DISCARDED(
            300,
            "discarded",
            "An identifier for a taxon discarded in processing that has been mapped onto this taxon"),
    UNKNOWN(200, "unknown", "An identifier of unknown status"),
    DEPRECATED(100, "deprecated", "An identifier that should not be used");

    private final Integer priority;
    private final String name;
    private final String description;

    IdentifierStatus(Integer priority, String name, String description) {
        this.priority = priority;
        this.name = name;
        this.description = description;
    }

    public Integer getPriority() {
        return this.priority;
    }

    public String getName() {
        return this.name;
    }

    public String getDescription() {
        return this.description;
    }
}
