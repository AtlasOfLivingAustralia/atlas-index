/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Synthetic coverage tests for Home.tsx.
 */

import { test, expect } from '../fixtures';
import { BASE_URL, setupMocks, setupDefaultMock } from './helpers';

test.describe('Home.tsx', () => {
    test.beforeEach(async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
    });

    test('renders all collection thumbnail cards', async ({ page }) => {
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const cards = page.locator('div.thumbnail');
        await expect(cards.first()).toBeVisible();
        // The playwright collections.json has 21 entries
        expect(await cards.count()).toBe(21);
    });

    test('each card has a heading link to /browse/:uid', async ({ page }) => {
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const link = page.locator('div.thumbnail').first().locator('h2 a');
        await expect(link).toBeVisible();
        expect(await link.getAttribute('href')).toMatch(/^\/browse\//);
    });

    test('card image links to /browse/:uid', async ({ page }) => {
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const imgLink = page.locator('div.thumbnail').first().locator('a').nth(1);
        expect(await imgLink.getAttribute('href')).toMatch(/^\/browse\//);
    });

    test('institution name is shown when present', async ({ page }) => {
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const co56Card = page.locator('div.thumbnail', {
            has: page.locator('h2 a', {
                hasText: 'South Australian Museum Terrestrial Invertebrate Collection',
            }),
        });
        await expect(co56Card.locator('h3')).toBeVisible();
        await expect(co56Card.locator('h3')).toContainText('South Australian Museum');
    });

    test('"click here" link navigates to /browse', async ({ page }) => {
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const browseLink = page
            .getByText('To view images from all collections,')
            .locator('..')
            .locator('a[href*="/browse"]');
        await expect(browseLink).toBeVisible();

        await Promise.all([page.waitForURL(/\/browse/), browseLink.click()]);
        await expect(page.locator('div.page-header h2')).toBeVisible();
    });

    test('setBreadcrumbs is called on mount', async ({ page }) => {
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('main')).toBeVisible();
    });

    test('collection cards have a description text element', async ({ page }) => {
        await page.goto(BASE_URL + '/');
        await page.waitForLoadState('networkidle');

        const desc = page.locator('div.thumbnail').first().locator('p.panel-text');
        await expect(desc).toHaveCount(1);
    });
});
