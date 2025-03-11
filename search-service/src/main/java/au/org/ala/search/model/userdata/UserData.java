package au.org.ala.search.model.userdata;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Document(collection = "userdata")
public class UserData {
    @Id
    private String uuid;
    private String userId;
    private String data;
    @Indexed(expireAfterSeconds = 0)
    private LocalDateTime expiryDate;

    public UserData(String userId, String data, LocalDateTime expiryDate) {
        this.uuid = UUID.randomUUID().toString();
        this.userId = userId;
        this.data = data;
        this.expiryDate = expiryDate;
    }
}
