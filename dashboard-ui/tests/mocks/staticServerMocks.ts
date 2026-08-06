import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * `static-server/` (a sibling package) is not a real service — it is just a
 * directory of static files historically served in tests by spinning up a
 * second `http-server` process on port 8082. Rather than running that
 * process, this mock intercepts requests to that origin and serves the
 * files directly from disk (or from test fixtures, for data that tests
 * override), removing the need for a second server entirely.
 */
const STATIC_SERVER_ROOT = path.resolve(__dirname, '../../../static-server/static');
const RESOURCES_ROOT = path.resolve(__dirname, '../resources');

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.mustache': 'text/plain',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.zip': 'application/zip',
    '.csv': 'text/csv',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

function contentTypeFor(filePath: string): string {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Serve `http://localhost:8082/static/dashboard/dashboard.json` and
 * `dashboard.zip` from the test fixtures directory. This replaces the
 * run-playwright-test.sh step that used to copy these files into
 * `static-server/static/dashboard/` before starting a real static-server
 * http-server process.
 */
async function mockDashboardData(page: Page, seenUrls: Set<URL>) {
    const jsonUrl = 'http://localhost:8082/static/dashboard/dashboard.json';
    const zipUrl = 'http://localhost:8082/static/dashboard/dashboard.zip';
    seenUrls.add(new URL(jsonUrl));
    seenUrls.add(new URL(zipUrl));

    await page.route(jsonUrl, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: fs.readFileSync(path.join(RESOURCES_ROOT, 'dashboard.json'), 'utf-8'),
        })
    );

    // Registered at the browser-context level (not page level) because the
    // "Download as CSV" link uses target="_blank", opening the zip URL in a
    // new page/tab. page.route() only applies to the page it was registered
    // on, so a context-level route is required for it to be intercepted
    // there too. Page-level routes (e.g. logMissingMocks, mockStaticFiles)
    // take priority over context-level routes regardless of registration
    // order, so this only ever applies to requests page-level routes don't
    // already handle — which is exactly the new-tab zip download.
    await page.context().route(zipUrl, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/zip',
            headers: { 'content-disposition': 'attachment; filename="dashboard.zip"' },
            body: fs.readFileSync(path.join(RESOURCES_ROOT, 'dashboard.zip')),
        })
    );
}

/**
 * Serve everything else under `http://localhost:8082/static/**` straight
 * from the static-server checkout on disk (e.g. static/common/banner.mustache,
 * footer.mustache, ala-combined.css/js). This is the same content a real
 * `http-server ../static-server` process would have served, just read
 * directly instead of over a socket.
 */
async function mockStaticFiles(page: Page, seenUrls: Set<URL>) {
    const pattern = 'http://localhost:8082/static/**';
    await page.route(pattern, (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const relativePath = url.pathname.replace(/^\/static\//, '');
        const filePath = path.join(STATIC_SERVER_ROOT, relativePath);

        // Guard against path traversal escaping the static root.
        if (!filePath.startsWith(STATIC_SERVER_ROOT) || !fs.existsSync(filePath)) {
            return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' });
        }

        return route.fulfill({
            status: 200,
            contentType: contentTypeFor(filePath),
            body: fs.readFileSync(filePath),
        });
    });
}

/**
 * Register all static-server mocks. Must be registered after
 * logMissingMocks (so it takes priority over the catch-all) but works fine
 * regardless of ordering relative to apiMocks/mockSession/mockBanner.
 */
export async function staticServerMocks(page: Page, seenUrls: Set<URL>) {
    // mockDashboardData must be registered after mockStaticFiles so its
    // fixture-based response takes priority (Playwright gives later
    // registrations higher priority) over static-server's on-disk
    // dashboard.json/zip, which is stale historical test output.
    await mockStaticFiles(page, seenUrls);
    await mockDashboardData(page, seenUrls);
}
