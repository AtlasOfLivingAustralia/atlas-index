package au.org.ala.search.model.dashboard;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashMap;
import java.util.Map;

@NoArgsConstructor
@Setter
@Getter
public class DashboardData {
    public Map<String, Record> data = new HashMap<>();
}




