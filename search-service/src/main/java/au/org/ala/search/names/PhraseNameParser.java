/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.names;

import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.text.WordUtils;
import org.gbif.nameparser.NameParserGBIF;
import org.gbif.nameparser.api.*;
import org.gbif.nameparser.util.RankUtils;

import java.util.HashMap;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * This is a copy from ala-name-matching-model using current gbif dependencies.
 */
public class PhraseNameParser extends NameParserGBIF {
    public static final HashMap<String, Rank> VALID_PHRASE_RANKS;
    public static final String ALL_LETTERS_NUMBERS = "A-ZÏËÖÜÄÉÈČÁÀÆŒa-zïëöüäåéèčáàæœ0-9";
    public static final Pattern RANK_MARKER;
    protected static final String LOCATION_OR_DESCR =
            "(?:[A-ZÏËÖÜÄÉÈČÁÀÆŒa-zïëöüäåéèčáàæœ0-9 -'\"_\\.]+|\\.)";
    protected static final String VOUCHER = "(\\([A-ZÏËÖÜÄÉÈČÁÀÆŒa-zïëöüäåéèčáàæœ0-9- \\./&,']+\\))";
    protected static final String COMMENTARY = "(\\[[^\\]]*\\])";
    protected static final String SOURCE_AUTHORITY =
            "([A-ZÏËÖÜÄÉÈČÁÀÆŒa-zïëöüäåéèčáàæœ0-9'\" -,\\.]+|\\.)";
    protected static final String PHRASE_RANKS;
    protected static final Pattern SPECIES_PATTERN;
    protected static final Pattern POTENTIAL_SPECIES_PATTERN;
    protected static final Pattern PHRASE_PATTERN;
    protected static final Pattern WRONG_CASE_INFRAGENERIC;
    protected static final String RANK_MARKER_INFRAGENERIC;
    protected static final String NUMBER_PLACEHOLDER = "\\d+\\.?";
    protected static final Pattern NUMBERED_PLACEHOLDER;
    protected static final Pattern IGNORE_MARKERS;
    private static final String RANK_MARKER_ALL;

    static {
        HashMap<String, Rank> ranks = new HashMap();
        ranks.put("f", Rank.FORM);
        ranks.put("subsp", Rank.SUBSPECIES);
        ranks.put("ssp", Rank.SUBSPECIES);
        ranks.put("var", Rank.VARIETY);
        ranks.put("sp", Rank.SPECIES);
        ranks.put("cv", Rank.CULTIVAR);
        VALID_PHRASE_RANKS = ranks;
        PHRASE_RANKS = "(?:" + StringUtils.join(VALID_PHRASE_RANKS.keySet(), "|") + ")\\.? ";
        RANK_MARKER_ALL =
                "(notho)? *(" + StringUtils.join(RankUtils.RANK_MARKER_MAP.keySet(), "|") + ")\\.?";
        RANK_MARKER = Pattern.compile("^" + RANK_MARKER_ALL + "$");
        SPECIES_PATTERN = Pattern.compile("sp\\.?");
        POTENTIAL_SPECIES_PATTERN =
                Pattern.compile(
                        "^([\\x00-\\x7F\\s]*)("
                                + SPECIES_PATTERN.pattern()
                                + " )(["
                                + "a-zïëöüäåéèčáàæœ"
                                + "]{3,})(?: *)([\\x00-\\x7F\\s]*)");
        PHRASE_PATTERN =
                Pattern.compile(
                        "^([\\x00-\\x7F\\s]*)(?: *)("
                                + PHRASE_RANKS
                                + ")(?: *)("
                                + "(?:[A-ZÏËÖÜÄÉÈČÁÀÆŒa-zïëöüäåéèčáàæœ0-9 -'\"_\\.]+|\\.)"
                                + ")"
                                + "(\\([A-ZÏËÖÜÄÉÈČÁÀÆŒa-zïëöüäåéèčáàæœ0-9- \\./&,']+\\))"
                                + "?(?: *)"
                                + "(\\[[^\\]]*\\])"
                                + "?(?: *)"
                                + "([A-ZÏËÖÜÄÉÈČÁÀÆŒa-zïëöüäåéèčáàæœ0-9'\" -,\\.]+|\\.)"
                                + "?$");
        WRONG_CASE_INFRAGENERIC =
                Pattern.compile(
                        "(?:\\( ?([a-zïëöüäåéèčáàæœ-]+) ?\\)|("
                                + StringUtils.join(RankUtils.RANK_MARKER_MAP_INFRAGENERIC.keySet(), "|")
                                + ")\\.? ?(["
                                + "A-ZÏËÖÜÄÉÈČÁÀÆŒ"
                                + "]["
                                + "a-zïëöüäåéèčáàæœ"
                                + "-]+))");
        RANK_MARKER_INFRAGENERIC =
                "(?:" + StringUtils.join(RankUtils.RANK_MARKER_MAP_INFRAGENERIC.keySet(), "|") + ")\\.?";
        NUMBERED_PLACEHOLDER =
                Pattern.compile(
                        "([A-ZÏËÖÜÄÉÈČÁÀÆŒ](?:\\.|[a-zïëöüäåéèčáàæœ]+)(?:-[A-ZÏËÖÜÄÉÈČÁÀÆŒ]?[a-zïëöüäåéèčáàæœ]+)?)\\s+(("
                                + RANK_MARKER_INFRAGENERIC
                                + "|[Gg]roup|[Ss]ub[Gg]roup)[\\s_\\-]*"
                                + "\\d+\\.?"
                                + ")(\\s+"
                                + "(?:(?:(?:[A-ZÏËÖÜÄÉÈČÁÀÆŒ\\p{Lu}]{1,3}\\.?[ -]?){0,3}|[A-ZÏËÖÜÄÉÈČÁÀÆŒ\\p{Lu}][a-zïëöüäåéèčáàæœ\\p{Ll}-?]{3,} )?(?:[vV](?:an)(?:[ -](?:den|der) )? ?|von[ -](?:den |der |dem )?|(?:del|de|di|da)[`' _]|(?:Des|De|Di|N)[`' _]?|(?:de )?(?:la|le) |d'|D'|Mac|Mc|Le|St\\.? ?|Ou|O')?(?:v\\. )?[A-ZÏËÖÜÄÉÈČÁÀÆŒ\\p{Lu}]+[a-zïëöüäåéèčáàæœ\\p{Ll}-?]*\\.?(?:(?:[- ](?:de|da|du)?[- ]?)[A-ZÏËÖÜÄÉÈČÁÀÆŒ\\p{Lu}]+[a-zïëöüäåéèčáàæœ\\p{Ll}-?]*\\.?)?(?: ?(?:f|fil|j|jr|jun|junior|sr|sen|senior|ms)\\.?)?(?: *: *(?:Pers|Fr)\\.?)?)?(?:(?: ?ex\\.? | & | et | in |, ?|; ?|\\.)(?:(?:(?:(?:[A-ZÏËÖÜÄÉÈČÁÀÆŒ\\p{Lu}]{1,3}\\.?[ -]?){0,3}|[A-ZÏËÖÜÄÉÈČÁÀÆŒ\\p{Lu}][a-zïëöüäåéèčáàæœ\\p{Ll}-?]{3,} )?(?:[vV](?:an)(?:[ -](?:den|der) )? ?|von[ -](?:den |der |dem )?|(?:del|de|di|da)[`' _]|(?:Des|De|Di|N)[`' _]?|(?:de )?(?:la|le) |d'|D'|Mac|Mc|Le|St\\.? ?|Ou|O')?(?:v\\. )?[A-ZÏËÖÜÄÉÈČÁÀÆŒ\\p{Lu}]+[a-zïëöüäåéèčáàæœ\\p{Ll}-?]*\\.?(?:(?:[- ](?:de|da|du)?[- ]?)[A-ZÏËÖÜÄÉÈČÁÀÆŒ\\p{Lu}]+[a-zïëöüäåéèčáàæœ\\p{Ll}-?]*\\.?)?(?: ?(?:f|fil|j|jr|jun|junior|sr|sen|senior|ms)\\.?)?(?: *: *(?:Pers|Fr)\\.?)?)|al\\.?))*"
                                + "(\\s*,\\s*"
                                + "[12][0-9][0-9][0-9?][abcdh?]?(?:[/-][0-9]{1,4})?"
                                + ")?)?");
        IGNORE_MARKERS = Pattern.compile("s[\\.| ]+str[\\. ]+");
    }

