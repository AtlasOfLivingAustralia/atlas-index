/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.util.FormatUtil;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

public class FormatUtilTest {

    @Test
    public void testSanitizeDescriptionA1() {
        String html1 = "<a href=\"https://ala.org.au\">Example</a>";
        String result1 = FormatUtil.htmlToText(html1);

        assertEquals("Example (https://ala.org.au)", result1);
    }

    @Test
    public void testSanitizeDescriptionA2() {
        String html2 = "<a href=\"https://ala.org.au\">https://ala.org.au</a>";
        String result2 = FormatUtil.htmlToText(html2);

        assertEquals("https://ala.org.au", result2);
    }

    @Test
    public void testSanitizeDescriptionA3() {
        String html3 = "Sentence<a href=\"https://ala.org.au\">&nbsp;link</a>";
        String result3 = FormatUtil.htmlToText(html3);

        // This test is expected to fail, as HTML formatted <a> inner text is not supported.
        assertNotEquals("Sentence link (https://ala.org.au)", result3);
        assertEquals("Sentencelink (https://ala.org.au)", result3);
    }

    @Test
    public void testSanitizeDescriptionOL() {
        String html1 = "<ol><li>one</li><li>two</li></ol>";
        String result1 = FormatUtil.htmlToText(html1);

        assertEquals("1. one\n2. two", result1);
    }

    @Test
    public void testSanitizeDescriptionUL() {
        String html1 = "<ul><li>one</li><li>two</li></ul>";
        String result1 = FormatUtil.htmlToText(html1);

        assertEquals("- one\n- two", result1);
    }

    @Test
    public void testSanitizeDescriptionNewLines() {
        String html1 = "<p>one</p><br/><br/> <br/><br/>   <br/><p>two</p>";
        String result1 = FormatUtil.htmlToText(html1);

        assertEquals("one\n\ntwo", result1);
    }
}
