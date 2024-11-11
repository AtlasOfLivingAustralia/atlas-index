package au.org.ala.search.service.queue;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.FieldguideQueueRequest;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;
import org.xhtmlrenderer.pdf.ITextRenderer;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * Consumes the fieldguide queue to produce PDF files.
 */
@Service
public class FieldguideConsumerService extends ConsumerService {
    private static final Logger logger = LoggerFactory.getLogger(FieldguideConsumerService.class);
    private final ElasticService elasticService;

    @Value("${images.url}")
    public String imagesUrl;

    @Value("${fieldguide.consumer.threads}")
    public Integer fieldguideConsumerThreads;

    @Value("${biocache.url}")
    public String biocacheUrl;

    @Value("${collections.url}")
    public String collectionsUrl;

    @Value("${speciesUrlPrefix}")
    public String speciesUIPrefix;

    @Value("${homeUrl}")
    public String homeUrl;

    @Value("${email.enabled}")
    public boolean emailEnabled;

    @Value("${email.from}")
    public String emailFrom;

    @Value("${email.text.success}")
    public String emailTextSuccess;

    @Value("${email.subject.success}")
    public String emailSubjectSuccess;

    @Value("#{'${openapi.servers}'.split(',')[0]}")
    private String baseUrl;

    int maxTaxonHeight = 300;
    int maxTaxonWidth = 260;

    public FieldguideConsumerService(LogService logService, QueueService queueService, JavaMailSender emailSender, DownloadFileStoreService downloadFileStoreService, ElasticService elasticService) {
        super(logService, queueService, emailSender, downloadFileStoreService);
        this.elasticService = elasticService;
    }

    @PostConstruct
    void init() {
        taskType = TaskType.FIELDGUIDE;
        super.init(fieldguideConsumerThreads);
    }

    void processItem(QueueItem item) {
        // process item
        logger.info("Processing fieldguide: " + item.id);

        try {
            writePdf(item, generateTemplate(item));
            sendEmail(item);
        } catch (IOException e) {
            queueService.updateStatus(item, StatusCode.ERROR, e.getMessage());
            logger.error("Error processing fieldguide: " + item.id, e);
        }
    }

    private Map generateTemplate(QueueItem item) throws IOException {
        FieldguideQueueRequest request = (FieldguideQueueRequest) item.queueRequest;
        ObjectMapper om = new ObjectMapper();

        Map<String, Object> json = new HashMap<>();
        json.put("title", request.title);
        json.put("sourceUrl", item.queueRequest.sourceUrl);

        HashMap<String, List<Map<String, Object>>> families = new HashMap<>();
        for (String id : request.id) {
            SearchItemIndex taxon = elasticService.getTaxon(id);
            if (taxon != null) {
                Map<String, Object> itemMap = new HashMap<>();
                itemMap.put("guid", taxon.guid);
                itemMap.put("scientificName", taxon.scientificName);
                itemMap.put("commonName", taxon.commonNameSingle != null ? taxon.commonNameSingle : "");
                itemMap.put("datasetName", taxon.datasetName);
                itemMap.put("datasetID", taxon.datasetID);

                String imageId = null;
                if (taxon.image != null) {
                    imageId = taxon.image.split(",")[0];
                }

                itemMap.put("imageId", imageId);

                if (imageId != null) {
                    try {
                        Map imgMetadata = om.createParser(URI.create(imagesUrl + "/ws/image/" + imageId).toURL()).readValueAs(Map.class);
                        itemMap.put("thumbnailUrl", imagesUrl + "/image/" + imageId + "/thumbnail");
                        itemMap.put("imageUrl", imagesUrl + "/image/" + imageId + "/large");

                        Integer height = (Integer) imgMetadata.get("height");
                        Integer width = (Integer) imgMetadata.get("width");
                        try {
                            if (width / (double) height > maxTaxonWidth / (double) maxTaxonHeight) {
                                // limit by width
                                itemMap.put("imgWidth", maxTaxonWidth);
                                itemMap.put("imgHeight", (int) (height / (double) width * maxTaxonWidth));
                            } else {
                                // limit by height
                                itemMap.put("imgHeight", maxTaxonHeight);
                                itemMap.put("imgWidth", (int) (width / (double) height * maxTaxonHeight));
                            }
                        } catch (Exception ignored) {
                            itemMap.put("imgHeight", maxTaxonHeight);
                            itemMap.put("imgWidth", maxTaxonWidth);
                        }

                        Map dataResource = elasticService.getDocumentMap(taxon.datasetID);
                        if (dataResource != null) {
                            itemMap.put("imageDataResourceURL", dataResource.get("image")); // TODO: get the data resource image URL as this might be wrong
                            itemMap.put("imageDataResourceName", dataResource.get("name"));
                        }
                        itemMap.put("imageDataResourceUid", imgMetadata.get("dataResourceUid"));
                        itemMap.put("imageCreator", imgMetadata.get("creator"));
                        itemMap.put("imageRights", imgMetadata.get("rights"));
                        if (imgMetadata.get("recognisedLicence") != null) {
                            itemMap.put("imageLicence", ((Map) imgMetadata.get("recognisedLicence")).get("acronym"));
                            itemMap.put("imageLicenceUrl", ((Map) imgMetadata.get("recognisedLicence")).get("url"));
                        }
                    } catch (IOException e) {
                        logger.error("Error getting image metadata: " + id);
                    }
                }

                // add to families
                String family = taxon.rkFields != null ? taxon.rkFields.get("rk_family") : null;
                if (family == null) {
                    family = "";
                }
                List<Map<String, Object>> list = families.computeIfAbsent(family, k -> new ArrayList<>());
                list.add(itemMap);
            }
        }

        // sorting by family, commonName, scientificName
        HashMap<String, List<Map<String, Object>>> sortedFamilies = new LinkedHashMap<>();

        List<String> sortedKeys = new ArrayList<>(families.keySet());
        sortedKeys.sort(String::compareTo);

        for (String key : sortedKeys) {
            List<Map<String, Object>> list = families.get(key);
            list.sort(Comparator.comparing((Map<String, Object> a) -> a.get("commonName").toString()).thenComparing(a -> a.get("scientificName").toString()));
            sortedFamilies.put(key, list);
        }

        json.put("families", sortedFamilies);

        return json;
    }

