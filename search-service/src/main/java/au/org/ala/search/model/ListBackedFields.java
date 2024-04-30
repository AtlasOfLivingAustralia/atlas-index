package au.org.ala.search.model;

public enum ListBackedFields {
    WIKI("wikiUrl_s"),
    HIDDEN("hiddenImages_s"),
    IMAGE("image"),
    NOT_FOUND("");

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
