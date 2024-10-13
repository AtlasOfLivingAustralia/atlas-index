package au.org.ala.search.model.cache;

import au.org.ala.search.model.dto.DatasetInfo;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.Map;

@AllArgsConstructor
@NoArgsConstructor
public class DenormalCache {
    public DenormalTaxon[] cacheTaxon;
    public DenormalIdentifier[] cacheIdentifier;
    public DenormalVariant[] cacheVariant;
    public DenormalVernacular[] cacheVernacular;
    public Map<String, DatasetInfo> attributionMap;
}
