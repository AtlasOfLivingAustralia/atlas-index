package au.org.ala.search.service;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.dto.SandboxIngress;
import au.org.ala.search.model.queue.SandboxQueueRequest;
import au.org.ala.search.model.queue.Status;
import au.org.ala.search.model.sandbox.SandboxUpload;
import au.org.ala.search.repo.SandboxMongoRepository;
import au.org.ala.search.service.auth.WebService;
import au.org.ala.search.service.queue.QueueService;
import com.opencsv.*;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import org.gbif.dwc.terms.Term;
import org.gbif.dwc.terms.TermFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

// TODO: align with spatial-service's SandboxService
@Service
public class SandboxService {
    private static final Logger logger = LoggerFactory.getLogger(SandboxService.class);
    private final WebService webService;
    private final SandboxMongoRepository sandboxMongoRepository;
    private final QueueService queueService;

    @Value("${sandbox.dir}")
    public String sandboxDir;

    @Value("${solr.url}")
    public String solrUrl;

    public SandboxService(WebService webService, SandboxMongoRepository sandboxMongoRepository, QueueService queueService) {
        this.webService = webService;
        this.sandboxMongoRepository = sandboxMongoRepository;
        this.queueService = queueService;
    }

    public boolean isValidUUID(String uuid) {
        // validate that uuid is a correctly formed UUID
        try {
            return UUID.fromString(uuid).toString().equals(uuid);
        } catch (Exception ignored) {
            return false;
        }
    }

    public SandboxIngress upload(MultipartFile file, String datasetName, String userId) throws CsvValidationException, IOException {
        // get uuid
        String uuid = UUID.randomUUID().toString();

        SandboxIngress sandboxIngress = new SandboxIngress();
        sandboxIngress.setId(uuid);
        sandboxIngress.setUserId(userId);
        sandboxIngress.setDataResourceUid(UUID.randomUUID().toString());
        sandboxIngress.setDescription(datasetName);

        if (file.getOriginalFilename().toLowerCase().endsWith(".csv")) {
            importCsv(file, sandboxIngress);
        } else if (file.getOriginalFilename().toLowerCase().endsWith(".zip")) {
            importZip(file, sandboxIngress);
        } else {
            return null;
        }

        // store in the db so there is a reference to the file from the userId
        sandboxMongoRepository.save(SandboxUpload.builder().userId(userId).dataResourceUid(uuid).build());

        return sandboxIngress;
    }

    private void importZip(MultipartFile file, SandboxIngress sandboxIngress) throws CsvValidationException {
        // upload and unzip file
        File thisDir = new File(sandboxDir + "/upload/" + sandboxIngress.getId());
        try {
            FileUtils.forceMkdir(thisDir);
            File zipFile = new File(thisDir, "archive.zip");
            file.transferTo(zipFile);

            // unzip into thisDir, the files "meta.xml" and "occurrences.txt"
            ZipFile zip = new ZipFile(zipFile);

            // check if this is a DwCA by finding "meta.xml" in the zip file
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (entry.getName().toLowerCase().endsWith("meta.xml")) {
                    sandboxIngress.setIsDwCA(true);
                    break;
                }
            }

            // treat as a csv or tsv file when not a DwCA
            if (!sandboxIngress.getIsDwCA()) {
                entries = zip.entries();

                while (entries.hasMoreElements()) {
                    ZipEntry entry = entries.nextElement();
                    File entryFile = new File(thisDir, entry.getName());

                    if (!entry.isDirectory()) {
                        InputStream in = zip.getInputStream(entry);
                        OutputStream out = new FileOutputStream(entryFile);
                        IOUtils.copy(in, out);
                        IOUtils.closeQuietly(in);
                        IOUtils.closeQuietly(out);
                    }
                }

                sandboxIngress.setIsDwCA(false);

                String[] header = null;

                // look for a single csv or tsv file
                File[] files = thisDir.listFiles();
                for (File f : files) {
                    if (f.getName().toLowerCase().endsWith(".csv")) {
                        // move to occurrences.txt
                        header = convertCsvToDwCA(f, thisDir, sandboxIngress.getUserId(), sandboxIngress.getDescription());
                    } else if (f.getName().toLowerCase().endsWith(".tsv")) {
                        BufferedReader br = new BufferedReader(new FileReader(f));
                        header = br.readLine().split("\n");
                    }
                }
                if (header != null) {
                    sandboxIngress.setHeaders(interpretHeader(header));
                } else {
                    sandboxIngress = null;
                    logger.error("Error interpreting header: " + thisDir.getAbsolutePath());
                }
            }
        } catch (IOException e) {
            sandboxIngress = null;
            logger.error("Error importing ZIP file: " + thisDir.getAbsolutePath(), e);
        }

