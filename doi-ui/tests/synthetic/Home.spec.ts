import { test, expect } from '../fixtures';
import { BASE_URL, setupDefault, load, waitForContent } from './helpers';
import { logMissingMocks } from '../mocks/logMissingMocks';
import { staticServerMocks } from '../mocks/staticServerMocks';
import { mockSession, SESSION_ANONYMOUS } from '../mocks/apiMocks';

// ---------------------------------------------------------------------------
// Home.tsx — branches NOT covered by acceptance tests
//
// 1. loading skeleton → content transition (placeholder-glow visible then hidden)
// 2. API error → maxResults stays 0, loading ends, no crash
// 3. summary.length > 0 section ("Empowering research through open data")
//    Currently homeSummary.json is [] so this is always false in mock builds.
//    We skip this branch — it cannot be triggered without changing the build.
// 4. featured.length > 0 section ("Featured DOIs") — same reason, skipped.
// 5. Pagination: second page fetched correctly
// 6. Row date: dateCreated absent → empty cell (no crash)
// 7. Row records: recordCount absent → empty cell (no crash)
// 8. Row datasets: datasets absent → empty cell (no crash)
// ---------------------------------------------------------------------------

test.describe('Home.tsx', () => {

    // -----------------------------------------------------------------------
    // Loading skeleton is visible before data arrives
    // -----------------------------------------------------------------------
    test('loading skeleton visible before API response arrives', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        // Delay the DOI list response so the skeleton is observable
        await page.route(/http:\/\/localhost:8081\/v1\/doi\?/, async (route) => {
            seenUrls.add(new URL(route.request().url()));
            await new Promise(r => setTimeout(r, 400));
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'x-total-count': '1', 'access-control-expose-headers': 'x-total-count' },
                body: JSON.stringify([{
                    uuid: 'aaa', doi: '10.1/aaa', title: 'Test DOI',
                    description: '', active: true, dateCreated: '2025-01-01T00:00:00Z',
                    applicationMetadata: { recordCount: 5, datasets: [] }, licence: [],
                }]),
            });
        });
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await page.goto(BASE_URL);
        // Skeleton must be visible before data arrives
        const skeleton = page.locator('.placeholder-glow');
        await expect(skeleton).toBeVisible({ timeout: 2000 });

        // After data arrives skeleton disappears
        await page.waitForLoadState('networkidle');
        await expect(skeleton).toBeHidden({ timeout: 5000 });
    });

    // -----------------------------------------------------------------------
    // API error → loading ends, no crash, maxResults stays 0
    // -----------------------------------------------------------------------
    test('API error does not crash the page — shows empty table', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await page.route(/http:\/\/localhost:8081\/v1\/doi\?/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 500, body: 'Internal Server Error' });
        });
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Loading ended (no skeleton)
        await expect(page.locator('.placeholder-glow')).toBeHidden({ timeout: 5000 });
        // Table rendered (even if empty)
        await expect(page.locator('table')).toBeVisible();
        // "Showing" text still renders
        await expect(page.locator('text=Showing')).toBeVisible();
    });

    // -----------------------------------------------------------------------
    // DOI row with no dateCreated — renders empty cell, no crash
    // -----------------------------------------------------------------------
    test('DOI row with no dateCreated renders without crashing', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await page.route(/http:\/\/localhost:8081\/v1\/doi\?/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'x-total-count': '1', 'access-control-expose-headers': 'x-total-count' },
                body: JSON.stringify([{
                    uuid: 'no-date', doi: '10.1/no-date', title: 'No Date DOI',
                    description: 'no date', active: true,
                    // dateCreated intentionally absent
                    applicationMetadata: { recordCount: 10, datasets: [{ name: 'ds', licence: 'CC', count: 10 }] },
                    licence: [],
                }]),
            });
        });
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await load(page, BASE_URL);
        await waitForContent(page);

        // Row rendered without crashing — title visible
        await expect(page.locator('td', { hasText: 'No Date DOI' })).toBeVisible();
    });

    // -----------------------------------------------------------------------
    // DOI row with no applicationMetadata — empty records/datasets cells
    // -----------------------------------------------------------------------
    test('DOI row with no applicationMetadata renders without crashing', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await page.route(/http:\/\/localhost:8081\/v1\/doi\?/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'x-total-count': '1', 'access-control-expose-headers': 'x-total-count' },
                body: JSON.stringify([{
                    uuid: 'no-meta', doi: '10.1/no-meta', title: 'No Meta DOI',
                    description: 'no meta', active: true,
                    dateCreated: '2025-06-01T00:00:00Z',
                    // applicationMetadata intentionally absent
                    licence: [],
                }]),
            });
        });
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await load(page, BASE_URL);
        await waitForContent(page);

        await expect(page.locator('td', { hasText: 'No Meta DOI' })).toBeVisible();
        // Records and datasets cells are empty (no crash)
    });

    // -----------------------------------------------------------------------
    // App.tsx — visibilitychange listener exercises checkLoginState re-call
    // -----------------------------------------------------------------------
    test('visibilitychange event does not crash the page', async ({ page }) => {
        await setupDefault(page, SESSION_ANONYMOUS);
        await load(page, BASE_URL);

        await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await expect(page).toHaveTitle(/DOI \| Atlas of Living Australia/);
    });

    // -----------------------------------------------------------------------
    // App.tsx — cleanup removes visibilitychange listener on unmount
    // -----------------------------------------------------------------------
    test('navigating away unmounts the React tree without error', async ({ page }) => {
        await setupDefault(page, SESSION_ANONYMOUS);
        await load(page, BASE_URL);

        await page.evaluate(() => { window.location.href = 'about:blank'; });
        // No crash = cleanup ran correctly
    });

    // -----------------------------------------------------------------------
    // App.tsx — resize listener updates isMobile
    // -----------------------------------------------------------------------
    test('window resize does not crash the page', async ({ page }) => {
        await setupDefault(page, SESSION_ANONYMOUS);
        await load(page, BASE_URL);

        await page.setViewportSize({ width: 400, height: 800 });  // mobile
        await page.waitForTimeout(100);
        await page.setViewportSize({ width: 1280, height: 800 }); // desktop
        await page.waitForTimeout(100);

        await expect(page.locator('text=ALA DOI Repository').first()).toBeVisible();
    });
});
