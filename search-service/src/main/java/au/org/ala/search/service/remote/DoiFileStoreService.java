/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.doi.Doi;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.S3AsyncClientBuilder;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.File;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

/**
 * Service to store doi files, e.g. local file system or S3
 */
@Slf4j
@Service
public class DoiFileStoreService {

    S3AsyncClient s3Client;
    @Value("${doi.filestore.path}")
    private String fileStorePath;
    @Value("${doi.s3.region}")
    private String s3Region;
    @Value("${doi.s3.accessKey}")
    private String s3AccessKey;
    @Value("${doi.s3.secretKey}")
    private String s3SecretKey;
    @Value("${doi.s3.duration}")
    private Integer duration;
    @Value("${doi.s3.directPath}")
    private String directS3Path;

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

    public boolean copyToFileStore(File src, Doi doi, boolean deleteSource) {
        try {
            if (isS3()) {
                // s3 storage
                String s3Uri = fileStorePath.substring(5); // remove "s3://"
                int slashIdx = s3Uri.indexOf('/');
                String bucket = slashIdx == -1 ? s3Uri : s3Uri.substring(0, slashIdx);
                String path = slashIdx == -1 ? "" : s3Uri.substring(slashIdx + 1) + "/";
                PutObjectRequest request = PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(path + itemFileName(doi))
                        .build();
                CompletableFuture<PutObjectResponse> result = s3Client.putObject(request, src.toPath());
                result.join();

                // report error
                if (result.isCompletedExceptionally()) {
                    log.error("Failed to copy file to s3 src: {}, dstPath{}", src.getAbsolutePath(), itemFileName(doi));
                    return false;
                }
            } else {
                // local file system
                FileUtils.copyFile(src, new File(getFilePath(doi)));
            }
            if (deleteSource) {
                src.delete();
            }
            return true;
        } catch (Exception e) {
            log.error("Failed to copy file to file store src: {}, dstPath{}, {}", src.getAbsolutePath(), itemFileName(doi), e.getMessage());
            return false;
        }
    }

    private String itemFileName(Doi doi) {
        // construct path to file, should be in an external function
        return doi.getUuid().toString() + "/" + doi.getFilename();
    }

    public String createPresignedGetUrl(Doi doi) {
        String dstPath = itemFileName(doi);

        if (StringUtils.isNotEmpty(directS3Path)) {
            // direct s3 path
            return directS3Path + "/" + dstPath;
        } else {
            // create temporary, presigned URL
            try (S3Presigner presigner = S3Presigner.create()) {
                // s3 storage
                String s3Uri = fileStorePath.substring(5); // remove "s3://"
                int slashIdx = s3Uri.indexOf('/');
                String bucket = slashIdx == -1 ? s3Uri : s3Uri.substring(0, slashIdx);
                String path = slashIdx == -1 ? "" : s3Uri.substring(slashIdx + 1) + "/";
                GetObjectRequest objectRequest = GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(path + dstPath)
                        .build();

                GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofMinutes(duration))  // The URL will expire in 10 minutes.
                        .getObjectRequest(objectRequest)
                        .build();

                PresignedGetObjectRequest presignedRequest = presigner.presignGetObject(presignRequest);

                return presignedRequest.url().toExternalForm();
            }
        }
    }

    public String getFilePath(Doi doi) {
        return fileStorePath + "/" + itemFileName(doi);
    }

    public boolean isS3() {
        return fileStorePath.startsWith("s3");
    }

    public boolean delete(Doi doi) {
        try {
            if (isS3()) {
                // s3 storage
                String s3Uri = fileStorePath.substring(5); // remove "s3://"
                int slashIdx = s3Uri.indexOf('/');
                String bucket = slashIdx == -1 ? s3Uri : s3Uri.substring(0, slashIdx);
                String path = slashIdx == -1 ? "" : s3Uri.substring(slashIdx + 1) + "/";
                DeleteObjectRequest request = DeleteObjectRequest.builder()
                        .bucket(bucket)
                        .key(path + itemFileName(doi))
                        .build();
                CompletableFuture<DeleteObjectResponse> result = s3Client.deleteObject(request);
                result.join();

                // report error
                if (result.isCompletedExceptionally()) {
                    log.error("Failed to delete s3 file: {}", itemFileName(doi));
                    return false;
                }
            } else {
                // local file system
                FileUtils.delete(new File(getFilePath(doi)));
            }
            return true;
        } catch (Exception e) {
            log.error("Failed to delete file {}, {}", itemFileName(doi), e.getMessage());
            return false;
        }
    }
}
