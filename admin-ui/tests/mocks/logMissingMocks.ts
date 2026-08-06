import { Page } from '@playwright/test';

// These origins are served locally during tests (ports are randomly selected by
// run-playwright-test.sh and passed through via env vars; fall back to the
// historical defaults for ad-hoc/local runs).
const appPort = process.env.PLAYWRIGHT_APP_PORT ?? '5173';
// static-server (port 8082) is not a real server in tests -- its content is
// served via staticServerMocks.ts's page.route interception instead, so it
// does not need to be an allowed origin here.
const allowedOrigins = new Set<string>([`http://localhost:${appPort}`]);

// Known external URLs that are safe to silently abort
const knownExternalUrlPrefixes = [
    'https://cdn.usefathom.com/',
    'https://s3.amazonaws.com/assets.freshdesk.com/',
    'https://www.ala.org.au/app/uploads/',
    'https://www.ala.org.au/app/themes/',
    'https://fonts.googleapis.com',
    'https://bie.test.ala.org.au', // search prefix used in Header
];

// Log any missing mocks. Register FIRST (lowest Playwright priority) so that
// specific mocks registered later take precedence.
export async function logMissingMocks(page: Page, seenUrls: Set<URL>) {
    await page.route('**/*', async (route) => {
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
