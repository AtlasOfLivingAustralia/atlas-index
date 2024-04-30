package au.org.ala.search.names;

import org.gbif.dwc.terms.Term;
import org.gbif.dwc.terms.TermFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;

/**
 * This is a copy from ala-name-matching-model using current gbif dependencies.
 */
public enum ALATerm implements Term {
    verbatimNomenclaturalCode,
    verbatimTaxonomicStatus,
    verbatimNomenclaturalStatus,
    verbatimTaxonRemarks,
    nameComplete,
    nameFormatted,
    nameID,
    status,
    priority,
    kingdomID,
    phylumID,
    classID,
    orderID,
    familyID,
    genusID,
    speciesID,
    subphylum,
    subclass,
    suborder,
    infraorder,
    labels,
    value,
    principalTaxonID,
    principalScientificName,
    taxonomicFlags,
    parentLocationID,
    geographyType,
    distribution,
    doi,
    UnplacedVernacularName,
    UnplacedReference,
    TaxonVariant,
    TaxonomicIssue,
    Location("dwc:", "http://rs.tdwg.org/dwc/terms/");

    public static final String NS = "http://ala.org.au/terms/1.0/";
    public static final String PREFIX = "ala:";

    static {
        TermFactory factory = TermFactory.instance();
        Arrays.stream(values()).forEach(factory::registerTerm);
    }

    private final String prefix;
    private final String namespace;

    ALATerm(String prefix, String namespace) {
        this.prefix = prefix;
        this.namespace = namespace;
    }

    ALATerm() {
        this("ala:", "http://ala.org.au/terms/1.0/");
    }

    public String qualifiedName() {
        return this.namespace + this.simpleName();
    }

    @Override
    public boolean isClass() {
        return false;
    }

    @Override
    public String prefix() {
        return this.prefix;
    }

    @Override
    public URI namespace() {
        try {
            return new URI(namespace);
        } catch (URISyntaxException e) {
            throw new RuntimeException(e);
        }
    }

    public String simpleName() {
        return this.name();
    }

    public String toString() {
        return this.prefix + this.name();
    }
}
