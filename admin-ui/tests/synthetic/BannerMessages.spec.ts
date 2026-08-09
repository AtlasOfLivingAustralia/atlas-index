import { test, expect } from '../fixtures';
import { setupMocks, mockHomeInfo, goHome, clickMenu, API } from './helpers';

const bannerData = {
    admin: { message: 'Existing message', severity: 'INFO', updated: '2026-07-01T00:00:00Z', closable: true },
};

test.describe('BannerMessages.tsx — synthetic', () => {

    test('fetch error shows the error alert', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/v2/banner`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 500, body: '' });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Banner Messages');

        await expect(page.locator('text=Failed to load banner data')).toBeVisible({ timeout: 5000 });
    });

    test('entering a disallowed tag shows a validation error and disables Save', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/v2/banner`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bannerData) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Banner Messages');
        await expect(page.locator('textarea#admin-msg')).toBeVisible({ timeout: 5000 });

        await page.locator('textarea#admin-msg').fill('<script>alert(1)</script>');
        await expect(page.locator('text=Disallowed tag or attribute')).toBeVisible();
        await expect(page.locator('button', { hasText: 'Save' })).toBeDisabled();
    });

    test('editing the message, saving successfully shows "Saved" status', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/v2/banner`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bannerData) });
            });
            await page.route(`${API}/admin/banner`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Banner Messages');
        await expect(page.locator('textarea#admin-msg')).toBeVisible({ timeout: 5000 });

        await page.locator('textarea#admin-msg').fill('Updated <b>message</b>');
        await page.locator('button', { hasText: 'Save' }).click();
        await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });
    });

    test('save failure shows "Failed" status', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/v2/banner`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bannerData) });
            });
            await page.route(`${API}/admin/banner`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 500, body: '' });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Banner Messages');
        await expect(page.locator('textarea#admin-msg')).toBeVisible({ timeout: 5000 });

        await page.locator('textarea#admin-msg').fill('Updated message');
        await page.locator('button', { hasText: 'Save' }).click();
        await expect(page.locator('text=Failed')).toBeVisible({ timeout: 5000 });
    });

    test('preview toggle shows and hides the rendered banner', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/v2/banner`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bannerData) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Banner Messages');
        await expect(page.locator('textarea#admin-msg')).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Preview' }).click();
        await expect(page.locator('.alert-info', { hasText: 'Existing message' })).toBeVisible();
        await page.locator('button', { hasText: 'Hide Preview' }).click();
        await expect(page.locator('.alert-info', { hasText: 'Existing message' })).toBeHidden();
    });

    test('discard reverts an unsaved edit', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/v2/banner`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bannerData) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Banner Messages');
        await expect(page.locator('textarea#admin-msg')).toBeVisible({ timeout: 5000 });

        await page.locator('textarea#admin-msg').fill('a temporary edit');
        await page.locator('button', { hasText: 'Discard' }).click();
        await expect(page.locator('textarea#admin-msg')).toHaveValue('Existing message');
    });

    test('empty message shows the "banner hidden" preview note', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/v2/banner`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bannerData) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Banner Messages');
        await expect(page.locator('textarea#admin-msg')).toBeVisible({ timeout: 5000 });

        await page.locator('textarea#admin-msg').fill('');
        await page.locator('button', { hasText: 'Preview' }).click();
        await expect(page.locator('text=empty message — banner will be hidden')).toBeVisible();
    });
});
