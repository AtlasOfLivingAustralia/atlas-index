package au.org.ala.search.util;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.dto.Profile;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public class FormatUtil {
    public static String getHighlightedName(String name, String term) {
        String prefix = "<b>";
        String suffix = "</b>";
        String value;
        boolean isHighlight = false;

        //have word highlight
        if (term != null) {
            value = cleanName(term.trim());
            isHighlight = true;
        } else {
            value = "";
        }

        Pattern p = Pattern.compile(value, Pattern.CASE_INSENSITIVE);
        java.util.regex.Matcher m = p.matcher(value);

        String name1;
        name = name.trim();
        if (isHighlight) {
            name1 = name;
        } else {
            name1 = concatName(name);
        }
        m.reset(name1);
        if (m.find()) {
            //insert <b> and </b>at the start and end index
            name = name.substring(0, m.start()) + prefix + name.substring(m.start(), m.end()) + suffix + name.substring(m.end());
        }

        return name;
    }

    static public List<Profile> itemsToProfiles(List<SearchItemIndex> items) {
        List<Profile> profiles = new ArrayList<>();
        for (SearchItemIndex item : items) {
            profiles.add(new Profile(item.guid, item.scientificName,
                    // TODO: include other definitions of accepted, e.g. why is the taxonomicStatus test required?
                    StringUtils.isNotEmpty(item.acceptedConceptID) ? item.acceptedConceptID : ("accepted".equals(item.taxonomicStatus) ? item.guid : ""),
                    StringUtils.isNotEmpty(item.acceptedConceptName) ? item.acceptedConceptName : ("accepted".equals(item.taxonomicStatus) ? item.scientificName : "")));
        }

        return profiles;
    }

    public static String cleanName(String name) {
        String patternA = "[^a-zA-Z]";
        /* replace multiple whitespaces between words with single blank */
        String patternB = "\\b\\s{2,}\\b";

        String cleanQuery = "";
        if (name != null) {
            cleanQuery = name;//ClientUtils.escapeQueryChars(name);//.toLowerCase();
            cleanQuery = cleanQuery.toLowerCase();
            cleanQuery = cleanQuery.replaceAll(patternA, " ");
            cleanQuery = cleanQuery.replaceAll(patternB, " ");
            cleanQuery = cleanQuery.trim();
        }
        return cleanQuery;
    }

    public static String concatName(String name) {
        String patternA = "[^a-zA-Z]";
        /* replace multiple whitespaces between words with single blank */
        String patternB = "\\b\\s{2,}\\b";

        String cleanQuery = "";
        if (name != null) {
            cleanQuery = name;//ClientUtils.escapeQueryChars(name);//.toLowerCase();
            cleanQuery = cleanQuery.toLowerCase();
            cleanQuery = cleanQuery.replaceAll(patternA, "");
            cleanQuery = cleanQuery.replaceAll(patternB, "");
            cleanQuery = cleanQuery.trim();
        }
        return cleanQuery;
    }
}
