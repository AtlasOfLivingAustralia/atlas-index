import { test, expect } from '../fixtures';
import { setupMocks, mockHomeInfo, goHome, clickMenu, API } from './helpers';

const atlasLog = {
    queues: { default: { activeCount: 1, queueSize: 2, description: 'Default queue', queueCapacity: 10 } },
    tasks: {
        ALL: { log: [{ id: 'l1', task: 'ALL', modified: 1719900000000, message: 'Completed', modifiedDate: '' }], description: 'Run all tasks', enabled: true },
    },
};

const atlasConfig = [
    { id: 'task.schedule', value: '0 0 * * *', notes: 'nightly cron', updated: 1719900000000 },
];

async function gotoAtlasAdmin(page: any, extra?: (page: any, seenUrls: Set<URL>) => Promise<void>) {
    await setupMocks(page, async (page, seenUrls) => {
        await mockHomeInfo(page, seenUrls);
        await page.route(/http:\/\/localhost:8081\/admin\/log(\?.*)?$/, (route: any) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(atlasLog) });
        });
        await page.route(`${API}/admin/config`, (route: any) => {
            seenUrls.add(new URL(route.request().url()));
            if (route.request().method() === 'POST') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            }
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(atlasConfig) });
        });
        if (extra) await extra(page, seenUrls);
    });
    await goHome(page);
    await clickMenu(page, 'Search Index');
}

test.describe('AtlasAdmin.tsx — synthetic', () => {

    test('Background tasks tab: "Run now" posts to /admin/task and switches to the Log tab', async ({ page }) => {
        await gotoAtlasAdmin(page, async (page, seenUrls) => {
            await page.route(/http:\/\/localhost:8081\/admin\/task\?type=ALL/, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ started: true }) });
            });
        });
        await page.locator('button[role="tab"]', { hasText: 'Background tasks' }).click();
        await expect(page.locator('td', { hasText: /^ALL$/ })).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Run now' }).click();
        await expect(page.locator('button[role="tab"][aria-selected="true"]', { hasText: 'Log' })).toBeVisible({ timeout: 5000 });
    });

    test('Log tab: changing the task filter re-fetches the log', async ({ page }) => {
        let lastUrl = '';
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/log(\?.*)?$/, (route: any) => {
                lastUrl = route.request().url();
                seenUrls.add(new URL(lastUrl));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(atlasLog) });
            });
            await page.route(`${API}/admin/config`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(atlasConfig) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Search Index');

        await page.locator('button[role="tab"]', { hasText: 'Log' }).click();
        await page.locator('select#filter').selectOption('ALL');
        await page.waitForTimeout(300);
        expect(lastUrl).toContain('type=ALL');
    });

    test('Log tab: "Show Threads & Queues" reveals the queue JSON', async ({ page }) => {
        await gotoAtlasAdmin(page);
        await page.locator('button[role="tab"]', { hasText: 'Log' }).click();
        await expect(page.locator('pre', { hasText: 'Completed' })).toBeVisible({ timeout: 5000 });

        await page.locator('input[type="checkbox"]').first().click();
        await expect(page.locator('pre', { hasText: 'activeCount' })).toBeVisible();
    });

    test('Dynamic Config tab: editing a value and saving posts the update', async ({ page }) => {
        let savedBody: any = null;
        await gotoAtlasAdmin(page, async (page, seenUrls) => {
            await page.route(`${API}/admin/config`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                if (route.request().method() === 'POST') {
                    savedBody = JSON.parse(route.request().postData() ?? '{}');
                    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
                }
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(atlasConfig) });
            });
        });
        await page.locator('button[role="tab"]', { hasText: 'Dynamic Config' }).click();
        await expect(page.locator('text=task.schedule')).toBeVisible({ timeout: 5000 });

        await page.locator('a', { hasText: 'Edit' }).click();
        await expect(page.locator('text=Edit Config Value')).toBeVisible();

        await page.locator('.card input.form-control').fill('0 12 * * *');
        await page.locator('button', { hasText: 'Save' }).click();
        await page.waitForTimeout(300);

        expect(savedBody?.id).toBe('task.schedule');
        expect(savedBody?.value).toBe('0 12 * * *');
    });

    test('Dynamic Config tab: Cancel closes the edit dialog without saving', async ({ page }) => {
        await gotoAtlasAdmin(page);
        await page.locator('button[role="tab"]', { hasText: 'Dynamic Config' }).click();
        await expect(page.locator('text=task.schedule')).toBeVisible({ timeout: 5000 });

        await page.locator('a', { hasText: 'Edit' }).click();
        await expect(page.locator('text=Edit Config Value')).toBeVisible();
        await page.locator('button', { hasText: 'Cancel' }).click();
        await expect(page.locator('text=Edit Config Value')).toBeHidden();
    });
});
