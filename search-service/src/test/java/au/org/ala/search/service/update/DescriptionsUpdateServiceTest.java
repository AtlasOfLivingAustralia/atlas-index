/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import org.junit.jupiter.api.Test;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Pure-logic unit tests for {@link DescriptionsUpdateService}'s {@code buildUpdateQuery}
 * helper. No Spring context, no containers — constructor dependencies are Mockito mocks, and
 * the private method is exercised via reflection. {@code elasticService.update(...)} is
 * verified via Mockito rather than actually contacting Elasticsearch.
 */
class DescriptionsUpdateServiceTest {

    private final ElasticService elasticService = mock(ElasticService.class);
    private final DescriptionsUpdateService descriptionsUpdateService = new DescriptionsUpdateService(
            elasticService, mock(LogService.class), null);

    private void buildUpdateQuery(List<UpdateQuery> updates, String documentId, Object newDescription)
            throws Exception {
        Method m = DescriptionsUpdateService.class.getDeclaredMethod(
                "buildUpdateQuery", List.class, String.class, Object.class);
        m.setAccessible(true);
        m.invoke(descriptionsUpdateService, updates, documentId, newDescription);
    }

    @Test
    void buildUpdateQuery_addsQueryToList() throws Exception {
        List<UpdateQuery> updates = new ArrayList<>();

        buildUpdateQuery(updates, "doc-1", "New description");

        assertThat(updates).hasSize(1);
        assertThat(updates.get(0).getId()).isEqualTo("doc-1");
    }

    @Test
    void buildUpdateQuery_belowBatchSize_doesNotFlush() throws Exception {
        List<UpdateQuery> updates = new ArrayList<>();

        buildUpdateQuery(updates, "doc-1", "desc");

        verify(elasticService, never()).update(org.mockito.ArgumentMatchers.anyList());
        assertThat(updates).hasSize(1);
    }

    @Test
    void buildUpdateQuery_reachesBatchSize_flushesAndClearsList() throws Exception {
        // batchSize is a private constant of 10000; pre-fill the list to one below that so the
        // next call triggers the flush.
        List<UpdateQuery> updates = new ArrayList<>();
        for (int i = 0; i < 9999; i++) {
            Document doc = Document.create();
            doc.put("heroDescription", "desc-" + i);
            updates.add(UpdateQuery.builder("doc-" + i).withDocument(doc).build());
        }

        buildUpdateQuery(updates, "doc-9999", "desc");

        verify(elasticService, times(1)).update(org.mockito.ArgumentMatchers.anyList());
        assertThat(updates).isEmpty();
    }
}
