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
import software.amazon.awssdk.services.s3.model.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.attribute.FileTime;
import java.util.concurrent.CompletableFuture;

@Service
public class DataFileStoreService {
    private static final Logger logger = LoggerFactory.getLogger(DataFileStoreService.class);
    S3AsyncClient s3Client;
    @Value("${data.filestore.path}")
    private String fileStorePath;
    @Value("${data.s3.region}")
    private String s3Region;
    @Value("${data.s3.accessKey}")
    private String s3AccessKey;
    @Value("${data.s3.secretKey}")
    private String s3SecretKey;

    @PostConstruct
    void init() {
        if (StringUtils.isNotEmpty(s3Region)) {
            S3AsyncClientBuilder builder = S3AsyncClient.builder().region(Region.of(s3Region));

            if (StringUtils.isNotBlank(s3AccessKey) && StringUtils.isNotBlank(s3SecretKey)) {
                builder.credentialsProvider(() -> AwsBasicCredentials.create(s3AccessKey, s3SecretKey));
            }

            s3Client = builder.build();
        } else if (fileStorePath.startsWith("s3")) {
            throw new RuntimeException("s3.region is not provided. file store path is s3: " + fileStorePath);
        }
    }

    public long retrieveFileLastModified(String fileName) throws IOException {
        if (isS3()) {
            String bucket = fileStorePath.substring(5, fileStorePath.indexOf("/", 5));
            String path = fileStorePath.substring(fileStorePath.indexOf("/", 5) + 1) + "/" + fileName;
            HeadObjectRequest headRequest = HeadObjectRequest.builder()
                    .bucket(bucket)
                    .key(path)
                    .build();

            CompletableFuture<HeadObjectResponse> future = s3Client.headObject(headRequest);
            HeadObjectResponse response = future.join();

            if (future.isCompletedExceptionally()) {
                throw new IOException("Failed to retrieve metadata from S3: " + path);
            }

            return FileTime.from(response.lastModified()).toMillis();
        } else {
            File file = new File(fileStorePath, fileName);
            if (!file.exists()) {
                throw new IOException("File not found: " + fileName);
            }
            return file.lastModified();
        }
    }

    public File retrieveFile(String fileName) throws IOException {
        if (isS3()) {
            return retrieveFileFromS3(fileName);
        } else {
            return retrieveFileFromLocal(fileName);
        }
    }

    private File retrieveFileFromS3(String fileName) throws IOException {
        String bucket = fileStorePath.substring(5, fileStorePath.indexOf("/", 5));
        String path = fileStorePath.substring(fileStorePath.indexOf("/", 5) + 1) + "/" + fileName;
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket)
                .key(path)
                .build();

        File tmpFile = File.createTempFile("data", ".tmp");

        CompletableFuture<GetObjectResponse> future = s3Client.getObject(request, tmpFile.toPath());
        GetObjectResponse response = future.join();

        if (future.isCompletedExceptionally()) {
            throw new IOException("Failed to retrieve file from S3: " + fileName);
        }

        // Set the last modified time of the local file to the S3 last modified time
        FileTime fileTime = FileTime.from(response.lastModified());
        Files.setLastModifiedTime(Paths.get(fileName), fileTime);

        return tmpFile;
    }

    private File retrieveFileFromLocal(String fileName) throws IOException {
        File file = new File(fileStorePath, fileName);
        if (!file.exists()) {
            throw new IOException("File not found: " + fileName);
        }
        return file;
    }

    private boolean isS3() {
        return fileStorePath.startsWith("s3");
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

                result.join();

                // report error
                if (result.isCompletedExceptionally()) {
                    logger.error("Failed to copy file to s3 src: " + src.getAbsolutePath() + ", dstPath" + path + "/" + dstPath);
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
     * Close the store file returned by retrieveFile(srcPath). This will clean up (delete) any temporary local copy of the
     * remote file.
     * <p>
     * Only use this method if you have called get(srcPath) to get the File.
     *
     * @param file
     */
    public void cleanupFile(File file) {
        if (fileStorePath.startsWith("s3")) {
            file.delete();
        }
    }

}
