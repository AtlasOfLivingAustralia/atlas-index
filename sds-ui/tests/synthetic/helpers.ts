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
import { mockSensitiveSpeciesXml, mockSession, sensitiveSpeciesXmlUrl, MOCK_XML_LAST_MODIFIED } from '../mocks/apiServiceMocks';

export const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_APP_PORT ?? '5173'}`;
export { sensitiveSpeciesXmlUrl, MOCK_XML_LAST_MODIFIED };

/**
 * Set up the full mock stack. Routes are registered in this order so Playwright
 * (which tries handlers in reverse-registration order) prioritises the api
 * handler over the logMissingMocks catch-all.
 */
export async function setupMocks(page: Page, xmlSetup: (page: Page, seenUrls: Set<URL>) => Promise<void>) {
    const seenUrls = new Set<URL>();
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await xmlSetup(page, seenUrls);
    // Session must be mocked last so it wins over the logMissingMocks catch-all.
    await mockSession(page, seenUrls);
    return seenUrls;
}

/** Default: XML fetch resolves 200 with a Last-Modified header. */
export async function setupDefaultMock(page: Page, seenUrls: Set<URL>) {
    await mockSensitiveSpeciesXml(page, seenUrls);
}

/** XML fetch resolves 200 OK but without a Last-Modified header — exercises the "header not available" branch. */
export async function setupNoLastModifiedMock(page: Page, seenUrls: Set<URL>) {
    await mockSensitiveSpeciesXml(page, seenUrls, null);
}

/** XML fetch resolves with a non-ok status — exercises the thrown "Failed to fetch file information" branch. */
export async function setupHttpErrorMock(page: Page, seenUrls: Set<URL>) {
    seenUrls.add(new URL(sensitiveSpeciesXmlUrl));
    await page.route(sensitiveSpeciesXmlUrl, (route) =>
        route.fulfill({ status: 500, contentType: 'application/xml', body: '' })
    );
}

/** XML fetch fails at the network level — exercises the generic catch(error) branch. */
export async function setupAbortMock(page: Page, seenUrls: Set<URL>) {
    seenUrls.add(new URL(sensitiveSpeciesXmlUrl));
    await page.route(sensitiveSpeciesXmlUrl, (route) => route.abort('failed'));
}
