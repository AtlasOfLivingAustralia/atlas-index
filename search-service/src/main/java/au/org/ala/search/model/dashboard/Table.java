package au.org.ala.search.model.dashboard;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@NoArgsConstructor
@Setter
@Getter
public class Table {
    public String name;
    public List<String> header;
    public List<TableRow> rows;

    public Table(String name) {
        this.name = name;
    }
}
