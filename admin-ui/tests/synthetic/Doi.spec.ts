import { test, expect } from '../fixtures';
import { setupMocks, mockHomeInfo, goHome, clickMenu, API } from './helpers';

const doiListFixture = [
    { uuid: 'uuid-1', doi: '10.1234/ala-000001', dateCreated: '2026-07-01T00:00:00Z', title: 'Occurrence records download', userId: 'user-1' },
];

const doiDetail = { uuid: 'uuid-1', doi: '10.1234/ala-000001', title: 'Occurrence records download', providerMetadata: { title: 'Occurrence records download' } };

async function gotoDoi(page: any, extra?: (page: any, seenUrls: Set<URL>) => Promise<void>) {
    await setupMocks(page, async (page, seenUrls) => {
        await mockHomeInfo(page, seenUrls);
        await page.route(/http:\/\/localhost:8081\/v1\/doi\?/, (route: any) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'x-total-count': String(doiListFixture.length), 'access-control-expose-headers': 'x-total-count' },
                body: JSON.stringify(doiListFixture),
            });
        });
        if (extra) await extra(page, seenUrls);
    });
    await goHome(page);
    await clickMenu(page, 'DOIs');
}

const showTabSearchButton = (page: any) => page.locator('#admin-tabs-tabpane-show button.btn-primary', { hasText: 'Search' });

test.describe('Doi.tsx — synthetic', () => {

    test('the Recent DOIs list is shown by default', async ({ page }) => {
        await gotoDoi(page);
        await expect(page.locator('button[role="tab"][aria-selected="true"]', { hasText: 'Recent DOIs' })).toBeVisible({ timeout: 5000 });
        await expect(page.locator('td', { hasText: '10.1234/ala-000001' })).toBeVisible({ timeout: 5000 });
    });

    test('clicking a row in the Recent DOIs list navigates to the Show tab and fetches detail', async ({ page }) => {
        await gotoDoi(page, async (page, seenUrls) => {
            // The Doi.tsx view fetches "/v1/doi/" + doi.doi, which contains a
            // literal "/" — so the request path has two extra segments.
            await page.route(/http:\/\/localhost:8081\/v1\/doi\/10\.1234\/ala-000001$/, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doiDetail) });
            });
        });
        await expect(page.locator('td', { hasText: '10.1234/ala-000001' })).toBeVisible({ timeout: 5000 });

        await page.locator('tbody tr', { hasText: '10.1234/ala-000001' }).click();
        await expect(page.locator('button[role="tab"][aria-selected="true"]', { hasText: 'Show data for a DOI' })).toBeVisible();
        await expect(page.locator('input[placeholder*="DOI"]')).toHaveValue('10.1234/ala-000001');
        await expect(page.locator('#admin-tabs-tabpane-show pre')).toBeVisible({ timeout: 5000 });
    });

    test('Show tab: alerts when searching without a DOI entered', async ({ page }) => {
        await gotoDoi(page);
        await page.locator('button[role="tab"]', { hasText: 'Show data for a DOI' }).click();

        let alertMessage = '';
        page.on('dialog', async (dialog) => { alertMessage = dialog.message(); await dialog.dismiss(); });
        await showTabSearchButton(page).click();
        await page.waitForTimeout(300);
        expect(alertMessage).toContain('Please enter a DOI');
    });

    test('Show tab: not-found DOI alerts with the error message', async ({ page }) => {
        await gotoDoi(page, async (page, seenUrls) => {
            await page.route(/http:\/\/localhost:8081\/v1\/doi\/does-not-exist$/, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'DOI not found' }) });
            });
        });
        await page.locator('button[role="tab"]', { hasText: 'Show data for a DOI' }).click();

        let alertMessage = '';
        page.on('dialog', async (dialog) => { alertMessage = dialog.message(); await dialog.dismiss(); });
        await page.locator('input[placeholder*="DOI"]').fill('does-not-exist');
        await showTabSearchButton(page).click();
        await page.waitForTimeout(300);
        expect(alertMessage).toContain('DOI not found');
    });

    test('Show tab: including provider record fetches the DataCite record too', async ({ page }) => {
        await gotoDoi(page, async (page, seenUrls) => {
            await page.route(/http:\/\/localhost:8081\/v1\/doi\/uuid-1$/, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doiDetail) });
            });
            await page.route(`${API}/datacite/dois/uuid-1`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'uuid-1' } }) });
            });
        });
        await page.locator('button[role="tab"]', { hasText: 'Show data for a DOI' }).click();

        await page.locator('input[placeholder*="DOI"]').fill('uuid-1');
        await page.locator('#admin-tabs-tabpane-show input[type="checkbox"]').click();
        await showTabSearchButton(page).click();

        await expect(page.locator('h4', { hasText: 'Provider record' })).toBeVisible({ timeout: 5000 });
    });

    test('Mint DOI tab shows the instructions panel', async ({ page }) => {
        await gotoDoi(page);
        await page.locator('button[role="tab"]', { hasText: 'Mint DOI' }).click();
        await expect(page.locator('button[role="tab"][aria-selected="true"]', { hasText: 'Mint DOI' })).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=Provider Metadata Example')).toBeVisible();
    });
});
