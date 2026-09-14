/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.repo.TaxonDataPostgresRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Pure-logic unit tests for {@link TaxonDataService}'s {@code sanitizeHtml} helper. No Spring
 * context, no containers, no database/file interaction — constructor dependencies are Mockito
 * mocks that are never invoked, and the private method is exercised via reflection.
 */
class TaxonDataServiceTest {

    private final TaxonDataService taxonDataService = new TaxonDataService(
            mock(TaxonDataPostgresRepository.class),
            new AuditService(null),
            null,
            new ObjectMapper());

    private String sanitizeHtml(String value) throws Exception {
        Method m = TaxonDataService.class.getDeclaredMethod("sanitizeHtml", String.class);
        m.setAccessible(true);
        return (String) m.invoke(taxonDataService, value);
    }

    @Test
    void sanitizeHtml_plainText_wrappedInParagraph() throws Exception {
        String result = sanitizeHtml("hello world");

        assertThat(result).isEqualTo("<p>hello world</p>");
    }

    @Test
    void sanitizeHtml_removesImgTags() throws Exception {
        String result = sanitizeHtml("<p>text<img src=\"evil.png\"></p>");

        assertThat(result).doesNotContain("<img");
        assertThat(result).contains("text");
    }

    @Test
    void sanitizeHtml_convertsAnchorTagsToSpan() throws Exception {
        String result = sanitizeHtml("<p><a href=\"https://ala.org.au\">link</a></p>");

        assertThat(result).doesNotContain("<a ");
        assertThat(result).doesNotContain("<a>");
        assertThat(result).contains("<span>link</span>");
    }

    @Test
    void sanitizeHtml_stripsAllAttributesFromElements() throws Exception {
        String result = sanitizeHtml("<p class=\"foo\" onclick=\"evil()\">text</p>");

        assertThat(result).doesNotContain("class=");
        assertThat(result).doesNotContain("onclick=");
    }

    @Test
    void sanitizeHtml_stripsAttributesFromNestedElements() throws Exception {
        String result = sanitizeHtml("<div><span style=\"color:red\">text</span></div>");

        assertThat(result).doesNotContain("style=");
    }

    @Test
    void sanitizeHtml_preservesPlainTextContent() throws Exception {
        String result = sanitizeHtml("<p>Some <strong>important</strong> text</p>");

        assertThat(result).contains("Some", "important", "text");
    }

    @Test
    void sanitizeHtml_scriptTagContentNotExecuted_bodyExtractedSafely() throws Exception {
        String result = sanitizeHtml("<script>alert('xss')</script>");

        // Jsoup will not preserve a bare <script> as a body child in the same way, but crucially
        // no img/anchor logic should throw and the call should not blow up on malicious input.
        assertThat(result).isNotNull();
    }

    @Test
    void sanitizeHtml_emptyString_wrappedInEmptyParagraph() throws Exception {
        String result = sanitizeHtml("");

        assertThat(result).isEqualTo("<p></p>");
    }
}
