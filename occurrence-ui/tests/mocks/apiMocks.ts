import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(relativePath: string): any {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources', relativePath), 'utf-8'));
}

const g_dataQualityProfiles = loadFixture('dataQualityProfiles.json');

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

/** User who is a collection/admin (ROLE_ADMIN) -- can verify/delete others' annotations */
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

// ---------------------------------------------------------------------------
// Mock registration helpers
// ---------------------------------------------------------------------------

/**
 * Mock the /session endpoint. Must be registered AFTER logMissingMocks so it
 * takes priority (Playwright routes in reverse-registration order).
 */
export async function mockSession(page: Page, seenUrls: Set<URL>, sessionData: object = SESSION_ANONYMOUS) {
    const url = 'http://localhost:8081/session';
    seenUrls.add(new URL(url));
    await page.context().route(url, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(sessionData),
        })
    );
}

/**
 * Mock the data-quality profiles list (GET VITE_APP_DATA_QUALITY_URL).
 * Fixture categories already have a non-empty `inverseFilter`, so
 * OccurrenceList.tsx's fetchDqInverse() short-circuits and never calls
 * mockDataQualityInverse below in the common case -- it is still registered
 * for completeness / future tests that use a fixture without inverseFilter set.
 */
export async function mockDataQualityProfiles(page: Page, seenUrls: Set<URL>, profiles: any[] = g_dataQualityProfiles) {
    const url = 'http://localhost:8081/v1/dq/data-profiles';
    seenUrls.add(new URL(url));
    await page.context().route(url + '**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(profiles),
        })
    );
}

/**
 * Mock the inverse-category-filters lookup (GET
 * VITE_APP_DATA_QUALITY_INVERSE_URL?qualityProfileId=<id>). Returns an empty
 * map by default -- only reached when a profile fixture omits inverseFilter.
 */
export async function mockDataQualityInverse(page: Page, seenUrls: Set<URL>) {
    const pattern = 'http://localhost:8081/v1/dq/quality/getAllInverseCategoryFiltersForProfile';
    seenUrls.add(new URL(pattern));
    await page.context().route(pattern + '**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({}),
        })
    );
}

/**
 * Mock the logged-in user's saved DQ-profile property
 * (GET/PUT http://localhost:8081/v2/user/property?key=dq).
 * `savedProperty` should be a JSON-stringified `{disableAll, dataProfile, disabledItems, expand}` payload,
 * matching what dataQualitySettingsModal.tsx writes and OccurrenceList.tsx reads.
 *
 * Stateful: a POST/PUT (dataQualitySettingsModal.tsx's Save button) updates the value a
 * subsequent GET returns -- this lets a persistence test do a real save-then-reload
 * round trip (page.reload() re-runs OccurrenceList's loadDqProfile() GET fetch) without
 * needing a real OIDC login/logout flow.
 */
export async function mockUserProperty(page: Page, seenUrls: Set<URL>, savedProperty?: string) {
    const pattern = 'http://localhost:8081/v2/user/property';
    const store = { value: savedProperty };
    seenUrls.add(new URL(pattern));
    await page.context().route(pattern + '**', async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
            if (store.value === undefined) {
                return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({}) });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ dq: store.value }),
            });
        }
        // POST/PUT save -- persist the body's `dq` value for subsequent GETs.
        const body = route.request().postData();
        try {
            store.value = body ? JSON.parse(body)['dq'] : store.value;
        } catch (_) { /* leave store.value unchanged on unparsable body */ }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
}

/** Default autocomplete suggestions for the "acacia" simple-search smoke test. */
export const g_autocompleteAcacia = [
    { name: 'Acacia', rank: 'genus', guid: 'https://id.biodiversity.org.au/node/apni/2914725' },
    { name: 'Acacia dealbata', rank: 'species', guid: 'https://id.biodiversity.org.au/node/apni/2895958' },
    { name: 'Acacia melanoxylon', rank: 'species', guid: 'https://id.biodiversity.org.au/node/apni/2901308' },
];

/**
 * Mock the name-matching autocomplete service used by OccurrenceSearch.tsx's
 * Simple-search typeahead (GET VITE_NAMEMATCHING_URL/api/autocomplete?q=...).
 * Real hostname (namematching-ws.ala.org.au), same convention as biocache/images.
 */