    public PhraseNameParser() {
    }

    public ParsedName parse(String scientificName, Rank rank)
            throws InterruptedException, UnparsableNameException {
        ParsedName pn = super.parse(scientificName, rank);
        Matcher m = NUMBERED_PLACEHOLDER.matcher(scientificName);
        String newName;
        boolean isAuthorsParsed = false;
        if (m.matches()) {
            String nameRank = m.group(3);
            newName = m.group(1);
            String epithet = m.group(2);
            String author = m.group(4) == null ? null : m.group(4).trim();
            if (StringUtils.isNotBlank(newName)
                    && StringUtils.isNotBlank(epithet)
                    && StringUtils.isNotBlank(nameRank)) {
                if (StringUtils.isNotBlank(author)) {
                    pn.setBasionymAuthorship(new Authorship(List.of(author)));
                }

                isAuthorsParsed = true;
                pn.setRank(rank != null ? rank : RankUtils.inferRank(nameRank));
                pn.setSpecificEpithet(epithet.replaceAll("[ _-]+", "-"));
                pn.setType(NameType.PLACEHOLDER);
                return pn;
            }
        }

        if (pn.getType() != NameType.SCIENTIFIC
                && this.isPhraseRank(pn.getRank())
                && (!isAuthorsParsed
                || pn.getSpecificEpithet() == null
                || SPECIES_PATTERN.matcher(pn.getSpecificEpithet()).matches())) {
            if (SPECIES_PATTERN.matcher(scientificName).find()) {
                Matcher m1 = POTENTIAL_SPECIES_PATTERN.matcher(scientificName);
                if (m1.find()) {
                    newName = m1.group(1) + m1.group(3) + StringUtils.defaultString(m1.group(4), "");
                    pn = super.parse(newName, rank);
                    if (pn.getType() == NameType.SCIENTIFIC) {
                        return pn;
                    }
                }
            }

            m = PHRASE_PATTERN.matcher(scientificName);
            if (m.find()) {
                ALAParsedName alapn = new ALAParsedName(pn);
                alapn.setInfragenericEpithet(null);
                alapn.setSpecificEpithet(null);
                alapn.setInfraspecificEpithet(null);
                alapn.setSanctioningAuthor(null);
                alapn.setLocationPhraseDescription(StringUtils.trimToNull(m.group(3)));
                alapn.setPhraseVoucher(StringUtils.trimToNull(m.group(4)));
                alapn.setPhraseNominatingParty(StringUtils.trimToNull(m.group(6)));
                return alapn;
            }
        } else {
            m = WRONG_CASE_INFRAGENERIC.matcher(scientificName);
            if (m.find()) {
                scientificName = WordUtils.capitalize(scientificName, '(');
                pn = super.parse(scientificName, rank);
            }
        }

        return pn;
    }

    private boolean isPhraseRank(Rank rank) {
        return rank != null && VALID_PHRASE_RANKS.containsValue(rank);
    }
}
