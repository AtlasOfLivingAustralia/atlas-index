import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { setupMocks, loadResults, BASE_URL, SESSION_USER } from './helpers';

// ===========================================================================
// Synthetic coverage for several small-to-medium sidebar/toolbar pieces around
// the search-results page that acceptance.spec.ts never reaches:
//  - facetWell.tsx's OWN inline "Data Profile" collapsible group (distinct from
//    dataQuality.tsx's top bar, which is all the existing DQ tests ever open)
//  - activeFilters.tsx (remove one fq / remove spatial / clear all)
//  - customizeFilterModal.tsx (Update / Reset to defaults)
//  - OccurrenceList.tsx's quick-search box, anonymous saved-DQ-preference
//    branch, logged-in DQ-fetch failure branch, and the main-list fetch error
//    (.alert-danger) branch
// ===========================================================================

test.describe('FacetWell — inline "Data Profile" group in the sidebar', () => {
    // NOTE: split into 2 tests rather than 1 -- clicking a category checkbox
    // triggers toggleDqFilter() -> updateDataQualityInfo() -> addParams() ->
    // window.location.replace(), a REAL top-level navigation. Per PLAYWRIGHT_TEST.md
    // §5.0's documented coverage-instrumentation limitation, a mid-test real
    // navigation resets window.__coverage__, so whatever ran before it within THE
    // SAME test never reaches fixtures.ts's end-of-test snapshot. Keeping the
    // "open the group and see resolved counts" flow (dqOpen toggle, the categories
    // render loop, fetchDqCountsSequentially) in its own reload-free test lets that
    // portion's coverage actually get captured; the checkbox-click test's own
    // triggering code remains uncaptured either way, but still verifies real
    // end-to-end behaviour (the resulting URL), which has value independent of coverage.
    test('opening it shows the 3 ALA categories with resolved counts', async ({ page }) => {
        await setupMocks(page, { biocache: { totalRecords: 500, unfilteredTotalRecords: 600 } });
        await loadResults(page);

        const facetWell = page.locator('#facetWell');
        await expect(facetWell).toBeVisible();
        await facetWell.getByText('Data Profile', { exact: true }).click();

        const categoryRow = facetWell.locator('li', { hasText: 'Exclude spatially suspect records' });
        await expect(categoryRow).toBeVisible();
        // Starts checked (selected) -- bi-check-square icon, not bi-square.
        await expect(categoryRow.locator('i.bi-check-square')).toBeAttached();
        // Count resolves from a spinner to a real number (dqCache's fetchDqCountsSequentially).
        await expect(categoryRow).not.toContainText('...', { timeout: 10000 });

        // All 3 categories resolve (sequentially, not just the first).
        for (const name of ['Exclude spatially suspect records', 'Exclude unidentified records', 'Exclude records with low quality identification']) {
            const row = facetWell.locator('li', { hasText: name });
            await expect(row.locator('.spinner-border')).toHaveCount(0, { timeout: 10000 });
        }

        // Collapsing then re-opening re-runs the dqOpen-dependent effect, re-calling
        // fetchDqCountsSequentially for the SAME search+category -- dqCache.ts's
        // hasCachedCount()/getCachedCount() cache-hit branch (previously untested;
        // every prior test only ever opened the group once) resolves it immediately,
        // with no spinner flash at all this time.
        await facetWell.getByText('Data Profile', { exact: true }).click(); // collapse
        await expect(categoryRow).toHaveCount(0);
        await facetWell.getByText('Data Profile', { exact: true }).click(); // re-open
        await expect(categoryRow).toBeVisible();
        await expect(categoryRow.locator('.spinner-border')).toHaveCount(0);
        await expect(categoryRow).not.toContainText('...');
    });

    test('clicking a category checkbox navigates with disableQualityFilter for it', async ({ page }) => {
        await setupMocks(page, { biocache: { totalRecords: 500, unfilteredTotalRecords: 600 } });
        await loadResults(page);

        const facetWell = page.locator('#facetWell');
        await facetWell.getByText('Data Profile', { exact: true }).click();
        const categoryRow = facetWell.locator('li', { hasText: 'Exclude spatially suspect records' });
        await expect(categoryRow).toBeVisible();

        await categoryRow.click();
        await expect(page).toHaveURL(/disableQualityFilter=spatiallySuspect/);
    });
});

