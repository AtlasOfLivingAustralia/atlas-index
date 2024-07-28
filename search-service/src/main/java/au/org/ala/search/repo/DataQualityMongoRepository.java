package au.org.ala.search.repo;

import au.org.ala.search.model.quality.QualityProfile;
import org.springframework.data.mongodb.repository.MongoRepository;


public interface DataQualityMongoRepository extends MongoRepository<QualityProfile, String> {
    void deleteById(long profileId);
}