    private void writePdf(QueueItem item, Map json) throws IOException {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        resolver.setPrefix("/templates/");
        resolver.setSuffix(".html");

        SimpleDateFormat sdf = new SimpleDateFormat("d MMMM yyyy");

        Context context = new Context();
        context.setVariable("fieldguideHeaderPg1", "./images/field-guide-header-pg1.png");
        context.setVariable("dataLink", item.queueRequest.sourceUrl);
        context.setVariable("baseUrl", homeUrl);
        context.setVariable("fieldguideBannerOtherPages", "./images/field-guide-banner-other-pages.png");
        context.setVariable("fieldguideSpeciesUrl", speciesUIPrefix);
        context.setVariable("collectoryUrl", collectionsUrl + "/public/show/");
        context.setVariable("formattedDate", sdf.format(new Date()));
        context.setVariable("biocacheMapUrl", biocacheUrl + "/density/map?fq=geospatial_kosher:true&q=lsid:%22");
        context.setVariable("biocacheLegendUrl", biocacheUrl + "/density/legend?fq=geospatial_kosher:true&q=lsid:%22");
        context.setVariable("data", json);

        TemplateEngine templateEngine = new TemplateEngine();
        templateEngine.setTemplateResolver(resolver);

        String html = templateEngine.process("fieldguide", context);

        File file;
        if (downloadFileStoreService.isS3()) {
            file = File.createTempFile("fieldguide", ".pdf");
        } else {
            file = new File(downloadFileStoreService.getFilePath(item));
        }

        OutputStream outputStream = new FileOutputStream(file);
        ITextRenderer renderer = new ITextRenderer();
        renderer.setDocumentFromString(html, new ClassPathResource("/templates/").getURL().toExternalForm());
        renderer.layout();
        renderer.createPDF(outputStream);
        outputStream.flush();
        outputStream.close();
    }

    void sendEmail(QueueItem item) {
        String downloadUrl = baseUrl + "/v1/download/" + item.id;

        String content = emailTextSuccess
                .replace("[url]", downloadUrl)
                .replace("[date]", new Date().toString())
                .replace("[query]", item.queueRequest.sourceUrl != null ? item.queueRequest.sourceUrl : "");

        String subject = emailSubjectSuccess.replace("[filename]", item.queueRequest.filename);

        if (emailEnabled) {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(emailFrom);
            message.setTo(item.queueRequest.email);
            message.setSubject(subject);
            message.setText(content);
            emailSender.send(message);
        } else {
            logger.debug("to: " + item.queueRequest.email);
            logger.debug("from: " + emailFrom);
            logger.debug("subject:" + subject);
            logger.debug("html:" + content);
        }
    }
}
