package au.org.ala.search.model;

public enum ListBackedFields {
    WIKI("wikiUrl_s"),
    HIDDEN("hiddenImages_s"),
    IMAGE("image"),
    NOT_FOUND(""),
    NATIVE_INTRODUCED("native_introduced_s"); // JSON map of " Place: Status" pairs

    final public String field;

    ListBackedFields(String field) {
        this.field = field;
    }

    public static ListBackedFields find(String field) {
        for (ListBackedFields lbf : ListBackedFields.values()) {
            if (lbf.field.equals(field)) {
                return lbf;
            }
        }

        return NOT_FOUND;
    }
}