export async function mockAutocomplete(page: Page, seenUrls: Set<URL>, results: any[] = g_autocompleteAcacia) {
    const pattern = 'https://namematching-ws.ala.org.au/api/autocomplete**';
    seenUrls.add(new URL('https://namematching-ws.ala.org.au/api/autocomplete'));
    await page.context().route(pattern, (route) => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(results) });
    });
}

/**
 * Mock the login redirect (GET VITE_APP_API_URL/login?path=...). App.tsx / Download.tsx /
 * CustomDownload.tsx / flagIssueModal.tsx use handleLogin(), which does a real
 * `window.location.href = ...` navigation (not a fetch()) -- without this mock,
 * logMissingMocks throws because localhost:8081 isn't in its allowedOrigins.
 */
export async function mockLoginRedirect(page: Page, seenUrls: Set<URL>) {
    const pattern = 'http://localhost:8081/login**';
    seenUrls.add(new URL('http://localhost:8081/login'));
    await page.context().route(pattern, (route) => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Login page mock</body></html>' });
    });
}

/**
 * Mock the logout redirect (GET VITE_APP_API_URL/logout?path=...). App.tsx's
 * handleLogoutWrapper() -> common-ui's handleLogout() does a real
 * `window.location.href = ...` navigation (not a fetch()) -- without this mock,
 * logMissingMocks throws because localhost:8081 isn't in its allowedOrigins. Not
 * part of mockCommonApis()/setupMocks() by default (unlike mockLoginRedirect,
 * which basically every test's Header needs) since clicking Logout is only ever
 * exercised by a handful of App-shell-focused tests.
 */
export async function mockLogoutRedirect(page: Page, seenUrls: Set<URL>) {
    const pattern = 'http://localhost:8081/logout**';
    seenUrls.add(new URL('http://localhost:8081/logout'));
    await page.context().route(pattern, (route) => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Logout page mock</body></html>' });
    });
}

/**
 * Mock the field-guide PDF generation endpoint (POST VITE_APP_FIELDGUIDE_DOWNLOAD_URL,
 * DownloadStatus.tsx's startDownloadFieldguide()). Returns a statusUrl that should
 * then be registered via biocacheMocks.ts's mockDownloadStatusPolling.
 */
export async function mockFieldguideDownload(page: Page, seenUrls: Set<URL>, statusUrl: string) {
    const pattern = 'http://localhost:8081/v2/download/fieldguide**';
    seenUrls.add(new URL('http://localhost:8081/v2/download/fieldguide'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusUrl }) });
    });
}

/**
 * Mock alertModal.tsx's two "create alert" redirects (GET VITE_APP_ALERTS_WS_URL/ws/
 * createBiocacheNewRecordsAlert|createBiocacheNewAnnotationsAlert), fired via a real
 * `window.location.href = ...` top-level navigation, not a fetch() -- same convention
 * as mockLoginRedirect. Not used by any acceptance.spec.ts test (see synthetic
 * listModals.spec.ts). Neither endpoint is mocked anywhere else; without this,
 * logMissingMocks throws because alerts.test.ala.org.au isn't in its allowedOrigins.
 */
export async function mockCreateAlert(page: Page, seenUrls: Set<URL>) {
    // VITE_APP_ALERTS_WS_URL in .env.playwright -- hardcoded here to match every
    // other mock's convention (test files run under Node, not Vite, so
    // import.meta.env is not available in this file).
    const base = 'https://alerts.test.ala.org.au';
    for (const method of ['createBiocacheNewRecordsAlert', 'createBiocacheNewAnnotationsAlert']) {
        const pattern = `${base}/ws/${method}**`;
        seenUrls.add(new URL(`${base}/ws/${method}`));
        await page.context().route(pattern, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'text/html', body: `<html><body>${method} mock</body></html>` });
        });
    }
}

/**
 * Composite: everything App.tsx / OccurrenceList.tsx need on every page that
 * renders the header (session) and, for /occurrences/search, the DQ profile bar.
 * Does not include the biocache dispatcher -- see biocacheMocks.ts.
 */
export async function mockCommonApis(page: Page, seenUrls: Set<URL>, sessionData: object = SESSION_ANONYMOUS) {
    await mockSession(page, seenUrls, sessionData);
    await mockDataQualityProfiles(page, seenUrls);
    await mockDataQualityInverse(page, seenUrls);
    await mockUserProperty(page, seenUrls);
    await mockAutocomplete(page, seenUrls);
    await mockLoginRedirect(page, seenUrls);
}
