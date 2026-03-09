/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

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
 *     field:rangeValue
 *     -field:value
 *     -field:rangeValue
 *   where value is
 *     string
 *     "string"
 *   where rangeValue is
 *     [string TO string]
 *     {string TO string}
 *     [string TO string}
 *     {string TO string]
 * </pre>
 */
public class QueryParserUtil {

    static public Op parse(String q, String[] fqs, ValidField validField) {
        Op parentOp = new Op();
        parentOp.andOp = true;

        if (StringUtils.isNotEmpty(q)) {
            addToOp(parentOp, q, validField);
        }

        if (fqs != null) {
            for (String fq : fqs) {
                if (StringUtils.isNotEmpty(fq)) {
                    addToOp(parentOp, fq, validField);
                }
            }
        }

        if (parentOp.terms.isEmpty()) {
            throw new QueryParseException("Query produced no terms: '" + q + "'");
        }

        return parentOp;
    }

    static private void addToOp(Op parentOp, String q, ValidField validField) {
        Op currentOp = parse(q, validField);
        if (currentOp.terms.isEmpty()) {
            throw new QueryParseException("Query produced no terms: '" + q + "'");
        } else if (currentOp.terms.size() == 1) {
            // add term to be ANDed
            parentOp.terms.add(currentOp.terms.get(0));
        } else {
            Term t = new Term();
            t.op = currentOp;
            parentOp.terms.add(t);
        }
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
        int rangeState = -1; // -1=not range, 0=from, 1=TO keyword, 2=to
        while (tokenizer.hasMoreTokens()) {
            String token = tokenizer.nextToken();
            if (isSingleValue) {
                // append everything
                if (":".equals(token)) {
                    // the presence of a ':' means this is not a valid isSingleValue
                    throw new QueryParseException("'" + currentTerm.value + "' is not a valid field name");
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
                    throw new QueryParseException("Unexpected ')' without matching '('");
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
                    throw new QueryParseException("Unexpected 'OR' after incomplete term");
                }
                currentOp.andOp = false;
            } else if ("AND".equals(token)) {
                if (":".equals(prevToken) || currentTerm.field != null || currentTerm.value != null) {
                    throw new QueryParseException("Unexpected 'AND' after incomplete term");
                }
                currentOp.andOp = true;
            } else if ("-".equals(token)) {
                // this should be the pattern '-(' only. When '(' is encountered this is checked in prevToken.
            } else if (rangeState >= 0) {
                if (rangeState == 1) {
                    // expecting 'TO'
                    if (!"TO".equalsIgnoreCase(token)) {
                        throw new QueryParseException("Expected 'TO' in range expression for field '" + currentTerm.field + "', got '" + token + "'");
                    }
                    rangeState = 2;
                } else {
                    // reading 'to' value — may end with ] or }
                    if (token.endsWith("]")) {
                        currentTerm.toInclusive = true;
                    } else if (token.endsWith("}")) {
                        currentTerm.toInclusive = false;
                    } else {
                        throw new QueryParseException("Range expression for field '" + currentTerm.field + "' missing closing ']' or '}'");
                    }
                    currentTerm.rangeTo = token.substring(0, token.length() - 1);

                    rangeState = -1; // end of range
                    currentOp.terms.add(currentTerm);
                    currentTerm = new Term();
                }
            } else {
                if (currentTerm.field == null && (":".equals(prevToken) || ":".equals(token))) {
                    throw new QueryParseException("Unexpected ':' without a preceding field name");
                } else if (currentTerm.field == null) {
                    if (currentTerm.value != null) {
                        // this is an instance of allowSingleValue:true and an invalid field copied to the value
                        throw new QueryParseException("Unexpected token '" + token + "' after value '" + currentTerm.value + "'");
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
                    if (token.startsWith("[") || token.startsWith("{")) {
                        // start of a range value
                        currentTerm.fromInclusive = token.startsWith("[");
                        String fromPart = token.substring(1);
                        if (!fromPart.isEmpty()) {
                            currentTerm.rangeFrom = fromPart;
                            rangeState = 1;
                        } else {
                            throw new QueryParseException("Empty 'from' value in range expression for field '" + currentTerm.field + "'");
                        }
                    } else {
                        currentTerm.value = token;
                        currentOp.terms.add(currentTerm);
                        currentTerm = new Term();
                    }
                }
            }
            prevToken = token;
        }
        return parentOp;
    }
}
