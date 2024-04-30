package au.org.ala.search.model.cache;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@AllArgsConstructor
@NoArgsConstructor
public class DenormalCache {
    public DenormalTaxon[] cacheTaxon;
    public DenormalIdentifier[] cacheIdentifier;
    public DenormalVariant[] cacheVariant;
    public DenormalVernacular[] cacheVernacular;
}
