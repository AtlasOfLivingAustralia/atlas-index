package au.org.ala.search.model.dashboard.logger;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@NoArgsConstructor
@Getter
@Setter
public class Result {
    public Long events;
    public Long records;
    public Map<String, Breakdown> reasonBreakdown;
    public Map<String, Breakdown> emailBreakdown;
}
