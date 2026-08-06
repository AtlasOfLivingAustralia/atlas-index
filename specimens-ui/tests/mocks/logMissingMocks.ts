/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Page } from '@playwright/test';

const appPort = process.env.PLAYWRIGHT_APP_PORT ?? '5173';
const allowedOrigins = new Set<string>([`http://localhost:${appPort}`]);

// known external URLs that are safe to block and will not be logged
const knownExternalUrlPrefixes = ['https://cdn.usefathom.com/script.js', 'https://s3.amazonaws.com/assets.freshdesk.com/widget/freshwidget.js', 'https://www.ala.org.au/app/uploads/', 'https://www.ala.org.au/app/themes/'];

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
