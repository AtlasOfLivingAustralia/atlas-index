/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.AdminIndex;
import au.org.ala.search.model.TaskType;
import co.elastic.clients.elasticsearch._types.SortOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.elasticsearch.core.query.IndexQueryBuilder;
import org.springframework.data.elasticsearch.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Date;
import java.util.List;

@Service
public class LogService {

    private static final Logger logger = LoggerFactory.getLogger(LogService.class);
    protected final ElasticsearchOperations elasticsearchOperations;

    @Value("${elastic.adminIndex}")
    private String elasticAdminIndex;

    public LogService(ElasticsearchOperations elasticsearchOperations) {
        this.elasticsearchOperations = elasticsearchOperations;
    }

    public void log(TaskType task, String message) {
        long time = System.currentTimeMillis();
        IndexQuery item = new IndexQueryBuilder()
                .withId(task.name() + "-" + time)
                .withObject(AdminIndex.builder().id(task.name() + time)
                        .message(message)
                        .task(task.name())
                        .modified(new Date(time)))
                .build();
        elasticsearchOperations.bulkIndex(Collections.singletonList(item), AdminIndex.class);
    }

    public List<AdminIndex> getStatus(TaskType task, int size) {
        PageRequest p = PageRequest.of(0, size);

        Query query = NativeQuery.builder()
                .withQuery(q -> q.term(t -> t.field("task").value(task.name())))
                .withPageable(p)
                .withSort(s -> s.field(fs -> fs.field("modified").order(SortOrder.Desc)))
                .build();

        return elasticsearchOperations.search(query, AdminIndex.class, IndexCoordinates.of(elasticAdminIndex)).stream().map(SearchHit::getContent).toList();
    }
}
