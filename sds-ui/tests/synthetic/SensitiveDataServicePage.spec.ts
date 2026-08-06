/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Synthetic coverage tests for SensitiveDataServicePage.tsx.
 */

import { test, expect } from '../fixtures';
import {
    BASE_URL,
    setupMocks,
    setupDefaultMock,
    setupNoLastModifiedMock,
    setupHttpErrorMock,
    setupAbortMock,
} from './helpers';

test.describe('SensitiveDataServicePage.tsx', () => {
    test('shows a formatted date once the Last-Modified header resolves', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const el = page.locator('#xmlLastModified');
        await expect(async () => {
            expect(await el.innerText()).not.toBe('(loading...)');
        }).toPass({ timeout: 10000 });
        expect(await el.innerText()).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    test('shows a message when the Last-Modified header is missing', async ({ page }) => {
        await setupMocks(page, setupNoLastModifiedMock);
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const el = page.locator('#xmlLastModified');
        await expect(el).toHaveText('[Last-Modified header not available]', { timeout: 10000 });
    });

    test('shows an error message when the fetch response is not ok', async ({ page }) => {
        await setupMocks(page, setupHttpErrorMock);
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const el = page.locator('#xmlLastModified');
        await expect(async () => {
            expect(await el.innerHTML()).toContain('Error');
        }).toPass({ timeout: 10000 });
        await expect(el.locator('code')).toHaveText('Failed to fetch file information');
    });

    test('shows an error message when the network request fails outright', async ({ page }) => {
        await setupMocks(page, setupAbortMock);
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        // Browser-level network errors ("Failed to fetch" / "NetworkError...") differ by engine,
        // so only assert the generic "Error:" prefix, not the exact message text.
        const el = page.locator('#xmlLastModified');
        await expect(async () => {
            expect(await el.innerHTML()).toContain('Error');
        }).toPass({ timeout: 10000 });
    });

    test('setBreadcrumbs is called on mount with Home and page title', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const items = page.locator('#breadcrumb li.breadcrumb-item');
        await expect(items).toHaveCount(2);
        await expect(items.first()).toHaveText('Home');
        await expect(items.last()).toHaveText('Sensitive Data Service');
    });

    test('resource links point at the sensitive-ws endpoints', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const rows = page.locator('table.table tbody tr');
        await expect(rows).toHaveCount(4);
        expect(await rows.nth(1).locator('a').getAttribute('href')).toMatch(/\/categories$/);
        expect(await rows.nth(2).locator('a').getAttribute('href')).toMatch(/\/zones$/);
        expect(await rows.nth(3).locator('a').getAttribute('href')).toMatch(/\/layers$/);
    });
});
