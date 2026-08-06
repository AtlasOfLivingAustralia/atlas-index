import { Page, Route } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(relativePath: string): any {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources', relativePath), 'utf-8'));
}

async function fulfillJson(route: Route, data: unknown) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
}

// ---------------------------------------------------------------------------
// Fixture data — loaded once at module init
// ---------------------------------------------------------------------------

export const SPECIES_BIRD_FULL = loadFixture('species/species-bird-full.json');
export const SPECIES_PLANT_MINIMAL = loadFixture('species/species-plant-minimal.json');
export const SPECIES_PLANT_TRAITS = loadFixture('species/species-plant-traits.json');
export const SPECIES_PLANT_NO_TRAITS = loadFixture('species/species-plant-no-traits.json');

const g_idxtypeFacet = loadFixture('search/idxtype-facet.json');
const g_speciesResults = loadFixture('search/species-results.json');
const g_datasetsResults = loadFixture('search/datasets-results.json');
const g_specieslistsResults = loadFixture('search/specieslists-results.json');
const g_dataprojectsResults = loadFixture('search/dataprojects-results.json');
const g_layersResults = loadFixture('search/layers-results.json');
const g_regionslocalitiesResults = loadFixture('search/regionslocalities-results.json');
const g_articlesResults = loadFixture('search/articles-results.json');
export const g_disambiguationResults = loadFixture('disambiguation-results.json');
const g_datasetLicenses = loadFixture('dataset-licenses.json');
const g_autocomplete = loadFixture('autocomplete-acacia.json');

/** A single-item "drilled down" response for the species tab's "rank:genus" facet click (Acacia genus only). */
const g_speciesGenusDrilldown = {
    totalRecords: 1,
    searchResults: g_speciesResults.searchResults.filter((item: any) => item.rank === 'genus'),
    facetResults: [
        { fieldName: 'speciesGroup', fieldResult: [{ label: 'Plants', count: 1 }] },
        { fieldName: 'taxonomicStatus', fieldResult: [{ label: 'accepted', count: 1 }] },
        { fieldName: 'rank', fieldResult: [{ label: 'genus', count: 2 }] },
    ],
};

// ---------------------------------------------------------------------------
// Session fixtures
// ---------------------------------------------------------------------------

/** Anonymous / not logged in — search-ui has no login-gated views, this is the default. */
export const SESSION_ANONYMOUS = {
    authenticated: false,
};

/**
 * Mock the /session endpoint so common-ui's checkLoginState() resolves cleanly
 * without a network connection.
 *
 * Must be registered AFTER logMissingMocks so that Playwright's
 * reverse-registration priority gives this mock higher priority than the
 * catch-all throw route.
 */
export async function mockSession(page: Page, seenUrls: Set<URL>, session: object = SESSION_ANONYMOUS) {
    const url = 'http://localhost:8081/session';
    seenUrls.add(new URL(url));
    await page.context().route(url, (route) => fulfillJson(route, session));
}

// ---------------------------------------------------------------------------
// POST /v2/species — species detail lookup
// ---------------------------------------------------------------------------

const g_speciesByPath: Record<string, any> = {
    [SPECIES_BIRD_FULL.guid]: SPECIES_BIRD_FULL,
    [SPECIES_PLANT_MINIMAL.guid]: SPECIES_PLANT_MINIMAL,
    [SPECIES_PLANT_TRAITS.guid]: SPECIES_PLANT_TRAITS,
    [SPECIES_PLANT_NO_TRAITS.guid]: SPECIES_PLANT_NO_TRAITS,
};

/**
 * Mock the species-detail POST endpoint. `extraByPath` lets a test register
 * additional guid/path -> species-object mappings (or override the defaults)
 * without needing a dedicated fixture file for one-off scenarios.
 */
export async function mockSpeciesDetail(page: Page, seenUrls: Set<URL>, extraByPath: Record<string, any> = {}) {
    const byPath = { ...g_speciesByPath, ...extraByPath };
    const url = 'http://localhost:8081/v2/species';
    seenUrls.add(new URL(url));
    await page.context().route(url, async (route) => {
        let requestPaths: string[] = [];
        try {
            requestPaths = JSON.parse(route.request().postData() || '[]');
        } catch {
            requestPaths = [];
        }
        const requestedPath = requestPaths[0];
        const match = requestedPath ? byPath[requestedPath] : undefined;
        await fulfillJson(route, [match ?? null]);
    });
}

// ---------------------------------------------------------------------------
// GET /v1/bie/search/auto — autocomplete
// ---------------------------------------------------------------------------

export async function mockAutocomplete(page: Page, seenUrls: Set<URL>, response: any = g_autocomplete) {
    const pattern = 'http://localhost:8081/v1/bie/search/auto**';
    seenUrls.add(new URL('http://localhost:8081/v1/bie/search/auto'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await fulfillJson(route, response);
    });
}

// ---------------------------------------------------------------------------
// GET /v2/search — the single most-used endpoint in search-ui. Used by:
//  - AllView (idxtype facet count, then pageSize=4 per-group results)
//  - GenericView (pageSize=12 per-tab results + facets, for each of the 7 categories)
//  - ClassificationView (children by parentGuid)
//  - DisambiguationView (exact_text query)
//  - DatasetsView (license lookup by dataResourceUid list)
//  - speciesDefn / datasetsDefn / dataprojectsDefn addCustomFacetsFn (small {totalRecords} responses)
// ---------------------------------------------------------------------------

