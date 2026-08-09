import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { mockSession } from '../mocks/apiMocks';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_APP_PORT ?? '5173'}`;

// Biocache URL from .env.playwright
export const BIOCACHE_PATTERN = '**/biocache-ws*.ala.org.au/ws/occurrences/search**';

// Spatial WS patterns
export const SPATIAL_OBJECT_PATTERN = '**/spatial*.ala.org.au/ws/object/*';
export const SPATIAL_INTERSECT_PATTERN = '**/spatial*.ala.org.au/ws/intersect/cl10925/*/*';

// Fixtures loaded once at module init
export const regionsListFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../resources/regionsList.json'), 'utf-8')
);
export const speciesGroupsFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../resources/speciesGroups.json'), 'utf-8')
);
export const speciesFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../resources/species.json'), 'utf-8')
);
export const kingdomsFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../resources/kingdoms.json'), 'utf-8')
);
export const occurrencesFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../resources/occurrences.json'), 'utf-8')
);

// Standard ACT spatial object response
export const actObjectResponse = {
    pid: '8832857',
    name: 'AUSTRALIAN CAPITAL TERRITORY',
    fid: 'cl10925',
    fieldname: 'PSMA States (2016)',
    bbox: 'POLYGON((148.762675104 -35.9207620485,148.762675104 -35.124517035,149.399284512 -35.124517035,149.399284512 -35.9207620485,148.762675104 -35.9207620485))',
    description: 'AUSTRALIAN CAPITAL TERRITORY',
    area_km: 2363.21,
    id: '8832857',
    wmsurl: 'https://spatial.ala.org.au/geoserver/wms?service=WMS&version=1.1.0&request=GetMap&layers=ALA:Objects&format=image/png&viewparams=s:8832857',
};

// Standard ACT intersect response
export const actIntersectResponse = [
    {
        field: 'cl10925',
        description: 'AUSTRALIAN CAPITAL TERRITORY',
        layername: 'PSMA States (2016)',
        pid: '8832857',
        value: 'AUSTRALIAN CAPITAL TERRITORY',
    },
];

/**
 * Register regionsList mock.
 */
export async function setupRegionsListMock(page: Page, seenUrls: Set<URL>) {
    await page.route('**/regionsList.json', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(regionsListFixture),
        });
    });
}

/**
 * Register spatial object mock (always returns the ACT object).
 */
export async function setupSpatialObjectMock(page: Page, seenUrls: Set<URL>, response = actObjectResponse) {
    await page.route(SPATIAL_OBJECT_PATTERN, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
        });
    });
}

/**
 * Register spatial intersect mock (always returns the ACT intersection).
 */
export async function setupSpatialIntersectMock(page: Page, seenUrls: Set<URL>, response = actIntersectResponse) {
    await page.route(SPATIAL_INTERSECT_PATTERN, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
        });
    });
}

/**
 * Register the standard biocache mock that routes on facets/fq, matching
 * the behaviour of apiServiceMocks.ts.
 */
export async function setupBiocacheMock(
    page: Page,
    seenUrls: Set<URL>,
    overrides: {
        speciesGroups?: object;
        species?: object;
        kingdoms?: object;
        occurrences?: object;
    } = {}
) {
    await page.route(BIOCACHE_PATTERN, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        const facets = url.searchParams.get('facets');
        const fqs = url.searchParams.getAll('fq');
        const searchOccurrences = fqs.some(f => f.startsWith('species:'));

        let response: object;
        if (facets === 'species,decade') {
            response = overrides.species ?? speciesFixture;
        } else if (facets === 'kingdom,decade') {
            response = overrides.kingdoms ?? kingdomsFixture;
        } else if (facets === 'speciesGroup,decade') {
            response = overrides.speciesGroups ?? speciesGroupsFixture;
        } else if (searchOccurrences) {
            response = overrides.occurrences ?? occurrencesFixture;
        } else {
            response = speciesGroupsFixture;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
        });
    });
}

/**
 * Register the map tile mocks (OSM + GeoServer WMS + biocache WMS).
 * Returns a minimal 1×1 transparent PNG for every tile request.
 */
export async function setupMapMocks(page: Page, seenUrls: Set<URL>) {
    // 1×1 transparent PNG (smallest valid PNG)
    const TRANSPARENT_PNG = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
    );

    await page.route('**/spatial.ala.org.au/osm/*/*/*.png', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
    });

    await page.route('**/spatial*.ala.org.au/geoserver/wms*', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
    });

    await page.route('**/biocache-ws.ala.org.au/ws/ogc/wms/reflect*', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
    });
}

/**
 * Register the BIE species page mock.
 */
export async function setupBieMock(page: Page, seenUrls: Set<URL>) {
    await page.route(/https?:\/\/bie\..*\/species\/.*/, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<html lang="en"></html>' });
    });
}

/**
 * Full default mock setup for the Regions home page (/).
 * Biocache is also mocked so that tests which navigate to a Region detail
 * page (e.g. clicking the same region twice) don't hit the real network.
 */
export async function setupRegionsMocks(page: Page) {
    const seenUrls = new Set<URL>();
    const { logMissingMocks } = await import('../mocks/logMissingMocks');
    const { staticServerMocks } = await import('../mocks/staticServerMocks');
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await setupMapMocks(page, seenUrls);
    await setupRegionsListMock(page, seenUrls);
    await setupSpatialObjectMock(page, seenUrls);
    await setupSpatialIntersectMock(page, seenUrls);
    await setupBiocacheMock(page, seenUrls);
    await mockSession(page, seenUrls);
    return seenUrls;
}

/**
 * Full default mock setup for a Region detail page (/region?id=...).
 */
export async function setupRegionDetailMocks(
    page: Page,
    biocacheOverrides: Parameters<typeof setupBiocacheMock>[2] = {}
) {
    const seenUrls = new Set<URL>();
    const { logMissingMocks } = await import('../mocks/logMissingMocks');
    const { staticServerMocks } = await import('../mocks/staticServerMocks');
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await setupMapMocks(page, seenUrls);
    await setupSpatialObjectMock(page, seenUrls);
    await setupBiocacheMock(page, seenUrls, biocacheOverrides);
    await setupBieMock(page, seenUrls);
    await mockSession(page, seenUrls);
    return seenUrls;
}

/** Navigate and wait for network idle. */
export async function load(page: Page, url = BASE_URL) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
}
