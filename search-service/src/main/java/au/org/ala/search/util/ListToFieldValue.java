package au.org.ala.search.util;

import java.util.Map;

@FunctionalInterface
public interface ListToFieldValue {
    String convert(Map<String, Object> it);
}
