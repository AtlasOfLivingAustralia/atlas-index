/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.consumer;

import au.org.ala.search.model.dto.SandboxIngress;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.SandboxQueueRequest;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.service.remote.QueueDataService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.*;
import java.util.Arrays;
import java.util.Map;

/**
 * Consumes the fieldguide queue to produce PDF files.
 */
@Slf4j
@Service
public class SandboxConsumer {
    public static final String UUID_METRICS = "uuid-metrics.yml";
    public static final String INTERPRETATION_METRICS = "interpretation-metrics.yml";
    public static final String VERBATIM_METRICS = "dwca-metrics.yml";
    public static final String INDEXING_METRICS = "indexing-metrics.yml";
    public static final String SENSITIVE_METRICS = "sensitive-metrics.yml";

    private final QueueDataService queueDataService;

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

    public SandboxConsumer(QueueDataService queueDataService) {
        this.queueDataService = queueDataService;
    }

    public void consume(QueueItem item) {
        // process item
        log.info("Processing sandbox: {}", item.id);

        String datasetID = null;
        try {
            queueDataService.updateStatus(item.id, StatusCode.RUNNING, "Processing");

            SandboxQueueRequest sandboxQueueRequest = item.queueRequest.sandboxQueueRequest;
            datasetID = sandboxQueueRequest.sandboxIngress.getDataResourceUid();
            sandboxQueueRequest.sandboxIngress.setDataResourceUid(datasetID);

            int recordCount = loadDwCA(item, sandboxQueueRequest.sandboxIngress, datasetID);

            if (recordCount > 0) {
                queueDataService.updateStatus(item.id, StatusCode.FINISHED, "Processed " + recordCount + " records (subject to SOLR indexing)");
            } // else, updateStatus already called in loadDwCA with an error message
        } catch (Exception e) {
            queueDataService.updateStatus(item.id, StatusCode.ERROR, e.getMessage());
            log.error("Error processing sandbox: {}", item.id, e);
        } finally {
            // delete pipelines files
            File dir = new File(sandboxDir + "/processed/" + datasetID);
            if (dir.exists()) {
                try {
                    org.apache.commons.io.FileUtils.deleteDirectory(dir);
                } catch (IOException e) {
                    log.error("Error deleting directory: {}", dir.getAbsolutePath(), e);
                }
            }
        }
    }

    /**
     * TODO: align with spatial-service
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
        queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "DwCA to verbatim");
        pipelinesExecute(dwcaToVerbatimOpts);

        // test if it was successful
        File verbatimDir = new File(sandboxDir + "/processed/" + datasetID + "/1/verbatim/");
        if (!verbatimDir.exists() || verbatimDir.listFiles() == null || verbatimDir.listFiles().length == 0) {
            log.error("DwCA to verbatim failed");
            queueDataService.updateStatus(queueItem.id, StatusCode.ERROR, "DwCA to verbatim failed");
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
        queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "Verbatim to interpreted");
        pipelinesExecute(verbatimToInterpretedOpts);

        File occurrenceDir = new File(sandboxDir + "/processed/" + datasetID + "/1/occurrence/");
        if (!occurrenceDir.exists() || occurrenceDir.listFiles().length < 4) {
            log.error("Verbatim to interpreted failed");
            queueDataService.updateStatus(queueItem.id, StatusCode.ERROR, "Verbatim to interpreted failed");
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
        queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "UUID processing");
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
        queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "Sensitive processing");
        pipelinesExecute(interpretedToSensitiveOpts);

        // index record generation
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
        queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "index-record processing");
        pipelinesExecute(indexingOpts);

        File processedDir = new File(sandboxDir + "/processed/" + datasetID + "/all-datasets/index-record/" + datasetID);
        if (!processedDir.exists() || processedDir.listFiles() == null || processedDir.listFiles().length == 0) {
            log.error("Index Record Pipeline failed");
            queueDataService.updateStatus(queueItem.id, StatusCode.ERROR, "index-record failed");
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
        queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "lat-lng processing");
        pipelinesExecute(exportLatLngsOpts);

        File latLngDir = new File(sandboxDir + "/processed/" + datasetID + "/1/latlng");
        if (!latLngDir.exists() || latLngDir.listFiles() == null || latLngDir.listFiles().length == 0) {
            log.error("Export Lat Lng failed");
            queueDataService.updateStatus(queueItem.id, StatusCode.ERROR, "lat-lng failed");
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
        queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "sampling");
        pipelinesExecute(sampleOpts);

        File samplingDir = new File(sandboxDir + "/processed/" + datasetID + "/1/sampling");
        if (!samplingDir.exists() || samplingDir.listFiles() == null || samplingDir.listFiles().length == 0) {
            log.error("Sampling failed");
            queueDataService.updateStatus(queueItem.id, StatusCode.ERROR, "sampling failed");
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
        queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "SOLR import");
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
                    log.info("SOLR import successful: {} records", solrCount);
                    queueDataService.updateStatus(queueItem.id, StatusCode.RUNNING, "SOLR import successful: " + solrCount + " records (subject to indexing)");
                    return solrCount;
                }
                Thread.sleep(sleepMs);
                retry++;
            }
        } catch (Exception e) {
            log.error("SOLR request failed: {}", e.getMessage(), e);
        }

        queueDataService.updateStatus(queueItem.id, StatusCode.ERROR, "SOLR import failed (or timed out)");
        return 0;
    }

    void pipelinesExecute(String[] opts) {
        String[] prefix = pipelineCmd.split(" ");
        String[] cmd = new String[prefix.length + opts.length + 1];
        System.arraycopy(prefix, 0, cmd, 0, prefix.length);
        System.arraycopy(opts, 0, cmd, prefix.length, opts.length);
        cmd[cmd.length - 1] = pipelinesConfig;

        try {
            log.info("Executing pipeline: {}", StringUtils.join(cmd, " "));
            ProcessBuilder builder = new ProcessBuilder(cmd);
            builder.environment().putAll(System.getenv());
            builder.redirectErrorStream(true);

            Process proc = builder.start();

            logStream(proc.getInputStream());

            proc.waitFor();
        } catch (Exception e) {
            log.error("Error executing pipeline: {}", Arrays.toString(cmd), e);
            throw new RuntimeException(e);
        }
    }

    private void logStream(InputStream stream) {
        new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.info(line);
                }
            } catch (IOException e) {
                log.error("Error reading stream", e);
            }
        }).start();
    }

}
