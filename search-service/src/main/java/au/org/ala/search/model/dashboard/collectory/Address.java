package au.org.ala.search.model.dashboard.collectory;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter
@Setter
public class Address {
    public String street;           // includes number e.g. 186 Tinaroo Creek Road
    public String postBox;          // eg PO Box 2104
    public String city;
    public String state;            // full name e.g. Queensland
    public String postcode;
    public String country;
}
