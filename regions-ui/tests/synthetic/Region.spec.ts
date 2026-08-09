import { test, expect } from '../fixtures';
import { logMissingMocks } from '../mocks/logMissingMocks';
import { staticServerMocks } from '../mocks/staticServerMocks';
import { mockSession } from '../mocks/apiMocks';
import {
    BASE_URL,
    load,
    setupMapMocks,
    setupSpatialObjectMock,
    setupBieMock,
    setupRegionDetailMocks,
    actObjectResponse,
    speciesGroupsFixture,
    speciesFixture,
    kingdomsFixture,
} from './helpers';

const REGION_URL = `${BASE_URL}/region?id=8832857`;
const REGION_URL_21 = `${BASE_URL}/region?id=21654846#layer=States+and+territories&region=AUSTRALIAN+CAPITAL+TERRITORY`;

// ---------------------------------------------------------------------------
// Region.tsx — branches NOT covered by the acceptance tests
// ---------------------------------------------------------------------------

test.describe('Region.tsx — loading spinner', () => {
    // -----------------------------------------------------------------------
    // While occurrenceCount < 0 (before the biocache response arrives)
    // the loading spinner is rendered. Acceptance tests only see the fully-
    // loaded state. We delay the biocache response to observe the spinner.
    // -----------------------------------------------------------------------
    test('displays loading spinner before biocache data arrives', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await setupMapMocks(page, seenUrls);
        await setupSpatialObjectMock(page, seenUrls);
        await setupBieMock(page, seenUrls);

        // Delay biocache so the spinner is visible before data arrives.
        await page.route('**/biocache-ws*.ala.org.au/ws/occurrences/search**', async (route) => {
            const url = new URL(route.request().url());
            seenUrls.add(url);
            await new Promise(r => setTimeout(r, 400));
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(speciesGroupsFixture),
            });
        });

        // Session must be mocked so checkLoginState does not leak to the network.
        await mockSession(page, seenUrls);

        await page.goto(REGION_URL);
        // Spinner must be visible before network settles.
        const spinner = page.locator('[class*="pageLoading"]');
        await expect(spinner).toBeVisible({ timeout: 3000 });

        // After data arrives the spinner disappears and content renders.
        await page.waitForLoadState('networkidle');
        await expect(spinner).toBeHidden();
        await expect(page.locator('h2', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' })).toBeVisible();
    });
});

