package au.org.ala.search.service.remote;

import au.org.ala.search.model.quality.QualityCategory;
import au.org.ala.search.model.quality.QualityFilter;
import au.org.ala.search.model.quality.QualityProfile;
import au.org.ala.search.repo.DataQualityMongoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Data Quality service API
 */
@Service
public class DataQualityService {

    private static final Logger logger = LoggerFactory.getLogger(DataQualityService.class);

    protected final DataQualityMongoRepository dataQualityMongoRepository;
    protected final CacheManager cacheManager;
    protected final StaticFileStoreService staticFileStoreService;

    @Getter
    List<QualityProfile> profiles;

    final Object editLock = new Object();

    public DataQualityService(DataQualityMongoRepository dataQualityMongoRepository, CacheManager cacheManager, StaticFileStoreService staticFileStoreService) {
        this.dataQualityMongoRepository = dataQualityMongoRepository;
        this.cacheManager = cacheManager;
        this.staticFileStoreService = staticFileStoreService;
    }

    final private AtomicLong uniqueId = new AtomicLong(1);
    private Long nextId() {
        return uniqueId.getAndAdd(1);
    }

    @PostConstruct
    void init() {
        // read from mongoDB, all profiles
        profiles = dataQualityMongoRepository.findAll();

        // init unique id
        long maxId = 1;
        for (QualityProfile profile : profiles) {
            if (profile.getId() != null && profile.getId() > maxId) {
                maxId = profile.getId();
            }
            profile.setId(nextId());
            for (QualityCategory category : profile.getCategories()) {
                if (category.getId() != null && category.getId() > maxId) {
                    maxId = category.getId();
                }
                for (QualityFilter filter : category.getQualityFilters()) {
                    if (filter.getId() != null && filter.getId() > maxId) {
                        maxId = filter.getId();
                    }
                }
            }
        }
        uniqueId.set(maxId + 1);
    }

    private String invert(String query) {
        if (StringUtils.isNotEmpty(query)) {
            if (query.startsWith("-")) {
                return query.substring(1);
            } else {
                return "-" + query;
            }
        }
        return "-(" + query + ")";
    }

    public void clearCache() {
        profiles = dataQualityMongoRepository.findAll();
        cacheManager.getCache("qualityProfiles").clear();
    }

    @Cacheable("qualityProfiles")
    public List<QualityProfile> getProfiles(String shortName, String name, Boolean enabled, Integer max, Integer offset, String sort, String order) {
        List<QualityProfile> list = new ArrayList<>();

        for (QualityProfile profile : profiles) {
            if (StringUtils.isNotBlank(shortName) && !profile.getShortName().equals(shortName)) {
                continue;
            }
            if (StringUtils.isNotBlank(name) && !profile.getName().equals(name)) {
                continue;
            }
            if (enabled != null && profile.isEnabled() != enabled) {
                continue;
            }

            list.add(profile);
        }

        if (StringUtils.isNotEmpty(sort) && StringUtils.isNotEmpty(order)) {
            list.sort((a, b) -> {
                return switch (sort) {
                    case "shortName" -> a.getShortName().compareTo(b.getShortName());
                    case "name" -> a.getName().compareTo(b.getName());
                    case "dateCreated" -> a.getDateCreated().compareTo(b.getDateCreated());
                    case "lastUpdated" -> a.getLastUpdated().compareTo(b.getLastUpdated());
                    case "displayOrder" -> a.getDisplayOrder().compareTo(b.getDisplayOrder());
                    default -> 0;
                };
            });
        }

        if (offset >= list.size()) {
            return new ArrayList<>();
        }

        return list.subList(offset, Math.min(list.size(), offset + max));
    }

    @Cacheable("qualityProfiles")
    public QualityProfile getProfile(String profileId) {
        Optional<QualityProfile> profile = profiles.stream().filter(p -> p.getId().toString().equals(profileId) || p.getShortName().equals(profileId)).findFirst();
        return profile.orElse(null);
    }

    @Cacheable("qualityProfiles")
    public QualityCategory getCategory(String profileId, Long categoryId) {
        Optional<QualityProfile> profile = profiles.stream().filter(p -> p.getId().toString().equals(profileId) || p.getShortName().equals(profileId)).findFirst();
        if (profile.isPresent()) {
            Optional<QualityCategory> category = profile.get().getCategories().stream().filter(it -> it.getId().equals(categoryId)).findFirst();
            return category.orElse(null);
        }
        return null;
    }

