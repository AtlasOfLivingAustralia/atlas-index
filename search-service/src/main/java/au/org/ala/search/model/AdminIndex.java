package au.org.ala.search.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Mapping;
import org.springframework.data.elasticsearch.annotations.Setting;

import java.util.Date;

@Document(indexName = "#{@environment.getProperty('elastic.adminIndex')}", createIndex = true)
@Setting(settingPath = "/elasticsearch/settings.json")
@Mapping(mappingPath = "/elasticsearch/mappings.admin.json")
@NoArgsConstructor
@Data
@SuperBuilder
public class AdminIndex {
    @Id
    public String id;
    public String task;
    public Date modified;
    public String message;
}
