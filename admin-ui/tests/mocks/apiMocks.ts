import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name: string): any {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources', name), 'utf-8'));
}

// ---------------------------------------------------------------------------
// Fixture data — loaded once at module init
// ---------------------------------------------------------------------------

export const homeStatsFixture = loadFixture('homeStats.json');
export const dqProfilesFixture = loadFixture('dqProfiles.json');
export const tasksPageFixture = loadFixture('tasksPage.json');
export const scaffoldTablesFixture = loadFixture('scaffoldTables.json');
export const scaffoldPageFixture = loadFixture('scaffoldPage.json');
export const doiListFixture = loadFixture('doiList.json');
export const bannerDataFixture = loadFixture('bannerData.json');
export const biocacheDownloadsFixture = loadFixture('biocacheDownloads.json');
export const auditPageFixture = loadFixture('auditPage.json');
export const atlasLogFixture = loadFixture('atlasLog.json');
export const atlasConfigFixture = loadFixture('atlasConfig.json');
export const swaggerSpecFixture = loadFixture('swaggerSpec.json');

// ---------------------------------------------------------------------------
// User session fixtures
// ---------------------------------------------------------------------------

/** Anonymous / not logged in */
export const SESSION_ANONYMOUS = {
    authenticated: false,
};

/** Authenticated user without the admin role */
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

/** Authenticated user with ROLE_ADMIN */
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
// Individual mock registration helpers
// ---------------------------------------------------------------------------

/**
 * Mock the /session endpoint used by common-ui's checkLoginState().
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

/** Home page: /admin/info and /admin/test */
export async function mockHome(page: Page, seenUrls: Set<URL>, stats: object = homeStatsFixture) {
    const infoUrl = 'http://localhost:8081/admin/info';
    seenUrls.add(new URL(infoUrl));
    await page.route(infoUrl, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stats) })
    );

    await page.route('http://localhost:8081/admin/test', (route) => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ elasticsearch: 'ok', rabbitmq: 'ok', dataStore: 'ok', downloadStore: 'ok', staticStore: 'ok' }),
        });
    });
}

/** Data Quality admin: GET /admin/dq */
export async function mockDataQuality(page: Page, seenUrls: Set<URL>, profiles: any[] = dqProfilesFixture) {
    const url = 'http://localhost:8081/admin/dq';
    seenUrls.add(new URL(url));
    await page.route(url, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profiles) })
    );
}

/** Tasks view: /admin/tasks?page=N */
export async function mockTasks(page: Page, seenUrls: Set<URL>, tasksPage: object = tasksPageFixture) {
    await page.route(/http:\/\/localhost:8081\/admin\/tasks(\?.*)?$/, (route) => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasksPage) });
    });
}

/** Reference Tables (Scaffold) admin: table list + page content */
export async function mockScaffold(
    page: Page,
    seenUrls: Set<URL>,
    tables: any[] = scaffoldTablesFixture,
    pageResult: object = scaffoldPageFixture
) {
    await page.route(/http:\/\/localhost:8081\/admin\/scaffold(\?.*)?$/, (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        if (url.searchParams.has('table')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pageResult) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tables) });
    });
}

/** DOI list view: GET /v1/doi?... */
export async function mockDoiList(page: Page, seenUrls: Set<URL>, items: any[] = doiListFixture) {
    await page.route(/http:\/\/localhost:8081\/v1\/doi\?/, (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'x-total-count': String(items.length), 'access-control-expose-headers': 'x-total-count' },
            body: JSON.stringify(items),
        });
    });
}

/** Banner Messages admin: GET /v2/banner */
export async function mockBanner(page: Page, seenUrls: Set<URL>, data: object = bannerDataFixture) {
    const url = 'http://localhost:8081/v2/banner';
    seenUrls.add(new URL(url));
    await page.route(url, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    );
}

/** Biocache admin: GET /occurrences/offline/status/all */
export async function mockBiocache(page: Page, seenUrls: Set<URL>, downloads: object = biocacheDownloadsFixture) {
    const url = 'http://localhost:8081/occurrences/offline/status/all';
    seenUrls.add(new URL(url));
    await page.route(url, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(downloads) })
    );
}

/** Audit History admin: GET /admin/audit?... */
export async function mockAudit(page: Page, seenUrls: Set<URL>, results: object = auditPageFixture) {
    await page.route(/http:\/\/localhost:8081\/admin\/audit(\?.*)?$/, (route) => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(results) });
    });
}

/** Search Index (Atlas Admin) view: /admin/log and /admin/config */
export async function mockAtlasAdmin(page: Page, seenUrls: Set<URL>, log: object = atlasLogFixture, config: any[] = atlasConfigFixture) {
    await page.route(/http:\/\/localhost:8081\/admin\/log(\?.*)?$/, (route) => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(log) });
    });
    const configUrl = 'http://localhost:8081/admin/config';
    seenUrls.add(new URL(configUrl));
    await page.route(configUrl, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) })
    );
}

/** Swagger view: the single mocked spec source (see .env.playwright VITE_SWAGGER_SOURCES) */
export async function mockSwagger(page: Page, seenUrls: Set<URL>, spec: object = swaggerSpecFixture) {
    const url = 'http://localhost:8081/mock-openapi.json';
    seenUrls.add(new URL(url));
    await page.route(url, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(spec) })
    );
}

// ---------------------------------------------------------------------------
// Composite setup functions — one per route, always includes session + logMissingMocks
// ---------------------------------------------------------------------------

async function baseSetup(page: Page, sessionData: object) {
    const seenUrls = new Set<URL>();
    const { logMissingMocks } = await import('./logMissingMocks');
    const { staticServerMocks } = await import('./staticServerMocks');
    await logMissingMocks(page, seenUrls); // lowest priority — catch-all
    await staticServerMocks(page, seenUrls);
    await mockHome(page, seenUrls);
    await mockSession(page, seenUrls, sessionData);
    return seenUrls;
}

export async function setupHomeMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    return await baseSetup(page, sessionData);
}

export async function setupAtlasAdminMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockAtlasAdmin(page, seenUrls);
    return seenUrls;
}

export async function setupDataQualityMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockDataQuality(page, seenUrls);
    return seenUrls;
}

export async function setupTasksMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockTasks(page, seenUrls);
    return seenUrls;
}

export async function setupDoiMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockDoiList(page, seenUrls);
    return seenUrls;
}

export async function setupBiocacheMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockBiocache(page, seenUrls);
    return seenUrls;
}

export async function setupBannerMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockBanner(page, seenUrls);
    return seenUrls;
}

export async function setupScaffoldMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockScaffold(page, seenUrls);
    return seenUrls;
}

export async function setupAuditMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockAudit(page, seenUrls);
    return seenUrls;
}

export async function setupSwaggerMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockSwagger(page, seenUrls);
    return seenUrls;
}
