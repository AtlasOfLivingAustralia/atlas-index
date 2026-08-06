/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Page } from '@playwright/test';

// Resolved from .env.playwright (loaded by playwright.config.ts before tests run).
// Falls back to the same value so tests still work if invoked without the config loaded.
export const sensitiveSpeciesXmlUrl =
    process.env.VITE_APP_SENSITIVE_SPECIES_XML_URL ?? 'https://sensitive-ws-test.ala.org.au/sensitive-species-data.xml';

// Fixed date used for the mock Last-Modified header on the sensitive-species-data.xml file.
export const MOCK_XML_LAST_MODIFIED = 'Wed, 21 Oct 2015 07:28:00 GMT';

export async function apiMocks(page: Page, seenUrls: Set<URL>) {
    /**
     * Mock the sensitive-species-data.xml file. SensitiveDataServicePage.tsx
     * only reads the Last-Modified response header from this request — the
     * body content itself is never inspected.
     */
    await mockSensitiveSpeciesXml(page, seenUrls);

    // Session must be mocked so checkLoginState does not reach the network.
    await mockSession(page, seenUrls);
}

/**
 * Mock the sensitive-species-data.xml file fetch.
 *
 * @param lastModified  The Last-Modified header value to return, or null to omit the header entirely.
 */
export async function mockSensitiveSpeciesXml(page: Page, seenUrls: Set<URL>, lastModified: string | null = MOCK_XML_LAST_MODIFIED) {
    seenUrls.add(new URL(sensitiveSpeciesXmlUrl));
    await page.route(sensitiveSpeciesXmlUrl, route =>
        route.fulfill({
            status: 200,
            contentType: 'application/xml',
            headers: lastModified ? { 'last-modified': lastModified } : {},
            body: '<sensitiveSpeciesDataSets></sensitiveSpeciesDataSets>',
        })
    );
}

/**
 * Mock the /session endpoint so App.tsx's checkLoginState resolves cleanly
 * without a network connection. Returns an anonymous (not authenticated)
 * session — sds-ui does not require login to view its single page.
 *
 * Must be registered AFTER logMissingMocks so Playwright's
 * reverse-registration priority gives this mock higher priority than the
 * catch-all throw route.
 */
export async function mockSession(page: Page, seenUrls: Set<URL>) {
    const url = 'http://localhost:8081/session';
    seenUrls.add(new URL(url));
    await page.route(url, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ authenticated: false }),
        })
    );
}
