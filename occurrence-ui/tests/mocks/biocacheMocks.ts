import { Page, Route } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateTilePlaceholder } from './imageMocks';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(relativePath: string): any {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources', relativePath), 'utf-8'));
}

async function fulfillJson(route: Route, data: unknown) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
}

const g_acacia = loadFixture('occurrences-search-acacia.json');

// biocache-ws.ala.org.au is the REAL hostname (see .env.playwright's comment on why
// VITE_APP_BIOCACHE_URL is not redirected to localhost). Both the env-var-driven call
// sites AND OccurrenceSearch.tsx's two hardcoded spatial-search-popup calls hit this host.
const BIOCACHE_SEARCH_PATTERN = 'https://biocache-ws.ala.org.au/ws/occurrences/search**';
const BIOCACHE_FACETS_PATTERN = 'https://biocache-ws.ala.org.au/ws/occurrences/facets**';
const BIOCACHE_QID_PATTERN = 'https://biocache-ws.ala.org.au/ws/qid**';

export interface FacetFieldResult {
    label: string;
    count: number;
    fq: string;
    i18nCode: string;
}

/**
 * Default facet value lists for AdvancedSearch.tsx / advancedSearchAvh.tsx's
 * on-focus dropdown population (GET /occurrences/search?q=*:*&facets=<field>&flimit=-1)
 * and for FacetWell.tsx's sidebar facet groups. Keyed by biocache field name.
 * `fetchFacet()` in AdvancedSearch.tsx maps { name: fr.label, fq: fr.fq } from these.
 */
export const g_defaultFacetResponses: Record<string, FacetFieldResult[]> = {
    speciesGroup: [
        { label: 'Birds', count: 120000, fq: 'speciesGroup:Birds', i18nCode: 'facet.speciesGroup.Birds' },
        { label: 'Mammals', count: 45000, fq: 'speciesGroup:Mammals', i18nCode: 'facet.speciesGroup.Mammals' },
        { label: 'Plants', count: 300000, fq: 'speciesGroup:Plants', i18nCode: 'facet.speciesGroup.Plants' },
    ],
    institutionUid: [
        { label: 'CSIRO', count: 50000, fq: 'institutionUid:in1', i18nCode: 'facet.institutionUid.in1' },
        { label: 'Museums Victoria', count: 30000, fq: 'institutionUid:in2', i18nCode: 'facet.institutionUid.in2' },
    ],
    collectionUid: [
        { label: 'CSIRO Australian National Insect Collection', count: 20000, fq: 'collectionUid:co1', i18nCode: 'facet.collectionUid.co1' },
        { label: 'Museums Victoria Herpetology', count: 15000, fq: 'collectionUid:co2', i18nCode: 'facet.collectionUid.co2' },
    ],
    country: [
        { label: 'Australia', count: 700000, fq: 'country:Australia', i18nCode: 'facet.country.Australia' },
        { label: 'New Zealand', count: 5000, fq: 'country:"New Zealand"', i18nCode: 'facet.country.NewZealand' },
        { label: 'Fiji', count: 200, fq: 'country:Fiji', i18nCode: 'facet.country.Fiji' },
        { label: 'Papua New Guinea', count: 150, fq: 'country:"Papua New Guinea"', i18nCode: 'facet.country.PNG' },
        { label: 'Indonesia', count: 90, fq: 'country:Indonesia', i18nCode: 'facet.country.Indonesia' },
    ],
    state: [
        { label: 'New South Wales', count: 200000, fq: 'state:"New South Wales"', i18nCode: 'facet.state.NSW' },
        { label: 'Victoria', count: 150000, fq: 'state:Victoria', i18nCode: 'facet.state.VIC' },
        { label: 'Queensland', count: 120000, fq: 'state:Queensland', i18nCode: 'facet.state.QLD' },
        { label: 'South Australia', count: 80000, fq: 'state:"South Australia"', i18nCode: 'facet.state.SA' },
        { label: 'Western Australia', count: 60000, fq: 'state:"Western Australia"', i18nCode: 'facet.state.WA' },
    ],
    cl1048: [
        { label: 'Australian Alps', count: 3000, fq: 'cl1048:"Australian Alps"', i18nCode: 'facet.cl1048.AustralianAlps' },
    ],
    cl21: [
        { label: 'South-east Shelf Transition', count: 2000, fq: 'cl21:"South-east Shelf Transition"', i18nCode: 'facet.cl21.SEShelf' },
    ],
    cl959: [
        { label: 'Canberra', count: 4000, fq: 'cl959:Canberra', i18nCode: 'facet.cl959.Canberra' },
    ],
    typeStatus: [
        { label: 'Holotype', count: 500, fq: 'typeStatus:HOLOTYPE', i18nCode: 'facet.typeStatus.HOLOTYPE' },
        { label: 'Paratype', count: 800, fq: 'typeStatus:PARATYPE', i18nCode: 'facet.typeStatus.PARATYPE' },
    ],
    basisOfRecord: [
        { label: 'Preserved specimen', count: 400000, fq: 'basisOfRecord:PreservedSpecimen', i18nCode: 'facet.basisOfRecord.PreservedSpecimen' },
        { label: 'Human observation', count: 350000, fq: 'basisOfRecord:HumanObservation', i18nCode: 'facet.basisOfRecord.HumanObservation' },
    ],
    dataResourceUid: [
        { label: 'eBird Australia', count: 250000, fq: 'dataResourceUid:dr123', i18nCode: 'facet.dataResourceUid.dr123' },
        { label: 'ALA specimen records', count: 100000, fq: 'dataResourceUid:dr456', i18nCode: 'facet.dataResourceUid.dr456' },
        { label: 'iNaturalist Australia', count: 80000, fq: 'dataResourceUid:dr789', i18nCode: 'facet.dataResourceUid.dr789' },
        { label: 'Museums Victoria', count: 40000, fq: 'dataResourceUid:dr101', i18nCode: 'facet.dataResourceUid.dr101' },
        { label: 'Royal Botanic Gardens Victoria', count: 20000, fq: 'dataResourceUid:dr102', i18nCode: 'facet.dataResourceUid.dr102' },
    ],
};


