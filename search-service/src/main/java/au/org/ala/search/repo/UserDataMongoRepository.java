package au.org.ala.search.repo;

import au.org.ala.search.model.userdata.UserData;
import org.springframework.data.mongodb.repository.MongoRepository;


public interface UserDataMongoRepository extends MongoRepository<UserData, String> {
    void deleteById(String id);
}
