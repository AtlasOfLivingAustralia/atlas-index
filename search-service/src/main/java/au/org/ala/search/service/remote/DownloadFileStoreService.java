package au.org.ala.search.service.remote;

import au.org.ala.search.model.queue.FieldguideQueueRequest;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.SearchQueueRequest;
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
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.File;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

/**
 * Service to store files, usually static files, info a file store. e.g. local file system or S3
 */
@Service
public class DownloadFileStoreService {

    private static final Logger logger = LoggerFactory.getLogger(DownloadFileStoreService.class);

    @Value("${download.filestore.path}")
    private String fileStorePath;
    @Value("${download.s3.region}")
    private String s3Region;
    @Value("${download.s3.accessKey}")
    private String s3AccessKey;
    @Value("${download.s3.secretKey}")
    private String s3SecretKey;
    @Value("${download.s3.duration}")
    private Integer duration;
    @Value("${download.s3.directPath}")
    private String directS3Path;

    S3AsyncClient s3Client;

    @PostConstruct
    void init() {
        if (StringUtils.isNotEmpty(s3Region)) {
            S3AsyncClientBuilder builder = S3AsyncClient.builder().region(Region.of(s3Region));

            // override default system credentials if s3.accessKey and s3.secretKey are provided
            if (StringUtils.isNotBlank(s3AccessKey) && StringUtils.isNotBlank(s3SecretKey)) {
                builder.credentialsProvider(() -> AwsBasicCredentials.create(s3AccessKey, s3SecretKey));
            }

            s3Client = builder.build();
        } else if (fileStorePath.startsWith("s3")){
            throw new RuntimeException("s3.region is not provided. file store path is s3: " + fileStorePath);
        }
    }

    public boolean copyToFileStore(File src, QueueItem queueItem, boolean deleteSource) {
        try {
            if (isS3()) {
                // s3 storage
                String bucket = fileStorePath.substring(5, fileStorePath.indexOf("/", 5));
                String path = fileStorePath.substring(fileStorePath.indexOf("/", 5) + 1);
                PutObjectRequest request = PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(path + "/" + itemFileName(queueItem))
                        .build();
                CompletableFuture<PutObjectResponse> result = s3Client.putObject(request, src.toPath());
                result.join();

                // report error
                if (result.isCompletedExceptionally()) {
                    logger.error("Failed to copy file to s3 src: " + src.getAbsolutePath() + ", dstPath" + itemFileName(queueItem));
                    return false;
                }
            } else {
                // local file system
                FileUtils.copyFile(src, new File(getFilePath(queueItem)));
            }
            if (deleteSource) {
                src.delete();
            }
            return true;
        } catch (Exception e) {
            logger.error("Failed to copy file to file store src: " + src.getAbsolutePath() + ", dstPath" + itemFileName(queueItem) + ", " + e.getMessage());
            return false;
        }
    }

    private String itemFileName(QueueItem queueItem) {
        if (queueItem.queueRequest instanceof SearchQueueRequest) {
            return "search/" + queueItem.id + ".zip";
        } else if (queueItem.queueRequest instanceof FieldguideQueueRequest) {
            return "fieldguide/" + queueItem.id + ".pdf";
        }
        return queueItem.id;
    }

    public String createPresignedGetUrl(QueueItem queueItem) {
        String dstPath = itemFileName(queueItem);

        if (StringUtils.isNotEmpty(directS3Path)) {
            // direct s3 path
            return directS3Path + "/" + dstPath;
        } else {
            // create temporary, presigned URL
            try (S3Presigner presigner = S3Presigner.create()) {
                // s3 storage
                String bucket = fileStorePath.substring(5, fileStorePath.indexOf("/", 5));
                String path = fileStorePath.substring(fileStorePath.indexOf("/", 5) + 1);
                GetObjectRequest objectRequest = GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(path + "/" + dstPath)
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

    public String getFilePath(QueueItem queueItem) {
        return fileStorePath + "/" + itemFileName(queueItem);
    }

    public boolean isS3() {
        return fileStorePath.startsWith("s3");
    }
}
