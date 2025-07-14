package au.org.ala.search.repo;

import au.org.ala.search.model.quality.QualityProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DataQualityPostgresRepository extends JpaRepository<QualityProfile, Long> {
    // This repository interface will automatically provide CRUD operations for QualityProfile entities.
    // Additional custom query methods can be defined here if needed.
}