test.describe('ActiveFilters — remove-one / remove-spatial / clear-all', () => {
    async function loadWithFilters(page: Page) {
        await setupMocks(page);
        await page.goto(
            `${BASE_URL}/occurrences/search?q=${encodeURIComponent('taxa:"acacia"')}` +
            `&qualityProfile=ALA` +
            `&fq=${encodeURIComponent('state:"New South Wales"')}` +
            `&fq=${encodeURIComponent('basisOfRecord:PreservedSpecimen')}` +
            `&radius=5&lat=-35.28&lon=149.13`
        );
        await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 15000 });
    }

    // Chromium percent-encodes ":" in a pushState-updated URL (%3A); Firefox/WebKit
    // leave it literal. Normalising avoids a 3-way browser-specific assertion.
    function normalizedUrl(page: Page): string {
        return decodeURIComponent(page.url()).replace(/\+/g, ' ');
    }

    test('renders a labelled chip per fq plus a spatial chip; clicking one fq\'s x removes only that filter', async ({ page }) => {
        await loadWithFilters(page);

        // dataQuality.tsx's own top bar coincidentally reuses the same "activeFilters"
        // class on its #dataQuality container -- scope this component out explicitly.
        const filters = page.locator('.activeFilters:not(#dataQuality)');
        await expect(filters).toBeVisible();
        await expect(filters).toContainText('State or Territory: New South Wales');
        await expect(filters).toContainText('Record type: PreservedSpecimen');
        await expect(filters).toContainText('Spatial filter');
        // 2 fq chips + 1 spatial chip -- excludes the "Clear all" pill, which also
        // carries the "activeFilter" class but is styled btn-primary, not btn-outline-dark.
        await expect(filters.locator('.activeFilter.btn-outline-dark')).toHaveCount(3);

        await filters.locator('.activeFilter', { hasText: 'State or Territory' }).click();

        await expect(async () => {
            expect(normalizedUrl(page)).not.toContain('state:"New South Wales"');
        }).toPass({ timeout: 5000 });
        expect(normalizedUrl(page)).toContain('basisOfRecord:PreservedSpecimen');
        expect(page.url()).toContain('radius=5'); // spatial filter untouched
    });

    test('clicking the spatial chip\'s x removes radius/lat/lon together', async ({ page }) => {
        await loadWithFilters(page);

        const filters = page.locator('.activeFilters:not(#dataQuality)');
        await filters.locator('.activeFilter', { hasText: 'Spatial filter' }).click();

        await expect(async () => {
            expect(page.url()).not.toContain('radius=');
        }).toPass({ timeout: 5000 });
        expect(page.url()).not.toContain('lat=');
        expect(page.url()).not.toContain('lon=');
        // Both fq's remain.
        expect(normalizedUrl(page)).toContain('state:"New South Wales"');
    });

    test('"Clear all" (shown once >1 filter is active) removes every fq and the spatial filter together', async ({ page }) => {
        await loadWithFilters(page);

        const filters = page.locator('.activeFilters:not(#dataQuality)');
        // The pill's text is literally "> Clear all" (a raw "&gt;&nbsp;" prefix), so
        // an exact match would never hit -- a substring match is intentional here.
        const clearAll = filters.getByText('Clear all');
        await expect(clearAll).toBeVisible();
        await clearAll.click();

        await expect(async () => {
            expect(page.url()).not.toContain('fq=');
        }).toPass({ timeout: 5000 });
        expect(page.url()).not.toContain('radius=');
        expect(page.url()).not.toContain('wkt=');
        // The active-filters bar itself disappears once totalCount is 0.
        await expect(page.locator('.activeFilters:not(#dataQuality)')).toHaveCount(0);
    });
});

test.describe('CustomizeFilterModal — Update / Reset to defaults', () => {
    test('unchecking a default facet and checking a new one, then Update, persists the new list to localStorage', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);

        await page.getByText('Customise filters', { exact: true }).click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        // "Data resource" is a default facet (defaultFacets.json); uncheck it.
        const dataResourceCheckbox = modal.locator('input[type=checkbox][value="dataResourceUid"]');
        await expect(dataResourceCheckbox).toBeChecked();
        await dataResourceCheckbox.uncheck();

        // "Type status" is not a default facet; check it on.
        const typeStatusCheckbox = modal.locator('input[type=checkbox][value="typeStatus"]');
        await expect(typeStatusCheckbox).not.toBeChecked();
        await typeStatusCheckbox.check();

        await modal.getByRole('button', { name: 'Update', exact: true }).click();
        await expect(modal).not.toBeVisible();

        const stored = await page.evaluate(() => localStorage.getItem('customFacets'));
        const parsed = JSON.parse(stored as string);
        expect(parsed).not.toContain('dataResourceUid');
        expect(parsed).toContain('typeStatus');
    });

    test('"Reset to defaults" closes the modal without saving any customisation', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);
        await page.evaluate(() => localStorage.removeItem('customFacets'));

        await page.getByText('Customise filters', { exact: true }).click();
        const modal = page.getByRole('dialog');
        await modal.locator('input[type=checkbox][value="dataResourceUid"]').uncheck();

        await modal.getByRole('button', { name: 'Reset to defaults' }).click();
        await expect(modal).not.toBeVisible();

        // reset() calls setFacetList(defaultFacets) directly -- it does NOT write
        // customFacets to localStorage at all (only update() does).
        const stored = await page.evaluate(() => localStorage.getItem('customFacets'));
        expect(stored).toBeNull();
    });
});

