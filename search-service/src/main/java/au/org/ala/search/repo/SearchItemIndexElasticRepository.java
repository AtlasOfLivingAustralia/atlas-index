package au.org.ala.search.repo;

import au.org.ala.search.model.SearchItemIndex;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

public interface SearchItemIndexElasticRepository
        extends ElasticsearchRepository<SearchItemIndex, String> {
}
