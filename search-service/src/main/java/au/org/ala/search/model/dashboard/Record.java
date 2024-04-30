package au.org.ala.search.model.dashboard;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;
import java.util.List;
import java.util.Map;

@NoArgsConstructor
@Getter
@Setter
public class Record {
    public Date date = new Date();
    public Integer count;
    public String url;
    public String imageUrl;
    public List<Table> tables;
    public Map<String, String> mostRecent;
}
