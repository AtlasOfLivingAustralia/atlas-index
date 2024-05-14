package au.org.ala.search.util;

@FunctionalInterface
public interface ValidField {
    boolean isValid(String fieldName);
}
