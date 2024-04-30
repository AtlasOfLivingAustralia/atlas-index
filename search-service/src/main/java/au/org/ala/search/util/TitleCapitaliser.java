package au.org.ala.search.util;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * A title capitaliser.
 *
 * <p>Titles are capitalised according to the following rules:
 *
 * <ol>
 *   <li>Certain initial letters with an apostrophe (d', O') are replaced with the correct case and
 *       the following letter capitalised
 *   <li>The first and last words are always capitalised
 *   <li>Conjunctions (and, or, nor, but, for) are lower case
 *   <li>Articles (a, an, the) are lower case
 *   <li>Prepositions (to, from, by, on, at) are lower case
 * </ul>
 *
 * <p>Capitalisation capitalises anything that occurs after a punctuation symbol. So 'a.j.p.'
 * becomes 'A.J.P.' and 'indo-pacific' becomes 'Indo-Pacific'
 *
 * <p>The terms used for articles, etc. are language-specific and can be specified in the <code>
 * messages</code> resource bundle.
 *
 * <p>Constructing a capitaliser can be a little expensive, so the {@link #create} factory method
 * can be used to get a capitaliser for a language.
 *
 * @author Doug Palmer &lt;Doug.Palmer@csiro.au&gt;
 * {@code @copyright} Copyright &copy; 2017 Atlas of Living Australia
 */
public class TitleCapitaliser {
    /**
     * The action to take
     */
    private static final int ACTION_CAPITALISE = 1;
    private static final int ACTION_LOWERCASE = 2;
    private static final int ACTION_ASIS = 3;
    /**
     * Patterns
     */
    private static final Pattern LETTER_APOSTROPHE = Pattern.compile("\\p{L}'\\p{L}.*");
    /**
     * The capitaliser list
     */
    private static final Map<String, TitleCapitaliser> capitializers = new HashMap<>();
    /**
     * The resource bundle to use for word lookups
     */
    static String RESOURCE_BUNDLE = "messages";
    /**
     * The resource bundle entry for conjunctions
     */
    static String CONJUNCTION_RESOURCE = "title.conjunctions";
    /**
     * The resource bundle entry for articless
     */
    static String ARTICLE_RESOURCE = "title.articles";
    /**
     * The resource bundle entry for initial
     */
    static String INITIALS_RESOURCE = "title.initials";
    /**
     * The resource bundle entry for prepositions
     */
    static String PREPOSITION_RESOURCE = "title.prepositions";
    Locale locale;
    Set<String> lowercase;
    Set<String> initials;

    /**
     * Construct a capitaliser for a locale.
     *
     * @param locale The locale
     */
    TitleCapitaliser(Locale locale) {
        this.locale = locale;
        ResourceBundle rb = ResourceBundle.getBundle(RESOURCE_BUNDLE, locale);
        this.lowercase =
                Arrays.stream(rb.getString(CONJUNCTION_RESOURCE).split(","))
                        .map(it -> it.trim().toLowerCase())
                        .collect(Collectors.toSet());
        this.lowercase.addAll(
                Arrays.stream(rb.getString(ARTICLE_RESOURCE).split(","))
                        .map(it -> it.trim().toLowerCase())
                        .collect(Collectors.toSet()));
        this.lowercase.addAll(
                Arrays.stream(rb.getString(PREPOSITION_RESOURCE).split(","))
                        .map(it -> it.trim().toLowerCase())
                        .collect(Collectors.toSet()));
        this.initials =
                Arrays.stream(rb.getString(INITIALS_RESOURCE).split(","))
                        .map(String::trim)
                        .collect(Collectors.toSet());
    }

    /**
     * Construct a capitaliser for a language
     *
     * @param language The language (must map onto a locale)
     */
    TitleCapitaliser(String language) {
        this(Locale.forLanguageTag(language));
    }

    /**
     * Create a capitaliser.
     *
     * @param lang The language code
     * @return The capitaliser
     */
    public static synchronized TitleCapitaliser create(String lang) {
        TitleCapitaliser capitaliser = capitializers.get(lang);
        if (capitaliser == null) {
            capitaliser = new TitleCapitaliser(lang);
            capitializers.put(lang, capitaliser);
        }
        return capitaliser;
    }

    /**
     * Capitalise a title according to the capitaliser rules.
     *
     * @param title The title
     * @return The capitalised title
     */
    public String capitalise(String title) {
        List<String> tokens = Arrays.stream(title.split("\\s+")).toList();
        StringBuilder capitalised = new StringBuilder(title.length());
        for (int i = 0; i < tokens.size(); i++) {
            String token = tokens.get(i);
            String lc = token.toLowerCase();
            int action = ACTION_CAPITALISE;
            Matcher matcher = LETTER_APOSTROPHE.matcher(token);
            if (matcher.matches()) {
                String pre = token.substring(0, 2);
                String puc = pre.toUpperCase();
                String plc = pre.toLowerCase();
                boolean cap = true;
                if (this.initials.contains(puc)) {
                    pre = puc;
                } else if (this.initials.contains(plc)) {
                    pre = plc;
                } else {
                    cap = false;
                }
                if (cap) {
                    token = pre + token.substring(2, 3).toUpperCase() + token.substring(3);
                    action = ACTION_ASIS;
                }
            } else if (i == 0 || i == tokens.size() - 1) {
                action = ACTION_CAPITALISE;
            } else if (this.lowercase.contains(lc)) {
                action = ACTION_LOWERCASE;
            }

            if (!capitalised.isEmpty()) {
                capitalised.append(' ');
            }

            switch (action) {
                case ACTION_CAPITALISE:
                    boolean cap = true;
                    for (int j = 0; j < token.length(); j++) {
                        int ch = token.codePointAt(j);
                        capitalised.appendCodePoint(
                                cap ? Character.toUpperCase(ch) : Character.toLowerCase(ch));
                        cap = !Character.isLetterOrDigit(ch) && ch != 0x27; // 0x27 == '
                    }
                    break;
                case ACTION_LOWERCASE:
                    capitalised.append(token.toLowerCase());
                    break;
                default:
                    capitalised.append(token);
            }
        }
        return capitalised.toString();
    }
}
