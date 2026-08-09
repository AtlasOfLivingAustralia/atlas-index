import { Page } from '@playwright/test';
import { logMissingMocks } from './mocks/logMissingMocks';
import { staticServerMocks } from './mocks/staticServerMocks';
import { mockOsmTiles, mockWmsTiles, mockImages } from './mocks/imageMocks';
import { mockCommonApis, SESSION_ANONYMOUS, SESSION_USER, SESSION_ADMIN } from './mocks/apiMocks';
import { mockBiocacheSearch, mockQid, mockOccurrenceFacets, BiocacheSearchConfig, OccurrenceFacetsEntry } from './mocks/biocacheMocks';
import { getBaseUrl, isLiveMode } from './mocks/liveConfig';
import { expect } from './fixtures';

// Resolves to the live-config.json baseUrl when LIVE_CONFIG_PATH is set (see
// tests/mocks/liveConfig.ts), otherwise the standard mock-mode localhost URL.
// Evaluated once at module load, which happens after run-live-test.sh /
// run-playwright-test.sh have already set (or not set) the env var.
export const BASE_URL = getBaseUrl();

export { SESSION_ANONYMOUS, SESSION_USER, SESSION_ADMIN, mockWmsTiles, mockImages };

export interface SetupMocksOptions {
    session?: object;
    biocache?: BiocacheSearchConfig;
    occurrenceFacets?: Record<string, OccurrenceFacetsEntry>;
}

/**
 * Full default mock setup: catch-all guard + OSM tiles (mounted eagerly on EVERY
 * page via OccurrenceSearch.tsx's Spatial tab -- see imageMocks.ts's mockOsmTiles
 * comment) + session + data-quality profiles + biocache search/facets dispatchers.
 *
 * Registered in mock-registration-priority order (Playwright resolves routes in
 * reverse-registration order, so logMissingMocks -- the catch-all -- must be first).
 *
 * Short-circuits entirely in live mode so acceptance.spec.ts tests can run against
 * a real deployed environment unmocked (see search-ui's PLAYWRIGHT_TEST.md Phase 7
 * for why this guard belongs here rather than being added later as a bug fix).
 */
export async function setupMocks(page: Page, options: SetupMocksOptions = {}): Promise<Set<URL>> {
    const seenUrls = new Set<URL>();
    if (isLiveMode()) return seenUrls;

    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await mockOsmTiles(page, seenUrls);
    await mockCommonApis(page, seenUrls, options.session ?? SESSION_ANONYMOUS);
    await mockBiocacheSearch(page, seenUrls, options.biocache ?? {});
    await mockOccurrenceFacets(page, seenUrls, options.occurrenceFacets ?? {});
    await mockQid(page, seenUrls);
    return seenUrls;
}

/** Navigate and wait for networkidle. */
export async function load(page: Page, url: string = BASE_URL) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
}

/**
 * Navigate directly to the results page for a given `q` and wait for the main
 * list to actually render (see acceptance.spec.ts's note on why
 * waitForLoadState('networkidle') is unreliable for this page: DQ profile fetch
 * -> qualityProfile redirect -> main list fetch is a multi-step async chain).
 * `waitForText` should be some text guaranteed to appear in the mocked results
 * (defaults to the acacia fixture's first record).
 */
export async function loadResults(page: Page, q: string = 'taxa:"acacia"', waitForText: string = 'Acacia dealbata') {
    await page.goto(`${BASE_URL}/occurrences/search?q=${encodeURIComponent(q)}`);
    await expect(page.getByText(waitForText)).toBeVisible({ timeout: 15000 });
}
