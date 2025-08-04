/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.consumer;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.model.fieldguide.Fieldguide;
import au.org.ala.search.model.fieldguide.Group;
import au.org.ala.search.model.fieldguide.Taxon;
import au.org.ala.search.model.queue.FieldguideQueueRequest;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.util.InterruptibleResourceResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.fop.apps.*;
import org.apache.fop.apps.io.ResourceResolverFactory;
import org.apache.fop.configuration.Configuration;
import org.apache.fop.configuration.DefaultConfigurationBuilder;
import org.apache.xmlgraphics.io.ResourceResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import javax.xml.transform.Result;
import javax.xml.transform.Source;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.sax.SAXResult;
import javax.xml.transform.stream.StreamSource;
import java.io.*;
import java.net.URI;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * Consumes the fieldguide queue to produce PDF files.
 * <p>
 * Future: Add a progress message to the indicate progress. Make use of the # with image, and track progress using the
 *  interruption handling class. e.g. "Setup 1/10" for requests for image metadata, "Pre-processing 1/10" for the
 *  preparation stage, "Generating PDF 1/10" for the FOP processing. Could consider using tracking "Pages rendered" at
 *  the "Generating PDF" stage if not too complex.
 * <p>
 * TODO: maybe use a local cache for all external images (images.ala and biocache-ws.ala) or maybe consider configurable
 *  per-instance throttling on images.and biocache-ws.ala requests
 */
@Slf4j
@Service
public class FieldguideConsumer {
    private final ElasticService elasticService;
    private final DownloadFileStoreService downloadFileStoreService;
    private final JavaMailSender emailSender;

    @Value("${images.url}")
    public String imagesUrl;

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
    int maxTaxonHeight = 300;
    int maxTaxonWidth = 260;
    @Value("#{'${openapi.servers}'.split(',')[0]}")
    private String baseUrl;

    public FieldguideConsumer(ElasticService elasticService, DownloadFileStoreService downloadFileStoreService, JavaMailSender emailSender) {
        this.elasticService = elasticService;
        this.downloadFileStoreService = downloadFileStoreService;
        this.emailSender = emailSender;
    }

    public void consume(QueueItem item) throws Exception {
        log.info("Processing fieldguide: {}", item.id);

        writePdfWithFop(item, generateTemplate(item));

        sendEmail(item);
    }

