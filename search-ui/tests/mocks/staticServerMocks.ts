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
 * files directly from disk instead, removing the need for a second server
 * entirely.
 */
const STATIC_SERVER_ROOT = path.resolve(__dirname, '../../../static-server/static');

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
 * Serve everything under `http://localhost:8082/static/**` straight from
 * the static-server checkout on disk (e.g. static/common/banner.mustache,
 * footer.mustache, ala-combined.css/js). This is the same content a real
 * `http-server ../static-server` process would have served, just read
 * directly instead of over a socket.
 *
 * Must be registered after logMissingMocks (so it takes priority over the
 * catch-all).
 */
export async function staticServerMocks(page: Page, seenUrls: Set<URL>) {
    const pattern = 'http://localhost:8082/static/**';
    await page.context().route(pattern, (route) => {
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
