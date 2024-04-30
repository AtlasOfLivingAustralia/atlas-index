package au.org.ala.search.names;

import org.gbif.nameparser.api.ParsedName;
import org.gbif.nameparser.api.Rank;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * This is a copy from ala-name-matching-model using current gbif dependencies.
 */
public class ALAParsedName extends ParsedName {
    public static final Pattern multipleSpaces = Pattern.compile("\\s{2,}");
    public static final Pattern voucherBlacklist = Pattern.compile(" and | AND | And | s.n.| sn ");
    public static final Pattern voucherRemovePattern = Pattern.compile("[^\\w]");
    public static final Pattern potentialVoucherId = Pattern.compile("([^A-Z][A-Z]{1,3} [0-9])");
    public static final Pattern initialOnePattern = Pattern.compile("(?:[A-Z][\\.]){1,3}");
    public static final Pattern initialTwoPattern = Pattern.compile("(?:[^A-Z][A-Z]{1,3} )");
    public static final Pattern phraseBlacklist =
            Pattern.compile("&| AND | and |Stn|Stn\\.|Station|Mt |Mt\\.|Mount");
    public static final Pattern phrasePunctuationRemoval = Pattern.compile("'|\"");
    public String locationPhraseDescription = null;
    public String cleanPhrase = null;
    public String phraseVoucher = null;
    public String cleanVoucher = null;
    public String phraseNominatingParty = null;

    public ALAParsedName() {
    }

    public ALAParsedName(ParsedName pn) {
        copy(pn);
    }

    /**
     * @deprecated
     */
    public String getLocationPhraseDesciption() {
        return this.locationPhraseDescription;
    }

    public String getLocationPhraseDescription() {
        return this.locationPhraseDescription;
    }

    public void setLocationPhraseDescription(String locationPhraseDescription) {
        this.locationPhraseDescription = locationPhraseDescription;
        if (this.getRank() == Rank.SPECIES) {
            this.setSpecificEpithet(locationPhraseDescription);
        } else if (this.getRank() == Rank.CULTIVAR) {
            this.setCultivarEpithet(locationPhraseDescription);
        } else {
            this.setInfraspecificEpithet(locationPhraseDescription);
        }

        if (locationPhraseDescription != null) {
            this.cleanPhrase =
                    phraseBlacklist.matcher(" " + locationPhraseDescription).replaceAll(" ").trim();
            this.cleanPhrase = phrasePunctuationRemoval.matcher(this.cleanPhrase).replaceAll("");
            this.cleanPhrase = multipleSpaces.matcher(this.cleanPhrase).replaceAll(" ");
        }
    }

    public String getPhraseNominatingParty() {
        return this.phraseNominatingParty;
    }

    public void setPhraseNominatingParty(String phraseNominatingParty) {
        this.phraseNominatingParty = phraseNominatingParty;
    }

    public String getPhraseVoucher() {
        return this.phraseVoucher;
    }

    public void setPhraseVoucher(String phraseVoucher) {
        this.phraseVoucher = phraseVoucher;
        if (phraseVoucher != null) {
            this.cleanVoucher = phraseVoucher;
            Matcher m = potentialVoucherId.matcher(this.cleanVoucher);
            if (m.find()) {
                this.cleanVoucher = m.replaceFirst(" " + m.group().replaceAll(" ", ""));
            }

            this.cleanVoucher = voucherBlacklist.matcher(this.cleanVoucher).replaceAll(" ");
            this.cleanVoucher = initialOnePattern.matcher(this.cleanVoucher).replaceAll(" ");
            this.cleanVoucher = initialTwoPattern.matcher(this.cleanVoucher).replaceAll(" ");
            this.cleanVoucher = voucherRemovePattern.matcher(this.cleanVoucher).replaceAll("");
        }
    }
}