    private Fieldguide generateTemplate(QueueItem item) throws InterruptedException {
        FieldguideQueueRequest request = item.queueRequest.fieldguideQueueRequest;
        ObjectMapper om = new ObjectMapper();

        Fieldguide data = new Fieldguide();
        data.title = request.title;
        data.sourceUrl = request.sourceUrl;

        // Future: expand on this for more flexibility. Currently limited to grouping with family, then sorting by
        // either "commonName,scientificName" or "scientificName"
        String[] sortBy = StringUtils.compare("scientificName", request.sortBy) != 0
                ? new String[]{"rk_family", "commonName", "scientificName"} : new String[]{"rk_family", "scientificName", "commonName"};

        data.groupTitle = "Family";

        Map<String, List<Taxon>> groups = new LinkedHashMap<>();
        for (String id : request.id) {
            // check for thread interruption
            if (Thread.interrupted()) {
                log.info("Fieldguide generation interrupted for item: {}", item.id);
                throw new InterruptedException("Fieldguide generation was interrupted");
            }

            SearchItemIndex taxon = elasticService.getTaxon(id);
            if (taxon != null) {
                Taxon newTaxon = new Taxon();
                newTaxon.guid = taxon.guid;
                newTaxon.scientificName = taxon.scientificName;
                newTaxon.commonName = taxon.commonNameSingle != null ? taxon.commonNameSingle : "";
                newTaxon.datasetName = taxon.datasetName;
                newTaxon.datasetID = taxon.datasetID;

                String imageId = null;
                if (taxon.image != null) {
                    imageId = taxon.image.split(",")[0];
                }

                newTaxon.imageId = imageId;

                if (imageId != null) {
                    try {
                        Map imgMetadata = om.createParser(URI.create(imagesUrl + "/ws/image/" + imageId).toURL()).readValueAs(Map.class);
                        newTaxon.thumbnailUrl = imagesUrl + "/image/" + imageId + "/thumbnail";
                        newTaxon.imageUrl = imagesUrl + "/image/" + imageId + "/large";

                        Integer height = (Integer) imgMetadata.get("height");
                        Integer width = (Integer) imgMetadata.get("width");
                        try {
                            if (width / (double) height > maxTaxonWidth / (double) maxTaxonHeight) {
                                // limit by width
                                newTaxon.imgWidth = maxTaxonWidth;
                                newTaxon.imgHeight = (int) (height / (double) width * maxTaxonWidth);
                            } else {
                                // limit by height
                                newTaxon.imgHeight = maxTaxonHeight;
                                newTaxon.imgWidth = (int) (width / (double) height * maxTaxonHeight);
                            }
                        } catch (Exception ignored) {
                            newTaxon.imgHeight = maxTaxonHeight;
                            newTaxon.imgWidth = maxTaxonWidth;
                        }

                        newTaxon.imageDataResourceURL = Objects.toString(imgMetadata.get("websiteUrl"), "");
                        newTaxon.imageDataResourceName = Objects.toString(imgMetadata.get("name"), "");
                        newTaxon.imageDataResourceUid = Objects.toString(imgMetadata.get("dataResourceUid"), "");
                        newTaxon.imageCreator = Objects.toString(imgMetadata.get("creator"), "");
                        newTaxon.imageRights = Objects.toString(imgMetadata.get("rights"), "");
                        if (imgMetadata.get("recognisedLicence") != null) {
                            newTaxon.imageLicence = Objects.toString(((Map) imgMetadata.get("recognisedLicence")).get("acronym"), "");
                            newTaxon.imageLicenceUrl = Objects.toString(((Map) imgMetadata.get("recognisedLicence")).get("url"), "");
                        }
                    } catch (IOException e) {
                        log.warn("Error getting image metadata for imageId: {}", imageId);
                    }
                }

                // add to group
                String group = taxon.rkFields != null ? taxon.rkFields.get(sortBy[0]) : null;
                if (group == null) {
                    group = "";
                }
                List<Taxon> list = groups.computeIfAbsent(group, k -> new ArrayList<>());
                list.add(newTaxon);
            }
        }

        // sort groups by name
        List<String> sortedKeys = new ArrayList<>(groups.keySet());
        sortedKeys.sort(String::compareTo);

        data.groups = new ArrayList();
        for (String key : sortedKeys) {
            Group group = new Group();
            group.name = key;

            List<Taxon> list = groups.get(key);
            if (StringUtils.compare("scientificName", request.sortBy) != 0) {
                // default sorting
                list.sort(Comparator.comparing((Taxon a) -> a.commonName).thenComparing(a -> a.scientificName));
            } else {
                // sort by scientificName
                list.sort(Comparator.comparing((Taxon a) -> a.scientificName).thenComparing(a -> a.commonName));
            }
            group.taxa = list;

            data.groups.add(group);
        }

        return data;
    }

