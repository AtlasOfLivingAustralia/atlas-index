package au.org.ala.search.names;

/**
 * This is a copy from ala-name-matching-model.
 */
public enum TaxonomicType {
    ACCEPTED("accepted", TaxonomicTypeGroup.ACCEPTED, true, true, false, false, false, false, true),
    INFERRED_ACCEPTED(
            "inferredAccepted",
            TaxonomicTypeGroup.ACCEPTED,
            true,
            true,
            false,
            false,
            false,
            false,
            true),
    SYNONYM("synonym", TaxonomicTypeGroup.SYNONYM, true, false, true, false, false, false, true),
    HOMOTYPIC_SYNONYM(
            "homotypicSynonym", TaxonomicTypeGroup.SYNONYM, true, false, true, false, false, false, true),
    OBJECTIVE_SYNONYM(
            "objectiveSynonym", TaxonomicTypeGroup.SYNONYM, true, false, true, false, false, false, true),
    HETEROTYPIC_SYNONYM(
            "heterotypicSynonym",
            TaxonomicTypeGroup.SYNONYM,
            true,
            false,
            true,
            false,
            false,
            false,
            true),
    SUBJECTIVE_SYNONYM(
            "subjectiveSynonym",
            TaxonomicTypeGroup.SYNONYM,
            true,
            false,
            true,
            false,
            false,
            false,
            true),
    PRO_PARTE_SYNONYM(
            "proParteSynonym", TaxonomicTypeGroup.SYNONYM, true, false, true, false, false, false, true),
    MISAPPLIED(
            "misapplied", TaxonomicTypeGroup.MISAPPLIED, false, false, true, false, false, true, true),
    INFERRED_SYNONYM(
            "inferredSynonym", TaxonomicTypeGroup.SYNONYM, true, false, true, false, false, false, true),
    EXCLUDED("excluded", TaxonomicTypeGroup.EXCLUDED, false, false, false, false, false, true, true),
    INCERTAE_SEDIS(
            "incertaeSedis",
            TaxonomicTypeGroup.INCERTAE_SEDIS,
            false,
            true,
            false,
            false,
            true,
            false,
            true),
    SPECIES_INQUIRENDA(
            "speciesInquirenda",
            TaxonomicTypeGroup.INCERTAE_SEDIS,
            false,
            true,
            false,
            false,
            true,
            false,
            true),
    UNPLACED(
            "unplaced",
            TaxonomicTypeGroup.UNPLACED,
            false,
            false,
            false,
            true,
            false,
            false,
            true,
            "unknown"),
    INFERRED_UNPLACED(
            "inferredUnplaced",
            TaxonomicTypeGroup.UNPLACED,
            false,
            false,
            false,
            true,
            false,
            false,
            true),
    INVALID("invalid", TaxonomicTypeGroup.INVALID, false, false, false, false, false, false, true),
    INFERRED_INVALID(
            "inferredInvalid",
            TaxonomicTypeGroup.INVALID,
            false,
            false,
            false,
            false,
            false,
            false,
            true),
    DOUBTFUL("doubtful", TaxonomicTypeGroup.DOUBTFUL, false, false, false, false, false, false, true),
    MISCELLANEOUS_LITERATURE(
            "miscellaneousLiterature",
            TaxonomicTypeGroup.MISCELLANEOUS,
            false,
            false,
            true,
            true,
            false,
            true,
            true),
    PSEUDO_TAXON(
            "pseudoTaxon",
            TaxonomicTypeGroup.MISCELLANEOUS,
            true,
            false,
            true,
            false,
            false,
            false,
            false);

    private final String term;
    private final TaxonomicTypeGroup group;
    private final boolean primary;
    private final boolean accepted;
    private final boolean synonym;
    private final boolean unplaced;
    private final boolean placeholder;
    private final boolean geographic;
    private final boolean output;
    private final String[] labels;

    TaxonomicType(
            String term,
            TaxonomicTypeGroup group,
            boolean primary,
            boolean accepted,
            boolean synonym,
            boolean unplaced,
            boolean placeholder,
            boolean geographic,
            boolean output,
            String... labels) {
        this.term = term;
        this.group = group;
        this.primary = primary;
        this.accepted = accepted;
        this.synonym = synonym;
        this.unplaced = unplaced;
        this.placeholder = placeholder;
        this.geographic = geographic;
        this.output = output;
        this.labels = labels;
    }

    public String getTerm() {
        return this.term;
    }

    public TaxonomicTypeGroup getGroup() {
        return this.group;
    }

    public boolean isPrimary() {
        return this.primary;
    }

    public boolean isAccepted() {
        return this.accepted;
    }

    public boolean isSynonym() {
        return this.synonym;
    }

    public boolean isGeographic() {
        return this.geographic;
    }

    public boolean isUnplaced() {
        return this.unplaced;
    }

    public boolean isPlaceholder() {
        return this.placeholder;
    }

    public boolean isOutput() {
        return this.output;
    }

    public String[] getLabels() {
        return this.labels;
    }
}
