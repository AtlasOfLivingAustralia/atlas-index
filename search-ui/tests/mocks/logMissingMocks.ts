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
// Anything under static.test.ala.org.au that IS explicitly mocked (taxon-descriptions,
// taxon-traits, taxon-bhl, taxon-map) is registered in staticContentMocks.ts, which is
// added to `seenUrls` and/or registered after this function, so it takes precedence.
const knownExternalUrlPrefixes = [
    'https://cdn.usefathom.com/',
    'https://www.ala.org.au/app/uploads/',
    'https://www.ala.org.au/app/themes/',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://bie.test.ala.org.au',              // Header's search-box form target, not fetched via JS
    'https://static.test.ala.org.au/images/',   // featuredPages.json / onlineResources.json / austraits logo decorative images
];

// Log any missing mocks. Register FIRST (lowest Playwright priority) so that
// specific mocks registered later take precedence.
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
