package au.org.ala.search.service.queue;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.dto.SandboxIngress;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.SandboxQueueRequest;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.LogService;
import jakarta.annotation.PostConstruct;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
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

    @Value("${solr.collection}")
    public String solrCollection;

    public SandboxConsumerService(LogService logService, QueueService queueService, JavaMailSender emailSender, DownloadFileStoreService downloadFileStoreService) {
        super(logService, queueService, emailSender, downloadFileStoreService);
    }

    @PostConstruct
    void init() {
        taskType = TaskType.SANDBOX;
        super.init(sandboxConsumerThreads);
    }

    void processItem(QueueItem item) {
        // process item
        logger.info("Processing sandbox: " + item.id);

        try {
            SandboxQueueRequest sandboxQueueRequest = (SandboxQueueRequest) item.queueRequest;
            loadDwCA(sandboxQueueRequest.sandboxIngress);
        } catch (Exception e) {
            queueService.updateStatus(item, StatusCode.ERROR, e.getMessage());
            logger.error("Error processing sandbox: " + item.id, e);
        }
    }

    void loadDwCA(SandboxIngress item) {
        // get temporary data resource uid
        String datasetID = UUID.randomUUID().toString();

        // convert DwCA
        String[] dwcaToVerbatimOpts = new String[]{
                "au.org.ala.pipelines.beam.ALADwcaToVerbatimPipeline", // produces the sharded avros
//                "au.org.ala.pipelines.beam.DwcaToVerbatimPipeline", // produces a single verbatim.avro
                "--datasetId=" + datasetID,
                "--appName=DWCA",
                "--attempt=1",
                "--runner=DirectRunner",
                "--metaFileName=" + VERBATIM_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/upload/" + item.getId()
        };
        pipelinesExecute(dwcaToVerbatimOpts);

        // interpret
        String[] verbatimToInterpretedOpts = new String[]{
                "au.org.ala.pipelines.beam.ALAVerbatimToInterpretedPipeline",
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--interpretationTypes=ALL",
                "--metaFileName=" + INTERPRETATION_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed/" + datasetID + "/1/verbatim.avro",
//                "--properties=" + itUtils.getPropertiesFilePath(),
                "--useExtendedRecordId=true"
        };
        pipelinesExecute(verbatimToInterpretedOpts);

        // validate and create UUIDs
        String[] uuidMintingOpts = new String[]{
                "uuid", //ALAUUIDMintingPipeline
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--metaFileName=" + UUID_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
//                "--properties=" + itUtils.getPropertiesFilePath(),
                "--useExtendedRecordId=true"
        };
        pipelinesExecute(uuidMintingOpts);

        // run SDS checks
        String[] interpretedToSensitiveOpts = new String[]{
                "sds", //ALAInterpretedToSensitivePipeline
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--metaFileName=" + SENSITIVE_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
//                "--properties=" + itUtils.getPropertiesFilePath()
        };
        pipelinesExecute(interpretedToSensitiveOpts);

        // index record generation
        String[] indexingOpts = new String[]{
                "index", //IndexRecordPipeline.run(solrOptions);
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--metaFileName=" + INDEXING_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
                "--allDatasetsInputPath=" + sandboxDir + "/processed/all-datasets",
//                "--properties=" + itUtils.getPropertiesFilePath(),
                "--includeImages=false",
                "--includeSensitiveDataChecks=false"
        };
        pipelinesExecute(indexingOpts);

        // export lat lngs
        String[] exportLatLngsOpts = new String[]{
                "sampling", //SamplingPipeline
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
                "--allDatasetsInputPath=" + sandboxDir + "/processed/all-datasets",
//                "--properties=" + itUtils.getPropertiesFilePath()
        };
        pipelinesExecute(exportLatLngsOpts);

        // sample
        String[] sampleOpts = new String[]{
                "sample", //LayerCrawler
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=DirectRunner",
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
                "--allDatasetsInputPath=" + sandboxDir + "/processed/all-datasets",
//                "--properties=" + itUtils.getPropertiesFilePath()
        };
        pipelinesExecute(sampleOpts);

        // index into SOLR
        String[] indexRecordToSolrOpts = new String[]{
                "solr", //IndexRecordToSolrPipeline.run(solrOptions2);
                "--datasetId=" + datasetID,
                "--attempt=1",
                "--runner=SparkRunner",
                "--metaFileName=" + INDEXING_METRICS,
                "--targetPath=" + sandboxDir + "/processed",
                "--inputPath=" + sandboxDir + "/processed",
                "--allDatasetsInputPath=" + sandboxDir + "/processed/all-datasets",
//                "--properties=" + TestUtils.getPipelinesConfigFile(),
                "--zkHost=" + zkHosts,
                "--solrCollection=" + solrCollection,
                "--includeSampling=true",
                "--includeImages=false",
                "--numOfPartitions=10"
        };
        pipelinesExecute(indexRecordToSolrOpts);
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

            logStream(proc.getInputStream(), logger);

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
                    logger.info(line);
                }
            } catch (IOException e) {
                logger.error("Error reading stream", e);
            }
        }).start();
    }

}
