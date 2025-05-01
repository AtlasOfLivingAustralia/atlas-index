/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.dto.Profile;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

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
                    // I do wonder if "accepted" is appropriate here, or if it should be omitted.
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

    /**
     * Convert and sanitize HTML to plain text.
     * <p>
     * Includes handing for: <a>, <ol>, <ul>, <br>, <p>
     *
     * @param html the HTML to sanitize and convert to plain text
     * @return the sanitized description as plain text
     */
    public static String htmlToText(String html) {
        if (html == null || html.trim().isEmpty()) {
            return "";
        }

        // Parse HTML
        Document doc = Jsoup.parse(html);
        doc.select("script, style").remove();

        // Handle unordered lists
        for (Element ul : doc.select("ul")) {
            List<Element> numberedList = new ArrayList<>();
            for (Element li : ul.select("li")) {
                if (!numberedList.isEmpty()) {
                    numberedList.add(new Element("br"));
                }
                numberedList.add(new Element("span").text("- " + li.text()));
            }
            ul.replaceWith(new Element("p").appendChildren(numberedList));
        }

        // Handle ordered lists
        for (Element ol : doc.select("ol")) {
            List<Element> numberedList = new ArrayList<>();
            int count = 1;
            for (Element li : ol.select("li")) {
                if (!numberedList.isEmpty()) {
                    numberedList.add(new Element("br"));
                }
                numberedList.add(new Element("span").text(count + ". " + li.text()));
                count++;
            }
            ol.replaceWith(new Element("p").appendChildren(numberedList));
        }

        for (Element a : doc.select("a")) {
            String text = a.text();
            String href = a.attr("href");

            // If the text of the link looks like a URL, don't include it in the text
            if (!text.startsWith("http")) {
                a.replaceWith(new Element("span").text(text + " (" + href + ")"));
            } else {
                a.replaceWith(new Element("span").text(text));
            }
        }

        return doc.body().html()
                .replaceAll("&nbsp;", " ")
                .replaceAll("<br\\s*/?>", "\n")
                .replaceAll("</p>", "\n\n")
                .replaceAll("<[^>]+>", "")
                .replaceAll("(\\n\\s*){3,}", "\n\n")
                .trim();
    }
}
