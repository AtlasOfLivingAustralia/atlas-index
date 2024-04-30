package au.org.ala.search.service;

import au.org.ala.search.model.ListBackedFields;
import au.org.ala.search.model.dto.SetRequest;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.ListService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class AdminService {

    private static final Logger logger = LoggerFactory.getLogger(AdminService.class);
    protected final ElasticsearchOperations elasticsearchOperations;
    protected final ElasticService elasticService;
    protected final ListService listService;

    @Value("${lists.wiki.id}")
    private String wikiListId;
    @Value("${lists.wiki.field}")
    private String wikiListField;

    @Value("${lists.images.hidden.id}")
    private String hiddenImageListId;
    @Value("${lists.images.hidden.field}")
    private String hiddenImageListField;

    @Value("${lists.images.preferred.id}")
    private String preferredImageListId;
    @Value("${lists.images.preferred.field}")
    private String preferredImageListField;


    public AdminService(
            ElasticsearchOperations elasticsearchOperations, ElasticService elasticService, ListService listService) {
        this.elasticsearchOperations = elasticsearchOperations;
        this.elasticService = elasticService;
        this.listService = listService;
    }

    public boolean setValue(SetRequest setRequest) {
        String listId;
        String listField;
        switch (ListBackedFields.find(setRequest.getField())) {
            case ListBackedFields.WIKI:
                listId = wikiListId;
                listField = wikiListField;
                break;
            case ListBackedFields.HIDDEN:
                listId = hiddenImageListId;
                listField = hiddenImageListField;
                break;
            case ListBackedFields.IMAGE:
                listId = preferredImageListId;
                listField = preferredImageListField;
                break;
            default:
                return false;
        }
        listService.updateItem(listId, listField, setRequest);

        String esId = elasticService.queryTaxonId(setRequest.getTaxonID());

        Document doc = Document.create();
        doc.put(setRequest.getField(), setRequest.getValue());

        elasticService.updateImmediately(Collections.singletonList(UpdateQuery.builder(esId).withDocument(doc).build()));

        return true;
    }
}
