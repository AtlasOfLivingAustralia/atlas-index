/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

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

import java.io.File;
import java.nio.file.Paths;
import java.util.concurrent.CompletableFuture;

/**
 * Service to store files, usually static files, info a file store. e.g. local file system or S3
 */
@Slf4j
@Service
public class StaticFileStoreService {

    S3AsyncClient s3Client;
    @Value("${static.filestore.path}")
    private String fileStorePath;
    @Value("${static.s3.region}")
    private String s3Region;
    @Value("${static.s3.accessKey}")
    private String s3AccessKey;
    @Value("${static.s3.secretKey}")
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

                result.join();

                // report error
                if (result.isCompletedExceptionally()) {
                    log.error("Failed to copy file to s3 src: {}, dstPath{}/{}", src.getAbsolutePath(), path, dstPath);
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
            log.error("Failed to copy file to file store src: {}, dstPath{}, {}", src.getAbsolutePath(), dstPath, e.getMessage(), e);
            return false;
        }
    }

    /**
     * Close the store file returned by get(srcPath). This will clean up (delete) any temporary local copy of the
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

    /**
     * Get the file from the file store as a File.
     * <p>
     * Always call closeStoreFile when finished with the returned file. This will clean up (delete) any temporary
     * local copy of the remote file.
     *
     * @param srcPath
     * @return
     */
    public File get(String srcPath) {
        try {
            if (fileStorePath.startsWith("s3")) {
                // s3 storage
                String bucket = fileStorePath.substring(5, fileStorePath.indexOf("/", 5));
                String path = fileStorePath.substring(fileStorePath.indexOf("/", 5) + 1);
                GetObjectRequest request = GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(path + "/" + srcPath)
                        .build();

                File tmpFile = File.createTempFile("tmp", ".tmp");
                CompletableFuture<GetObjectResponse> result = s3Client.getObject(request, Paths.get(tmpFile.getAbsolutePath()));

                result.join();

                // report error
                if (result.isCompletedExceptionally()) {
                    log.error("Failed to get file from s3 srcPath: {}", srcPath);
                } else {
                    return tmpFile;
                }
            } else {
                // local file system
                File file = new File(fileStorePath + "/" + srcPath);
                if (file.exists()) {
                    return file;
                }
            }
        } catch (Exception e) {
            log.error("Failed to get the file for srcPath: {}, {}", srcPath, e.getMessage(), e);
        }
        return null;
    }

    public boolean delete(String filePath) {
        try {
            if (fileStorePath.startsWith("s3")) {
                // s3 storage
                String bucket = fileStorePath.substring(5, fileStorePath.indexOf("/", 5));
                String path = fileStorePath.substring(fileStorePath.indexOf("/", 5) + 1);
                DeleteObjectRequest request = DeleteObjectRequest.builder()
                        .bucket(bucket)
                        .key(path + "/" + filePath)
                        .build();
                CompletableFuture<DeleteObjectResponse> result = s3Client.deleteObject(request);

                result.join();

                // report error
                if (result.isCompletedExceptionally()) {
                    log.error("Failed to delete file on s3: {}/{}", path, filePath);
                    return false;
                }
            } else {
                // local file system
                FileUtils.delete(new File(fileStorePath + "/" + filePath));
            }
            return true;
        } catch (Exception e) {
            log.error("Failed to delete file: {}, {}", filePath, e.getMessage(), e);
            return false;
        }
    }
}