export interface BiocacheSearchConfig {
    /** Main paginated list response (used when the request has a numeric, non-zero pageSize). */
    occurrences?: any[];
    /** totalRecords for the main (filtered, e.g. qualityProfile=ALA applied) search. */
    totalRecords?: number;
    /**
     * totalRecords for the UNFILTERED count. Dispatched when the request has
     * disableAllQualityFilters=true and (uniquely) omits `pageSize` entirely --
     * see ResultsReturned.tsx, which appends disableAllQualityFilters=true to the
     * whitelisted queryString (never including pageSize/sort/dir/start).
     */
    unfilteredTotalRecords?: number;
    /**
     * facets=<field> responses, keyed by field name, for FacetWell.tsx's per-group
     * facet-count fetches (pageSize=0&facet=true&facets=<field>&flimit=N&fsort=count).
     * Defaults to an empty list for any field not present in this map.
     */
    facetResponses?: Record<string, FacetFieldResult[]>;
    /**
     * Data Quality profile simulation: for every `disableQualityFilter=<label>` param
     * present on the (paginated-list or pageSize=0 count-only) request, add this many
     * extra records on top of `totalRecords` -- simulating a DQ category's exclusions
     * being lifted. Designed so the per-category values sum to exactly
     * `unfilteredTotalRecords - totalRecords`, so disabling every category in a profile
     * produces the same count as `disableAllQualityFilters=true` (see
     * dq-all-disabled-matches-total in PLAYWRIGHT_TEST.md). Unrecognised labels are
     * ignored (contribute 0), and the result is capped at unfilteredTotalRecords.
     */
    qualityFilterExtraRecords?: Record<string, number>;
    /**
     * Injected into the main paginated-list response only (see synthetic tests for
     * lsidDropdown.tsx / alertModal.tsx). Neither the default acacia fixture nor this
     * interface previously modelled `queryTitle` at all -- it's the raw HTML fragment
     * resultsReturned.tsx/AlertModal read as `results.queryTitle`; a value containing
     * a `<span class="lsid" id="...">` fragment is required to mount LsidDropdown at
     * all, and AlertModal throws a TypeError if it's left undefined and a "Get email
     * alerts" button is clicked (see recordMocks.ts-style header comments elsewhere).
     */
    queryTitle?: string;
}