    @Cacheable("qualityProfiles")
    public QualityFilter getFilter(String profileId, Long categoryId, Long id) {
        Optional<QualityProfile> profile = profiles.stream().filter(p -> p.getId().toString().equals(profileId) || p.getShortName().equals(profileId)).findFirst();
        if (profile.isPresent()) {
            Optional<QualityCategory> category = profile.get().getCategories().stream().filter(it -> it.getId().equals(categoryId)).findFirst();
            if (category.isPresent()) {
                Optional<QualityFilter> filter = category.get().getQualityFilters().stream().filter(it -> it.getId().equals(id)).findFirst();
                return filter.orElse(null);
            }
        }
        return null;
    }

    @Cacheable("qualityProfiles")
    public QualityProfile getProfileOrDefault(String profileName) {
        Optional<QualityProfile> profile = StringUtils.isNotEmpty(profileName) ?
                profiles.stream().filter(p -> p.getShortName().equals(profileName) || p.getName().equals(profileName)).findFirst() :
                Optional.empty();

        if (profile.isEmpty()) {
            return profiles.stream().filter(QualityProfile::isDefault).findFirst().orElse(null);
        }
        return profile.get();
    }

    @Cacheable("qualityProfiles")
    public Map<String, String> getEnabledFiltersByLabel(String profileName) {
        Map<String, String> map = new HashMap<>();

        QualityProfile profile = getProfileOrDefault(profileName);

        if (profile != null) {
            profile.getCategories().forEach(category -> {
                if (category.isEnabled()) {
                    List<String> filters = category.getQualityFilters().stream().filter(QualityFilter::isEnabled).map(QualityFilter::getFilter).toList();
                    if (!filters.isEmpty()) {
                        map.put(category.getLabel(), String.join(" AND ", filters));
                    }
                }
            });
        }

        return map;
    }

    @Cacheable("qualityProfiles")
    public Set<String> getEnabledQualityFilters(String profileName) {
        Set<String> set = new HashSet<>();

        QualityProfile profile = getProfileOrDefault(profileName);

        if (profile != null) {
            profile.getCategories().forEach(category -> {
                if (category.isEnabled()) {
                    category.getQualityFilters().stream().filter(QualityFilter::isEnabled).forEach(it -> set.add(it.getFilter()));
                }
            });
        }

        return set;
    }

    @Cacheable("qualityProfiles")
    public LinkedHashMap<String, List<QualityFilter>> getGroupedEnabledFilters(String profileName) {
        LinkedHashMap<String, List<QualityFilter>> map = new LinkedHashMap<>();

        QualityProfile profile = getProfileOrDefault(profileName);

        if (profile != null) {
            profile.getCategories().forEach(category -> {
                if (category.isEnabled()) {
                    List<QualityFilter> filters = category.getQualityFilters().stream().filter(QualityFilter::isEnabled).toList();
                    if (!filters.isEmpty()) {
                        map.put(category.getLabel(), filters);
                    }
                }
            });
        }

        return map;
    }

    @Cacheable("qualityProfiles")
    public List<QualityCategory> findAllEnabledCategories(String profileName) {
        List<QualityCategory> result = new ArrayList<>();

        QualityProfile profile = getProfileOrDefault(profileName);

        if (profile != null) {
            profile.getCategories().forEach(category -> {
                if (category.isEnabled()) {
                    QualityCategory qc = QualityCategory.builder()
                            .id(category.getId())
                            .enabled(category.isEnabled())
                            .name(category.getName())
                            .label(category.getLabel())
                            .description(category.getDescription())
                            .displayOrder(category.getDisplayOrder())
                            .inverseFilter(category.getInverseFilter())
                            .qualityFilters(new ArrayList<>())
                            .build();
                    category.getQualityFilters().forEach(qf -> {
                        qc.getQualityFilters().add(QualityFilter.builder()
                                .id(qf.getId())
                                .enabled(qf.isEnabled())
                                .filter(qf.getFilter())
                                .description(qf.getDescription())
                                .displayOrder(qf.getDisplayOrder())
                                .build());
                    });
                    result.add(qc);
                }
            });
        }

        return result;
    }

    @Cacheable("qualityProfiles")
    public String getJoinedQualityFilter(String profileName) {
        return StringUtils.join(getEnabledQualityFilters(profileName), " AND ");
    }

