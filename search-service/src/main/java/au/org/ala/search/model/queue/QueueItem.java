package au.org.ala.search.model.queue;

import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@Data
@SuperBuilder
@AllArgsConstructor
@Jacksonized
@org.springframework.data.mongodb.core.mapping.Document(collection = "userqueue")
public class QueueItem {
    @Id
    public String id;

    public String userId;

    @CreatedDate
    public LocalDateTime createdDate;

    public QueueRequest queueRequest;
    public Status status;
}
