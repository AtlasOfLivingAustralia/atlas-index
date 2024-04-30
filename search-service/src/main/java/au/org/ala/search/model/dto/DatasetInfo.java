package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@AllArgsConstructor
public class DatasetInfo {
    public String datasetName;
    public String rightsHolder;
}
