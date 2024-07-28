package au.org.ala.search.repo;

import au.org.ala.search.model.queue.QueueItem;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface QueueMongoRepository extends MongoRepository<QueueItem, String> {

}
