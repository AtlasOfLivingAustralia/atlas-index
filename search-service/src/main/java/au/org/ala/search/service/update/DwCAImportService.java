/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.IndexDocType;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.cache.*;
import au.org.ala.search.model.dto.DatasetInfo;
import au.org.ala.search.names.ALATerm;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import org.gbif.api.model.registry.Dataset;
import org.gbif.dwc.Archive;
import org.gbif.dwc.ArchiveFile;
import org.gbif.dwc.meta.DwcMetaFiles;
import org.gbif.dwc.record.Record;
import org.gbif.dwc.terms.DcTerm;
import org.gbif.dwc.terms.DwcTerm;
import org.gbif.dwc.terms.GbifTerm;
import org.gbif.metadata.eml.parse.DatasetEmlParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileInputStream;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DwCAImportService {
    public static final String META_XML = "meta.xml";
    private static final TaskType taskType = TaskType.DWCA;
    private static final Logger logger = LoggerFactory.getLogger(DwCAImportService.class);
    protected final ElasticService elasticService;
    protected final DwCAImportRunner dwCAImportRunner;
    protected final DwCADenormaliseImportService dwCADenormaliseImportService;
    protected final LogService logService;
    @Value("${dwca.dir}")
    private String dwcaDir;

    public DwCAImportService(ElasticService elasticService, DwCAImportRunner dwCAImportRunner, DwCADenormaliseImportService dwCADenormaliseImportService, LogService logService) {
        this.elasticService = elasticService;
        this.dwCAImportRunner = dwCAImportRunner;
        this.dwCADenormaliseImportService = dwCADenormaliseImportService;
        this.logService = logService;
    }

    @Async("processExecutor")
    public CompletableFuture<Boolean> run() {
        long count = elasticService.queryCount("idxtype", IndexDocType.TAXON.name()) +
                elasticService.queryCount("idxtype", IndexDocType.TAXONVARIANT.name()) +
                elasticService.queryCount("idxtype", IndexDocType.COMMON.name()) +
                elasticService.queryCount("idxtype", IndexDocType.IDENTIFIER.name());
        if (count > 0) {
            logService.log(taskType, "Skipping DwCA import because records already exist");
            return CompletableFuture.completedFuture(true);
        }

        logService.log(taskType, "Starting DwCA import");

        List<DenormalCache> caches = new ArrayList<>();
        Map<String, DatasetInfo> attributionMap = new ConcurrentHashMap<>();
        for (String dir : retrieveAvailableDwCAPaths()) {
            caches.add(importDwcA(dir, true, attributionMap));
        }

        // consolidate caches
        DenormalCache cache = new DenormalCache(aggregateTaxon(caches), aggregateIdentifier(caches), aggregateVariant(caches), aggregateVernacular(caches), attributionMap);
        dwCADenormaliseImportService.setCache(cache);

        for (String dir : retrieveAvailableDwCAPaths()) {
            importDwcA(dir, false, attributionMap);
        }

        dwCADenormaliseImportService.deleteCaches();

        // dynamic fields may have changed, cache the new list
        elasticService.indexFields(true);

        logService.log(taskType, "Finished");

        return CompletableFuture.completedFuture(true);
    }

    private DenormalTaxon[] aggregateTaxon(List<DenormalCache> caches) {
        int totalSize = 0;
        for (DenormalCache cache : caches) {
            DenormalTaxon[] list = cache.cacheTaxon;
            if (list != null) {
                totalSize += list.length;
            }
        }
        DenormalTaxon[] aggregate = new DenormalTaxon[totalSize];
        int length = 0;
        for (DenormalCache cache : caches) {
            DenormalTaxon[] list = cache.cacheTaxon;
            if (list != null) {
                System.arraycopy(list, 0, aggregate, length, list.length);
                length += list.length;

                // unallocate
                cache.cacheTaxon = null;
            }
        }
        return aggregate;
    }

    private DenormalIdentifier[] aggregateIdentifier(List<DenormalCache> caches) {
        int totalSize = 0;
        for (DenormalCache cache : caches) {
            DenormalIdentifier[] list = cache.cacheIdentifier;
            if (list != null) {
                totalSize += list.length;
            }
        }
        DenormalIdentifier[] aggregate = new DenormalIdentifier[totalSize];
        int length = 0;
        for (DenormalCache cache : caches) {
            DenormalIdentifier[] list = cache.cacheIdentifier;
            if (list != null) {
                System.arraycopy(list, 0, aggregate, length, list.length);
                length += list.length;

                // unallocate
                cache.cacheIdentifier = null;
            }
        }
        return aggregate;
    }

    private DenormalVariant[] aggregateVariant(List<DenormalCache> caches) {
        int totalSize = 0;
        for (DenormalCache cache : caches) {
            DenormalVariant[] list = cache.cacheVariant;
            if (list != null) {
                totalSize += list.length;
            }
        }
        DenormalVariant[] aggregate = new DenormalVariant[totalSize];
        int length = 0;
        for (DenormalCache cache : caches) {
            DenormalVariant[] list = cache.cacheVariant;
            if (list != null) {
                System.arraycopy(list, 0, aggregate, length, list.length);
                length += list.length;

                // unallocate
                cache.cacheVariant = null;
            }
        }
        return aggregate;
    }

    private DenormalVernacular[] aggregateVernacular(List<DenormalCache> caches) {
        int totalSize = 0;
        for (DenormalCache cache : caches) {
            DenormalVernacular[] list = cache.cacheVernacular;
            if (list != null) {
                totalSize += list.length;
            }
        }
        DenormalVernacular[] aggregate = new DenormalVernacular[totalSize];
        int length = 0;
        for (DenormalCache cache : caches) {
            DenormalVernacular[] list = cache.cacheVernacular;
            if (list != null) {
                System.arraycopy(list, 0, aggregate, length, list.length);
                length += list.length;

                // unallocate
                cache.cacheVernacular = null;
            }
        }
        return aggregate;
    }

    private DenormalCache importDwcA(String dir, boolean cacheOnly, Map<String, DatasetInfo> attributionMap) {
        String logLabel = cacheOnly ? "building cache" : "importing archive";
        DenormalCache cache = null;
        try {
            logService.log(taskType, logLabel + " from " + dir);

            // read the DwC metadata
            java.nio.file.Path dwcLocation = Paths.get(dir);
            java.nio.file.Path metaDescriptorFile = dwcLocation.resolve(META_XML);
            Archive archive =
                    DwcMetaFiles.fromMetaDescriptor(new FileInputStream(metaDescriptorFile.toFile()));
            archive.setLocation(dwcLocation.toFile());

            logService.log(taskType, "Archive metadata detected: " + (archive.getMetadataLocation() != null));
            String defaultDatasetName = null;
            Date modified = new Date();
            if (archive.getMetadataLocation() != null) {
                Dataset dataset = DatasetEmlParser.build(archive.getMetadata().getBytes());
                defaultDatasetName = dataset.getTitle();
                modified = dataset.getModified() != null ? dataset.getModified() : new Date(metaDescriptorFile.toFile().lastModified());
                logService.log(taskType, "Default dataset name from metadata: " + defaultDatasetName + ", modified: " + modified.toString());
            }

            // retrieve datasets
            if (attributionMap.isEmpty()) {
                attributionMap.putAll(getDatasets(archive));
            }

            if (attributionMap.isEmpty()) {
                logService.log(taskType, "Error No datasets found in the archive");
                return null;
            }

            // init cache object
            if (cacheOnly) {
                cache = new DenormalCache();
            }

            CompletableFuture<Integer> main = dwCAImportRunner.importDwcARowType(archive.getCore(), attributionMap, defaultDatasetName, modified, cache);
            CompletableFuture<Integer> variant = CompletableFuture.completedFuture(null);
            CompletableFuture<Integer> vernacular = CompletableFuture.completedFuture(null);
            CompletableFuture<Integer> identifier = CompletableFuture.completedFuture(null);

            // Legacy behaviour is to import identifiers into elasticsearch. While caching is required, the import is
            // to be removed when deprecating legacy functionality.
            ArchiveFile identifierExtension = archive.getExtension(GbifTerm.Identifier);
            if (identifierExtension != null) {
                identifier = dwCAImportRunner.importDwcARowType(identifierExtension, attributionMap, defaultDatasetName, modified, cache);
            }

            // Legacy behaviour is to import variants into elasticsearch. While caching is required, the import is
            // to be removed when deprecating legacy functionality.
            ArchiveFile variantExtension = archive.getExtension(ALATerm.TaxonVariant);
            if (variantExtension != null) {
                variant = dwCAImportRunner.importDwcARowType(variantExtension, attributionMap, defaultDatasetName, modified, cache);
            }

            ArchiveFile vernacularExtension = archive.getExtension(GbifTerm.VernacularName);
            if (vernacularExtension != null) {
                vernacular = dwCAImportRunner.importDwcARowType(vernacularExtension, attributionMap, defaultDatasetName, modified, cache);
            }

            CompletableFuture.allOf(main, variant, vernacular, identifier).join();

            logService.log(taskType, "Finished " + (cacheOnly ? "caching" : "importing") + " archive from " + dir
                    + " finished: taxon=" + main.get()
                    + ", variant=" + variant.get()
                    + ", vernacular=" + vernacular.get()
                    + ", identifier=" + identifier.get());
        } catch (Exception ex) {
            logService.log(taskType, "Error There was problem with the " + logLabel + ": " + ex.getMessage());
            logger.error("There was problem with the import: " + ex.getMessage(), ex);
        }

        return cache;
    }

    private Map<String, DatasetInfo> getDatasets(Archive archive) {
        Map<String, DatasetInfo> attributionMap = null;

        // dataset extension available?
        ArchiveFile datasetArchiveFile = archive.getExtension(DcTerm.rightsHolder);
        logService.log(taskType, "Dataset extension detected: " + (datasetArchiveFile != null));
        if (datasetArchiveFile != null) {
            attributionMap = readAttribution(datasetArchiveFile);
            logService.log(taskType, "Datasets read: " + attributionMap.size());
        }

        return attributionMap;
    }

    private List<String> retrieveAvailableDwCAPaths() {
        List<String> filePaths = new ArrayList<>();
        File dir = new File(dwcaDir);
        if (dir.exists() && dir.isDirectory()) {
            try {
                for (File subdir : dir.listFiles()) {
                    if (subdir.isDirectory()) {
                        filePaths.add(subdir.getAbsolutePath());
                    }
                }
            } catch (Exception e) {
                logService.log(taskType, "Error dwca.dir contains no directories " + dwcaDir);
                logger.error("dwca.dir contains no directories " + dwcaDir);
            }
        }
        return filePaths;
    }

    private Map<String, DatasetInfo> readAttribution(ArchiveFile datasetArchiveFile) {
        Map<String, DatasetInfo> datasets = new ConcurrentHashMap<>();

        for (Record record : datasetArchiveFile) {
            String datasetID = record.id();
            String datasetName = record.value(DwcTerm.datasetName);
            String rightsHolder = record.value(DcTerm.rightsHolder);
            datasets.put(datasetID, new DatasetInfo(datasetName, rightsHolder));
        }

        return datasets;
    }
}