/**
 * Mock https://biocache-ws.ala.org.au/ws/occurrences/search for every caller in the
 * app (OccurrenceList's main list, ResultsReturned's unfiltered total, FacetWell's
 * per-facet counts, dqCache's excluded counts, mapView/Download/OccurrenceSearch's
 * bare pageSize=0 counts) by dispatching on query-param shape, since they all hit
 * the same path. See BiocacheSearchConfig field comments for the exact dispatch rule
 * each branch implements.
 */
export async function mockBiocacheSearch(page: Page, seenUrls: Set<URL>, config: BiocacheSearchConfig = {}) {
    const totalRecords = config.totalRecords ?? g_acacia.totalRecords;
    const unfilteredTotalRecords = config.unfilteredTotalRecords ?? g_acacia.unfilteredTotalRecords;
    const occurrences = config.occurrences ?? g_acacia.occurrences;
    const facetResponses = config.facetResponses ?? g_defaultFacetResponses;
    const qualityFilterExtraRecords = config.qualityFilterExtraRecords ?? {};
    const queryTitle = config.queryTitle;

    // Sums qualityFilterExtraRecords for every disableQualityFilter=<label> param present
    // (or the full unfiltered total if disableAllQualityFilters=true is present instead),
    // added on top of the base (fully-filtered) totalRecords and capped at
    // unfilteredTotalRecords -- see BiocacheSearchConfig.qualityFilterExtraRecords.
    function dqAdjustedTotal(params: URLSearchParams): number {
        if (params.get('disableAllQualityFilters') === 'true') {
            return unfilteredTotalRecords;
        }
        let extra = 0;
        for (const label of params.getAll('disableQualityFilter')) {
            extra += qualityFilterExtraRecords[label] ?? 0;
        }
        return Math.min(totalRecords + extra, unfilteredTotalRecords);
    }

    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/search'));
    await page.context().route(BIOCACHE_SEARCH_PATTERN, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const params = url.searchParams;
        const facets = params.get('facets');

        // FacetWell.tsx per-group facet-count request (pageSize=0&facet=true&facets=<field>&...)
        // AND AdvancedSearch.tsx/advancedSearchAvh.tsx's on-focus dropdown population
        // (q=*:*&pageSize=0&facets=<field>&flimit=-1). AdvancedSearch's fetchFacet()
        // requires `fieldName` on the result entry to match the requested facet --
        // FacetWell doesn't check it (always reads facetResults[0]), but it must be
        // present for AdvancedSearch's dropdowns to populate.
        if (facets) {
            const list = facetResponses[facets] ?? [];
            return fulfillJson(route, {
                totalRecords,
                facetResults: [{ fieldName: facets, fieldResult: list }],
            });
        }

        // ResultsReturned.tsx's unfiltered total: no pageSize param at all (queryString
        // is whitelisted to q/fq/qualityProfile/disableQualityFilter/disableAllQualityFilters/
        // wkt/radius/lat/lon before disableAllQualityFilters=true is appended).
        if (!params.has('pageSize')) {
            return fulfillJson(route, { totalRecords: unfilteredTotalRecords });
        }

        // Bare count-only requests (mapView map-click popup, dqCache excluded counts,
        // Download.tsx's record-count check): pageSize=0, no facets param.
        if (params.get('pageSize') === '0') {
            return fulfillJson(route, { totalRecords: dqAdjustedTotal(params) });
        }

        // OccurrenceList.tsx's main paginated list: pageSize=<N>&sort=...&dir=...&start=...
        return fulfillJson(route, {
            occurrences,
            totalRecords: dqAdjustedTotal(params),
            ...(queryTitle !== undefined ? { queryTitle } : {}),
        });
    });
}

/**
 * Mock the qid endpoint used by Batch taxon / Catalogue number / Event search
 * (POST https://biocache-ws.ala.org.au/ws/qid?q=<query>), which returns a plain-text
 * qid that the app appends to `/occurrences/search?q=qid:<qid>`.
 */
