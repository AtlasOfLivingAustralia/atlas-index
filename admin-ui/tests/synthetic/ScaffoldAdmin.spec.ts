import { test, expect } from '../fixtures';
import { setupMocks, mockHomeInfo, goHome, clickMenu } from './helpers';

const tables = [
    { table: 'banner', label: 'Banner Messages' },
];

const schema = {
    table: 'banner',
    label: 'Banner Messages',
    fields: [
        { name: 'id', type: 'int', required: true, primaryKey: true, readOnly: true },
        { name: 'message', type: 'string', required: true, primaryKey: false, readOnly: false },
        { name: 'enabled', type: 'boolean', required: false, primaryKey: false, readOnly: false },
    ],
};

function makePage(content: any[], totalPages = 1, number = 0) {
    return { schema, content, totalElements: content.length, totalPages, number, size: 50 };
}

async function gotoScaffold(page: any, pageResult: object, seenUrlsExtra?: (page: any, seenUrls: Set<URL>) => Promise<void>) {
    await setupMocks(page, async (page, seenUrls) => {
        await mockHomeInfo(page, seenUrls);
        await page.route(/http:\/\/localhost:8081\/admin\/scaffold(\?.*)?$/, (route: any) => {
            const url = new URL(route.request().url());
            seenUrls.add(url);
            if (route.request().method() === 'DELETE') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            }
            if (route.request().method() === 'POST') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            }
            if (url.searchParams.has('table')) {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pageResult) });
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tables) });
        });
        if (seenUrlsExtra) await seenUrlsExtra(page, seenUrls);
    });
    await goHome(page);
    await clickMenu(page, 'Reference Tables');
    await page.locator('select.form-select-sm').selectOption('banner');
}

test.describe('ScaffoldAdmin.tsx — synthetic', () => {

    test('shows "No rows." when the table is empty', async ({ page }) => {
        await gotoScaffold(page, makePage([]));
        await expect(page.locator('text=No rows.')).toBeVisible({ timeout: 5000 });
    });

    test('shows fixture rows with boolean badges', async ({ page }) => {
        await gotoScaffold(page, makePage([{ id: 1, message: 'hello', enabled: true }, { id: 2, message: 'bye', enabled: false }]));
        await expect(page.locator('td', { hasText: 'hello' })).toBeVisible({ timeout: 5000 });
        await expect(page.locator('span.badge.bg-success', { hasText: 'true' })).toBeVisible();
        await expect(page.locator('span.badge.bg-secondary', { hasText: 'false' })).toBeVisible();
    });

    test('Add Row opens the modal and Save posts the new row', async ({ page }) => {
        let postedBody: any = null;
        await gotoScaffold(page, makePage([{ id: 1, message: 'hello', enabled: true }]), async (page, seenUrls) => {
            await page.route(/http:\/\/localhost:8081\/admin\/scaffold(\?.*)?$/, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                if (route.request().method() === 'POST') {
                    postedBody = JSON.parse(route.request().postData() ?? '{}');
                    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
                }
                return route.fallback();
            });
        });
        await expect(page.locator('td', { hasText: 'hello' })).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Add Row' }).click();
        await expect(page.locator('.modal-title', { hasText: 'Add Row' })).toBeVisible();

        await page.locator('.modal-body input[type="text"]').fill('a new message');
        await page.locator('.modal-footer button', { hasText: 'Save' }).click();
        await expect(page.locator('.modal-title')).toBeHidden({ timeout: 5000 });

        expect(postedBody?.message).toBe('a new message');
    });

    test('Edit Row opens pre-filled and Cancel discards changes', async ({ page }) => {
        await gotoScaffold(page, makePage([{ id: 1, message: 'hello', enabled: true }]));
        await expect(page.locator('td', { hasText: 'hello' })).toBeVisible({ timeout: 5000 });

        await page.locator('button.btn-outline-secondary').first().click();
        await expect(page.locator('.modal-title', { hasText: 'Edit Row' })).toBeVisible();
        await expect(page.locator('.modal-body input[type="text"]')).toHaveValue('hello');

        await page.locator('.modal-footer button', { hasText: 'Cancel' }).click();
        await expect(page.locator('.modal-title')).toBeHidden();
    });

    test('Delete Row shows a confirm modal and deletes on confirm', async ({ page }) => {
        let deleteCalled = false;
        await gotoScaffold(page, makePage([{ id: 1, message: 'hello', enabled: true }]), async (page, seenUrls) => {
            await page.route(/http:\/\/localhost:8081\/admin\/scaffold(\?.*)?$/, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                if (route.request().method() === 'DELETE') {
                    deleteCalled = true;
                    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
                }
                return route.fallback();
            });
        });
        await expect(page.locator('td', { hasText: 'hello' })).toBeVisible({ timeout: 5000 });

        await page.locator('button.btn-outline-danger').first().click();
        await expect(page.locator('text=Confirm Delete')).toBeVisible();
        await page.locator('button.btn-danger', { hasText: 'Delete' }).click();
        await expect(page.locator('text=Confirm Delete')).toBeHidden({ timeout: 5000 });

        expect(deleteCalled).toBe(true);
    });

    test('save failure shows a save error inside the modal', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/scaffold(\?.*)?$/, (route) => {
                const url = new URL(route.request().url());
                seenUrls.add(url);
                if (route.request().method() === 'POST') {
                    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'duplicate key' }) });
                }
                if (url.searchParams.has('table')) {
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePage([{ id: 1, message: 'hello', enabled: true }])) });
                }
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tables) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Reference Tables');
        await page.locator('select.form-select-sm').selectOption('banner');
        await expect(page.locator('td', { hasText: 'hello' })).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Add Row' }).click();
        await page.locator('.modal-footer button', { hasText: 'Save' }).click();
        await expect(page.locator('text=duplicate key')).toBeVisible({ timeout: 5000 });
    });

    test('pagination controls fetch a different page', async ({ page }) => {
        let requestedPage: string | null = null;
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/scaffold(\?.*)?$/, (route) => {
                const url = new URL(route.request().url());
                seenUrls.add(url);
                if (url.searchParams.has('table')) {
                    requestedPage = url.searchParams.get('page');
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePage([{ id: 1, message: 'hello', enabled: true }], 3, Number(requestedPage))) });
                }
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tables) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Reference Tables');
        await page.locator('select.form-select-sm').selectOption('banner');
        await expect(page.locator('td', { hasText: 'hello' })).toBeVisible({ timeout: 5000 });

        await page.locator('ul.pagination li.page-item button', { hasText: '2' }).click();
        await page.waitForTimeout(300);
        expect(requestedPage).toBe('1');
    });

    test('error banner is shown when the table list fails to load', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/scaffold(\?.*)?$/, (route) => {
                seenUrls.add(new URL(route.request().url()));
                // fetchTables() calls r.json() unconditionally (no status check) and only
                // falls into .catch() when the body itself fails to parse as JSON — an
                // object body would otherwise crash the "tables.map()" render below.
                route.fulfill({ status: 500, contentType: 'application/json', body: 'not valid json' });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Reference Tables');

        await expect(page.locator('text=Failed to load tables')).toBeVisible({ timeout: 5000 });
    });
});
