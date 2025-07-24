/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.consumer;

import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.SearchQueueRequest;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.QueueDataService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
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
@Slf4j
@Service
public class SearchConsumer {
    private final QueueDataService queueDataService;
    private final ElasticService elasticService;
    private final DownloadFileStoreService downloadFileStoreService;

    public SearchConsumer(QueueDataService queueDataService, ElasticService elasticService, DownloadFileStoreService downloadFileStoreService) {
        this.queueDataService = queueDataService;
        this.elasticService = elasticService;
        this.downloadFileStoreService = downloadFileStoreService;
    }

    public void consume(QueueItem item) {
        SearchQueueRequest request = item.queueRequest.searchQueueRequest;

        String q = request.q[0];
        String[] fqs = request.q.length > 1 ? Arrays.copyOfRange(request.q, 1, request.q.length) : null;

        try {
            String csvFilename = request.getFilename();
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
                log.error("search download: {}", item.id, e);
                queueDataService.updateStatus(item, StatusCode.ERROR, e.getMessage());
            } finally {
                if (tmpFile != null) {
                    tmpFile.delete();
                }
            }

            if (downloadFileStoreService.isS3()) {
                downloadFileStoreService.copyToFileStore(file, item, true);
            }
        } catch (Exception e) {
            log.error("search download: {}", item.id, e);
            queueDataService.updateStatus(item, StatusCode.ERROR, e.getMessage());
        }
    }
}
