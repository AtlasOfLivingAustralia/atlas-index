package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Getter
@AllArgsConstructor
public class SpeciesGuidsBulklookupResponse {
    List<TaxaBatchItem> searchDTOList;
}
