package au.org.ala.search.model.cache;

import lombok.AllArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.Comparator;

/*
Subset of SearchItemIndex for caching
 */
@AllArgsConstructor
@SuperBuilder
public class Denormal {
    public String key;

    public static class DenormalCompare implements Comparator<Denormal> {
        @Override
        public int compare(Denormal o1, Denormal o2) {
            String s1 = o1.key == null ? "" : o1.key;
            String s2 = o2.key == null ? "" : o2.key;
            return s1.compareTo(s2);
        }
    }
}