export async function mockQid(page: Page, seenUrls: Set<URL>, qid: string = 'mock-qid-001') {
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/qid'));
    await page.context().route(BIOCACHE_QID_PATTERN, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'text/plain', body: qid });
    });
}

export interface OccurrenceFacetsEntry {
    count: number;
    fieldResult: FacetFieldResult[];
}

/**
 * Mock the STANDALONE /occurrences/facets endpoint -- distinct from
 * /occurrences/search?facets=..., and with a different (flat array) response
 * shape: `[{ fieldName, count, fieldResult }]`. Used by:
 *  - OccurrenceSearch.tsx's spatial-search map-click popup (hardcoded hostname, facets=scientificName)
 *  - mapView.tsx's results-Map-tab map-click popup (facets=scientificName)
 *  - multipleFacets.tsx's "choose more..." modal (facets=<any sidebar facet>) + its CSV download link
 *  - DownloadStatus.tsx's checklist download (facets=species_guid, via /occurrences/facets/download)
 * `data[0].count` is the field's cardinality (distinct value count), NOT a specific
 * value's count -- OccurrenceSearch.tsx reads it directly as "taxonCount".
 */
export async function mockOccurrenceFacets(page: Page, seenUrls: Set<URL>, config: Record<string, OccurrenceFacetsEntry> = {}) {
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/facets'));
    await page.context().route(BIOCACHE_FACETS_PATTERN, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const facets = url.searchParams.get('facets') || 'scientificName';
        const entry = config[facets] ?? {
            count: (g_defaultFacetResponses[facets] ?? []).length,
            fieldResult: g_defaultFacetResponses[facets] ?? [],
        };
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{ fieldName: facets, count: entry.count, fieldResult: entry.fieldResult }]),
        });
    });
}

/**
 * Mock the /occurrences/facets/download endpoint (multipleFacets.tsx's CSV download
 * link, DownloadStatus.tsx's checklist download). Defaults to a CSV built from
 * g_defaultFacetResponses so the "choose more..." modal's download-icon test can
 * assert the file matches what the modal's table displayed.
 */
export async function mockFacetsDownload(page: Page, seenUrls: Set<URL>, csvByFacet: Record<string, string> = {}) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/occurrences/facets/download**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/facets/download'));
    await page.context().route(pattern, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const facets = url.searchParams.get('facets') || 'scientificName';
        const rows = g_defaultFacetResponses[facets] ?? [];
        const csv = csvByFacet[facets] ?? ['name,count', ...rows.map(r => `${r.label},${r.count}`)].join('\n');
        // Content-Disposition: attachment is required for WebKit to treat this as a
        // download rather than navigating its target="_blank" link to view the CSV
        // inline -- without it, Chromium/Firefox still download (by content-type
        // heuristic) but WebKit does not, making cross-browser download tests flaky.
        await route.fulfill({
            status: 200,
            contentType: 'text/csv',
            headers: { 'content-disposition': `attachment; filename="${facets}.csv"` },
            body: csv,
        });
    });
}

export interface ChartDataPoint {
    fq: string;
    count: number;
    i18nCode: string;
    label: string;
}

const g_defaultChartPoints: ChartDataPoint[] = [
    { fq: 'license:CC-BY', count: 100000, i18nCode: 'facet.license.CC-BY', label: 'CC-BY' },
    { fq: 'license:CC0', count: 50000, i18nCode: 'facet.license.CC0', label: 'CC0' },
    { fq: 'license:*', count: 20000, i18nCode: 'facet.license.unknown', label: 'Unknown' }, // excluded client-side (fq ends with '*')
];

/**
 * Mock GET /chart -- used by charts.tsx's Charts tab, which fires 7 SEQUENTIAL
 * requests (one per src/config/charts.json entry: license, month, genus, decade,
 * family, assertions, typeStatus), each only starting once the previous one's
 * response has been processed. Defaults to the same generic point set for every
 * facet (`x=<field>` query param) unless overridden per-field.
 */