test.describe('OccurrenceList — quick search, saved DQ preference, DQ fetch failure, and search errors', () => {
    test('typing a path into the quick-search box and clicking the button navigates to it directly', async ({ page }) => {
        await setupMocks(page, { biocache: { totalRecords: 7 } });
        await loadResults(page);

        await page.locator('#searchBoxZ input[type=text]').fill(`/occurrences/search?q=${encodeURIComponent('taxa:"banksia"')}`);
        await page.getByRole('button', { name: 'Quick search' }).click();

        await expect(page).toHaveURL(/q=taxa%3A%22banksia%22|q=taxa:"banksia"/);
        await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 15000 });
    });

    test('an anonymous user with a saved localStorage DQ preference has both its profile and its disabled items applied on a fresh search', async ({ page }) => {
        await setupMocks(page);
        await page.goto(BASE_URL);
        await page.evaluate(() => {
            localStorage.setItem('ala-hub.dqUserProfile', JSON.stringify({
                disableAll: false,
                dataProfile: 'ENVIRO',
                disabledItems: ['oldRecords'],
                expand: 'collapsed',
            }));
        });

        // A genuinely fresh navigation (no qualityProfile/disableAllQualityFilters
        // param yet) is required -- see PLAYWRIGHT_TEST.md's note that a same-URL
        // reload never re-reads the saved preference once URL params are present.
        await page.goto(`${BASE_URL}/occurrences/search?q=${encodeURIComponent('taxa:"acacia"')}`);
        await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 15000 });

        // loadDqProfile()'s anonymous branch sets dataQualityInfo.profile from the
        // saved preference (so ENVIRO -- not the env-default ALA -- is applied)...
        await expect(page).toHaveURL(/qualityProfile=ENVIRO/);
        // ...and updateAndSaveDataQualityInfoWithQueryString()'s "no dq params yet"
        // branch now preserves the selectedFilters already computed from the saved
        // preference instead of unconditionally resetting them via initDqFilters(),
        // so the saved "disable oldRecords" preference survives into the redirect.
        await expect(page).toHaveURL(/disableQualityFilter=oldRecords/);
    });

    test('a logged-in user whose /v2/user/property fetch fails falls back to the default profile', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        // Override with a failing response -- registered after setupMocks() so it wins.
        await page.context().route('http://localhost:8081/v2/user/property**', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
        );
        seenUrls.add(new URL('http://localhost:8081/v2/user/property'));

        await page.goto(`${BASE_URL}/occurrences/search?q=${encodeURIComponent('taxa:"acacia"')}`);
        await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 15000 });

        // Falls back to updateAndSaveDataQualityInfoWithQueryString()'s "no saved
        // preference" branch -- the plain env-default ALA profile is applied.
        await expect(page).toHaveURL(/qualityProfile=ALA/);
    });

    test('a failed main-list search shows the server error message instead of the results table', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await page.context().route(
            (url) => url.hostname === 'biocache-ws.ala.org.au'
                && url.pathname === '/ws/occurrences/search'
                && url.searchParams.get('pageSize') !== null
                && url.searchParams.get('pageSize') !== '0',
            route => route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ errorType: 'INTERNAL_ERROR', message: 'Index temporarily unavailable' }),
            })
        );
        seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/search'));

        await page.goto(`${BASE_URL}/occurrences/search?q=${encodeURIComponent('taxa:"acacia"')}`);

        const alert = page.locator('.alert-danger');
        await expect(alert).toBeVisible({ timeout: 15000 });
        await expect(alert).toContainText('INTERNAL_ERROR: Index temporarily unavailable');
        // The results table (ResultsReturned) is replaced by the alert, not shown alongside it.
        await expect(page.locator('#returnedText')).toHaveCount(0);
    });
});