test.describe('Region.tsx — fetchObject no bbox branch', () => {
    // -----------------------------------------------------------------------
    // When the spatial object response has no bbox field, fetchObject's
    // `if (data && data.bbox)` guard fails. The page stays in the loading
    // state (counts remain -1) and the spinner never goes away.
    // -----------------------------------------------------------------------
    test('stays on loading spinner when spatial object has no bbox', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await setupMapMocks(page, seenUrls);

        // Return object WITHOUT a bbox field.
        const noBboxResponse = { ...actObjectResponse };
        delete (noBboxResponse as any).bbox;
        await setupSpatialObjectMock(page, seenUrls, noBboxResponse as any);
        await setupBieMock(page, seenUrls);

        // Session must be mocked so checkLoginState does not leak to the network.
        await mockSession(page, seenUrls);

        await page.goto(REGION_URL);
        await page.waitForTimeout(1500);

        // Main content (h2 with region name) must NOT appear.
        expect(await page.locator('h2', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' }).count()).toBe(0);
    });
});

test.describe('Region.tsx — biocache returns no facet results', () => {
    // -----------------------------------------------------------------------
    // Branch B in fetchObject: biocache returns a response with no
    // facetResults (or empty first facetResults). The app sets all counts
    // to 0 and renders "0" in the headings rather than real data.
    // -----------------------------------------------------------------------
    test('renders zero counts when biocache returns no facet results', async ({ page }) => {
        const noFacetsResponse = {
            pageSize: 0, startIndex: 0, totalRecords: 0,
            status: 'OK', occurrences: [], facetResults: [],
        };

        await setupRegionDetailMocks(page, {
            speciesGroups: noFacetsResponse,
            species: noFacetsResponse,
            kingdoms: noFacetsResponse,
        });

        await load(page, REGION_URL);

        // Occurrence count heading should show 0.
        await expect(page.locator('h3', { hasText: 'Occurrence records (0)' })).toBeVisible();
        // Species count heading should show 0.
        await expect(page.locator('h3', { hasText: 'Number of species (0)' })).toBeVisible();
        // No species list items.
        const noSpeciesMsg = page.locator('text=No species found');
        await expect(noSpeciesMsg).toBeVisible();
    });

    // -----------------------------------------------------------------------
    // Chart shows "no data" state (empty labels array) when facet results
    // are absent. The JSX branch:
    //   chartData !== undefined && Object.keys(chartData).length === 1 → show "No data"
    // -----------------------------------------------------------------------
    test('taxonomy chart shows no-data state when facet results are absent', async ({ page }) => {
        const noFacetsResponse = {
            pageSize: 0, startIndex: 0, totalRecords: 0,
            status: 'OK', occurrences: [], facetResults: [],
        };

        await setupRegionDetailMocks(page, {
            speciesGroups: noFacetsResponse,
            species: noFacetsResponse,
            kingdoms: noFacetsResponse,
        });

        await load(page, REGION_URL);

        // Switch to the taxonomy tab to reveal the chart area.
        const taxonomyTab = page.getByRole('tab', { name: 'Explore by taxonomy' });
        await expect(taxonomyTab).toBeVisible();
        await taxonomyTab.click();

        // The chart container should be visible.
        const chartContainer = page.locator('div[data-testid="taxonChartContainer"]');
        await expect(chartContainer).toBeVisible();

        // No data branch: no <canvas> rendered (or canvas hidden), "No data" text shown.
        const noDataMsg = chartContainer.locator('text=No data');
        await expect(noDataMsg).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Region.tsx — filterSpecies paths', () => {
    // -----------------------------------------------------------------------
    // filterSpecies() has two branches for the biocache fq it constructs:
    //   1. group !== ALL_SPECIES: includes both group fq AND species fq
    //   2. group === ALL_SPECIES (default): includes only species fq
    //
    // The acceptance tests only test path 2 (the default group).
    // We need path 1: first filter to a non-default group, then click a species.
    // -----------------------------------------------------------------------
    test('filterSpecies with a non-default group includes both group and species fq', async ({ page }) => {
        const capturedUrls: string[] = [];

        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await setupMapMocks(page, seenUrls);
        await setupSpatialObjectMock(page, seenUrls);
        await setupBieMock(page, seenUrls);

        await page.route('**/biocache-ws*.ala.org.au/ws/occurrences/search**', async (route) => {
            const url = new URL(route.request().url());
            seenUrls.add(url);
            capturedUrls.push(url.href);

            const facets = url.searchParams.get('facets');
            const fqs = url.searchParams.getAll('fq');
            const searchOccurrences = fqs.some(f => f.startsWith('species:'));

            let response;
            if (facets === 'species,decade') response = speciesFixture;
            else if (facets === 'kingdom,decade') response = kingdomsFixture;
            else if (facets === 'speciesGroup,decade') response = speciesGroupsFixture;
            else if (searchOccurrences) response = { pageSize: 1, totalRecords: 1, status: 'OK', occurrences: [{ taxonConceptID: 'urn:test:1' }], facetResults: [] };
            else response = speciesGroupsFixture;

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(response),
            });
        });

        // Session must be mocked so checkLoginState does not leak to the network.
        await mockSession(page, seenUrls);

        await load(page, REGION_URL_21);

        // Click a non-default species group to filter (Animals is always present).
        const animalsGroup = page.locator('div.speciesItem', { hasText: 'Animals' });
        await expect(animalsGroup).toBeVisible({ timeout: 5000 });
        await animalsGroup.click();
        await page.waitForTimeout(800);

        // Now click the first species in the filtered list.
        const firstSpecies = page.locator('div[class^="_speciesName_"]').first();
        await expect(firstSpecies).toBeVisible({ timeout: 5000 });
        await firstSpecies.click();
        await page.waitForTimeout(400);

        // Action buttons should appear (species was selected).
        await expect(page.locator('button', { hasText: 'List records' })).toBeVisible({ timeout: 3000 });

        // At least one biocache URL must contain both a speciesGroup fq
        // AND a species fq — confirming the group+species branch was taken.
        const hasGroupAndSpecies = capturedUrls.some(url => {
            const parsed = new URL(url);
            const fqs = parsed.searchParams.getAll('fq');
            return fqs.some(f => f.startsWith('speciesGroup:')) && fqs.some(f => f.startsWith('species:'));
        });
        expect(hasGroupAndSpecies).toBeTruthy();
    });
});

test.describe('Region.tsx — player pause and stop', () => {
    // -----------------------------------------------------------------------
    // The acceptance test exercises play+auto-advance only.
    // We need to cover the playerPause() and playerStop() branches.
    // -----------------------------------------------------------------------
    test('pause button stops player and shows paused state', async ({ page }) => {
        await setupRegionDetailMocks(page);
        await load(page, REGION_URL_21);

        const minSlider = page.locator('[data-testid="rangeSelection"]').locator('..').locator('button[aria-label="minimum"]');
        await expect(minSlider).toBeVisible({ timeout: 5000 });

        // Start playing.
        await page.locator('i.bi.bi-play').click();

        // The pause icon (bi-pause) appears while playing — click it.
        const pauseIcon = page.locator('i.bi.bi-pause');
        await expect(pauseIcon).toBeVisible({ timeout: 3000 });
        await pauseIcon.click();

        // After pause, the play icon should reappear (player is not playing).
        await expect(page.locator('i.bi.bi-play')).toBeVisible({ timeout: 3000 });
    });

    test('stop button resets player to stopped state', async ({ page }) => {
        await setupRegionDetailMocks(page);
        await load(page, REGION_URL_21);

        const minSlider = page.locator('[data-testid="rangeSelection"]').locator('..').locator('button[aria-label="minimum"]');
        await expect(minSlider).toBeVisible({ timeout: 5000 });

        // Start playing.
        await page.locator('i.bi.bi-play').click();

        // Stop button (bi-stop) is always present when player is available.
        const stopIcon = page.locator('i.bi.bi-stop');
        await expect(stopIcon).toBeVisible({ timeout: 3000 });
        await stopIcon.click();

        // After stop, the play icon should be present and no fill-play.
        await expect(page.locator('i.bi.bi-play')).toBeVisible({ timeout: 3000 });
        expect(await page.locator('i.bi.bi-play-fill').count()).toBe(0);
    });
});

test.describe('Region.tsx — playerReset', () => {
    // -----------------------------------------------------------------------
    // playerReset() is called when the player reaches the end (all decades
    // exhausted). It stops the player and resets yearMin/yearMax to the full
    // range.
    //
    // playerPlay() always starts from groupMinYear, not from the current
    // slider position. groupMinYear is set from the decade facet of THREE
    // independent, concurrently-fired biocache responses:
    //   - the initial speciesGroup,decade call (fetchObject)
    //   - every species,decade call (fetchSpeciesList)
    //   - every kingdom,decade call (fetchChartData)
    // fetchSpeciesList and fetchChartData are fired without awaiting each
    // other, so whichever resolves last wins the ref value. All three must
    // agree on a single near-current-year decade (2020) or groupMinYear can
    // race back to the fixtures' real minimum (1820), making the player run
    // for 20+ intervals instead of 1 — this raced in Chromium/WebKit even
    // though Firefox happened to resolve promises in a favourable order.
    // -----------------------------------------------------------------------
    test('player auto-stops and resets when it reaches the current year', async ({ page }) => {
        // Build minimal biocache responses with only the 2020 decade so
        // groupMinYear is set near the current year — the player stops after
        // one interval (~1 s) rather than after 20+ intervals from 1820.
        const singleDecadeFacet = {
            fieldName: 'decade',
            fieldResult: [{ label: '2020', i18nCode: 'decade.2020', count: 100, fq: 'decade:"2020"' }],
        };
        const speciesGroupsNearEnd = {
            ...speciesGroupsFixture,
            facetResults: [
                speciesGroupsFixture.facetResults[0], // speciesGroup facet unchanged
                singleDecadeFacet,
            ],
        };
        const speciesNearEnd = {
            ...speciesFixture,
            facetResults: [
                speciesFixture.facetResults[0], // species facet unchanged
                singleDecadeFacet,
            ],
        };
        const kingdomsNearEnd = {
            ...kingdomsFixture,
            facetResults: [
                kingdomsFixture.facetResults[0], // kingdom facet unchanged
                singleDecadeFacet,
            ],
        };

        await setupRegionDetailMocks(page, {
            speciesGroups: speciesGroupsNearEnd,
            species: speciesNearEnd,
            kingdoms: kingdomsNearEnd,
        });
        await load(page, REGION_URL_21);

        await expect(page.locator('i.bi.bi-play')).toBeVisible({ timeout: 5000 });

        // Start playing — groupMinYear=2020 so the player exhausts all decades
        // after one interval and calls playerStop().
        await page.locator('i.bi.bi-play').click();

        // Wait for the player to auto-stop (bi-play reappears, bi-play-fill gone).
        await expect(page.locator('i.bi.bi-play')).toBeVisible({ timeout: 8000 });
        expect(await page.locator('i.bi.bi-play-fill').count()).toBe(0);
    });
});

test.describe('Region.tsx — openDownloadLink', () => {
    // -----------------------------------------------------------------------
    // openDownloadLink() opens window.open with a biocache-hub download URL.
    // The acceptance tests only test openBiocacheForSpecies and openSpeciesPage.
    //
    // We intercept the download URL at the browser-context level (covering the
    // popup page) so the request never hits the real network and no redirect
    // to login occurs. The popup's initial URL is what we assert on.
    // -----------------------------------------------------------------------
    test('download records button opens a new tab with a download URL', async ({ page, context }) => {
        // Capture the URL that the popup is opened with before any redirect.
        let capturedDownloadUrl: string | null = null;
        await context.route('**/biocache*.ala.org.au/download/**', async (route) => {
            capturedDownloadUrl = route.request().url();
            await route.fulfill({ status: 200, contentType: 'text/html', body: '<html lang="en"><body>download</body></html>' });
        });

        await setupRegionDetailMocks(page);
        await load(page, REGION_URL_21);

        await expect(page.locator('h2', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' })).toBeVisible({ timeout: 5000 });

        const downloadBtn = page.locator('button', { hasText: 'Download records' });
        await expect(downloadBtn).toBeVisible({ timeout: 5000 });

        const [newPage] = await Promise.all([
            page.waitForEvent('popup'),
            downloadBtn.click(),
        ]);

        await newPage.waitForLoadState('load');
        await expect(newPage).not.toBeNull();
        // The URL must reference a download endpoint (biocache-hub or similar).
        expect(capturedDownloadUrl ?? newPage.url()).toMatch(/download/i);
    });
});

test.describe('Region.tsx — createAlert', () => {
    // -----------------------------------------------------------------------
    // createAlert() opens the ALA alerts app in a new tab.
    // Not exercised by any acceptance test.
    // -----------------------------------------------------------------------
    test('create alert button opens a new tab with the alerts URL', async ({ page }) => {
        await setupRegionDetailMocks(page);
        await load(page, REGION_URL_21);

        await expect(page.locator('h2', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' })).toBeVisible({ timeout: 5000 });

        const alertBtn = page.locator('button', { hasText: /alert/i });
        await expect(alertBtn).toBeVisible({ timeout: 5000 });

        const [newPage] = await Promise.all([
            page.waitForEvent('popup'),
            alertBtn.click(),
        ]);

        await expect(newPage).not.toBeNull();
        const alertUrl = newPage.url();
        expect(alertUrl).toMatch(/alert/i);
    });
});

test.describe('Region.tsx — drillUpChart back to root', () => {
    // -----------------------------------------------------------------------
    // The acceptance test drills down once (clicks Animalia) and verifies the
    // "Previous rank" button then clicks it once. We need to also verify that
    // clicking "Previous rank" when currentRank reaches 0 hides the button
    // (the `currentRank > 0` JSX guard).
    // -----------------------------------------------------------------------
    test('Previous rank button disappears after drilling back to kingdom level', async ({ page }) => {
        await setupRegionDetailMocks(page);
        await load(page, REGION_URL_21);

        const taxonomyTab = page.getByRole('tab', { name: 'Explore by taxonomy' });
        await expect(taxonomyTab).toBeVisible({ timeout: 5000 });
        await taxonomyTab.click();

        const chartContainer = page.locator('div[data-testid="taxonChartContainer"]');
        await expect(chartContainer).toBeVisible();
        const canvas = chartContainer.locator('canvas');
        await expect(canvas).toBeVisible();
        const bbox = await canvas.boundingBox();

        // Click the chart to drill into a kingdom.
        const centerX = bbox!.x + bbox!.width / 2;
        const centerY = bbox!.y + bbox!.height / 2;
        await page.mouse.move(centerX, centerY);
        await page.waitForTimeout(1000);
        await page.mouse.click(centerX, centerY);

        const previousRankBtn = page.locator('button', { hasText: 'Previous rank' });
        await expect(previousRankBtn).toBeVisible({ timeout: 5000 });

        // Click "Previous rank" — drills back to rank 0 (kingdom).
        await previousRankBtn.click();
        await page.waitForTimeout(1000);

        // At rank 0 the "Previous rank" button must be hidden.
        await expect(previousRankBtn).toBeHidden({ timeout: 5000 });
    });
});

test.describe('Region.tsx — tabChanged resets state', () => {
    // -----------------------------------------------------------------------
    // tabChanged() resets group, selectedSpecies, occurrenceFq, speciesList,
    // chartData, currentRank, rankFqs, selectedRanks when switching tabs.
    // The acceptance test calls tabChanged once (Explore by taxonomy) but
    // does not switch BACK to the species tab, so the reset path of switching
    // from taxonomy back to species is not covered.
    // -----------------------------------------------------------------------
    test('switching from taxonomy tab back to species tab resets chart state', async ({ page }) => {
        await setupRegionDetailMocks(page);
        await load(page, REGION_URL_21);

        // Switch to taxonomy tab.
        const taxonomyTab = page.getByRole('tab', { name: 'Explore by taxonomy' });
        await expect(taxonomyTab).toBeVisible({ timeout: 5000 });
        await taxonomyTab.click();

        const chartContainer = page.locator('div[data-testid="taxonChartContainer"]');
        await expect(chartContainer).toBeVisible({ timeout: 3000 });

        // Switch back to the species tab — triggers tabChanged('species').
        const speciesTab = page.getByRole('tab', { name: /species/i }).first();
        await expect(speciesTab).toBeVisible();
        await speciesTab.click();
        await page.waitForTimeout(500);

        // Species list should reload and be visible.
        const firstSpecies = page.locator('div[class^="_speciesName_"]').first();
        await expect(firstSpecies).toBeVisible({ timeout: 5000 });

        // The chart container should no longer be visible (taxonomy tab is inactive).
        await expect(chartContainer).toBeHidden();
    });
});