export async function mockChart(page: Page, seenUrls: Set<URL>, config: Record<string, ChartDataPoint[]> = {}) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/chart**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/chart'));
    await page.context().route(pattern, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const facet = url.searchParams.get('x') || '';
        const points = config[facet] ?? g_defaultChartPoints;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ data: points }] }) });
    });
}

/**
 * Mock the /occurrences/search endpoint used by recordImages.tsx's Record images tab.
 * Shares the same path (and route pattern) as mockBiocacheSearch's generic dispatcher --
 * matched here by its distinctive `fq=multimedia:Image` query param, falling back to
 * whatever route was registered before this one (mockBiocacheSearch, if present) for
 * any other request shape on the same path.
 */
export async function mockRecordImagesSearch(page: Page, seenUrls: Set<URL>, occurrences: any[] = []) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/occurrences/search**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/search'));
    await page.context().route(pattern, async (route) => {
        const url = new URL(route.request().url());
        if (!url.searchParams.getAll('fq').includes('multimedia:Image')) {
            return route.fallback();
        }
        seenUrls.add(url);
        const start = parseInt(url.searchParams.get('start') || '0', 10);
        // Simple pagination: only the first page (start=0) returns data by default,
        // so tests don't need to model infinite-scroll unless they pass more occurrences.
        const page_ = start === 0 ? occurrences : [];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ occurrences: page_, totalRecords: occurrences.length }) });
    });
}

// ---------------------------------------------------------------------------
// Download wizard mocks (Download.tsx / CustomDownload.tsx / DownloadStatus.tsx)
// ---------------------------------------------------------------------------

/** Representative /index/fields entries spanning several DwC classes + el/cl/misc fields. */
export const g_indexFields = [
    { name: 'occurrenceID', classs: 'Record', dwcTerm: 'occurrenceID', indexed: true, stored: true },
    { name: 'catalogNumber', classs: 'Occurrence', dwcTerm: 'catalogNumber', indexed: true, stored: true },
    { name: 'raw_catalogNumber', classs: 'Occurrence', dwcTerm: null, indexed: true, stored: true },
    { name: 'eventDate', classs: 'Event', dwcTerm: 'eventDate', indexed: true, stored: true },
    { name: 'eventID', classs: 'Event', dwcTerm: 'eventID', indexed: true, stored: true },
    { name: 'decimalLatitude', classs: 'Location', dwcTerm: 'decimalLatitude', indexed: true, stored: true },
    { name: 'decimalLongitude', classs: 'Location', dwcTerm: 'decimalLongitude', indexed: true, stored: true },
    { name: 'scientificName', classs: 'Taxon', dwcTerm: 'scientificName', indexed: true, stored: true },
    { name: 'raw_scientificName', classs: 'Taxon', dwcTerm: null, indexed: true, stored: true },
    { name: 'el882', classs: null, dwcTerm: null, indexed: true, stored: false },
    { name: 'cl1048', classs: null, dwcTerm: null, indexed: true, stored: false },
    { name: 'assertions', classs: null, dwcTerm: null, indexed: true, stored: true },
    { name: 'species_guid', classs: null, dwcTerm: null, indexed: true, stored: true },
];

/** Mock GET /index/fields -- used by CustomDownload.tsx, DownloadStatus.tsx (dwc/custom formats), Fields.tsx. */
export async function mockIndexFields(page: Page, seenUrls: Set<URL>, fields: any[] = g_indexFields) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/index/fields**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/index/fields'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fields) });
    });
}

/**
 * Mock GET /occurrences/offline/download (records download start) -- returns a
 * statusUrl that should then be registered via mockDownloadStatusPolling.
 */
export async function mockOfflineDownload(page: Page, seenUrls: Set<URL>, statusUrl: string) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/occurrences/offline/download**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/offline/download'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusUrl }) });
    });
}

/**
 * Stateful mock for a download statusUrl: returns each entry in `transitions` in
 * order on successive GETs (repeating the last entry once exhausted), simulating
 * DownloadStatus.tsx's checkStatus() polling loop (QUEUED -> RUNNING -> finished).
 */
