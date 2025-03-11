package au.org.ala.search.service.remote;

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
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.nio.file.Paths;
import java.util.concurrent.CompletableFuture;

@Service
public class DataFileStoreService {
    private static final Logger logger = LoggerFactory.getLogger(DataFileStoreService.class);

    @Value("${data.filestore.path}")
    private String fileStorePath;
    @Value("${data.s3.region}")
    private String s3Region;
    @Value("${data.s3.accessKey}")
    private String s3AccessKey;
    @Value("${data.s3.secretKey}")
    private String s3SecretKey;

    S3AsyncClient s3Client;

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

        CompletableFuture<GetObjectResponse> future = s3Client.getObject(request, Paths.get(fileName));
        future.join();

        if (future.isCompletedExceptionally()) {
            throw new IOException("Failed to retrieve file from S3: " + fileName);
        }

        return new File(fileName);
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
}