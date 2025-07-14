/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.quality.QualityCategory;
import au.org.ala.search.model.quality.QualityFilter;
import au.org.ala.search.model.quality.QualityProfile;
import au.org.ala.search.repo.DataQualityPostgresRepository;
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

    protected final DataQualityPostgresRepository dataQualityRepository;
    protected final CacheManager cacheManager;
    protected final StaticFileStoreService staticFileStoreService;
    final Object editLock = new Object();
    final private AtomicLong uniqueId = new AtomicLong(1);
    @Getter
    List<QualityProfile> profiles;

    public DataQualityService(DataQualityPostgresRepository dataQualityRepository, CacheManager cacheManager, StaticFileStoreService staticFileStoreService) {
        this.dataQualityRepository = dataQualityRepository;
        this.cacheManager = cacheManager;
        this.staticFileStoreService = staticFileStoreService;
    }

    private Long nextId() {
        return uniqueId.getAndAdd(1);
    }

    @PostConstruct
    void init() {
        // read from mongoDB, all profiles
        profiles = dataQualityRepository.findAll();

        // fetch the max id from the profiles, categories and filters.
        long maxId = 1;
        for (QualityProfile profile : profiles) {
            if (profile.getId() != null && profile.getId() > maxId) {
                maxId = profile.getId();
            }
            for (QualityCategory category : profile.getData().getCategories()) {
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
        profiles = dataQualityRepository.findAll();
        cacheManager.getCache("qualityProfiles").clear();
    }

    public List<QualityProfile> getProfiles(String shortName, String name, Boolean enabled, Integer max, Integer offset, String sort, String order) {
        List<QualityProfile> list = new ArrayList<>();

        for (QualityProfile profile : profiles) {
            if (StringUtils.isNotBlank(shortName) && !profile.getData().getShortName().equals(shortName)) {
                continue;
            }
            if (StringUtils.isNotBlank(name) && !profile.getName().equals(name)) {
                continue;
            }
            if (enabled != null && profile.getData().isEnabled() != enabled) {
                continue;
            }

            list.add(profile);
        }

        if (StringUtils.isNotEmpty(sort) && StringUtils.isNotEmpty(order)) {
            int direction = order.equalsIgnoreCase("desc") ? -1 : 1;
            list.sort((a, b) -> {
                return switch (sort) {
                    case "id" -> a.getId().compareTo(b.getId()) * direction;
                    case "shortName" -> a.getData().getShortName().compareTo(b.getData().getShortName()) * direction;
                    case "name" -> a.getName().compareTo(b.getName()) * direction;
                    case "dateCreated" -> a.getData().getDateCreated().compareTo(b.getData().getDateCreated()) * direction;
                    case "lastUpdated" -> a.getData().getLastUpdated().compareTo(b.getData().getLastUpdated()) * direction;
                    case "displayOrder" -> a.getData().getDisplayOrder().compareTo(b.getData().getDisplayOrder()) * direction;
                    default -> 0;
                };
            });
        }

        if (offset >= list.size()) {
            return new ArrayList<>();
        }

        return list.subList(offset, Math.min(list.size(), offset + max));
    }

    @Cacheable(value = "qualityProfiles", key = "'getProfile_' + #profileId")
    public QualityProfile getProfile(String profileId) {
        Optional<QualityProfile> profile = profiles.stream().filter(p -> p.getId().toString().equals(profileId) || p.getData().getShortName().equals(profileId)).findFirst();
        return profile.orElse(null);
    }

    @Cacheable(value = "qualityProfiles", key = "'getCategory_' + #profileId + '_' + #categoryId")
    public QualityCategory getCategory(String profileId, Long categoryId) {
        Optional<QualityProfile> profile = profiles.stream().filter(p -> p.getId().toString().equals(profileId) || p.getData().getShortName().equals(profileId)).findFirst();
        if (profile.isPresent()) {
            Optional<QualityCategory> category = profile.get().getData().getCategories().stream().filter(it -> it.getId().equals(categoryId)).findFirst();
            return category.orElse(null);
        }
        return null;
    }

    @Cacheable(value = "qualityProfiles", key = "'getFilter_' + #profileId + '_' + #categoryId + '_' + #id")
    public QualityFilter getFilter(String profileId, Long categoryId, Long id) {
        Optional<QualityProfile> profile = profiles.stream().filter(p -> p.getId().toString().equals(profileId) || p.getData().getShortName().equals(profileId)).findFirst();
        if (profile.isPresent()) {
            Optional<QualityCategory> category = profile.get().getData().getCategories().stream().filter(it -> it.getId().equals(categoryId)).findFirst();
            if (category.isPresent()) {
                Optional<QualityFilter> filter = category.get().getQualityFilters().stream().filter(it -> it.getId().equals(id)).findFirst();
                return filter.orElse(null);
            }
        }
        return null;
    }

    @Cacheable(value = "qualityProfiles", key = "'getProfileOrDefault_' + #profileName")
    public QualityProfile getProfileOrDefault(String profileName) {
        int id = StringUtils.isNumeric(profileName) ? Integer.parseInt(profileName) : 0;
        Optional<QualityProfile> profile = StringUtils.isNotEmpty(profileName) ?
                profiles.stream().filter(p -> p.getData().getShortName().equals(profileName) || p.getName().equals(profileName) || p.getId() == id).findFirst() :
                Optional.empty();

        if (profile.isEmpty()) {
            return profiles.stream().filter(q -> q.getData().isDefault()).findFirst().orElse(null);
        }
        return profile.get();
    }

    @Cacheable(value = "qualityProfiles", key = "'getEnabledFiltersByLabel_' + #profileName")
    public Map<String, String> getEnabledFiltersByLabel(String profileName) {
        Map<String, String> map = new HashMap<>();

        QualityProfile profile = getProfileOrDefault(profileName);

        if (profile != null) {
            profile.getData().getCategories().forEach(category -> {
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

    @Cacheable(value = "qualityProfiles", key = "'getEnabledQualityFilters_' + #profileName")
    public Set<String> getEnabledQualityFilters(String profileName) {
        Set<String> set = new HashSet<>();

        QualityProfile profile = getProfileOrDefault(profileName);

        if (profile != null) {
            profile.getData().getCategories().forEach(category -> {
                if (category.isEnabled()) {
                    category.getQualityFilters().stream().filter(QualityFilter::isEnabled).forEach(it -> set.add(it.getFilter()));
                }
            });
        }

        return set;
    }

    @Cacheable(value = "qualityProfiles", key = "'getGroupedEnabledFilters_' + #profileName")
    public LinkedHashMap<String, List<QualityFilter>> getGroupedEnabledFilters(String profileName) {
        LinkedHashMap<String, List<QualityFilter>> map = new LinkedHashMap<>();

        QualityProfile profile = getProfileOrDefault(profileName);

        if (profile != null) {
            profile.getData().getCategories().forEach(category -> {
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

    @Cacheable(value = "qualityProfiles", key = "'findAllEnabledCategories_' + #profileName")
    public List<QualityCategory> findAllEnabledCategories(String profileName) {
        List<QualityCategory> result = new ArrayList<>();

        QualityProfile profile = getProfileOrDefault(profileName);

        if (profile != null) {
            profile.getData().getCategories().forEach(category -> {
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

    @Cacheable(value = "qualityProfiles", key = "'getJoinedQualityFilter_' + #profileName")
    public String getJoinedQualityFilter(String profileName) {
        return StringUtils.join(getEnabledQualityFilters(profileName), " AND ");
    }

    @Cacheable(value = "qualityProfiles", key = "'getInverseCategoryFilter_' + #qualityCategoryId")
    public String getInverseCategoryFilter(Long qualityCategoryId) {
        List<QualityFilter> filters = new ArrayList<>();
        List<String> inverseFilter = new ArrayList<>();
        profiles.forEach(it -> {
            it.getData().getCategories().forEach(category -> {
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

    @Cacheable(value = "qualityProfiles", key = "'getAllInverseCategoryFiltersForProfile_' + #qualityProfileId")
    public Map<String, String> getAllInverseCategoryFiltersForProfile(String qualityProfileId) {
        Map<String, String> result = new HashMap<>();

        QualityProfile profile = getProfileOrDefault(qualityProfileId);

        if (profile != null) {
            profile.getData().getCategories().forEach(category -> {
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

        return result;
    }

    public boolean delete(Long profileId) {
        synchronized (editLock) {
            try {
                dataQualityRepository.deleteById(profileId);

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
            if (profile.getData().isDefault()) {
                // remove isDefault from all other profiles
                profiles.forEach(it -> {
                    if (it.getData().isDefault() && !it.getId().equals(profile.getId())) {
                        it.getData().setDefault(false);
                        dataQualityRepository.save(it);
                    }
                });
            } else {
                // do not remove isDefault from the last profile
                if (profiles.stream().noneMatch(q -> q.getData().isDefault())) {
                    profile.getData().setDefault(true);
                    profile.getData().setEnabled(true); // the default must be enabled
                }
            }

            // update lastUpdated
            profile.getData().setLastUpdated(new Date());

            // A legacy requirement is that QualityFilter.id and QualityCategory.id are unique, not null and not 0.
            profile.getData().getCategories().forEach(category -> {
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
            if (profile.getData().getDisplayOrder() == null) {
                profile.getData().setDisplayOrder((long) profiles.size());
            }

            try {
                QualityProfile savedProfile = dataQualityRepository.save(profile);

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
