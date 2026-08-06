import { test, expect } from '../fixtures';
import { setupMocks, mockHomeInfo, goHome, clickMenu, API } from './helpers';

async function mockBiocacheStatus(page: any, seenUrls: Set<URL>, downloads: object) {
    await page.route(`${API}/occurrences/offline/status/all`, (route: any) => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(downloads) });
    });
}

test.describe('Biocache.tsx — synthetic', () => {

    test('shows "None found" when there are no active downloads', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await mockBiocacheStatus(page, seenUrls, {});
        });
        await goHome(page);
        await clickMenu(page, 'Biocache');

        await expect(page.locator('text=None found')).toBeVisible({ timeout: 5000 });
    });

    test('switching to the "Admin requests" tab shows placeholder content', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await mockBiocacheStatus(page, seenUrls, {});
        });
        await goHome(page);
        await clickMenu(page, 'Biocache');
        await expect(page.locator('text=None found')).toBeVisible({ timeout: 5000 });

        await page.locator('button[role="tab"]', { hasText: 'Admin requests' }).click();
        await expect(page.locator('text=2nd')).toBeVisible();
    });

    test('cancelling a download: confirm triggers the cancel request and refreshes the list', async ({ page }) => {
        let cancelCalled = false;
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            let callCount = 0;
            await page.route(`${API}/occurrences/offline/status/all`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                callCount++;
                const body = callCount === 1
                    ? { 'user@example.com': [{ status: 'running', totalRecords: 100, records: 50, statusUrl: `${API}/status/1`, cancelUrl: `${API}/cancel/1` }] }
                    : {};
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
            });
            await page.route(`${API}/cancel/1`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                cancelCalled = true;
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'cancelled' }) });
            });
        });
        page.on('dialog', async (dialog) => { await dialog.accept(); });

        await goHome(page);
        await clickMenu(page, 'Biocache');
        await expect(page.locator('text=running')).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Cancel' }).click();
        await page.waitForTimeout(500);

        expect(cancelCalled).toBe(true);
        await expect(page.locator('text=None found')).toBeVisible({ timeout: 5000 });
    });

    test('cancelling a download: dismiss does not trigger the cancel request', async ({ page }) => {
        let cancelCalled = false;
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/occurrences/offline/status/all`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ 'user@example.com': [{ status: 'running', totalRecords: 100, records: 50, statusUrl: `${API}/status/1`, cancelUrl: `${API}/cancel/1` }] }),
                });
            });
            await page.route(`${API}/cancel/1`, (route: any) => {
                cancelCalled = true;
                route.fulfill({ status: 200, body: '' });
            });
        });
        page.on('dialog', async (dialog) => { await dialog.dismiss(); });

        await goHome(page);
        await clickMenu(page, 'Biocache');
        await expect(page.locator('text=running')).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Cancel' }).click();
        await page.waitForTimeout(300);

        expect(cancelCalled).toBe(false);
        await expect(page.locator('text=running')).toBeVisible();
    });
});
