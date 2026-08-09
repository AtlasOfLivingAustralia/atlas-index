/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Page } from '@playwright/test';

// these will be running, see run-playwright-test.sh (ports are randomly selected
// there and passed through via env vars; fall back to the historical defaults for
// ad-hoc/local runs)
const appPort = process.env.PLAYWRIGHT_APP_PORT ?? '5173';
// static-server (port 8082) is not a real server in tests -- its content is
// served via staticServerMocks.ts's page.route interception instead, so it
// does not need to be an allowed origin here.
const allowedOrigins = new Set<string>([`http://localhost:${appPort}`]);

// known external URLs that are safe to block and will not be logged
const knownExternalUrlPrefixes = [
    'https://cdn.usefathom.com/script.js',
    'https://s3.amazonaws.com/assets.freshdesk.com/widget/freshwidget.js',
    'https://www.ala.org.au/app/uploads/',
    'https://www.ala.org.au/app/themes/',
    // ala-combined.css (common-ui banner/footer styling) pulls in Google Fonts
    'https://fonts.googleapis.com/',
    'https://fonts.gstatic.com/',
];
// NOTE: http://localhost:8081 is intentionally NOT listed here.
// Any call to localhost:8081 (including /session) must be explicitly mocked.
// If it appears in a test run without a mock, logMissingMocks will throw,
// making the missing mock visible immediately.

// Log any missing mocks. Apply before other mocks to prevent it from intercepting other implemented mocks.
export async function logMissingMocks(page: Page, seenUrls: Set<URL>) {
    // Catch everything else and block unless seen before or in allowed origins or OK to block
    await page.route('**/*', async route => {
        const url = route.request().url();
        const origin = new URL(url).origin;

        for (let seen of Array.from(seenUrls)) {
            if (url === seen.toString()) {
                console.log(`Seen: ${JSON.stringify(seen)}`);
                return route.continue();
            }
        }

        if (allowedOrigins.has(origin)) {
            return route.continue();
        }

        for (let knownUrlPrefix of Array.from(knownExternalUrlPrefixes)) {
            if (url.startsWith(knownUrlPrefix)) {
                return route.abort();
            }
        }

        throw new Error(`[New URL that requires Mocking or Blocking] ${route.request().method()} ${url}`);
    });
}
