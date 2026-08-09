import { test, expect } from '../fixtures';
import { setupMocks, mockHomeInfo, goHome, clickMenu, API } from './helpers';

test.describe('SwaggerView.tsx — synthetic', () => {

    test('shows a spinner while the spec is loading, then renders the spec title', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/mock-openapi.json`, async (route) => {
                seenUrls.add(new URL(route.request().url()));
                await new Promise((r) => setTimeout(r, 300));
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ openapi: '3.0.1', info: { title: 'Mock Service API', version: '1.0.0' }, paths: {} }),
                });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Swagger');

        await expect(page.locator('.spinner-border')).toBeVisible({ timeout: 2000 });
        await expect(page.locator('text=Mock Service API')).toBeVisible({ timeout: 5000 });
    });

    test('shows a load error alert when the spec request fails', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/mock-openapi.json`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 500, body: '' });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Swagger');

        await expect(page.locator('.alert-danger', { hasText: 'Failed to load spec' })).toBeVisible({ timeout: 5000 });
    });

    test('the service selector shows the configured mock source', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/mock-openapi.json`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ openapi: '3.0.1', info: { title: 'Mock Service API', version: '1.0.0' }, paths: {} }) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Swagger');

        await expect(page.locator('select#spec-select option', { hasText: 'mock-service' })).toHaveCount(1);
    });
});
