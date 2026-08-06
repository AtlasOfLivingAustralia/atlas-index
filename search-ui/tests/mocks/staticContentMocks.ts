import { Page, Route } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateTilePlaceholder } from './imageMocks';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** The standard cached-map metadata fixture (2 zooms, 1 distribution layer) used by most Species page map tests. */
export const TAXON_MAP_METADATA_FIXTURE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources/taxon-map-metadata.json'), 'utf-8'));

/** Multi-section Wikipedia-style description content (Summary/Taxonomy/Ecology/References). */
export const DESCRIPTIONS_MULTI_SECTION_FIXTURE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources/descriptions-multi-section.json'), 'utf-8'));

/** BHL literature results (6 entries; only the first 5 should ever render). */
export const BHL_RESULTS_FIXTURE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources/bhl-results.json'), 'utf-8'));

/** AusTraits count/summary/csv fixtures for the plant-with-traits species. */
export const TRAITS_ENTRY_FIXTURE = {
    count: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources/traits-count.json'), 'utf-8')),
    summary: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources/traits-summary.json'), 'utf-8')),
    csv: fs.readFileSync(path.resolve(__dirname, '../resources/traits-data.csv'), 'utf-8'),
};

async function fulfillJson(route: Route, data: unknown) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
}

/**
 * The taxon-descriptions/taxon-traits/taxon-bhl/taxon-map tools all name files
 * after a *doubly* URL-encoded guid (encoded once for the file name, once more
 * for the CDN/http-server that decodes the URL path back to the file name).
 * Extract the original guid by stripping the known suffix and decoding twice.
 */
function extractGuidFromDoubleEncodedSegment(pathname: string, suffixToStrip: string): string {
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    const withoutSuffix = filename.endsWith(suffixToStrip) ? filename.slice(0, -suffixToStrip.length) : filename;
    try {
        return decodeURIComponent(decodeURIComponent(withoutSuffix));
    } catch {
        return '';
    }
}

// ---------------------------------------------------------------------------
// Descriptions — Species.tsx's fetchDescriptions() (only called when heroDescription is set)
// ---------------------------------------------------------------------------

export async function mockDescriptions(page: Page, seenUrls: Set<URL>, descriptionsByGuid: Record<string, any> = {}) {
    const pattern = 'https://static.test.ala.org.au/taxon-descriptions/**';
    seenUrls.add(new URL('https://static.test.ala.org.au/taxon-descriptions/'));
    await page.context().route(pattern, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const guid = extractGuidFromDoubleEncodedSegment(url.pathname, '.json');
        const data = descriptionsByGuid[guid];
        if (data === undefined) {
            return route.fulfill({ status: 404, contentType: 'application/json', body: '[]' });
        }
        await fulfillJson(route, data);
    });
}

// ---------------------------------------------------------------------------
// Traits — TraitsView's _count.json / _summary.json / _data.csv
// ---------------------------------------------------------------------------

export interface TraitsEntry {
    count: any;
    summary: any;
    csv?: string;
}

export async function mockTraits(page: Page, seenUrls: Set<URL>, traitsByGuid: Record<string, TraitsEntry> = {}) {
    seenUrls.add(new URL('https://static.test.ala.org.au/taxon-traits/'));

    await page.context().route('https://static.test.ala.org.au/taxon-traits/**_count.json', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const guid = extractGuidFromDoubleEncodedSegment(url.pathname, '_count.json');
        const entry = traitsByGuid[guid];
        if (!entry) {
            return route.fulfill({ status: 404, contentType: 'application/json', body: '[]' });
        }
        await fulfillJson(route, entry.count);
    });

    await page.context().route('https://static.test.ala.org.au/taxon-traits/**_summary.json', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const guid = extractGuidFromDoubleEncodedSegment(url.pathname, '_summary.json');
        const entry = traitsByGuid[guid];
        if (!entry) {
            return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        }
        await fulfillJson(route, entry.summary);
    });

    await page.context().route('https://static.test.ala.org.au/taxon-traits/**_data.csv', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const guid = extractGuidFromDoubleEncodedSegment(url.pathname, '_data.csv');
        const entry = traitsByGuid[guid];
        if (!entry?.csv) {
            return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' });
        }
        await route.fulfill({ status: 200, contentType: 'text/csv', body: entry.csv });
    });
}

// ---------------------------------------------------------------------------
// BHL — ResourcesView's literature lookup
// ---------------------------------------------------------------------------

export async function mockBhl(page: Page, seenUrls: Set<URL>, bhlByGuid: Record<string, any> = {}) {
    const pattern = 'https://static.test.ala.org.au/taxon-bhl/**';
    seenUrls.add(new URL('https://static.test.ala.org.au/taxon-bhl/'));
    await page.context().route(pattern, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const guid = extractGuidFromDoubleEncodedSegment(url.pathname, '.json');
        const data = bhlByGuid[guid];
        if (data === undefined) {
            return route.fulfill({ status: 404, contentType: 'application/json', body: '[]' });
        }
        await fulfillJson(route, data);
    });
}

// ---------------------------------------------------------------------------
// Cached map (taxon-map tool output) — CachedMapView's metadata + layer PNGs.
// A 404 on the metadata json triggers the component's onUnavailable() callback,
// which is how the Leaflet-fallback map path gets exercised.
// ---------------------------------------------------------------------------

export async function mockTaxonMap(page: Page, seenUrls: Set<URL>, metadataByGuid: Record<string, any> = {}) {
    seenUrls.add(new URL('https://static.test.ala.org.au/taxon-map/'));

    await page.context().route('https://static.test.ala.org.au/taxon-map/**_map.json', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const guid = extractGuidFromDoubleEncodedSegment(url.pathname, '_map.json');
        const data = metadataByGuid[guid];
        if (data === undefined) {
            return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        }
        await fulfillJson(route, data);
    });

    // Any PNG under taxon-map (shared base layer + per-guid occurrence/distribution layers) —
    // the exact layer/zoom identity doesn't matter for structural assertions, so one
    // placeholder generator serves every layer request.
    await page.context().route('https://static.test.ala.org.au/taxon-map/**.png', async (route) => {
        seenUrls.add(new URL(route.request().url()));
        try {
            const buffer = await generateTilePlaceholder(400, 300);
            await route.fulfill({ status: 200, contentType: 'image/png', body: buffer });
        } catch (error) {
            await route.fulfill({ status: 500, contentType: 'text/plain', body: `Error generating tile: ${error}` });
        }
    });
}
