import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Fixture data — loaded once at module init
// ---------------------------------------------------------------------------

const doiListFixture: any[] = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../resources/doiList.json'), 'utf-8')
);

export const activeDownloadsFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../resources/activeDownloads.json'), 'utf-8')
);

// ---------------------------------------------------------------------------
// User session fixtures
// ---------------------------------------------------------------------------

/** Anonymous / not logged in */
export const SESSION_ANONYMOUS = {
    authenticated: false,
};

/** Standard authenticated user with no special roles */
export const SESSION_USER = {
    authenticated: true,
    userId: 'user-001',
    email: 'user@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    roles: ['ROLE_USER'],
    accessToken: 'fake-jwt-user',
    expiresAt: Date.now() + 3_600_000,
};

/** User who is an admin (ROLE_ADMIN bypasses all authorisedRoles checks) */
export const SESSION_ADMIN = {
    authenticated: true,
    userId: 'admin-001',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['ROLE_USER', 'ROLE_ADMIN'],
    accessToken: 'fake-jwt-admin',
    expiresAt: Date.now() + 3_600_000,
};

/** User with exactly the ACT SDS role — matches the restricted DOI in fixtures */
export const SESSION_SDS_ACT = {
    authenticated: true,
    userId: 'sds-act-001',
    email: 'sds-act@example.com',
    firstName: 'SDS',
    lastName: 'ACT',
    roles: ['ROLE_USER', 'ROLE_SDS_ACT'],
    accessToken: 'fake-jwt-sds-act',
    expiresAt: Date.now() + 3_600_000,
};

/** User with an SDS role that does NOT match the restricted DOI */
export const SESSION_SDS_NSW = {
    authenticated: true,
    userId: 'sds-nsw-001',
    email: 'sds-nsw@example.com',
    firstName: 'SDS',
    lastName: 'NSW',
    roles: ['ROLE_USER', 'ROLE_SDS_NSW'],
    accessToken: 'fake-jwt-sds-nsw',
    expiresAt: Date.now() + 3_600_000,
};

// ---------------------------------------------------------------------------
// DOI fixture helpers — index by uuid for single-item lookups
// ---------------------------------------------------------------------------

const doiByUuid = Object.fromEntries(doiListFixture.map((d: any) => [d.uuid, d]));
const doiByDoi  = Object.fromEntries(doiListFixture.map((d: any) => [d.doi,  d]));

// Well-known UUIDs from fixtures (use these in tests)
export const DOI_BIOCACHE_UUID       = 'aaaabbbb-1111-2222-3333-ccccddddeeee';
export const DOI_CSDM_UUID           = 'bbbbcccc-2222-3333-4444-ddddeeeeffff';
export const DOI_RESTRICTED_UUID     = 'ccccdddd-3333-4444-5555-eeeeffff0000';
export const DOI_UNPUBLISHED_UUID    = 'ddddeeee-4444-5555-6666-ffff00001111';
export const DOI_NO_FILE_UUID        = 'eeee0000-5555-6666-7777-000011112222';

export const DOI_BIOCACHE_DOI        = doiByUuid[DOI_BIOCACHE_UUID].doi;
export const DOI_RESTRICTED_DOI      = doiByUuid[DOI_RESTRICTED_UUID].doi;

// ---------------------------------------------------------------------------
// Mock registration helpers
// ---------------------------------------------------------------------------

/**
 * Mock the /session endpoint.
 * Must be registered AFTER logMissingMocks so it takes priority
 * (Playwright routes in reverse-registration order).
 */
export async function mockSession(page: Page, seenUrls: Set<URL>, sessionData: object = SESSION_ANONYMOUS) {
    const url = 'http://localhost:8081/session';
    seenUrls.add(new URL(url));
    await page.route(url, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(sessionData),
        })
    );
}

/**
 * Mock the DOI list endpoint (paginated).
 * Handles both the public list (Home) and the user-scoped list (MyDownloads).
 * Returns up to pageSize items from the fixture, respecting offset.
 */
