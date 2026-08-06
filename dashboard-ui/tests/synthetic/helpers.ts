import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { mockSession, mockBanner } from '../mocks/apiMocks';
import { staticServerMocks } from '../mocks/staticServerMocks';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_APP_PORT ?? '5173'}`;

// static-server is mocked directly from disk (see staticServerMocks.ts), so
// this is a fixed value matching .env.playwright rather than a real server port.
export const STATIC_URL = 'http://localhost:8082';

// The biocache URL configured in .env.playwright
export const BIOCACHE_URL = 'https://biocache-ws-test.ala.org.au/ws';

// Full dashboard fixture loaded once.
export const dashboardFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../resources/dashboard.json'), 'utf-8')
);

/**
 * Register the dashboard.json mock so the app can load data.
 * Also registers a catch-all for the biocache tree API.
 */
export async function setupDashboardMock(page: Page, seenUrls: Set<URL>) {
    const dashboardUrl = `${STATIC_URL}/static/dashboard/dashboard.json`;
    seenUrls.add(new URL(dashboardUrl));
    await page.route(dashboardUrl, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(dashboardFixture),
        })
    );
}

/**
 * Register a biocache facets mock for the tree expand interaction.
 * Returns a fake child list (phylum level) for any kingdom fq.
 */
export async function setupBiocacheTreeMock(page: Page, seenUrls: Set<URL>, fieldResults: object[] = []) {
    const pattern = `${BIOCACHE_URL}/occurrence/facets**`;
    await page.route(pattern, (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
                fieldResults.length > 0
                    ? [{ fieldResult: fieldResults }]
                    : [{}]
            ),
        });
    });
}

/**
 * Standard mock setup: dashboard data + biocache tree (empty children) + session.
 */
export async function setupMocks(page: Page, seenUrls: Set<URL>) {
    await staticServerMocks(page, seenUrls);
    await setupDashboardMock(page, seenUrls);
    await setupBiocacheTreeMock(page, seenUrls);
    await mockSession(page, seenUrls);
    await mockBanner(page, seenUrls);
}
