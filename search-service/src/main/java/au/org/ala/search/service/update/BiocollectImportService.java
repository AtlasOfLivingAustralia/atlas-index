/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.common.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class BiocollectImportService {
    private static final TaskType taskType = TaskType.BIOCOLLECT;

    private static final Logger logger = LoggerFactory.getLogger(BiocollectImportService.class);
    protected final ElasticService elasticService;
    protected final LogService logService;

    @Value("${biocollect.url}")
    private String biocollectUrl;

    @Value("${biocollect.search}")
    private String biocollectSearch;

    public BiocollectImportService(ElasticService elasticService, LogService logService) {
        this.elasticService = elasticService;
        this.logService = logService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        logService.log(taskType, "Starting");

        List<IndexQuery> buffer = new ArrayList<>();

        Map<String, Date> existingItems = elasticService.queryItems("idxtype", IndexDocType.BIOCOLLECT.name());

        Map<String, SearchItemIndex> items = getList(existingItems);

        int counter = 0;

        for (Map.Entry<String, SearchItemIndex> item : items.entrySet()) {
            buffer.add(elasticService.buildIndexQuery(item.getValue()));

            if (buffer.size() > 1000) {
                counter += elasticService.flushImmediately(buffer);

                logService.log(taskType, "biocollect import progress: " + counter);
            }
        }

        counter += elasticService.flushImmediately(buffer);
        long deleted = elasticService.removeDeletedItems(existingItems);

        logService.log(taskType, "Finished updates: " + counter + ", deleted: " + deleted);
        return CompletableFuture.completedFuture(true);
    }

    // removes pages from existingPages as they are found
    private Map<String, SearchItemIndex> getList(Map<String, Date> existingLists) {
        Map<String, SearchItemIndex> updateList = new HashMap<>();

        try {
            String baseUrl = biocollectUrl + biocollectSearch;

            int max = 100;
            int offset = 0;

            ObjectMapper objectMapper = new ObjectMapper();

            boolean hasMore = true;
            while (hasMore) {
                URL url = URI.create(baseUrl + "&max=" + max + "&offset=" + offset).toURL();
                offset += max;

                Map<String, Object> page = objectMapper.readValue(url, Map.class);
                List<Map<String, Object>> projects = (List<Map<String, Object>>) page.get("projects");

                hasMore = projects.size() == max;

                for (Map<String, Object> project : projects) {
                    SearchItemIndex searchItemIndex = convertProjectToItemIndex(project);

                    if (searchItemIndex == null) {
                        continue;
                    }

                    Date stored = existingLists.get(searchItemIndex.getId());
                    if (stored == null || stored.compareTo(searchItemIndex.getModified()) < 0) {
                        updateList.put(searchItemIndex.getId(), searchItemIndex);
                    }

                    // remove this list from existingLists so that existingLists will only contain projects deleted
                    if (stored != null) {
                        // assume no duplicates
                        existingLists.remove(searchItemIndex.getId());
                    }
                }
            }
        } catch (Exception e) {
            logService.log(taskType, "Error getting project");
            logger.error(e.getMessage(), e);
        }
        return updateList;
    }

    private SearchItemIndex convertProjectToItemIndex(Map<String, Object> project) {
        String id = (String) project.get("url");

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss'Z'");

        Date current;
        try {
            current = sdf.parse((String) project.get("lastUpdated"));
        } catch (Exception e) {
            logService.log(taskType, "failed to parse lastUpdated date for " + id);
            return null;
        }

        Date created;
        try {
            created = sdf.parse((String) project.get("dateCreated"));
        } catch (Exception e) {
            logService.log(taskType, "failed to parse dateCreated date for " + id);
            return null;
        }

        String name = (String) project.get("name");
        String body = (String) project.get("description");

        String projectType = (String) project.get("projectType");
        String image = (String) project.getOrDefault("urlImage", null);
        String containsActivity = project.get("containsActivity").toString();
        String dateCreated = (String) project.getOrDefault("dateCreated", null);
        String keywords = (String) project.getOrDefault("keywords", null);
        if (StringUtils.isEmpty(projectType)) projectType = null;
        if (StringUtils.isEmpty(image)) image = null;
        if (StringUtils.isEmpty(containsActivity)) containsActivity = null;
        if (StringUtils.isEmpty(dateCreated)) dateCreated = null;
        if (StringUtils.isEmpty(keywords)) keywords = null;

        return SearchItemIndex.builder()
                .id(id)
                .guid(id)
                .idxtype(IndexDocType.BIOCOLLECT.name())
                .name(name)
                .description(body)
                .modified(current)
                .projectType(projectType)
                .image(image)
                .containsActivity(containsActivity)
                .dateCreated(dateCreated)
                .keywords(keywords)
                .created(created)
                .build();
    }
}