export async function mockDownloadStatusPolling(page: Page, seenUrls: Set<URL>, statusUrl: string, transitions: any[]) {
    let callCount = 0;
    seenUrls.add(new URL(statusUrl));
    await page.context().route(statusUrl, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        const response = transitions[Math.min(callCount, transitions.length - 1)];
        callCount++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
}

// ---------------------------------------------------------------------------
// Map-image download mock (downloadMapModal.tsx -- synthetic tests only)
// ---------------------------------------------------------------------------

/**
 * Mock GET /webportal/wms/image (downloadMapModal.tsx's "Download map" button,
 * fired via an imperative `window.open(url, '_blank')` rather than a real
 * `<a target="_blank">`). Not used by any acceptance.spec.ts test. Returns a small
 * generated PNG with `Content-Disposition: attachment` (same convention as
 * mockFacetsDownload) so a real 'download' event fires on Chromium/Firefox; WebKit
 * fires NEITHER a 'download' event NOR a real navigation for this window.open()
 * case (confirmed via direct instrumentation: the opened window's own url() stays
 * permanently empty) -- an even stricter version of the routed-<a>-click gotcha
 * elsewhere, with no popup-based fallback at all. Synthetic tests here
 * `test.skip(browserName === 'webkit', ...)` entirely rather than partially.
 */
export async function mockWmsImageDownload(page: Page, seenUrls: Set<URL>) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/webportal/wms/image**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/webportal/wms/image'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        const buffer = await generateTilePlaceholder(600, 400);
        const url = new URL(route.request().url());
        const fileName = url.searchParams.get('fileName') || 'map.jpg';
        await route.fulfill({
            status: 200,
            contentType: 'image/jpeg',
            headers: { 'content-disposition': `attachment; filename="${fileName}"` },
            body: buffer,
        });
    });
}

// ---------------------------------------------------------------------------
// mapView.tsx synthetic-coverage mocks (Colour-by legend, grid density legend,
// map-click record lookup) -- none of these are used by any acceptance.spec.ts
// test.
// ---------------------------------------------------------------------------

export interface MapLegendEntry {
    name: string;
    red: number;
    green: number;
    blue: number;
}

const g_defaultMapLegend: MapLegendEntry[] = [
    { name: 'New South Wales', red: 196, green: 77, blue: 52 },
    { name: 'Victoria', red: 52, green: 122, blue: 196 },
];

/**
 * Mock GET /mapping/legend (mapView.tsx's handleColourChange(), fired when the
 * Colour-by select is changed to a real facet field, e.g. "state"). Response is
 * a BARE JSON array (not wrapped in {data:...}) -- mapView.tsx iterates `data`
 * directly, and mapLegendControls.tsx reads facet.name/.red/.green/.blue.
 */
export async function mockMapLegend(page: Page, seenUrls: Set<URL>, legend: MapLegendEntry[] = g_defaultMapLegend) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/mapping/legend**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/mapping/legend'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await fulfillJson(route, legend);
    });
}

/**
 * Mock GET /density/legend (mapView.tsx's getLegendImgUrl(), only requested
 * when colourBy==='grid' -- rendered as a plain <img src=...> by
 * mapLegendControls.tsx's LegendImage). Returns a small generated PNG so the
 * <img>'s onLoad actually fires (LegendImage shows a spinner until it does).
 */
export async function mockDensityLegend(page: Page, seenUrls: Set<URL>) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/density/legend**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/density/legend'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        const buffer = await generateTilePlaceholder(200, 100);
        await route.fulfill({ status: 200, contentType: 'image/png', body: buffer });
    });
}

/**
 * Mock GET /occurrences/info (mapView.tsx's mapClick(), fired on a plain map
 * click that doesn't hit a drawn/loaded shape). `occurrences` is the list of
 * uuids mapView stores as mapLookupOccurrences; fetchOccurrence() then fetches
 * each one individually via the SAME singular /occurrence/:id endpoint
 * recordMocks.ts's mockRelatedOccurrence already covers, so register both
 * together when testing the map-click popup.
 */
export async function mockOccurrencesInfo(page: Page, seenUrls: Set<URL>, occurrences: string[]) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/occurrences/info**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/info'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await fulfillJson(route, { occurrences, count: occurrences.length });
    });
}