        if (sandboxIngress == null) {
            try {
                FileUtils.deleteDirectory(thisDir);
            } catch (IOException e) {
                logger.error("Error deleting directory: " + thisDir.getAbsolutePath(), e);
            }
        }
    }

    void importCsv(MultipartFile file, SandboxIngress si) throws IOException, CsvValidationException {
        String[] header = null;
        try {
            File thisDir = new File(sandboxDir + "/upload/" + si.getId());
            FileUtils.forceMkdir(thisDir);
            File csvFile = new File(thisDir, "occurrences.csv");
            file.transferTo(csvFile);

            // convert csv to tsv
            si.setHeaders(convertCsvToDwCA(csvFile, thisDir, si.getUserId(), si.getDescription()));
        } catch (IOException e) {
            logger.error("Error importing CSV file", e);
        }

        // update sandboxIngress
        si.setIsDwCA(false);
    }

    String[] convertCsvToDwCA(File csvFile, File thisDir, String userID, String datasetName) throws IOException, CsvValidationException {
        CSVReader reader = null;
        ICSVWriter writer = null;

        String[] header = null;
        try {
            // convert csv to tsv
            File tsvFile = new File(thisDir, "occurrence.tsv");
            reader = new CSVReader(new FileReader(csvFile));
            writer = new CSVWriterBuilder(new FileWriter(tsvFile)).withSeparator('\t').build();

            String[] nextLine;
            int occurrenceIDIndex = -1;
            int userIDIndex = -1;
            int datasetNameIndex = -1;
            int row = 0;
            while ((nextLine = reader.readNext()) != null) {
                // First row is the header
                if (row == 0) {
                    header = interpretHeader(nextLine);

                    // Append occurrenceID to the header, if absent
                    String occurrenceIDQualified = TermFactory.instance().findTerm("occurrenceID").qualifiedName();
                    occurrenceIDIndex = Arrays.asList(header).indexOf(occurrenceIDQualified);
                    if (occurrenceIDIndex < 0) {
                        String[] newHeader = new String[header.length + 1];
                        System.arraycopy(header, 0, newHeader, 0, header.length);
                        newHeader[header.length] = occurrenceIDQualified;
                        header = newHeader;
                    } else {

                    }

                    // Append userID to the header, if absent
                    String userIDQualified = TermFactory.instance().findTerm("userId").qualifiedName();
                    userIDIndex = Arrays.asList(header).indexOf(userIDQualified);
                    if (userIDIndex < 0) {
                        String[] newHeader = new String[header.length + 1];
                        System.arraycopy(header, 0, newHeader, 0, header.length);
                        newHeader[header.length] = userIDQualified;
                        header = newHeader;
                    } else {

                    }

                    // Append datasetName to the header, if absent
                    String datasetNameQualified = TermFactory.instance().findTerm("datasetName").qualifiedName();
                    datasetNameIndex = Arrays.asList(header).indexOf(datasetNameQualified);
                    if (datasetNameIndex < 0) {
                        String[] newHeader = new String[header.length + 1];
                        System.arraycopy(header, 0, newHeader, 0, header.length);
                        newHeader[header.length] = datasetNameQualified;
                        header = newHeader;
                    } else {

                    }
                } else {
                    // Append row number as the unique occurrenceID
                    if (occurrenceIDIndex < 0) {
                        String[] newLine = new String[nextLine.length + 1];
                        System.arraycopy(nextLine, 0, newLine, 0, nextLine.length);
                        newLine[nextLine.length] = Integer.toString(row);
                        nextLine = newLine;
                    } else {
                        // replace occurrenceID with the row number to prevent errors
                        nextLine[occurrenceIDIndex] = Integer.toString(row);
                    }

                    // Append ALA userID as the userID
                    if (userIDIndex < 0) {
                        String[] newLine = new String[nextLine.length + 1];
                        System.arraycopy(nextLine, 0, newLine, 0, nextLine.length);
                        newLine[nextLine.length] = userID;
                        nextLine = newLine;
                    } else {
                        // replace userID with ALA userID
                        nextLine[userIDIndex] = userID;
                    }

                    // Append datasetName to the row
                    if (datasetNameIndex < 0) {
                        String[] newLine = new String[nextLine.length + 1];
                        System.arraycopy(nextLine, 0, newLine, 0, nextLine.length);
                        newLine[nextLine.length] = datasetName;
                        nextLine = newLine;
                    } else {
                        // replace datasetName with the datasetName
                        nextLine[datasetNameIndex] = datasetName;
                    }

                    writer.writeNext(nextLine);
                }

                row++;
            }

            writer.flush();

            // create meta.xml
            StringBuilder sb = new StringBuilder();
            sb.append("<?xml version=\"1.0\"?>\n" +
                    "<archive xmlns=\"http://rs.tdwg.org/dwc/text/\">\n" +
                    "  <core encoding=\"UTF-8\" linesTerminatedBy=\"\\r\\n\" fieldsTerminatedBy=\"\\t\" fieldsEnclosedBy=\"&quot;\" ignoreHeaderLines=\"0\" rowType=\"http://rs.tdwg.org/dwc/terms/Occurrence\">\n" +
                    "    <files>\n" +
                    "      <location>occurrence.tsv</location>\n" +
                    "    </files>\n" +
                    "    <id index=\"0\"/>\n");
            for (int i = 0; i < header.length; i++) {
                sb.append("    <field index=\"").append(i).append("\" term=\"").append(header[i]).append("\"/>\n");
            }
            sb.append("  </core>\n" +
                    "</archive>");
            FileUtils.write(new File(csvFile.getParent(), "meta.xml"), sb.toString(), "UTF-8");

            // create the zip file
            File zipFile = new File(thisDir, "archive.zip");
            FileOutputStream fos = new FileOutputStream(zipFile);
            ZipOutputStream zipOut = new ZipOutputStream(fos);

            ZipEntry entry = new ZipEntry("occurrence.tsv");
            zipOut.putNextEntry(entry);
            FileInputStream in = new FileInputStream(tsvFile);
            IOUtils.copy(in, zipOut);
            IOUtils.closeQuietly(in);
            zipOut.closeEntry();

            entry = new ZipEntry("meta.xml");
            zipOut.putNextEntry(entry);
            in = new FileInputStream(new File(thisDir, "meta.xml"));
            IOUtils.copy(in, zipOut);
            IOUtils.closeQuietly(in);
            zipOut.closeEntry();

            zipOut.close();
        } catch (IOException e) {
            logger.error("Error importing CSV file", e);
        }

        if (reader != null) {
            reader.close();
        }

        if (writer != null) {
            writer.close();
        }

        return header;
    }

    private String[] interpretHeader(String[] header) {
        TermFactory factory = TermFactory.instance();

        String[] matched = new String[header.length];
        for (int i = 0; i < header.length; i++) {
            Term term = factory.findTerm(header[i]);
            if (term != null) {
                matched[i] = term.qualifiedName();
            } else {
                matched[i] = header[i];
            }
        }
        return matched;
    }

    public String getUserId(String id) {
        if (!isValidUUID(id)) {
            return null;
        }

        // get userId from SOLR
        Map resp = webService.get(solrUrl + "/select?q=dataResourceUid%3A" + id + "&fl=userId&rows=1", null, null, false, false, null);

        if (resp != null && resp.containsKey("response") && resp.get("response") instanceof Map) {
            Map response = (Map) resp.get("response");
            if (response.containsKey("docs") && response.get("docs") instanceof List) {
                List docs = (List) response.get("docs");
                if (docs.size() > 0) {
                    Map doc = (Map) docs.get(0);
                    if (doc.containsKey("userId")) {
                        return (String) doc.get("userId");
                    }
                }
            }
        }

        return null;
    }

    /**
     * Delete a sandbox data resource, from the /upload/ directory and SOLR.
     *
     * @param id      upload UUID (dataResourceUid)
     * @param userId  user ID or null to skip user check
     * @param isAdmin
     * @return
     */
    public SandboxIngress delete(String id, String userId, boolean isAdmin) {
        if (!isValidUUID(id)) {
            return null;
        }

        // check that the user owns this data resource, or is admin. userId == null will skip this check
        String drUserId = getUserId(id);
        if (!isAdmin && userId != null && (drUserId == null || !drUserId.equals(userId))) {
            return null;
        }

        // delete the file uploaded
        File thisDir = new File(sandboxDir + "/upload/" + id);
        try {
            FileUtils.deleteDirectory(thisDir);
        } catch (IOException e) {
            logger.error("Error deleting directory: " + thisDir.getAbsolutePath(), e);
        }

        // delete from SOLR
        webService.get(solrUrl + "/update?commit=true&stream.body=<delete><query>dataResourceUid%3A" + id + "</query></delete>", null, null, false, false, null);

        // delete from the database
        sandboxMongoRepository.deleteByDataResourceUid(id);

        return new SandboxIngress();
    }

    public Status ingress(SandboxIngress sandboxIngress) {

        SandboxQueueRequest request = new SandboxQueueRequest();
        request.taskType = TaskType.SANDBOX;
        request.sandboxIngress = sandboxIngress;

        // return queue reference
        return queueService.add(request);
    }
}
