package au.org.ala.search.service.queue;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.model.queue.QueueItem;
import au.org.ala.search.model.queue.StatusCode;
import au.org.ala.search.service.remote.DownloadFileStoreService;
import au.org.ala.search.service.remote.LogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Consumes the fieldguide queue to produce PDF files.
 *
 * Extending ConsumerService requires implementation of processItem and sendEmail methods, and a call to super.init()
 *
 * Example:
 *   @PostConstruct
 *   void init() {
 *     taskType = TaskType.SEARCH_DOWNLOAD;
 *     super.init(numberOfThreads);
 *   }
 */
@Service
public abstract class ConsumerService {
    private static final Logger logger = LoggerFactory.getLogger(ConsumerService.class);
    public TaskType taskType;

    protected final QueueService queueService;
    protected final LogService logService;
    protected final JavaMailSender emailSender;
    protected final DownloadFileStoreService downloadFileStoreService;

    public Integer consumerThreads;

    public Map<String, QueueItem> activeItems = new ConcurrentHashMap<>();

    public ConsumerService(LogService logService, QueueService queueService, JavaMailSender emailSender, DownloadFileStoreService downloadFileStoreService) {
        this.logService = logService;
        this.queueService = queueService;
        this.emailSender = emailSender;
        this.downloadFileStoreService = downloadFileStoreService;
    }

    void init(int consumerThreads) {
        logger.info(taskType.name().toLowerCase() + ".consumer.threads: " + consumerThreads);
        this.consumerThreads = consumerThreads;
        if (consumerThreads > 0) {
            for (int i = 0; i < consumerThreads; i++) {
                new Consumer().start();
            }
        }
    }

    /**
     * Process the item from the queue.
     *
     * This requires
     * - casting the item.downloadRequest to the appropriate type
     * - removing any temporary files created, during processing, that may exist due to an earlier a shutdown.
     * - processing the request
     * - updating status progress. e.g. queueService.updateStatus(item, StatusCode.RUNNING, "step 1 of 2");
     * - recording errors. e.g. queueService.updateStatus(item, StatusCode.ERROR, "error message");
     * - detecting if the task is cancelled. e.g. if (item.status.statusCode == StatusCode.CANCELLED) { return; }
     * - writing the output file to the file store. e.g. downloadFileStoreService.copyToFileStore(srcFile, queueItem, true);
     * - or, writing directly to the local file store. e.g. if (!downloadFileStoreService.isS3(queueItem)) FileUtils.write(downloadFileStoreService.getFilePath(queueItem), "content", "UTF-8");
     *
     * StatusCode.FINISHED is automatically set when the method completes.
     *
     * If an exception is thrown, StatusCode.ERROR is automatically set.
     *
     * @param queueItem item to process. Includes the downloadRequest and status.
     */
    abstract void processItem(QueueItem queueItem);

    class Consumer extends Thread {
        @Override
        public void run() {
            boolean notInterrupted = true;
            while (notInterrupted) {
                // get next item from queue
                QueueItem item = null;
                try {
                    item = queueService.next(taskType);

                    activeItems.put(item.id, item);

                    queueService.updateStatus(item, StatusCode.RUNNING, "");

                    processItem(item);

                    queueService.updateStatus(item, StatusCode.FINISHED, "");
                } catch (InterruptedException e) {
                    notInterrupted = false;

                    // when doing a clean shutdown, add it back to the queue
                    queueService.updateStatus(item, StatusCode.QUEUED, "interrupted");

                    logger.warn("(interrupted) added " + taskType.name().toLowerCase() + " back to the queue: " + item.id);
                } catch (Exception e) {
                    queueService.updateStatus(item, StatusCode.ERROR, e.getMessage());

                    logger.error("Error processing " + taskType.name().toLowerCase(), e);
                }
                if (item != null) {
                    activeItems.remove(item.id);
                }
            }
        }
    }
}
