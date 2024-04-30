package au.org.ala.search.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.jetbrains.annotations.NotNull;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@AllArgsConstructor
@Getter
public class RankedName {
    public String name;
    public String rank;

    @Override
    public int hashCode() {
        return (rank + " " + name).hashCode();
    }

    @Override
    public boolean equals(Object obj) {
        if (obj instanceof RankedName rn) {
            return(rank + " " + name).equals(rn.rank + " " + rn.name);
        }
        return false;
    }
}
