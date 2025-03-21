/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import jakarta.annotation.PostConstruct;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.S3AsyncClientBuilder;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;

import java.io.File;
import java.util.concurrent.CompletableFuture;

/**
 * Service to store sitemap files
 */
@Service
public class SitemapFileStoreService {

    private static final Logger logger = LoggerFactory.getLogger(SitemapFileStoreService.class);
    S3AsyncClient s3Client;
    @Value("${sitemap.filestore.path}")
    private String fileStorePath;
    @Value("${sitemap.s3.region}")
    private String s3Region;
    @Value("${sitemap.s3.accessKey}")
    private String s3AccessKey;
    @Value("${sitemap.s3.secretKey}")
    private String s3SecretKey;

    @PostConstruct
    void init() {
        if (StringUtils.isNotEmpty(s3Region)) {
            S3AsyncClientBuilder builder = S3AsyncClient.builder().region(Region.of(s3Region));

            // override default system credentials if s3.accessKey and s3.secretKey are provided
            if (StringUtils.isNotBlank(s3AccessKey) && StringUtils.isNotBlank(s3SecretKey)) {
                builder.credentialsProvider(() -> AwsBasicCredentials.create(s3AccessKey, s3SecretKey));
            }

            s3Client = builder.build();
        } else if (fileStorePath.startsWith("s3")) {
            throw new RuntimeException("s3.region is not provided. file store path is s3: " + fileStorePath);
        }
    }

    public boolean copyToFileStore(File src, String dstPath, boolean deleteSource) {
        try {
            if (fileStorePath.startsWith("s3")) {
                // s3 storage
                String bucket = fileStorePath.substring(5, fileStorePath.indexOf("/", 5));
                String path = fileStorePath.substring(fileStorePath.indexOf("/", 5) + 1);
                PutObjectRequest request = PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(path + "/" + dstPath)
                        .build();
                CompletableFuture<PutObjectResponse> result = s3Client.putObject(request, src.toPath());

                // wait for the result
                result.join();

                // log result
                if (result.isCompletedExceptionally()) {
                    logger.error("Failed to copy file to file store src: " + src.getAbsolutePath() + ", dstPath" + dstPath);
                    return false;
                }
            } else {
                // local file system
                FileUtils.copyFile(src, new File(fileStorePath + "/" + dstPath));
            }
            if (deleteSource) {
                src.delete();
            }
            return true;
        } catch (Exception e) {
            logger.error("Failed to copy file to file store src: " + src.getAbsolutePath() + ", dstPath" + dstPath + ", " + e.getMessage());
            return false;
        }
    }

    /**
     * Delete a file in the file store.
     *
     * @param file
     * @return true if the file exists and is deleted
     */
    public boolean deleteFile(String file) {
        try {
            if (fileStorePath.startsWith("s3")) {
                // s3 storage
                String bucket = fileStorePath.substring(5, fileStorePath.indexOf("/", 5));
                String path = fileStorePath.substring(fileStorePath.indexOf("/", 5) + 1);

                // check if the file exists
                boolean[] exists = {false};
                s3Client.listObjectsV2Paginator(builder -> builder.bucket(bucket).prefix(path + "/" + file))
                        .subscribe(response -> {
                            if (!response.contents().isEmpty()) {
                                exists[0] = true;
                            }
                        });

                if (!exists[0]) {
                    return false;
                }

                s3Client.deleteObject(builder -> builder.bucket(bucket).key(path + "/" + file));
            } else {
                // local file system
                File toDelete = new File(fileStorePath + "/" + file);

                if (!toDelete.exists()) {
                    return false;
                }

                return toDelete.delete();
            }
            return true;
        } catch (Exception e) {
            logger.error("Failed to delete file, " + file + ", " + e.getMessage());
            return false;
        }
    }
}
