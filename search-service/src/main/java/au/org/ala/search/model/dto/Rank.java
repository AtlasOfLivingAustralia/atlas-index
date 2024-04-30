package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@NoArgsConstructor
@SuperBuilder
@AllArgsConstructor
@Getter
public class Rank {
    private String branch;
    private String notes;
    private List<String> otherNames;
    private String rank;
    private String rankGroup;
    private Integer rankID;
}