export interface SpeciesSearchConfig {
    /** parentGuid (as used in ClassificationView's fq) -> array of {rank, nameFormatted, guid} children */
    childrenByParentGuid?: Record<string, any[]>;
    /** guid of the taxon being disambiguated -> full search-response object ({searchResults: [...]}) */
    disambiguationByGuid?: Record<string, any>;
    /** override for the dataset-license lookup response */
    datasetLicensesResponse?: any;
    /** override the small custom-facet-count responses (speciesDefn/datasetsDefn/dataprojectsDefn) */
    customFacetCounts?: {
        image?: number;
        iconicList?: number;
        iekName?: number;
        datasetsNoRecords?: number;
        projectsWithRecords?: number;
    };
    /** override the "rank:genus" facet drill-down response on the species tab */
    speciesGenusDrilldown?: any;
}

export async function mockSpeciesSearch(page: Page, seenUrls: Set<URL>, config: SpeciesSearchConfig = {}) {
    const pattern = 'http://localhost:8081/v2/search**';
    seenUrls.add(new URL('http://localhost:8081/v2/search'));
    await page.context().route(pattern, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const params = url.searchParams;
        const q = params.get('q') || '';
        const facets = params.get('facets') || '';
        const pageSize = params.get('pageSize');
        const fqs = params.getAll('fq');
        const fl = params.get('fl') || '';

        // 1. AllView's initial idxtype-count fetch: no fq at all, facets=idxtype, pageSize=0
        if (facets === 'idxtype' && pageSize === '0' && fqs.length === 0) {
            return fulfillJson(route, g_idxtypeFacet);
        }

        // 2. ClassificationView children (fq=parentGuid:"<guid>")
        const parentGuidFq = fqs.find((f) => f.startsWith('parentGuid:'));
        if (parentGuidFq) {
            const guid = parentGuidFq.replace(/^parentGuid:"/, '').replace(/"$/, '');
            const children = config.childrenByParentGuid?.[guid] ?? [];
            return fulfillJson(route, { searchResults: children });
        }

        // 3. DisambiguationView (q starts with exact_text:)
        if (q.startsWith('exact_text:')) {
            const guidFq = fqs.find((f) => f.startsWith('-guid:'));
            const guid = guidFq ? guidFq.replace(/^-guid:"/, '').replace(/"$/, '') : '';
            const response = config.disambiguationByGuid?.[guid];
            return fulfillJson(route, response ?? { searchResults: [] });
        }

        // 4. DatasetsView license lookup (q=idxtype:DATARESOURCE, fl includes license)
        if (q === 'idxtype:DATARESOURCE' && fl.includes('license')) {
            return fulfillJson(route, config.datasetLicensesResponse ?? g_datasetLicenses);
        }

        // 5. speciesDefn custom facets: image:*, speciesList:<iconic>, hasIekName:*
        if (fqs.includes('image:*')) {
            return fulfillJson(route, { totalRecords: config.customFacetCounts?.image ?? 5 });
        }
        if (fqs.some((f) => f.startsWith('speciesList:'))) {
            return fulfillJson(route, { totalRecords: config.customFacetCounts?.iconicList ?? 2 });
        }
        if (fqs.includes('hasIekName:*')) {
            return fulfillJson(route, { totalRecords: config.customFacetCounts?.iekName ?? 3 });
        }

        // 6. datasetsDefn custom facet: "Contains records" (occurrenceCount:0)
        if (fqs.includes('occurrenceCount:0')) {
            return fulfillJson(route, { totalRecords: config.customFacetCounts?.datasetsNoRecords ?? 1 });
        }

        // 7. dataprojectsDefn custom facet: "Contains records" (numberOfRecords)
        if (fqs.some((f) => f.includes('numberOfRecords'))) {
            return fulfillJson(route, { totalRecords: config.customFacetCounts?.projectsWithRecords ?? 1 });
        }

        // 8. Species tab facet drill-down (e.g. "rank:genus" selected in refine section)
        if (fqs.includes('rank:"genus"') && fqs.some((f) => f.includes('idxtype:TAXON'))) {
            return fulfillJson(route, config.speciesGenusDrilldown ?? g_speciesGenusDrilldown);
        }

        // 9. Category dispatch — AllView (pageSize=4) and GenericView (pageSize=12) both send
        // one of the 7 category fq strings (verbatim from searchGroupsTemplate / *Defn.fq).
        const categoryFq = fqs.find((f) => f.includes('idxtype:'));
        let responseData: any = { totalRecords: 0, searchResults: [] };
        if (categoryFq?.includes('idxtype:TAXON')) responseData = g_speciesResults;
        else if (categoryFq?.includes('idxtype:DATARESOURCE')) responseData = g_datasetsResults;
        else if (categoryFq?.includes('idxtype:SPECIESLIST')) responseData = g_specieslistsResults;
        else if (categoryFq?.includes('idxtype:BIOCOLLECT')) responseData = g_dataprojectsResults;
        else if (categoryFq?.includes('idxtype:LAYER')) responseData = g_layersResults;
        else if (categoryFq?.includes('idxtype:REGION') || categoryFq?.includes('idxtype:LOCALITY')) responseData = g_regionslocalitiesResults;
        else if (categoryFq?.includes('idxtype:WORDPRESS') || categoryFq?.includes('idxtype:KNOWLEDGEBASE')) responseData = g_articlesResults;

        // AllView requests pageSize=4 (its "top results per group" preview) — trim accordingly.
        if (pageSize === '4' && responseData.searchResults) {
            responseData = { ...responseData, searchResults: responseData.searchResults.slice(0, 4) };
        }

        return fulfillJson(route, responseData);
    });
}
