/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.model.query.Op;
import au.org.ala.search.model.query.Term;
import au.org.ala.search.util.QueryParseException;
import au.org.ala.search.util.QueryParserUtil;
import au.org.ala.search.util.ValidField;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class QueryParserUtilTest {

    // A ValidField that accepts any field name containing only word characters
    private static final ValidField ANY_FIELD = field -> field != null && field.matches("[\\w_]+");

    // A ValidField that only accepts known fields — used to test free-text (non-field) values
    private static final ValidField KNOWN_FIELDS = field -> field != null &&
            (field.equals("kingdom") || field.equals("class") || field.equals("year") || field.equals("name"));

    // -------------------------------------------------------------------------
    // value: plain string (free-text, no field)
    // -------------------------------------------------------------------------

    @Test
    public void testSingleFreeTextValue() {
        // "cats" is not a known field, so it becomes a free-text value term
        Op op = QueryParserUtil.parse("cats", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertNull(t.field);
        assertEquals("cats", t.value);
        assertFalse(t.negate);
    }

    @Test
    public void testQuotedStringValue() {
        Op op = QueryParserUtil.parse("\"hello world\"", ANY_FIELD);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertNull(t.field);
        assertEquals("hello world", t.value);
    }

    // -------------------------------------------------------------------------
    // value: field:value
    // -------------------------------------------------------------------------

    @Test
    public void testFieldValue() {
        Op op = QueryParserUtil.parse("kingdom:Animalia", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertEquals("kingdom", t.field);
        assertEquals("Animalia", t.value);
        assertFalse(t.negate);
    }

    @Test
    public void testFieldQuotedValue() {
        Op op = QueryParserUtil.parse("name:\"Aus bus\"", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertEquals("name", t.field);
        assertEquals("Aus bus", t.value);
    }

    // -------------------------------------------------------------------------
    // value: -field:value (negated)
    // -------------------------------------------------------------------------

    @Test
    public void testNegatedFieldValue() {
        Op op = QueryParserUtil.parse("-kingdom:Animalia", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertEquals("kingdom", t.field);
        assertEquals("Animalia", t.value);
        assertTrue(t.negate);
    }

    // -------------------------------------------------------------------------
    // rangeValue: [string TO string]  — fully inclusive
    // -------------------------------------------------------------------------

    @Test
    public void testRangeInclusiveInclusive() {
        Op op = QueryParserUtil.parse("year:[2000 TO 2025]", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertEquals("year", t.field);
        assertNull(t.value);
        assertEquals("2000", t.rangeFrom);
        assertEquals("2025", t.rangeTo);
        assertTrue(t.fromInclusive);
        assertTrue(t.toInclusive);
    }

    // -------------------------------------------------------------------------
    // rangeValue: {string TO string}  — fully exclusive
    // -------------------------------------------------------------------------

    @Test
    public void testRangeExclusiveExclusive() {
        Op op = QueryParserUtil.parse("year:{2000 TO 2025}", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertEquals("year", t.field);
        assertEquals("2000", t.rangeFrom);
        assertEquals("2025", t.rangeTo);
        assertFalse(t.fromInclusive);
        assertFalse(t.toInclusive);
    }

    // -------------------------------------------------------------------------
    // rangeValue: [string TO string}  — left inclusive, right exclusive
    // -------------------------------------------------------------------------

    @Test
    public void testRangeInclusiveExclusive() {
        Op op = QueryParserUtil.parse("year:[2000 TO 2025}", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertEquals("year", t.field);
        assertEquals("2000", t.rangeFrom);
        assertEquals("2025", t.rangeTo);
        assertTrue(t.fromInclusive);
        assertFalse(t.toInclusive);
    }

    // -------------------------------------------------------------------------
    // rangeValue: {string TO string]  — left exclusive, right inclusive
    // -------------------------------------------------------------------------

    @Test
    public void testRangeExclusiveInclusive() {
        Op op = QueryParserUtil.parse("year:{2000 TO 2025]", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertEquals("year", t.field);
        assertEquals("2000", t.rangeFrom);
        assertEquals("2025", t.rangeTo);
        assertFalse(t.fromInclusive);
        assertTrue(t.toInclusive);
    }

    // -------------------------------------------------------------------------
    // rangeValue: wildcard bounds (*)
    // -------------------------------------------------------------------------

    @Test
    public void testRangeWildcardFrom() {
        Op op = QueryParserUtil.parse("year:[* TO 2025]", KNOWN_FIELDS);
        assertNotNull(op);
        Term t = op.terms.get(0);
        assertEquals("*", t.rangeFrom);
        assertEquals("2025", t.rangeTo);
        assertTrue(t.fromInclusive);
        assertTrue(t.toInclusive);
    }

    @Test
    public void testRangeWildcardTo() {
        Op op = QueryParserUtil.parse("year:[2000 TO *]", KNOWN_FIELDS);
        assertNotNull(op);
        Term t = op.terms.get(0);
        assertEquals("2000", t.rangeFrom);
        assertEquals("*", t.rangeTo);
        assertTrue(t.fromInclusive);
        assertTrue(t.toInclusive);
    }

    // -------------------------------------------------------------------------
    // negated range: -field:rangeValue
    // -------------------------------------------------------------------------

    @Test
    public void testNegatedRange() {
        Op op = QueryParserUtil.parse("-year:[2000 TO 2025]", KNOWN_FIELDS);
        assertNotNull(op);
        Term t = op.terms.get(0);
        assertEquals("year", t.field);
        assertTrue(t.negate);
        assertEquals("2000", t.rangeFrom);
        assertEquals("2025", t.rangeTo);
        assertTrue(t.fromInclusive);
        assertTrue(t.toInclusive);
    }

    // -------------------------------------------------------------------------
    // ops: terms OR terms
    // -------------------------------------------------------------------------

    @Test
    public void testOrOp() {
        Op op = QueryParserUtil.parse("kingdom:Animalia OR kingdom:Plantae", KNOWN_FIELDS);
        assertNotNull(op);
        assertFalse(op.andOp);
        assertEquals(2, op.terms.size());
        assertEquals("kingdom", op.terms.get(0).field);
        assertEquals("Animalia", op.terms.get(0).value);
        assertEquals("kingdom", op.terms.get(1).field);
        assertEquals("Plantae", op.terms.get(1).value);
    }

    // -------------------------------------------------------------------------
    // ops: terms AND terms
    // -------------------------------------------------------------------------

    @Test
    public void testAndOp() {
        Op op = QueryParserUtil.parse("kingdom:Animalia AND class:Mammalia", KNOWN_FIELDS);
        assertNotNull(op);
        assertTrue(op.andOp);
        assertEquals(2, op.terms.size());
        assertEquals("kingdom", op.terms.get(0).field);
        assertEquals("Animalia", op.terms.get(0).value);
        assertEquals("class", op.terms.get(1).field);
        assertEquals("Mammalia", op.terms.get(1).value);
    }

    // -------------------------------------------------------------------------
    // ops: (op) — grouped subquery
    // -------------------------------------------------------------------------

    @Test
    public void testGroupedOp() {
        Op op = QueryParserUtil.parse("(kingdom:Animalia OR kingdom:Plantae)", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term wrapper = op.terms.get(0);
        assertNotNull(wrapper.op);
        assertFalse(wrapper.op.andOp);
        assertEquals(2, wrapper.op.terms.size());
    }

    @Test
    public void testNegatedGroupedOp() {
        Op op = QueryParserUtil.parse("-(kingdom:Animalia OR kingdom:Plantae)", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term wrapper = op.terms.get(0);
        assertTrue(wrapper.negate);
        assertNotNull(wrapper.op);
    }

    // -------------------------------------------------------------------------
    // parse(q, fqs, validField) — multiple fqs are ANDed
    // -------------------------------------------------------------------------

    @Test
    public void testParseWithFqs() {
        Op op = QueryParserUtil.parse("cats", new String[]{"kingdom:Animalia", "class:Mammalia"}, KNOWN_FIELDS);
        assertNotNull(op);
        assertTrue(op.andOp);
        assertEquals(3, op.terms.size());
    }

    @Test
    public void testParseNullQueryWithFqs() {
        Op op = QueryParserUtil.parse(null, new String[]{"kingdom:Animalia"}, KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        assertEquals("Animalia", op.terms.get(0).value);
    }

    // -------------------------------------------------------------------------
    // wildcard values — * and ?
    // -------------------------------------------------------------------------

    @Test
    public void testFreeTextWildcardStar() {
        // free-text "cata*" — no field, value contains *
        Op op = QueryParserUtil.parse("cata*", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertNull(t.field);
        assertEquals("cata*", t.value);
    }

    @Test
    public void testFreeTextWildcardQuestion() {
        // free-text "cat?" — no field, value contains ?
        Op op = QueryParserUtil.parse("cat?", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertNull(t.field);
        assertEquals("cat?", t.value);
    }

    @Test
    public void testFreeTextWildcardMixed() {
        // free-text "c?t*" — both wildcard chars
        Op op = QueryParserUtil.parse("c?t*", KNOWN_FIELDS);
        assertNotNull(op);
        Term t = op.terms.get(0);
        assertNull(t.field);
        assertEquals("c?t*", t.value);
    }

    @Test
    public void testFieldWildcardStar() {
        // field:value with trailing *
        Op op = QueryParserUtil.parse("kingdom:Anim*", KNOWN_FIELDS);
        assertNotNull(op);
        assertEquals(1, op.terms.size());
        Term t = op.terms.get(0);
        assertEquals("kingdom", t.field);
        assertEquals("Anim*", t.value);
    }

    @Test
    public void testFieldWildcardQuestion() {
        // field:value with ? wildcard
        Op op = QueryParserUtil.parse("kingdom:Animali?", KNOWN_FIELDS);
        assertNotNull(op);
        Term t = op.terms.get(0);
        assertEquals("kingdom", t.field);
        assertEquals("Animali?", t.value);
    }

    @Test
    public void testFieldWildcardMixed() {
        // field:value with both * and ?
        Op op = QueryParserUtil.parse("kingdom:A?im*", KNOWN_FIELDS);
        assertNotNull(op);
        Term t = op.terms.get(0);
        assertEquals("kingdom", t.field);
        assertEquals("A?im*", t.value);
    }

    @Test
    public void testFieldBareStarIsExists() {
        // field:* is still handled as ExistsQuery, not wildcard
        Op op = QueryParserUtil.parse("kingdom:*", KNOWN_FIELDS);
        assertNotNull(op);
        Term t = op.terms.get(0);
        assertEquals("kingdom", t.field);
        assertEquals("*", t.value);
        // value is bare *, no rangeFrom/rangeTo
        assertNull(t.rangeFrom);
    }

    // -------------------------------------------------------------------------
    // invalid inputs — expect QueryParseException
    // -------------------------------------------------------------------------

    @Test
    public void testInvalidColonOnly() {
        assertThrows(QueryParseException.class, () -> QueryParserUtil.parse(":", KNOWN_FIELDS));
    }

    @Test
    public void testInvalidFieldWithNoValue() {
        assertThrows(QueryParseException.class, () -> QueryParserUtil.parse("kingdom:", new String[0], KNOWN_FIELDS));
    }

    @Test
    public void testInvalidUnmatchedCloseParen() {
        assertThrows(QueryParseException.class, () -> QueryParserUtil.parse("kingdom:Animalia)", KNOWN_FIELDS));
    }

    @Test
    public void testInvalidRangeNoClosingBracket() {
        assertThrows(QueryParseException.class, () -> QueryParserUtil.parse("year:[2000 TO 2025", KNOWN_FIELDS));
    }

    @Test
    public void testInvalidRangeMissingTO() {
        assertThrows(QueryParseException.class, () -> QueryParserUtil.parse("year:[2000 2025]", KNOWN_FIELDS));
    }
}