    private void writePdfWithFop(QueueItem item, Fieldguide data) throws Exception {
        File pdfFile;
        if (downloadFileStoreService.isS3()) {
            pdfFile = File.createTempFile("fieldguide", ".pdf"); // copy to s3 later
        } else {
            pdfFile = new File(downloadFileStoreService.getFilePath(item)); // actual output file
        }

        try {
            // add additional document config
            SimpleDateFormat sdf = new SimpleDateFormat("d MMMM yyyy");
            data.fieldguideHeaderPg1 = "images/field-guide-header-pg1.png";
            data.dataLink = item.queueRequest.fieldguideQueueRequest.sourceUrl;
            data.baseUrl = homeUrl;
            data.fieldguideBannerOtherPages = "images/field-guide-banner-other-pages.png";
            data.fieldguideSpeciesUrl = speciesUIPrefix;
            data.collectoryUrl = collectionsUrl;
            data.formattedDate = sdf.format(new Date());
            data.biocacheMapUrl = biocacheUrl + "/density/map?fq=geospatial_kosher:true&q=lsid:%22";
            data.biocacheLegendUrl = biocacheUrl + "/density/legend?fq=geospatial_kosher:true&q=lsid:%22";

            XmlMapper xmlMapper = new XmlMapper();
            String xmlData = xmlMapper.writeValueAsString(data);

            // Load template and configuration
            Source xslt = new StreamSource(getClass().getResourceAsStream("/templates/fieldguide.xsl"));
            InputStream confStream = getClass().getResourceAsStream("/templates/fop.xconf");
            DefaultConfigurationBuilder cfgBuilder = new DefaultConfigurationBuilder();
            Configuration config = cfgBuilder.build(confStream);

            // --- Fieldguide template development section ---
            // Uncomment the following lines to reload template and config from the file system for live template changes.
            // Source xslt = new StreamSource(new File("search-service/src/main/resources/templates/fieldguide.xsl"));
            // InputStream confStream = new FileInputStream("search-service/src/main/resources/templates/fop.xconf");
            // File pdfFile = new File("/data/fieldguide.pdf"); // static output path

            Source xmlSource = new StreamSource(new StringReader(xmlData));
            OutputStream out = new BufferedOutputStream(new FileOutputStream(pdfFile));

            // Future: use a custom image preloader and URI resolver for remote images. This is for local caching and
            // to fix the debug error reported by the PreloaderSVG that is failing to assign the biocache-service PNG
            // images as such.

            // Set up FOP
            URL baseUrl = getClass().getResource("/templates/");
            ResourceResolver resolver = new InterruptibleResourceResolver(ResourceResolverFactory.createDefaultResourceResolver());
            FopFactoryBuilder builder = new FopFactoryBuilder(baseUrl.toURI(), resolver).setConfiguration(config);
            FopFactory fopFactory = builder.build();
            FOUserAgent foUserAgent = fopFactory.newFOUserAgent();
            Fop fop = fopFactory.newFop(MimeConstants.MIME_PDF, foUserAgent, out);

            // Transform XML to PDF
            TransformerFactory factory = TransformerFactory.newInstance();
            Transformer transformer = factory.newTransformer(xslt);
            Result res = new SAXResult(fop.getDefaultHandler());
            transformer.transform(xmlSource, res);

            out.close();

            if (downloadFileStoreService.isS3()) {
                downloadFileStoreService.copyToFileStore(pdfFile, item, true);
            }
        } catch (Exception e) {
            // delete pdfFile if it was created
            if (pdfFile.exists()) {
                if (!pdfFile.delete()) {
                    log.warn("Failed to delete temporary PDF file: {}", pdfFile.getAbsolutePath());
                }
            }

            throw e;
        }
    }

    void sendEmail(QueueItem item) {
        String downloadUrl = baseUrl + "/v1/fieldguide/download/" + item.id;

        String content = emailTextSuccess.replace("[url]", downloadUrl).replace("[date]", new Date().toString()).replace("[query]", item.queueRequest.fieldguideQueueRequest.sourceUrl != null ? item.queueRequest.fieldguideQueueRequest.sourceUrl : "");

        String subject = emailSubjectSuccess.replace("[filename]", item.queueRequest.fieldguideQueueRequest.filename);

        if (emailEnabled) {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(emailFrom);
            message.setTo(item.queueRequest.email);
            message.setSubject(subject);
            message.setText(content);
            emailSender.send(message);
        } else {
            log.debug("to: {}, from: {}, subject: {}, html: {}", item.queueRequest.email, emailFrom, subject, content);
        }
    }
}
