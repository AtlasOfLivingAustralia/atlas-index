/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.queue;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.SearchQueueRequest;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import jakarta.annotation.PostConstruct;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.Arrays;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Consumes the search download queue to produce Zipped CSV files.
 */
@Service
public class SearchConsumerService extends ConsumerService {
    private static final Logger logger = LoggerFactory.getLogger(SearchConsumerService.class);
    final ElasticService elasticService;
    @Value("${search.consumer.threads}")
    public Integer searchConsumerThreads;

    public SearchConsumerService(LogService logService, QueueService queueService, JavaMailSender emailSender, DownloadFileStoreService downloadFileStoreService, ElasticService elasticService) {
        super(logService, queueService, emailSender, downloadFileStoreService);
        this.elasticService = elasticService;
    }

    @PostConstruct
    void init() {
        taskType = TaskType.SEARCH_DOWNLOAD;
        super.init(searchConsumerThreads);
    }

    void processItem(QueueItem item) {
        SearchQueueRequest request = (SearchQueueRequest) item.queueRequest;

        String q = request.q[0];
        String[] fqs = request.q.length > 1 ? Arrays.copyOfRange(request.q, 1, request.q.length) : null;

        try {
            String csvFilename = item.queueRequest.getFilename();
            if (!csvFilename.toLowerCase().endsWith(".csv")) {
                csvFilename += ".csv";
            }

            File file;
            if (downloadFileStoreService.isS3()) {
                file = File.createTempFile("search", "." + item.id + ".zip");
            } else {
                file = new File(downloadFileStoreService.getFilePath(item));
            }

            File tmpFile = null;

            try (FileOutputStream fos = new FileOutputStream(file)) {
                ZipOutputStream zos = new ZipOutputStream(fos);

                ZipEntry ze = new ZipEntry(csvFilename);
                zos.putNextEntry(ze);

                tmpFile = elasticService.download(q, fqs, StringUtils.join(request.getFl(), ","), false);
                StreamUtils.copy(new FileInputStream(tmpFile), zos);

                zos.closeEntry();
                zos.close();
            } catch (Exception e) {
                logger.error("search download: " + item.id, e);
                queueService.updateStatus(item, StatusCode.ERROR, e.getMessage());
            } finally {
                if (tmpFile != null) {
                    tmpFile.delete();
                }
            }

            if (downloadFileStoreService.isS3()) {
                downloadFileStoreService.copyToFileStore(file, item, true);
            }
        } catch (Exception e) {
            logger.error("search download: " + item.id, e);
            queueService.updateStatus(item, StatusCode.ERROR, e.getMessage());
        }
    }
}
