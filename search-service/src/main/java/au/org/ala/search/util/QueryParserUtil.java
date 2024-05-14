package au.org.ala.search.util;

import au.org.ala.search.model.query.Op;
import au.org.ala.search.model.query.Term;
import io.micrometer.common.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.StringTokenizer;

/**
 * Converts a SOLR query to an Elasticsearch query. It is a subset, to be expanded as required for legacy support.
 * <p>
 * The current spec:
 * <p>
 * <pre>
 * supports ops
 *   where ops is
 *     terms OR terms
 *     terms AND terms
 *   where terms is
 *     (op)
 *     term
 *   where term is
 *     value
 *     field:value
 *     -field:value
 *   where value is
 *     string
 *     "string"
 * </pre>
 * TODO: unit tests
 */
public class QueryParserUtil {

    static public Op parse(String q, String[] fqs, ValidField validField) {
        Op parentOp = new Op();
        parentOp.andOp = true;

        if (StringUtils.isNotEmpty(q)) {
            if (!addToOp(parentOp, q, validField)) {
                return null;
            }
        }

        for (String fq : fqs) {
            if (StringUtils.isNotEmpty(fq)) {
                if (!addToOp(parentOp, fq, validField)) {
                    return null;
                }
            }
        }

        if (parentOp.terms.isEmpty()) {
            return null;
        }

        return parentOp;
    }

    static private boolean addToOp(Op parentOp, String q, ValidField validField) {
        Op currentOp = parse(q, validField);
        if (currentOp != null) {
            if (currentOp.terms.size() == 1) {
                // add term to be ANDed
                parentOp.terms.add(currentOp.terms.get(0));
            } else {
                Term t = new Term();
                t.op = currentOp;
                parentOp.terms.add(t);
            }
        }
        return currentOp != null;
    }

    static public Op parse(String input, ValidField validField) {
        StringTokenizer tokenizer = new StringTokenizer(input.trim(), " ()\"\\:", true);

        Op parentOp = new Op();
        Op currentOp = parentOp;
        List<Op> opStack = new ArrayList<>();
        List<Boolean> opNegateStack = new ArrayList<>();

        boolean inString = false;
        boolean isSingleValue = false;
        int inBracket = 0;
        String prevToken = null;
        Term currentTerm = new Term();
        String currentString = null;
        while (tokenizer.hasMoreTokens()) {
            String token = tokenizer.nextToken();
            if (isSingleValue) {
                // append everything
                if (":".equals(token)) {
                    // the presence of a ':' means this is not a valid isSingleValue
                    return null;
                }
                currentTerm.value += token;
            } else if (inString) {
                if ("\"".equals(token) && "\\".equals(prevToken)) {
                    currentString += token;
                } else if ("\"".equals(token)) {
                    inString = false;
                    currentTerm.value = currentString;
                    currentOp.terms.add(currentTerm);
                    currentTerm = new Term();
                } else if ("\\".equals(token)) {
                    // do nothing for this escape character
                } else {
                    currentString += token;
                }
            } else if ("\"".equals(token)) {
                inString = true;
                currentString = "";
            } else if ("(".equals(token)) {
                // start new op
                inBracket++;
                opNegateStack.add("-".equals(prevToken));
                opStack.add(currentOp);
                currentOp = new Op();
            } else if (")".equals(token)) {
                // push current op to parent
                if (inBracket == 0) {
                    return null;
                }
                inBracket--;
                Term newTerm = new Term();
                newTerm.negate = opNegateStack.remove(inBracket);
                newTerm.op = currentOp;
                currentOp = opStack.remove(inBracket);
                currentOp.terms.add(newTerm);
            } else if (" ".equals(token)) {
                // do nothing
                continue;
            } else if ("OR".equals(token)) {
                if (":".equals(prevToken) || currentTerm.field != null || currentTerm.value != null) {
                    // cannot have AND after an invalid term
                    return null;
                }
                currentOp.andOp = false;
            } else if ("AND".equals(token)) {
                if (":".equals(prevToken) || currentTerm.field != null || currentTerm.value != null) {
                    // cannot have AND after an invalid term
                    return null;
                }
                currentOp.andOp = true;
            } else if ("-".equals(token)) {
                // this should be the pattern '-(' only. When '(' is encountered this is checked in prevToken.
                continue;
            } else {
                if (currentTerm.field == null && (":".equals(prevToken) || ":".equals(token))) {
                    // field cannot equal ':' or appear immediately after ':'
                    return null;
                } else if (currentTerm.field == null) {
                    if (currentTerm.value != null) {
                        // this is an instance of allowSingleValue:true and an invalid field copied to the value
                        return null;
                    }
                    if (token.startsWith("-")) {
                        currentTerm.negate = true;
                        currentTerm.field = token.substring(1);
                    } else {
                        currentTerm.field = token;
                    }
                    if (!validField.isValid(currentTerm.field)) {
                        // must be a single value when it is not a valid field
                        currentTerm.value = currentTerm.field;
                        currentTerm.field = null;
                        isSingleValue = true;
                        currentOp.terms.add(currentTerm);
                    }
                } else if (!":".equals(token) && ":".equals(prevToken)) { // ':' must appear before a value
                    currentTerm.value = token;
                    currentOp.terms.add(currentTerm);
                    currentTerm = new Term();
                }
            }
            prevToken = token;
        }
        return parentOp;
    }

    static public boolean isValid(String query, ValidField validField) {
        Op op = parse(query, validField);

        return op != null;
    }
}
