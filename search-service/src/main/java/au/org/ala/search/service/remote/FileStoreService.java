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

import java.io.File;

/**
 * Service to store files, usually static files, info a file store. e.g. local file system or S3
 *
 * TODO: Test the S3 options.
 */
@Service
public class FileStoreService {

    private static final Logger logger = LoggerFactory.getLogger(FileStoreService.class);

    @Value("${filestore.path}")
    private String fileStorePath;
    @Value("${s3.region}")
    private String s3Region;
    @Value("${s3.accessKey}")
    private String s3AccessKey;
    @Value("${s3.secretKey}")
    private String s3SecretKey;

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
                s3Client.putObject(request, src.toPath());
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
}
