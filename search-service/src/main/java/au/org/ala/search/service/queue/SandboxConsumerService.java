package au.org.ala.search.service.queue;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.dto.SandboxIngress;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.SandboxQueueRequest;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.service.SandboxService;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.LogService;
import jakarta.annotation.PostConstruct;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.*;
import java.util.*;

/**
 * Consumes the fieldguide queue to produce PDF files.
 */
@Service
public class SandboxConsumerService extends ConsumerService {
    private static final Logger logger = LoggerFactory.getLogger(SandboxConsumerService.class);

    public static final String UUID_METRICS = "uuid-metrics.yml";
    public static final String INTERPRETATION_METRICS = "interpretation-metrics.yml";
    public static final String VERBATIM_METRICS = "dwca-metrics.yml";
    public static final String INDEXING_METRICS = "indexing-metrics.yml";
    public static final String SENSITIVE_METRICS = "sensitive-metrics.yml";
    private final SandboxService sandboxService;

    @Value("${images.url}")
    public String imagesUrl;

    @Value("${sandbox.consumer.threads}")
    public Integer sandboxConsumerThreads;

    @Value("${biocache.url}")
    public String biocacheUrl;

    @Value("${collections.url}")
    public String collectionsUrl;

    @Value("${bie.uiUrl}")
    public String bieUiUrl;

    @Value("${homeUrl}")
    public String homeUrl;

    @Value("${email.enabled}")
    public boolean emailEnabled;

    @Value("${email.from}")
    public String emailFrom;

    @Value("${email.text.success}")
    public String emailTextSuccess;

    @Value("${email.subject.success}")
    public String emailSubjectSuccess;

    @Value("${sandbox.dir}")
    public String sandboxDir;

    @Value("${pipeline.cmd}")
    public String pipelineCmd;

    @Value("${pipelines.config}")
    public String pipelinesConfig;

    @Value("${zk.hosts}")
    public String zkHosts;

    @Value("${solr.url}")
    public String solrUrl;

    @Value("${solr.collection}")
    public String solrCollection;

    public SandboxConsumerService(LogService logService, QueueService queueService, JavaMailSender emailSender, DownloadFileStoreService downloadFileStoreService, SandboxService sandboxService) {
        super(logService, queueService, emailSender, downloadFileStoreService);
        this.sandboxService = sandboxService;
    }

    @PostConstruct
    void init() {
        taskType = TaskType.SANDBOX;
        super.init(sandboxConsumerThreads);
    }

    void processItem(QueueItem item) {
        // process item
        logger.info("Processing sandbox: " + item.id);

        String datasetID = null;
        try {
            queueService.updateStatus(item, StatusCode.RUNNING, "Processing");

            SandboxQueueRequest sandboxQueueRequest = (SandboxQueueRequest) item.queueRequest;
            datasetID = sandboxQueueRequest.sandboxIngress.getDataResourceUid();
            sandboxQueueRequest.sandboxIngress.setDataResourceUid(datasetID);

            int recordCount = loadDwCA(item, sandboxQueueRequest.sandboxIngress, datasetID);

            if (recordCount > 0) {
                queueService.updateStatus(item, StatusCode.FINISHED, "Processed " + recordCount + " records (subject to SOLR indexing)");
            } // else, updateStatus already called in loadDwCA with an error message
        } catch (Exception e) {
            queueService.updateStatus(item, StatusCode.ERROR, e.getMessage());
            logger.error("Error processing sandbox: " + item.id, e);
        } finally {
            // delete pipelines files
            File dir = new File(sandboxDir + "/processed/" + datasetID);
            if (dir.exists()) {
                try {
                    org.apache.commons.io.FileUtils.deleteDirectory(dir);
                } catch (IOException e) {
                    logger.error("Error deleting directory: " + dir.getAbsolutePath(), e);
                }
            }
        }
    }

