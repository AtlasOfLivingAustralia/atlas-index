/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.queue;

import au.org.ala.search.LeadershipStatus;
import au.org.ala.search.model.queue.FieldguideQueueRequest;
import au.org.ala.search.model.queue.QueueRequest;
import au.org.ala.search.model.queue.SearchQueueRequest;
import au.org.ala.search.repo.QueuePostgresRepository;
import au.org.ala.search.service.consumer.FieldguideConsumer;
import au.org.ala.search.service.consumer.SearchConsumer;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.QueueDataService;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link ConsumerQueue}'s {@code sanitize} and {@code getValidationError}
 * helpers. No Spring context, no containers, no RabbitMQ — constructor dependencies are
 * Mockito mocks that are never invoked by these pure validation/sanitisation methods, and the
 * private methods are exercised via reflection.
 */
class ConsumerQueueTest {

    private final ElasticService elasticService = mock(ElasticService.class);
    private final ConsumerQueue consumerQueue = new ConsumerQueue(
            mock(QueuePostgresRepository.class),
            mock(QueueDataService.class),
            elasticService,
            mock(RabbitTemplate.class),
            mock(FieldguideConsumer.class),
            mock(SearchConsumer.class),
            mock(LeadershipStatus.class));

    private void sanitize(QueueRequest queueRequest) throws Exception {
        Method m = ConsumerQueue.class.getDeclaredMethod("sanitize", QueueRequest.class);
        m.setAccessible(true);
        m.invoke(consumerQueue, queueRequest);
    }

    private String getValidationError(QueueRequest queueRequest) throws Exception {
        Method m = ConsumerQueue.class.getDeclaredMethod("getValidationError", QueueRequest.class);
        m.setAccessible(true);
        return (String) m.invoke(consumerQueue, queueRequest);
    }

    private QueueRequest searchRequest(String filename, String... q) {
        QueueRequest qr = new QueueRequest();
        SearchQueueRequest sqr = new SearchQueueRequest();
        sqr.filename = filename;
        sqr.q = q;
        qr.searchQueueRequest = sqr;
        return qr;
    }

    private QueueRequest fieldguideRequest(String filename, String title, String email, String sourceUrl, String[] id) {
        QueueRequest qr = new QueueRequest();
        qr.email = email;
        FieldguideQueueRequest fqr = new FieldguideQueueRequest();
        fqr.filename = filename;
        fqr.title = title;
        fqr.sourceUrl = sourceUrl;
        fqr.id = id;
        qr.fieldguideQueueRequest = fqr;
        return qr;
    }

    @Test
    void sanitize_searchRequestFilenameMissingExtension_appendsCsv() throws Exception {
        QueueRequest qr = searchRequest("my-search");

        sanitize(qr);

        assertThat(qr.searchQueueRequest.filename).isEqualTo("my-search.csv");
    }

    @Test
    void sanitize_searchRequestFilenameAlreadyHasCsvExtension_unchanged() throws Exception {
        QueueRequest qr = searchRequest("my-search.csv");

        sanitize(qr);

        assertThat(qr.searchQueueRequest.filename).isEqualTo("my-search.csv");
    }

    @Test
    void sanitize_searchRequestFilenameUppercaseCsvExtension_notDuplicated() throws Exception {
        QueueRequest qr = searchRequest("my-search.CSV");

        sanitize(qr);

        assertThat(qr.searchQueueRequest.filename).isEqualTo("my-search.CSV");
    }

    @Test
    void sanitize_fieldguideRequestFilenameMissingExtension_appendsPdf() throws Exception {
        QueueRequest qr = fieldguideRequest("my-guide", "Title", "a@b.com", null, new String[]{"id1"});

        sanitize(qr);

        assertThat(qr.fieldguideQueueRequest.filename).isEqualTo("my-guide.pdf");
    }

    @Test
    void sanitize_fieldguideRequestFilenameAlreadyHasPdfExtension_unchanged() throws Exception {
        QueueRequest qr = fieldguideRequest("my-guide.pdf", "Title", "a@b.com", null, new String[]{"id1"});

        sanitize(qr);

        assertThat(qr.fieldguideQueueRequest.filename).isEqualTo("my-guide.pdf");
    }

    @Test
    void getValidationError_searchRequestMissingFilename_returnsError() throws Exception {
        QueueRequest qr = searchRequest(null, "state:Victoria");

        assertThat(getValidationError(qr)).isEqualTo("missing filename");
    }

