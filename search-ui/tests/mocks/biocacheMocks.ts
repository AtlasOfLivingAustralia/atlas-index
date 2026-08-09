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

const g_occurrenceCountDefault = loadFixture('occurrence-count-default.json');
const g_imagesPage1 = loadFixture('occurrence-images-page1.json');
const g_imagesPage2 = loadFixture('occurrence-images-page2.json');
const g_datasetFacet = loadFixture('occurrence-dataset-facet.json');

const BIOCACHE_SEARCH_PATTERN = 'https://biocache-ws.ala.org.au/ws/occurrences/search**';

export interface BiocacheSearchConfig {
    /** guid -> record count for MapView's record-count fetch. Defaults to 4200 for every guid. */
    countByGuid?: Record<string, number>;
    /** guid -> ordered array of page-response fixtures for ImagesView (index 0 = start=0, index 1 = start=12, ...). Defaults to the standard 2-page fixture set for every guid. */
    imagePagesByGuid?: Record<string, any[]>;
    /** guid -> dataResourceUid facet response for DatasetsView. Defaults to the standard fixture for every guid. */
    datasetFacetByGuid?: Record<string, any>;
}

/** q is one of: lsid:<guid>  or  lsid:"<guid>" — already URL-decoded by URLSearchParams. */
function extractGuidFromQ(q: string): string {
    const match = q.match(/^lsid:"?([^"]*?)"?$/);
    return match ? match[1] : '';
}

/**
 * Mock https://biocache-ws.ala.org.au/ws/occurrences/search for all three
 * search-ui callers (MapView record count, ImagesView gallery grid,
 * DatasetsView dataResourceUid facet). Dispatches on query-param shape since
 * all three hit the same path.
 */
export async function mockBiocacheSearch(page: Page, seenUrls: Set<URL>, config: BiocacheSearchConfig = {}) {
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/search'));
    await page.context().route(BIOCACHE_SEARCH_PATTERN, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const params = url.searchParams;
        const q = params.get('q') || '';
        const guid = extractGuidFromQ(q);
        const facets = params.get('facets');
        const pageSize = params.get('pageSize');
        const start = params.get('start');

        // DatasetsView: facets=dataResourceUid (also has pageSize=0, so this check must come first)
        if (facets === 'dataResourceUid') {
            const response = config.datasetFacetByGuid?.[guid] ?? g_datasetFacet;
            return fulfillJson(route, response);
        }

        // MapView record count: pageSize=0, no dataResourceUid facet
        if (pageSize === '0') {
            const count = config.countByGuid?.[guid] ?? g_occurrenceCountDefault.totalRecords;
            return fulfillJson(route, { totalRecords: count });
        }

        // ImagesView: paginated gallery grid (pageSize=12, start=0,12,24,...)
        const pages = config.imagePagesByGuid?.[guid] ?? [g_imagesPage1, g_imagesPage2];
        const startIndex = start ? parseInt(start, 10) : 0;
        const pageIndex = Math.floor(startIndex / 12);
        const pageData = pages[pageIndex] ?? { totalRecords: pages[0]?.totalRecords ?? 0, occurrences: [] };
        return fulfillJson(route, pageData);
    });
}

/**
 * Mock WMS tile endpoints (occurrence hex-bin overlay + distribution overlays).
 * Only reachable when VITE_GOOGLE_MAP_API_KEY is set for a specific test (the
 * interactive Leaflet map's LayersControl is otherwise unmounted — see
 * PLAYWRIGHT_TEST.md Phase 3 note). Registered for completeness / future use.
 */
export async function mockWmsTiles(page: Page, seenUrls: Set<URL>) {
    const patterns = [
        'https://biocache-ws.ala.org.au/ws/ogc/wms/reflect**',
        'https://spatial.ala.org.au/geoserver/wms**',
        'https://spatial.ala.org.au/ws/distribution/map/png/**',
        'https://spatial.ala.org.au/osm/**',
    ];
    for (const pattern of patterns) {
        seenUrls.add(new URL(pattern.replace(/\*+$/, '')));
        await page.context().route(pattern, async (route) => {
            seenUrls.add(new URL(route.request().url()));
            try {
                const buffer = await generateTilePlaceholder();
                await route.fulfill({ status: 200, contentType: 'image/png', body: buffer });
            } catch (error) {
                await route.fulfill({ status: 500, contentType: 'text/plain', body: `Error generating tile: ${error}` });
            }
        });
    }
}
