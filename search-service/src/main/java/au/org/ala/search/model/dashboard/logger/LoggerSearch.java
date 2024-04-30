package au.org.ala.search.model.dashboard.logger;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@NoArgsConstructor
@Getter
@Setter
public class LoggerSearch {
    public Result all;
    public Map<String, Breakdown> totals;
}