    @Test
    void getValidationError_searchRequestEmptyFilename_returnsError() throws Exception {
        QueueRequest qr = searchRequest("", "state:Victoria");

        assertThat(getValidationError(qr)).isEqualTo("missing filename");
    }

    @Test
    void getValidationError_searchRequestValidQuery_returnsNull() throws Exception {
        when(elasticService.isValidField(anyString())).thenReturn(true);
        QueueRequest qr = searchRequest("my-search", "state:Victoria");

        assertThat(getValidationError(qr)).isNull();
    }

    @Test
    void getValidationError_searchRequestInvalidQuery_returnsError() throws Exception {
        when(elasticService.isValidField(anyString())).thenReturn(false);
        QueueRequest qr = searchRequest("my-search", "state:Victoria");

        assertThat(getValidationError(qr)).isEqualTo("invalid query: state:Victoria");
    }

    @Test
    void getValidationError_searchRequestEmptyQueryArray_returnsNull() throws Exception {
        QueueRequest qr = searchRequest("my-search");

        assertThat(getValidationError(qr)).isNull();
    }

    @Test
    void getValidationError_searchRequestBlankQueryEntriesSkipped() throws Exception {
        QueueRequest qr = searchRequest("my-search", "", null);

        assertThat(getValidationError(qr)).isNull();
    }

    @Test
    void getValidationError_fieldguideRequestMissingTitle_returnsError() throws Exception {
        QueueRequest qr = fieldguideRequest("guide.pdf", null, "a@b.com", null, new String[]{"id1"});

        assertThat(getValidationError(qr)).isEqualTo("missing title");
    }

    @Test
    void getValidationError_fieldguideRequestMissingEmail_returnsError() throws Exception {
        QueueRequest qr = fieldguideRequest("guide.pdf", "Title", null, null, new String[]{"id1"});

        assertThat(getValidationError(qr)).isEqualTo("missing email");
    }

    @Test
    void getValidationError_fieldguideRequestMissingId_returnsError() throws Exception {
        QueueRequest qr = fieldguideRequest("guide.pdf", "Title", "a@b.com", null, new String[]{});

        assertThat(getValidationError(qr)).isEqualTo("missing id");
    }

    @Test
    void getValidationError_fieldguideRequestNullId_returnsError() throws Exception {
        QueueRequest qr = fieldguideRequest("guide.pdf", "Title", "a@b.com", null, null);

        assertThat(getValidationError(qr)).isEqualTo("missing id");
    }

    @Test
    void getValidationError_fieldguideRequestValid_returnsNull() throws Exception {
        QueueRequest qr = fieldguideRequest("guide.pdf", "Title", "a@b.com", null, new String[]{"id1"});

        assertThat(getValidationError(qr)).isNull();
    }

    @Test
    void getValidationError_fieldguideRequestInvalidSourceUrl_returnsError() throws Exception {
        QueueRequest qr = fieldguideRequest("guide.pdf", "Title", "a@b.com", "ht!tp://bad url", new String[]{"id1"});

        assertThat(getValidationError(qr)).isEqualTo("invalid sourceUrl");
    }

    @Test
    void getValidationError_fieldguideRequestValidSourceUrl_returnsNull() throws Exception {
        QueueRequest qr = fieldguideRequest("guide.pdf", "Title", "a@b.com", "https://example.org/page", new String[]{"id1"});

        assertThat(getValidationError(qr)).isNull();
    }

    @Test
    void getValidationError_fieldguideRequestMissingFilename_generatesOne() throws Exception {
        QueueRequest qr = fieldguideRequest(null, "Title", "a@b.com", null, new String[]{"id1"});

        getValidationError(qr);

        assertThat(qr.fieldguideQueueRequest.filename).startsWith("fieldguide-").endsWith(".pdf");
    }

    @Test
    void getValidationError_fieldguideRequestFilenameMissingExtension_appendsPdf() throws Exception {
        QueueRequest qr = fieldguideRequest("my-guide", "Title", "a@b.com", null, new String[]{"id1"});

        getValidationError(qr);

        assertThat(qr.fieldguideQueueRequest.filename).isEqualTo("my-guide.pdf");
    }

    @Test
    void getValidationError_neitherSearchNorFieldguide_returnsNull() throws Exception {
        QueueRequest qr = new QueueRequest();

        assertThat(getValidationError(qr)).isNull();
    }
}
