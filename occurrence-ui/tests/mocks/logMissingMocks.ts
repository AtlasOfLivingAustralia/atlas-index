import { Page } from '@playwright/test';

// These origins are served locally during tests (ports are randomly selected by
// run-playwright-test.sh and passed through via env vars; fall back to the
// historical defaults for ad-hoc/local runs).
const appPort = process.env.PLAYWRIGHT_APP_PORT ?? '5173';
// static-server (port 8082) is not a real server in tests -- its content is
// served via staticServerMocks.ts's page.route/page.context().route
// interception instead, so it does not need to be an allowed origin here.
const allowedOrigins = new Set<string>([`http://localhost:${appPort}`]);

// Known external URLs that are safe to silently abort (decorative/unused in tests).
// Anything that IS explicitly mocked (biocache-ws, images, spatial, collectory,
// events, alerts, namematching) is registered in its own mocks/*.ts file, which adds
// to `seenUrls` and/or is registered after this function, so it takes precedence.
const knownExternalUrlPrefixes = [
    'https://cdn.usefathom.com/',
    'https://www.ala.org.au/app/uploads/',
    'https://www.ala.org.au/app/themes/',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://bie.test.ala.org.au',   // header search-box form target + species href links, not fetched via JS
];

// Registered on the BROWSER CONTEXT (not the page) so that popup windows opened via
// window.open() -- e.g. image-service links, spatial-portal "more info" links, BHL
// links -- inherit both the mocks and this catch-all throw. Page-scoped routes are
// silently bypassed by popups (see search-ui's PLAYWRIGHT_TEST.md for the discovery).
//
// Register FIRST (lowest Playwright priority) so that specific mocks registered
// later take precedence.
export async function logMissingMocks(page: Page, seenUrls: Set<URL>) {
    await page.context().route('**/*', async (route) => {
        const url = route.request().url();
        const origin = new URL(url).origin;

        for (const seen of seenUrls) {
            if (url === seen.toString()) {
                return route.continue();
            }
        }

        if (allowedOrigins.has(origin)) {
            return route.continue();
        }

        for (const prefix of knownExternalUrlPrefixes) {
            if (url.startsWith(prefix)) {
                return route.abort();
            }
        }

        throw new Error(`[New URL that requires Mocking or Blocking] ${route.request().method()} ${url}`);
    });
}
