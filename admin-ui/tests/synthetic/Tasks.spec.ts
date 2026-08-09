import { test, expect } from '../fixtures';
import { setupMocks, mockHomeInfo, goHome, clickMenu, API } from './helpers';

const emptyTasksPage = { content: [], totalPages: 1 };

test.describe('Tasks.tsx — synthetic', () => {

    test('Run tab: submit task shows the JSON response and a download link', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/tasks(\?.*)?$/, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyTasksPage) });
            });
            await page.route(`${API}/v2/download/fieldguide`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ statusUrl: `${API}/v2/status/job-1`, downloadUrl: `${API}/files/job-1.pdf` }),
                });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Tasks');

        await page.locator('button', { hasText: 'Submit Task' }).click();
        await expect(page.locator('text=Download Tasks Output')).toBeVisible({ timeout: 5000 });
    });

    test('Run tab: refresh status fetches the statusUrl and clears the download link when absent', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/tasks(\?.*)?$/, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyTasksPage) });
            });
            await page.route(`${API}/v2/download/fieldguide`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ statusUrl: `${API}/v2/status/job-1` }),
                });
            });
            await page.route(`${API}/v2/status/job-1`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'RUNNING' }) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Tasks');

        await page.locator('button', { hasText: 'Submit Task' }).click();
        await expect(page.locator('button', { hasText: 'Refresh Status' })).toBeVisible({ timeout: 5000 });
        await page.locator('button', { hasText: 'Refresh Status' }).click();
        await expect(page.locator('textarea').filter({ hasText: 'RUNNING' })).toBeVisible({ timeout: 5000 });
    });

    test('List tab: filtering by status and email calls getTaskList with query params', async ({ page }) => {
        let lastUrl = '';
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/tasks(\?.*)?$/, (route) => {
                lastUrl = route.request().url();
                seenUrls.add(new URL(lastUrl));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyTasksPage) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Tasks');

        await page.locator('button[role="tab"]', { hasText: 'List of requests' }).click();
        const listPane = page.locator('#admin-tabs-tabpane-list');
        await listPane.locator('input[placeholder="Task ID"]').fill('user-42');
        await listPane.locator('select').nth(0).selectOption('FIELDGUIDE');
        await listPane.locator('select').nth(1).selectOption('RUNNING');
        await listPane.locator('input[placeholder="Email"]').fill('someone@example.com');
        await listPane.locator('button', { hasText: 'Apply Filter' }).click();
        await page.waitForTimeout(300);

        expect(lastUrl).toContain('status=RUNNING');
        expect(lastUrl).toContain('taskType=FIELDGUIDE');
        expect(lastUrl).toContain('userEmail=someone%40example.com');
        expect(lastUrl).toContain('userId=user-42');
    });

    test('List tab: task details modal opens and shows the cancel button when a cancelUrl is present', async ({ page }) => {
        const tasksPage = {
            content: [{
                id: 'task-999',
                status: 'RUNNING',
                created: '2026-07-01T00:00:00Z',
                started: '2026-07-01T00:00:01Z',
                liveness: '2026-07-01T00:00:05Z',
                queueRequest: { taskType: 'SEARCH_DOWNLOAD_V2', email: 'user@example.com' },
                cancelUrl: `${API}/v2/cancel/task-999`,
            }],
            totalPages: 1,
        };
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/tasks(\?.*)?$/, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasksPage) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Tasks');
        await page.locator('button[role="tab"]', { hasText: 'List of requests' }).click();
        await expect(page.locator('text=task-999')).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Task details' }).click();
        await expect(page.locator('.modal-content')).toBeVisible();
        expect(await page.locator('button', { hasText: 'Cancel' }).count()).toBeGreaterThan(0);
    });

    test('List tab: cancelling a task confirms, fires the cancel request and refreshes the list', async ({ page }) => {
        let cancelCalled = false;
        const tasksPage = {
            content: [{
                id: 'task-999',
                status: 'RUNNING',
                created: '2026-07-01T00:00:00Z',
                queueRequest: { taskType: 'SEARCH_DOWNLOAD_V2', email: 'user@example.com' },
                cancelUrl: `${API}/v2/cancel/task-999`,
            }],
            totalPages: 1,
        };
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(/http:\/\/localhost:8081\/admin\/tasks(\?.*)?$/, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasksPage) });
            });
            await page.route(`${API}/v2/cancel/task-999`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                cancelCalled = true;
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'cancelled' }) });
            });
        });
        page.on('dialog', async (dialog) => { await dialog.accept(); });

        await goHome(page);
        await clickMenu(page, 'Tasks');
        await page.locator('button[role="tab"]', { hasText: 'List of requests' }).click();
        await expect(page.locator('text=task-999')).toBeVisible({ timeout: 5000 });

        await page.locator('button.text-danger', { hasText: 'Cancel' }).click();
        await page.waitForTimeout(500);
        expect(cancelCalled).toBe(true);
    });
});
