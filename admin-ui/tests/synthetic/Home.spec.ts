import { test, expect } from '../fixtures';
import { setupMocks, mockHomeInfo, goHome, API } from './helpers';

test.describe('Home.tsx — synthetic', () => {

    test('renders without stats when /admin/info returns an error status', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await page.route(`${API}/admin/info`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) });
            });
            await page.route(`${API}/admin/test`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            });
        });
        await goHome(page);

        await expect(page.locator('h4', { hasText: 'Elasticsearch' })).toBeVisible();
        await expect(page.locator('h4', { hasText: 'RabbitMQ' })).toBeVisible();
        await expect(page.locator('h4', { hasText: 'Postgres' })).toBeVisible();
    });

    test('"Begin test" shows an http-error result when /admin/test fails', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/admin/test`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'service unavailable' }) });
            });
        });
        await goHome(page);

        await page.locator('button', { hasText: 'Begin test' }).click();
        await expect(page.locator('pre', { hasText: 'http error' })).toBeVisible({ timeout: 5000 });
        await expect(page.locator('pre', { hasText: 'service unavailable' })).toBeVisible();
    });

    test('"Begin test" shows a waiting state immediately after click', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/admin/test`, async (route) => {
                seenUrls.add(new URL(route.request().url()));
                await new Promise((r) => setTimeout(r, 300));
                route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            });
        });
        await goHome(page);

        await page.locator('button', { hasText: 'Begin test' }).click();
        await expect(page.locator('pre', { hasText: 'waiting' })).toBeVisible({ timeout: 1000 });
    });
});
