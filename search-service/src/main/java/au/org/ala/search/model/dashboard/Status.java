package au.org.ala.search.model.dashboard;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@NoArgsConstructor
@Getter
@Setter
public class Status {
    public List<CategoryStatus> categories = new ArrayList<>();
}
