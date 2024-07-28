package au.org.ala.search.repo;

import au.org.ala.search.model.quality.QualityProfile;
import au.org.ala.search.model.sandbox.SandboxUpload;
import org.springframework.data.mongodb.repository.MongoRepository;


public interface SandboxMongoRepository extends MongoRepository<SandboxUpload, String> {
    void deleteByDataResourceUid(String dataResourceUid);
}