    /**
     * Load a DwCA into the pipelines
     * - ALADwcaToVerbatimPipeline (DwCA to /verbatim avro)
     * - ALAVerbatimToInterpretedPipeline (/verbatim avro to /occurrence avro)
     * - ALAUUIDMintingPipeline (only for validation, TODO: manually create the reporting metrics file and skip this step)
     * - ALAInterpretedToSensitivePipeline (TODO: manually create the reporting metrics file OR update pipelines so this can be skipped)
     * - IndexRecordPipeline (/occurrence avro to /all-datasets avro)
     * - SamplingPipeline (exports lat lngs, TODO: make optional)
     * - LayerCrawler (do the sampling, TODO: make optional)
     * - IndexRecordToSolrPipeline (index into SOLR, TODO: make joins optional - joins: sampling, species lists)
     *
     * @param queueItem
     * @param item
     */
    int loadDwCA(QueueItem queueItem, SandboxIngress item, String datasetID) {
        // convert DwCA
        String[] dwcaToVerbatimOpts = new String[]{
                "au.org.ala.pipelines.beam.ALADwcaToVerbatimPipeline", // produces the sharded avros
                "--datasetId=" + datasetID,
                "--appName=DWCA",
                "--attempt=1",
                "--runner=DirectRunner",
                "--metaFileName=" + VERBATIM_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/upload/" + item.getId()
        };
        queueService.updateStatus(queueItem, StatusCode.RUNNING, "DwCA to verbatim");
        pipelinesExecute(dwcaToVerbatimOpts);

        // test if it was successful
        File verbatimDir = new File(sandboxDir + "/processed/" + datasetID + "/1/verbatim/");
        if (!verbatimDir.exists() || verbatimDir.listFiles() == null || verbatimDir.listFiles().length == 0) {
            logger.error("DwCA to verbatim failed");
            queueService.updateStatus(queueItem, StatusCode.ERROR, "DwCA to verbatim failed");
            return 0;
        }

        // interpret
        String[] verbatimToInterpretedOpts = new String[]{
                "au.org.ala.pipelines.java.ALAVerbatimToInterpretedPipeline",
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--interpretationTypes=ALL",
                "--metaFileName=" + INTERPRETATION_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed/" + datasetID + "/1/verbatim/*",
                "--useExtendedRecordId=true"
        };
        queueService.updateStatus(queueItem, StatusCode.RUNNING, "Verbatim to interpreted");
        pipelinesExecute(verbatimToInterpretedOpts);

        File occurrenceDir = new File(sandboxDir + "/processed/" + datasetID + "/1/occurrence/");
        if (!occurrenceDir.exists() || occurrenceDir.listFiles().length < 4) {
            logger.error("Verbatim to interpreted failed");
            queueService.updateStatus(queueItem, StatusCode.ERROR, "Verbatim to interpreted failed");
            return 0;
        }

        // validate and create UUIDs
        String[] uuidMintingOpts = new String[]{
                "au.org.ala.pipelines.beam.ALAUUIDMintingPipeline",
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--metaFileName=" + UUID_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
                "--useExtendedRecordId=true"
        };
        queueService.updateStatus(queueItem, StatusCode.RUNNING, "UUID processing");
        pipelinesExecute(uuidMintingOpts);

        // run SDS checks
        String[] interpretedToSensitiveOpts = new String[]{
                "au.org.ala.pipelines.beam.ALAInterpretedToSensitivePipeline",
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--metaFileName=" + SENSITIVE_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
        };
        queueService.updateStatus(queueItem, StatusCode.RUNNING, "Sensitive processing");
        pipelinesExecute(interpretedToSensitiveOpts);

        // index record generation
        // TODO: speed up the download of all authorised species lists
        String[] indexingOpts = new String[]{
                "au.org.ala.pipelines.java.IndexRecordPipeline",
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--metaFileName=" + INDEXING_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
                "--allDatasetsInputPath=" + sandboxDir + "/processed/" + datasetID + "/all-datasets",
                "--includeImages=false",
                "--includeSensitiveDataChecks=false"
        };
        queueService.updateStatus(queueItem, StatusCode.RUNNING, "index-record processing");
        pipelinesExecute(indexingOpts);

        File processedDir = new File( sandboxDir + "/processed/" + datasetID + "/all-datasets/index-record/" + datasetID);
        if (!processedDir.exists() || processedDir.listFiles() == null || processedDir.listFiles().length == 0) {
            logger.error("Index Record Pipeline failed");
            queueService.updateStatus(queueItem, StatusCode.ERROR, "index-record failed");
            return 0;
        }

        // export lat lngs
        String[] exportLatLngsOpts = new String[]{
                "au.org.ala.pipelines.beam.SamplingPipeline",
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
                "--allDatasetsInputPath=" + sandboxDir + "/processed/" + datasetID + "/all-datasets",
        };
        queueService.updateStatus(queueItem, StatusCode.RUNNING, "lat-lng processing");
        pipelinesExecute(exportLatLngsOpts);

        File latLngDir = new File(sandboxDir + "/processed/" + datasetID + "/1/latlng");
        if (!latLngDir.exists() || latLngDir.listFiles() == null || latLngDir.listFiles().length == 0) {
            logger.error("Export Lat Lng failed");
            queueService.updateStatus(queueItem, StatusCode.ERROR, "lat-lng failed");
            return 0;
        }

        // sample
        String[] sampleOpts = new String[]{
                "au.org.ala.sampling.LayerCrawler",
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
                "--allDatasetsInputPath=" + sandboxDir + "/processed/" + datasetID + "/all-datasets",
        };
        queueService.updateStatus(queueItem, StatusCode.RUNNING, "sampling");
        pipelinesExecute(sampleOpts);

        File samplingDir = new File(sandboxDir + "/processed/" + datasetID + "/1/sampling");
        if (!samplingDir.exists() || samplingDir.listFiles() == null || samplingDir.listFiles().length == 0) {
            logger.error("Sampling failed");
            queueService.updateStatus(queueItem, StatusCode.ERROR, "sampling failed");
            return 0;
        }

        // index into SOLR
        String[] indexRecordToSolrOpts = new String[]{
                "au.org.ala.pipelines.beam.IndexRecordToSolrPipeline",
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=SparkRunner",
                "--metaFileName=" + INDEXING_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
                "--allDatasetsInputPath=" + sandboxDir + "/processed/" + datasetID + "/all-datasets",
                "--zkHost=" + zkHosts,
                "--solrCollection=" + solrCollection,
                "--includeSampling=true",
                "--includeImages=false",
                "--numOfPartitions=10"
        };
        queueService.updateStatus(queueItem, StatusCode.RUNNING, "SOLR import");
        pipelinesExecute(indexRecordToSolrOpts);

        // might take a bit of time to index in SOLR, test for records, after 10s
        try {
            long sleepMs = 10000;
            Thread.sleep(sleepMs); // 10s
            int maxWaitRetry = 100; // 100x 10s = 1000s max wait in this loop
            int retry = 0;
            while (retry < maxWaitRetry) {
                ResponseEntity<Map> response = new RestTemplate().exchange(
                        solrUrl + "/select?q=dataResourceUid:" + datasetID,
                        HttpMethod.GET,
                        null,
                        Map.class);

                if (response.getStatusCode().is2xxSuccessful() &&
                        ((Integer) ((Map) response.getBody().get("response")).get("numFound")) > 0) {
                    int solrCount = ((Integer) ((Map) response.getBody().get("response")).get("numFound"));
                    logger.info("SOLR import successful: " + solrCount + " records");
                    queueService.updateStatus(queueItem, StatusCode.RUNNING, "SOLR import successful: " + solrCount + " records (subject to indexing)");
                    return solrCount;
                }
                Thread.sleep(sleepMs);
                retry++;
            }
        } catch (Exception e) {
            logger.error("SOLR request failed: " + e.getMessage());
        }

        queueService.updateStatus(queueItem, StatusCode.ERROR, "SOLR import failed (or timed out)");
        return 0;
    }

    void pipelinesExecute(String[] opts) {
        String [] prefix = pipelineCmd.split(" ");
        String [] cmd = new String[prefix.length + opts.length + 1];
        System.arraycopy(prefix, 0, cmd, 0, prefix.length);
        System.arraycopy(opts, 0, cmd, prefix.length, opts.length);
        cmd[cmd.length - 1] = pipelinesConfig;

        try {
            logger.info("Executing pipeline: " + StringUtils.join(cmd, " "));
            ProcessBuilder builder = new ProcessBuilder(cmd);
            builder.environment().putAll(System.getenv());
            builder.redirectErrorStream(true);

            Process proc = builder.start();

            logStream(proc.getInputStream(), null);

            proc.waitFor();
        } catch (Exception e) {
            logger.error("Error executing pipeline: " + Arrays.toString(cmd), e);
            throw new RuntimeException(e);
        }
    }

    private void logStream(InputStream stream, Logger logger) {
        new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (logger != null) {
                        logger.info(line);
                    }
                }
            } catch (IOException e) {
                logger.error("Error reading stream", e);
            }
        }).start();
    }

}