export async function mockDoiList(page: Page, seenUrls: Set<URL>, items: any[] = doiListFixture) {
    await page.route(/http:\/\/localhost:8081\/v1\/doi\?/, (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const max    = parseInt(url.searchParams.get('max')    ?? '10', 10);
        const offset = parseInt(url.searchParams.get('offset') ?? '0',  10);
        const page_items = items.slice(offset, offset + max);
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            // search-service exposes x-total-count via CORS (see WebConfig.java) —
            // without this, the browser hides the header from response.headers.get()
            // in the page's fetch() call, even though the mock "sent" it.
            headers: { 'x-total-count': String(items.length), 'access-control-expose-headers': 'x-total-count' },
            body: JSON.stringify(page_items),
        });
    });
}

/**
 * Mock a single DOI detail endpoint: GET /v1/doi/:uuid
 * When uuid is not in the fixture, returns 404.
 */
export async function mockDoiDetail(page: Page, seenUrls: Set<URL>) {
    await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^?]+$/, (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        // Extract the uuid/doi from the path — last path segment
        const id = url.pathname.split('/').at(-1) ?? '';
        const item = doiByUuid[id] ?? doiByDoi[id] ?? null;
        if (!item) {
            return route.fulfill({ status: 404, body: '' });
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(item),
        });
    });
}

/**
 * Mock the download URL endpoint: GET /v1/doi/:uuid/download?redirect=false
 * Returns a pre-signed URL pointing to a local blob URL.
 */
export async function mockDoiDownload(page: Page, seenUrls: Set<URL>, downloadUrl = 'http://localhost:8081/files/download.zip') {
    await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^/]+\/download/, (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ url: downloadUrl }),
        });
    });
}

/**
 * Mock the biocache active-downloads status endpoint.
 */
export async function mockBiocacheStatus(page: Page, seenUrls: Set<URL>, downloadsMap: object = activeDownloadsFixture) {
    const url = 'http://localhost:8081/biocache/occurrences/offline/status';
    seenUrls.add(new URL(url));
    await page.route(url, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(downloadsMap),
        })
    );
}

/**
 * Mock the biocache cancel-download endpoint.
 */
export async function mockBiocacheCancel(page: Page, seenUrls: Set<URL>) {
    await page.route(/http:\/\/localhost:8081\/biocache\/occurrences\/offline\/cancel\/.*/, (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'cancelled' }) });
    });
}

// ---------------------------------------------------------------------------
// Composite setup functions
// ---------------------------------------------------------------------------

/**
 * Full default mock setup for the Home page (anonymous user).
 * Registers all mocks in the correct order (logMissingMocks last-priority).
 */
export async function setupHomeMocks(page: Page, sessionData: object = SESSION_ANONYMOUS) {
    const seenUrls = new Set<URL>();
    const { logMissingMocks } = await import('./logMissingMocks');
    const { staticServerMocks } = await import('./staticServerMocks');
    await logMissingMocks(page, seenUrls);   // lowest priority — catch-all
    await staticServerMocks(page, seenUrls);
    await mockDoiList(page, seenUrls);       // registered after → higher priority
    await mockSession(page, seenUrls, sessionData);
    return seenUrls;
}

/**
 * Full mock setup for a DOI detail page.
 */
export async function setupDoiMocks(page: Page, sessionData: object = SESSION_ANONYMOUS) {
    const seenUrls = new Set<URL>();
    const { logMissingMocks } = await import('./logMissingMocks');
    const { staticServerMocks } = await import('./staticServerMocks');
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await mockDoiDetail(page, seenUrls);
    await mockDoiDownload(page, seenUrls);
    await mockSession(page, seenUrls, sessionData);
    return seenUrls;
}

/**
 * Full mock setup for the MyDownloads page (always requires auth).
 */
export async function setupMyDownloadsMocks(page: Page, sessionData: object = SESSION_USER, activeDownloads: object = {}) {
    const seenUrls = new Set<URL>();
    const { logMissingMocks } = await import('./logMissingMocks');
    const { staticServerMocks } = await import('./staticServerMocks');
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await mockDoiList(page, seenUrls);
    await mockDoiDetail(page, seenUrls);
    await mockDoiDownload(page, seenUrls);
    await mockBiocacheStatus(page, seenUrls, activeDownloads);
    await mockBiocacheCancel(page, seenUrls);
    await mockSession(page, seenUrls, sessionData);
    return seenUrls;
}