test.describe('ResultsReturned — "Show more" / "Show less" query-text toggle', () => {
    test('a long query title overflows the 3-line clamp, showing the toggle; expanding and collapsing both work', async ({ page }) => {
        const longTitle = 'genus:Acacia OR ' + Array.from({ length: 40 }, (_, i) => `species:"Acacia example number ${i}"`).join(' OR ');
        await setupMocks(page, { biocache: { queryTitle: longTitle } });
        await loadResults(page);

        const toggle = page.locator('#queryDisplayToggle');
        await expect(toggle).toBeVisible({ timeout: 10000 });
        await expect(toggle).toContainText('Show more');
        await expect(page.locator('#queryDisplayText')).toHaveClass(/query-text-truncated/);

        await toggle.click();
        await expect(page.locator('#queryDisplayText')).toHaveClass(/query-text-expanded/);
        await expect(toggle).toContainText('Show less');

        await toggle.click();
        await expect(page.locator('#queryDisplayText')).toHaveClass(/query-text-truncated/);
        await expect(toggle).toContainText('Show more');
    });

    test('a short query title never shows the toggle at all', async ({ page }) => {
        await setupMocks(page, { biocache: { queryTitle: 'acacia' } });
        await loadResults(page);

        await expect(page.locator('#returnedText')).toBeVisible();
        await expect(page.locator('#queryDisplayToggle')).toHaveCount(0);
    });
});

test.describe('MultipleFacets — sorting and checkbox selection (client-side only)', () => {
    test('checking a box updates its state; clicking the name/count column headers toggles sort direction', async ({ page }) => {
        await setupMocks(page, {
            occurrenceFacets: {
                state: {
                    count: 3,
                    fieldResult: [
                        { label: 'New South Wales', count: 200000, fq: 'state:"New South Wales"', i18nCode: 'facet.state.NSW' },
                        { label: 'Victoria', count: 150000, fq: 'state:Victoria', i18nCode: 'facet.state.VIC' },
                        { label: 'Tasmania', count: 9000, fq: 'state:Tasmania', i18nCode: 'facet.state.TAS' },
                    ],
                },
            },
        });
        await loadResults(page);

        await page.getByText('Location', { exact: true }).click();
        await page.locator('#group_state').getByText('choose more').click();

        const modal = page.getByRole('dialog');
        const rows = () => modal.locator('#fullFacets tbody tr');
        await expect(rows()).toHaveCount(3, { timeout: 10000 });

        // Default state is sortBy='count', sortDir='asc' -- but the comparator
        // deliberately treats 'asc' as descending for the count column (per the
        // component's own comment), so the initial order is BY COUNT DESCENDING:
        // New South Wales (200000), Victoria (150000), Tasmania (9000).
        await expect(rows().nth(0)).toContainText('New South Wales');

        // Checking a box updates item.checked locally (no navigation yet).
        await rows().nth(0).locator('input[type=checkbox]').check();
        await expect(rows().nth(0).locator('input[type=checkbox]')).toBeChecked();

        // Clicking the name column while a DIFFERENT column is active switches
        // sortBy AND resets sortDir to 'asc' -- true alphabetical ascending this
        // time (unlike the count column's inverted convention): New South Wales,
        // Tasmania, Victoria.
        await modal.locator('#indexCol a').click();
        await expect(rows().nth(0)).toContainText('New South Wales');
        await expect(rows().nth(1)).toContainText('Tasmania');
        await expect(rows().nth(2)).toContainText('Victoria');
        // The checked state survives the re-sort (same item objects, just re-ordered).
        await expect(rows().filter({ hasText: 'New South Wales' }).locator('input[type=checkbox]')).toBeChecked();

        // Clicking the SAME (name) column again toggles direction to descending.
        await modal.locator('#indexCol a').click();
        await expect(rows().nth(0)).toContainText('Victoria');
        await expect(rows().nth(2)).toContainText('New South Wales');

        // Count column: switching TO it resets sortDir to 'asc', which (per the
        // inverted convention) renders descending by count again -- NSW first.
        await modal.getByText('Count', { exact: true }).click();
        await expect(rows().nth(0)).toContainText('New South Wales');
        // Clicking the SAME (count) column again toggles to 'desc', which (still
        // inverted) renders ascending by count -- Tasmania (9000, the lowest) first.
        await modal.getByText('Count', { exact: true }).click();
        await expect(rows().nth(0)).toContainText('Tasmania');
    });
});

test.describe('LsidDropdown — closing on an outside click', () => {
    test('clicking outside the open dropdown closes it without navigating', async ({ page }) => {
        await setupMocks(page, {
            biocache: {
                queryTitle: '<span class="lsid" id="urn:lsid:biodiversity.org.au:afd.taxon:bird-001">Gymnorhina tibicen</span>',
                facetResponses: { raw_scientificName: [{ label: 'Gymnorhina tibicen', count: 4200, fq: '', i18nCode: '' }] },
            },
        });
        await loadResults(page);

        await page.locator('#resultsReturnedTemplate_0 button').click();
        await expect(page.locator('#rawTaxon_0_0')).toBeVisible({ timeout: 10000 });

        // Click somewhere definitely outside the dropdown's own btn-group container.
        await page.locator('#facetWell').click();
        await expect(page.locator('#rawTaxon_0_0')).toHaveCount(0);
    });
});
