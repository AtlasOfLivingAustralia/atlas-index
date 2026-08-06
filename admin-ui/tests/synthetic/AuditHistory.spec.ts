import { test, expect } from '../fixtures';
import { setupMocks, mockHomeInfo, goHome, clickMenu } from './helpers';

function auditPage(content: any[], totalPages = 1) {
    return { content, totalElements: content.length, totalPages, number: 0, size: 20 };
}

const sampleEntry = {
    id: 1,
    entityTable: 'banner',
    entityId: '1',
    entityName: 'admin',
    createdAt: '2026-07-01T10:00:00Z',
    actor: 'admin@example.com',
    action: 'UPDATE',
    diff: JSON.stringify({ message: { from: 'old text', to: 'new text' } }),
};

test.describe('AuditHistory.tsx — synthetic', () => {

    test('shows "No records found" for an empty result set', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/audit(\?.*)?$/, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auditPage([])) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Audit History');

        await expect(page.locator('text=No records found')).toBeVisible({ timeout: 5000 });
    });

    test('error alert is shown when the request fails', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/audit(\?.*)?$/, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 500, body: '' });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Audit History');

        await expect(page.locator('text=Failed to load audit history')).toBeVisible({ timeout: 5000 });
    });

    test('clicking "View diff" opens the modal with a from/to table', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/audit(\?.*)?$/, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auditPage([sampleEntry])) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Audit History');
        await expect(page.locator('text=View diff')).toBeVisible({ timeout: 5000 });

        await page.locator('text=View diff').click();
        await expect(page.locator('text=Change details')).toBeVisible();
        await expect(page.locator('td', { hasText: 'old text' })).toBeVisible();
        await expect(page.locator('td', { hasText: 'new text' })).toBeVisible();

        await page.locator('button.btn-close').click();
        await expect(page.locator('text=Change details')).toBeHidden();
    });

    test('submitting the search form applies the entered filters', async ({ page }) => {
        let lastUrl = '';
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/audit(\?.*)?$/, (route) => {
                lastUrl = route.request().url();
                seenUrls.add(new URL(lastUrl));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auditPage([])) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Audit History');
        await expect(page.locator('text=No records found')).toBeVisible({ timeout: 5000 });

        await page.locator('input[placeholder="exact match"]').fill('42');
        await page.locator('input[placeholder="partial match"]').first().fill('some name');
        await page.locator('input[placeholder="partial match"]').nth(1).fill('someone');
        await page.locator('select').nth(1).selectOption('DELETE');
        await page.locator('button[type="submit"]', { hasText: 'Search' }).click();
        await page.waitForTimeout(300);

        expect(lastUrl).toContain('entityId=42');
        expect(lastUrl).toContain('entityName=some+name');
        expect(lastUrl).toContain('author=someone');
        expect(lastUrl).toContain('action=DELETE');
    });

    test('Clear resets all filters and re-fetches', async ({ page }) => {
        let lastUrl = '';
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/audit(\?.*)?$/, (route) => {
                lastUrl = route.request().url();
                seenUrls.add(new URL(lastUrl));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auditPage([])) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Audit History');
        await expect(page.locator('text=No records found')).toBeVisible({ timeout: 5000 });

        await page.locator('input[placeholder="exact match"]').fill('42');
        await page.locator('button', { hasText: 'Clear' }).click();
        await page.waitForTimeout(300);

        expect(lastUrl).not.toContain('entityId=42');
        await expect(page.locator('input[placeholder="exact match"]')).toHaveValue('');
    });

    test('clicking a table badge in a row filters by that table', async ({ page }) => {
        let lastUrl = '';
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/audit(\?.*)?$/, (route) => {
                lastUrl = route.request().url();
                seenUrls.add(new URL(lastUrl));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auditPage([sampleEntry])) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Audit History');
        await expect(page.locator('span.badge.bg-secondary', { hasText: 'banner' })).toBeVisible({ timeout: 5000 });

        await page.locator('span.badge.bg-secondary', { hasText: 'banner' }).click();
        await page.waitForTimeout(300);
        expect(lastUrl).toContain('entityTable=banner');
    });

    test('pagination fetches the requested page', async ({ page }) => {
        let lastUrl = '';
        const entries = Array.from({ length: 1 }, (_, i) => ({ ...sampleEntry, id: i }));
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/audit(\?.*)?$/, (route) => {
                lastUrl = route.request().url();
                seenUrls.add(new URL(lastUrl));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auditPage(entries, 3)) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Audit History');
        await expect(page.locator('ul.pagination')).toBeVisible({ timeout: 5000 });

        await page.locator('ul.pagination li.page-item button', { hasText: '2' }).click();
        await page.waitForTimeout(300);
        expect(lastUrl).toContain('page=1');
    });
});
