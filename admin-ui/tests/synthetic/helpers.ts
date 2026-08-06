/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Shared fixtures, mock data and helper functions for the synthetic coverage specs.
 */

import { Page } from '@playwright/test';
import { logMissingMocks } from '../mocks/logMissingMocks';
import { staticServerMocks } from '../mocks/staticServerMocks';
import { mockSession, SESSION_ADMIN } from '../mocks/apiMocks';

export const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_APP_PORT ?? '5173'}`;
export const API = 'http://localhost:8081';

/**
 * Set up the full mock stack. Routes are registered in this order so Playwright
 * (which tries handlers in reverse-registration order) prioritises the api
 * handlers over the logMissingMocks catch-all, and the session mock (registered
 * last) always wins.
 */
export async function setupMocks(page: Page, apiSetup: (page: Page, seenUrls: Set<URL>) => Promise<void>, sessionData: object = SESSION_ADMIN) {
    const seenUrls = new Set<URL>();
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await apiSetup(page, seenUrls);
    await mockSession(page, seenUrls, sessionData);
    return seenUrls;
}

/** Home page mocks — always needed since every route is reached via "/" first. */
export async function mockHomeInfo(page: Page, seenUrls: Set<URL>) {
    await page.route(`${API}/admin/info`, (route) => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route(`${API}/admin/test`, (route) => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
}

export async function goHome(page: Page) {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
}

export async function clickMenu(page: Page, label: string) {
    await page.locator('a.menu-link', { hasText: label }).click();
}