    @Cacheable("qualityProfiles")
    public String getInverseCategoryFilter(Long qualityCategoryId) {
        List<QualityFilter> filters = new ArrayList<>();
        List<String> inverseFilter = new ArrayList<>();
        profiles.forEach(it -> {
            it.getCategories().forEach(category -> {
                if (category.getId().equals(qualityCategoryId)) {
                    if (StringUtils.isNotEmpty(category.getInverseFilter())) {
                        inverseFilter.add(category.getInverseFilter());
                    } else {
                        filters.addAll(category.getQualityFilters().stream().filter(QualityFilter::isEnabled).toList());
                    }
                }
            });
        });

        if (!inverseFilter.isEmpty()) {
            return inverseFilter.getFirst();
        }

        return StringUtils.join(filters.stream().map(it -> invert(it.getFilter())).toList(), " OR ");
    }

    @Cacheable("qualityProfiles")
    public Map<String, String> getAllInverseCategoryFiltersForProfile(String qualityProfileId) {
        Map<String, String> result = new HashMap<>();

        QualityProfile profile = getProfileOrDefault(qualityProfileId);

        if (profile != null) {
            profile.getCategories().forEach(category -> {
                if (category.isEnabled()) {
                    if (StringUtils.isNotEmpty(category.getInverseFilter())) {
                        result.put(category.getLabel(), category.getInverseFilter());
                    } else {
                        List<QualityFilter> filters = category.getQualityFilters().stream().filter(QualityFilter::isEnabled).toList();

                        String inverse = StringUtils.join(filters.stream().map(it -> invert(it.getFilter())).toList(), " OR ");

                        result.put(category.getLabel(), inverse);
                    }
                }
            });
        }

        return  result;
    }

    public boolean delete(Long profileId) {
        synchronized (editLock) {
            try {
                dataQualityMongoRepository.deleteById(profileId);

                clearCache();

                exportProfiles();

                return true;
            } catch (Exception e) {
                logger.error("Error deleting profile", e);
                return false;
            }
        }
    }

    // Requests are from admin only, so there is a high level of trust in the data
    public QualityProfile save(QualityProfile profile) {
        synchronized (editLock) {
            // ensure isDefault:true is unique
            if (profile.isDefault()) {
                // remove isDefault from all other profiles
                profiles.forEach(it -> {
                    if (it.isDefault() && !it.getId().equals(profile.getId())) {
                        it.setDefault(false);
                        dataQualityMongoRepository.save(it);
                    }
                });
            } else {
                // do not remove isDefault from the last profile
                if (profiles.stream().noneMatch(QualityProfile::isDefault)) {
                    profile.setDefault(true);
                }
            }

            // update lastUpdated
            profile.setLastUpdated(new Date());

            // set inverseFilter for all categories and filters without one
            profile.getCategories().forEach(category -> {
                category.getQualityFilters().forEach(filter -> {
                    if (StringUtils.isEmpty(filter.getInverseFilter())) {
                        filter.setInverseFilter(invert(filter.getFilter()));
                    }
                });

                if (StringUtils.isEmpty(category.getInverseFilter())) {
                    List<QualityFilter> filters = category.getQualityFilters().stream().filter(QualityFilter::isEnabled).toList();

                    String inverse = StringUtils.join(filters.stream().map(QualityFilter::getInverseFilter).toList(), " OR ");

                    category.setInverseFilter(inverse);
                }
            });

            // A legacy requirement is that QualityFilter.id and QualityCategory.id are unique, not null and not 0.
            profile.getCategories().forEach(category -> {
                category.getQualityFilters().forEach(filter -> {
                    if (filter.getId() == null || filter.getId() == 0) {
                        filter.setId(nextId());
                    }
                });
                if (category.getId() == null || category.getId() == 0) {
                    category.setId(nextId());
                }
            });

            // Remove placeholder profile.id=0. To be populated by mongodb.
            if (profile.getId() == null || profile.getId() == 0) {
                profile.setId(nextId());
            }

            // displayOrder must be present
            if (profile.getDisplayOrder() == null) {
                profile.setDisplayOrder((long) profiles.size());
            }

            try {
                QualityProfile savedProfile = dataQualityMongoRepository.save(profile);

                clearCache();

                exportProfiles();

                return savedProfile;
            } catch (Exception e) {
                logger.error("Error saving profile", e);
                return null;
            }
        }
    }

    public void exportProfiles() throws IOException {
        File tmpFile = File.createTempFile("qualityProfiles", ".json");
        FileUtils.writeStringToFile(tmpFile, new ObjectMapper().writeValueAsString(profiles), "UTF-8");
        staticFileStoreService.copyToFileStore(tmpFile, "dataQuality/profiles.json", true);
    }
}
