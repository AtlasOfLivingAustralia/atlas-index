import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const file = './src/config/advancedSearch.json';
const allFacets = {};

// TODO: make configurable
// base url for biocache-service
const baseUrl = process.argv[2] || 'https://biocache-ws.test.ala.org.au/ws';

// TODO: make configurable
// facets.cached=species_group,species_subgroup,state,country,institution_uid,collection_uid,data_resource_uid,basis_of_record,type_status,collector_text,cl1048,cl21,cl959
const facets = ["speciesGroup", "state", "country", "institutionUid", "collectionUid", "dataResourceUid", "basisOfRecord", "typeStatus", "cl1048", "cl21", "cl959"];

for (let i = 0; i < facets.length; i++) {
    const facet = facets[i];
    const url = `${baseUrl}/occurrences/search?q=*:*&pageSize=0&facets=${facet}&flimit=-1`;
    console.log(`Fetching facet data for: ${facet} from ${url}`);
    const response = JSON.parse(
        execSync(`curl -s "${url}"`)
            .toString()
            .trim()
    );
    if (response && response.facetResults && response.facetResults.length > 0) {
        const facetResult = response.facetResults.find(fr => fr.fieldName === facet);
        if (facetResult) {
            const facetValues = facetResult.fieldResult.map(fr => ({
                name: fr.label,
                fq: fr.fq
            }));

            // add to map
            allFacets[facet] = facetValues;
        }
    }
}

// write to file
writeFileSync(file, JSON.stringify(allFacets, null, 2));
console.log(`Advanced search configuration written to ${file}`);
