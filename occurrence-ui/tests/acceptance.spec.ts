import { test, expect } from './fixtures';
import { shouldSkip } from './mocks/liveConfig';
import { setupMocks, load, loadResults, mockWmsTiles, mockImages, SESSION_USER, BASE_URL } from './helpers';
import { mockChart, mockFacetsDownload, mockRecordImagesSearch, mockQid, mockIndexFields, mockOfflineDownload, mockDownloadStatusPolling } from './mocks/biocacheMocks';
import { mockFieldguideDownload } from './mocks/apiMocks';
import {
    setupRecordMocks, mockSpatialLayer, createAssertionsStore,
    g_acaciaRecord, g_emptyCompareRecord, mockPublicationMetadata,
} from './mocks/recordMocks';
import { setupExploreMocks, g_speciesByGroup } from './mocks/exploreMocks';
import * as fs from 'fs';

// ===========================================================================
// Home page (OccurrenceSearch.tsx) — smoke tests
//
// These are intentionally minimal "does the whole pipeline actually work"
// checks (build -> serve -> mock -> render -> coverage). The full battery of
// MANUAL TESTS-derived acceptance tests is tracked as a plan in
// PLAYWRIGHT_TEST.md and is expected to be implemented incrementally later.
// ===========================================================================

test.describe('Home page (OccurrenceSearch)', () => {

    test('loads with title, tabs, and a working simple-search autocomplete', async ({ page }) => {
        test.skip(shouldSkip('home-loads'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await load(page);

        await expect(page).toHaveTitle(/Search for records/);
        await expect(page.locator('#searchHeader')).toBeVisible();

        // Manual test: "View Advanced search tabs...", "View Batch taxon search and
        // Catalogue number search tabs", "View Spatial search tab", "View Event search
        // tab" -- full per-tab content checks are planned separately; this only
        // confirms every tab is present and clickable at all.
        for (const tabName of ['Simple search', 'Advanced search', 'Batch taxon search', 'Catalogue number search', 'Event search', 'Spatial search']) {
            await expect(page.getByRole('tab', { name: tabName })).toBeVisible();
        }

        // Manual test: "Check page has autocomplete on Simple search input box"
        // Note: react-bootstrap-typeahead sets role="combobox" directly on the
        // rendered <input> but does NOT copy the `id` prop onto it (the id is only
        // used to build aria-owns/aria-activedescendant references to the menu) --
        // so it must be located by role, not by #simple-taxa-autocomplete.
        const input = page.getByRole('tabpanel', { name: 'Simple search' }).getByRole('combobox');
        await input.fill('acacia');
        await expect(page.getByRole('option').first()).toBeVisible();
        await expect(page.getByRole('option', { name: 'Acacia dealbata' })).toBeVisible();
    });

    test('has no unexpected browser console errors', async ({ page }) => {
        test.skip(shouldSkip('home-no-console-errors'), 'Skipped via live-config.json skip list');
        const errors: string[] = [];
        page.on('console', msg => {
            if (msg.type() !== 'error') return;
            const text = msg.text();
            // Resource-load failures (deliberately-aborted decorative external assets --
            // fonts.googleapis.com, ala.org.au logo/favicon -- see logMissingMocks.ts's
            // knownExternalUrlPrefixes) are reported by the browser as generic
            // "Failed to load resource" console errors, or as a bare "Error" in WebKit.
            // A truly unmocked URL is instead caught by logMissingMocks itself, which
            // throws and fails the test directly -- so these are safe to ignore here.
            if (text.startsWith('Failed to load resource') || text === 'Error') return;
            // The shared static-server fixture (../static-server) is missing the Font
            // Awesome Brands woff2/ttf files, which every sibling app's tests already
            // treat as known noise (see doi-ui's tests/fixtures.ts) rather than a bug
            // introduced by this app or its mocks.
            if (text.includes('downloadable font') || text.includes('glyph')) return;
            // KNOWN APP BUG (see PLAYWRIGHT_TEST.md "Discrepancies found"): three
            // translation keys (home.index.simsplesearch.span, search.map.importText,
            // search.map.importText.spatialportal) use react-intl rich-text tags like
            // <b>...</b> without passing the corresponding `values={{b: ...}}` mapping
            // to formatMessage(), which react-intl logs as a FORMAT_ERROR / INVALID_TAG
            // console.error on every render, independent of any mocking. Filtered here
            // so this smoke test still catches *new* regressions; tracked separately.
            if (text.includes('FORMAT_ERROR') || text.includes('INVALID_TAG')) return;
            errors.push(text);
        });

        await setupMocks(page);
        await load(page);

        expect(errors, 'home-loads.consoleErrors').toEqual([]);
    });

    test('Spatial search tab shows a loaded map with draw tools', async ({ page }) => {
        test.skip(shouldSkip('home-spatial-map'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await load(page);

        await page.getByRole('tab', { name: 'Spatial search' }).click();
        await expect(page.locator('#leafletMap .leaflet-container')).toBeVisible();
        // Two toolbars render (draw shapes, edit/delete existing shapes) -- .first() is
        // the "Draw a polygon/rectangle/circle" toolbar the manual test refers to.
        await expect(page.locator('.leaflet-draw-toolbar').first()).toBeVisible();

        // "Import an existing GIS area" (WKT import) accordion toggle -- note the
        // translated text (en.json's search.map.importToggle) differs from the JSX
        // defaultMessage fallback ("Import WKT"); en.json wins whenever a key exists.
        // getByRole (not getByText) since the accordion body's first sentence also
        // starts with the same words, which a text match would ambiguously hit too.
        await page.getByRole('button', { name: 'Import an existing GIS area' }).click();
        await expect(page.locator('#importAreaContent')).toHaveClass(/show/);
    });
});

// ===========================================================================
// Home page - Advanced search tab (components/search/AdvancedSearch.tsx)
// ===========================================================================

test.describe('Home page - Advanced search tab', () => {

    test('facet-backed dropdowns populate on focus', async ({ page }) => {
        test.skip(shouldSkip('home-advanced-search-dropdowns'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await load(page);

        // AdvancedSearch is wrapped in LazyLoad (active={tab === 'advanced'}), so it does
        // not mount -- and therefore has no dropdowns to focus -- until this tab is clicked.
        await page.getByRole('tab', { name: 'Advanced search' }).click();
        const tabpanel = page.getByRole('tabpanel', { name: 'Advanced search' });
        await expect(tabpanel).toBeVisible();

        // Each of these is a plain <select> populated on focus via fetchFacet(), which
        // GETs /occurrences/search?q=*:*&facets=<field>&flimit=-1 (see biocacheMocks.ts's
        // g_defaultFacetResponses -- the default facetResponses used by setupMocks()).
        const selectsAndExpectedText: [string, string][] = [
            ['#species_group', 'Birds'],
            ['#country', 'Australia'],
            ['#state', 'New South Wales'],
            ['#ibra', 'Australian Alps'],
            ['#imcra', 'South-east Shelf Transition'],
            ['#lga', 'Canberra'],
            ['#type_status', 'Holotype'],
            ['#basis_of_record', 'Preserved specimen'],
        ];
        for (const [selector, expectedText] of selectsAndExpectedText) {
            const select = tabpanel.locator(selector);
            await select.focus();
            await expect(async () => {
                const texts = await select.locator('option').allTextContents();
                expect(texts.join(' | '), `home-advanced-search-dropdowns.${selector}`).toContain(expectedText);
            }).toPass({ timeout: 5000 });
        }

        // Institution/Collection: focusing this ONE select fetches BOTH institutionUid and
        // collectionUid, rendering an <optgroup> per institution with its collections nested.
        const institutionSelect = tabpanel.locator('#institution_collection');
        await institutionSelect.focus();
        await expect(async () => {
            const texts = await institutionSelect.locator('option, optgroup').allTextContents();
            expect(texts.join(' | '), 'home-advanced-search-dropdowns.institution').toContain('CSIRO');
        }).toPass({ timeout: 5000 });

        // Dataset name: react-bootstrap-typeahead, not a native <select> -- populated on
        // focus the same way, but rendered as a filterable combobox + option list. Native
        // <select> elements also expose an implicit ARIA combobox role, so scope by the
        // library's own input class rather than getByRole('combobox') (ambiguous here --
        // this tabpanel has 9 native <select>s in addition to this Typeahead).
        const dataResourceInput = tabpanel.locator('input.rbt-input-main');
        await dataResourceInput.click();
        await dataResourceInput.fill('eBird');
        await expect(tabpanel.getByRole('option', { name: 'eBird Australia' })).toBeVisible();
    });

    test('date-range search (blank text field) navigates and shows the expected result count', async ({ page }) => {
        test.skip(shouldSkip('home-advanced-search-date-range'), 'Skipped via live-config.json skip list');
        // Manual test example figure ("~177K for the date search as of Mar 2024") --
        // distinct from the "acacia" fixture's totals so this test can't accidentally
        // pass against the wrong mock.
        await setupMocks(page, { biocache: { totalRecords: 177412, unfilteredTotalRecords: 181900 } });
        await load(page);

        await page.getByRole('tab', { name: 'Advanced search' }).click();
        const tabpanel = page.getByRole('tabpanel', { name: 'Advanced search' });
        await tabpanel.locator('#startDate').fill('2020-07-20');
        await tabpanel.locator('#endDate').fill('2020-07-30');
        await tabpanel.getByRole('button', { name: 'Search', exact: true }).click();

        // advancedSearch() converts the FIRST fq into `q` (see AdvancedSearch.tsx's
        // `fq.substring(1)` trick) -- with only a date range set, that means the whole
        // eventDate range ends up as the `q` param, not `fq`.
        await expect(page).toHaveURL(/\/occurrences\/search\?q=eventDate%3A/);

        await expect(async () => {
            const digitsOnly = (await page.locator('#returnedText').innerText()).replace(/[^0-9]/g, '');
            expect(digitsOnly, 'home-advanced-search-date-range.filteredCount').toContain('177412');
            expect(digitsOnly, 'home-advanced-search-date-range.unfilteredCount').toContain('181900');
        }).toPass({ timeout: 10000 });
    });
});

// ===========================================================================
// Home page - Batch taxon / Catalogue number / Event search forms
// ===========================================================================

test.describe('Home page - Batch taxon / Catalogue number / Event search forms', () => {

    test('Batch taxon search tab shows textarea, match-mode radios, and Search button', async ({ page }) => {
        test.skip(shouldSkip('home-batch-taxon-controls'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await load(page);

        await page.getByRole('tab', { name: 'Batch taxon search' }).click();
        const tabpanel = page.getByRole('tabpanel', { name: 'Batch taxon search' });
        await expect(tabpanel.locator('#raw_names')).toBeVisible();
        await expect(tabpanel.locator('#batchModeMatched')).toBeVisible();
        await expect(tabpanel.locator('#batchModeRaw')).toBeVisible();
        await expect(tabpanel.getByRole('button', { name: 'Search' })).toBeVisible();
    });

    test('Catalogue number search tab shows textarea and Search button', async ({ page }) => {
        test.skip(shouldSkip('home-catalogue-search-controls'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await load(page);

        await page.getByRole('tab', { name: 'Catalogue number search' }).click();
        const tabpanel = page.getByRole('tabpanel', { name: 'Catalogue number search' });
        await expect(tabpanel.locator('#catalogue_numbers')).toBeVisible();
        await expect(tabpanel.getByRole('button', { name: 'Search' })).toBeVisible();
    });

    test('Event search tab shows all 5 search forms', async ({ page }) => {
        test.skip(shouldSkip('home-event-search-forms'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await load(page);

        await page.getByRole('tab', { name: 'Event search' }).click();
        const tabpanel = page.getByRole('tabpanel', { name: 'Event search' });
        for (const id of ['#event_keywords', '#event_ids', '#parent_event_ids', '#field_numbers', '#dataset_name']) {
            await expect(tabpanel.locator(id)).toBeVisible();
        }
        // 5 forms => 5 "Search" buttons within this one tabpanel
        await expect(tabpanel.getByRole('button', { name: 'Search' })).toHaveCount(5);
    });

    test('Batch taxon search submits and navigates via qid', async ({ page }) => {
        test.skip(shouldSkip('home-batch-taxon-search-submits'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await load(page);

        await page.getByRole('tab', { name: 'Batch taxon search' }).click();
        const tabpanel = page.getByRole('tabpanel', { name: 'Batch taxon search' });
        await tabpanel.locator('#raw_names').fill('Acacia dealbata\nAcacia melanoxylon');
        await tabpanel.getByRole('button', { name: 'Search' }).click();

        // batchSearch() POSTs to /qid (mockQid, default 'mock-qid-001') then navigates here.
        // Not URL-encoded (":" passes through navigate() as-is); OccurrenceList then appends
        // its own default DQ profile param once it redirects, hence no trailing anchor.
        await expect(page).toHaveURL(/\/occurrences\/search\?q=qid:mock-qid-001/);
    });
});

// ===========================================================================
// Home page - Spatial search map-click popup
// ===========================================================================

test.describe('Home page - Spatial search map-click popup', () => {

    test('drawing then clicking a rectangle shows a species/occurrence count popup', async ({ page }) => {
        test.skip(shouldSkip('home-spatial-map-click-popup'), 'Skipped via live-config.json skip list');
        await setupMocks(page, {
            biocache: { totalRecords: 42 },
            occurrenceFacets: { scientificName: { count: 7, fieldResult: [] } },
        });
        await load(page);

        await page.getByRole('tab', { name: 'Spatial search' }).click();
        const map = page.locator('#leafletMap .leaflet-container');
        await expect(map).toBeVisible();
        // Let the app's own setTimeout(() => mapRef.current?.invalidateSize(), 300) (fired on
        // tab switch, see OccurrenceSearch.tsx) settle before drawing, so the map's internal
        // pane sizing matches its final CSS box.
        await page.waitForTimeout(500);

        // Draw a rectangle: click the toolbar button, then mouse-down/move/up over the map.
        // leaflet-draw's rectangle tool only needs two corner points.
        await page.locator('.leaflet-draw-draw-rectangle').click();
        const box = (await map.boundingBox())!;
        await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.35);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.65, { steps: 5 });
        await page.mouse.up();

        // Click the drawn shape (leaflet-draw's created layer gets the "leaflet-interactive"
        // class) to fire onFeatureClick() (OccurrenceSearch.tsx), which fetches counts from
        // the (hardcoded-hostname) biocache endpoints and shows a Leaflet popup with
        // "calculating..." placeholders that get filled in once the fetches resolve. Locating
        // by element + .click() (not manual page.mouse.click() coordinate math) is required
        // here -- Playwright's own centre-point computation reliably lands inside the shape.
        await page.locator('.leaflet-interactive').first().click();

        const popup = page.locator('.leaflet-popup-content');
        await expect(popup).toBeVisible();
        await expect(popup).not.toContainText('calculating...', { timeout: 10000 });
        await expect(popup).toContainText('42');
        await expect(popup).toContainText('7');
        // Two links render in the popup ("Search for records..." and "Remove this area") --
        // name-match the first to avoid a strict-mode ambiguity violation.
        await expect(popup.getByRole('link', { name: /Search for records/ })).toHaveAttribute('href', /\/occurrences\/search\?/);
    });
});

// ===========================================================================
// Simple search -> Search results (OccurrenceList.tsx) — smoke test
// ===========================================================================

test.describe('Simple search for "acacia" -> results page', () => {

    test('shows record count, facet sidebar, and result tabs', async ({ page }) => {
        test.skip(shouldSkip('search-acacia-results'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await load(page);

        await page.getByRole('tabpanel', { name: 'Simple search' }).getByRole('combobox').fill('acacia');
        // exact: true -- the common-ui Header renders a "Search & analyse" nav dropdown
        // and an "Open search control" button that would otherwise also match "Search".
        await page.getByRole('button', { name: 'Search', exact: true }).click();

        await expect(page).toHaveURL(/\/occurrences\/search\?q=/);

        // Records tab (default) shows the mocked occurrences once the main list fetch
        // resolves. Wait for this rather than page.waitForLoadState('networkidle'),
        // which is unreliable here: the results page is an SPA route change followed
        // by a multi-step async chain (DQ profile fetch -> qualityProfile redirect ->
        // main list fetch) that can complete after any brief network lull.
        await expect(page.getByText('Acacia dealbata')).toBeVisible({ timeout: 15000 });

        // "number of search results is correct" -- digits-only comparison to stay
        // locale-agnostic re: thousands separators (matches "806,234" / "806234" / etc).
        // ResultsReturned's unfiltered-count fetch is independent of the main list
        // fetch above and may resolve slightly later, so poll via toPass() rather
        // than reading innerText() once.
        await expect(async () => {
            const digitsOnly = (await page.locator('#returnedText').innerText()).replace(/[^0-9]/g, '');
            expect(digitsOnly, 'search-acacia-results.filteredCount').toContain('806234');
            expect(digitsOnly, 'search-acacia-results.unfilteredCount').toContain('824877');
        }).toPass({ timeout: 10000 });

        // Facet sidebar ("Customise filters" / FacetWell) -- en.json's search.facets.heading
        // ("Narrow your results") differs from the JSX defaultMessage ("Refine results").
        await expect(page.locator('#facetWell')).toBeVisible();
        await expect(page.locator('#facetWell')).toContainText('Narrow your results');

        // Result tabs: Records / Map / Charts / Record images
        for (const tabName of ['Records', 'Map', 'Charts', 'Record images']) {
            await expect(page.getByRole('tab', { name: tabName })).toBeVisible();
        }

        // Records tab (default) shows the mocked occurrences
        await expect(page.getByText('Acacia dealbata')).toBeVisible();

        // Download / API buttons
        await expect(page.locator('#downloads').first()).toBeVisible();
    });
});

// ===========================================================================
// Search results - facets (i18n, click-through), Map/Charts/Record images tabs
// ===========================================================================

test.describe('Search results - facets', () => {

    test('facet labels are internationalised (names, not raw fq codes) and clicking one filters the results', async ({ page }) => {
        test.skip(shouldSkip('results-facets-i18n-and-click'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await loadResults(page);

        // "Attribution" group contains the dataResourceUid facet -- fq values are
        // data-resource UID codes (e.g. "dataResourceUid:dr123") but the manual test
        // specifically calls out that displayed LABELS must be resource names.
        await page.getByText('Attribution', { exact: true }).click();
        const facetSection = page.locator('#group_dataResourceUid');
        await expect(facetSection).toBeVisible();
        const firstValue = facetSection.getByRole('link', { name: /eBird Australia/ });
        await expect(firstValue).toBeVisible();
        // The raw code must NOT be what's displayed to the user.
        await expect(facetSection).not.toContainText('dr123');

        // FacetWell renders facet values as plain <a href> links (full navigation,
        // not a client-side <Link>), appending the fq to the current queryString.
        await expect(firstValue).toHaveAttribute('href', /fq=dataResourceUid%3Adr123/);
        await firstValue.click();
        await expect(page).toHaveURL(/fq=dataResourceUid%3Adr123/);
    });

    test('"choose more" modal shows internationalised facet values', async ({ page }) => {
        test.skip(shouldSkip('results-facets-choose-more-modal'), 'Skipped via live-config.json skip list');
        // "state" (not "country" -- country isn't in src/config/defaultFacets.json, so
        // FacetWell's sidebar never renders it at all, regardless of groupedFacets).
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
        await expect(modal.getByText('Refine your search')).toBeVisible();
        await expect(modal.getByText('New South Wales')).toBeVisible();
        await expect(modal.getByText('Victoria')).toBeVisible();
        await expect(modal.getByText('Tasmania')).toBeVisible();
    });

    test('scrolling the "choose more" modal loads additional values beyond the first 100', async ({ page }) => {
        test.skip(shouldSkip('results-facets-scroll-loads-more'), 'Skipped via live-config.json skip list');
        const manyValues = Array.from({ length: 150 }, (_, i) => ({
            label: `Species ${String(i).padStart(3, '0')}`,
            count: 150 - i,
            fq: `scientificName:"Species ${i}"`,
            i18nCode: `facet.scientificName.species${i}`,
        }));
        await setupMocks(page, {
            // Sidebar preview (FacetWell, via /occurrences/search?facets=) only needs
            // >= flimitValue (5) entries to show the "choose more" link at all -- the
            // modal itself (via the standalone /occurrences/facets endpoint) is what
            // needs the full 150-item set to exercise the scroll-loads-more behaviour.
            biocache: { facetResponses: { scientificName: manyValues.slice(0, 5) } },
            occurrenceFacets: { scientificName: { count: manyValues.length, fieldResult: manyValues } },
        });
        await loadResults(page);

        await page.getByText('Taxon', { exact: true }).click();
        await page.locator('#group_scientificName').getByText('choose more').click();

        const modal = page.getByRole('dialog');
        const rows = modal.locator('table#fullFacets tbody tr');
        // Only count rows that are actual facet-value rows (checkbox in first cell),
        // excluding the "Show more results" sentinel row.
        const dataRows = () => rows.locator('input.fqs');
        await expect(dataRows()).toHaveCount(100);

        // DISCOVERED BUG (see PLAYWRIGHT_TEST.md "Discrepancies found"):
        // multipleFacets.tsx's infinite-scroll IntersectionObserver is set up in a
        // `useEffect(..., [observerRef.current])` -- mutating a ref does not trigger a
        // dependency re-check, so the observer set up on initial mount (when
        // observerRef.current was still null, since the sentinel <span> doesn't exist
        // until the data-loaded table replaces the "loading" placeholder) never
        // actually calls observer.observe(). It only starts working once the component
        // re-renders for an unrelated reason after the ref has attached (e.g. a sort
        // click), which is what real users would rarely do before trying to scroll.
        // Triggering that re-render here so we can still test the *intended* scroll
        // behaviour, but this is a real bug worth fixing upstream (e.g. using a
        // callback ref or `useState` instead of `useRef` for observerRef).
        await modal.getByRole('link', { name: 'Count' }).click();

        await modal.locator('table#fullFacets').evaluate(el => el.scrollIntoView());
        // The sentinel row (rendered when facetItems.length >= maxResults) triggers an
        // IntersectionObserver that bumps maxResults by 100 -- scroll it into view.
        await modal.getByText('Show more results').scrollIntoViewIfNeeded();

        // Manual test: must NOT get stuck showing a "Loading 100 more values..." state --
        // this app's equivalent stuck-state would be the count never exceeding 100.
        await expect(async () => {
            expect(await dataRows().count()).toBeGreaterThan(100);
        }).toPass({ timeout: 5000 });
    });

    test('downloading the facet list produces a CSV matching the displayed table', async ({ page, browserName }) => {
        test.skip(shouldSkip('results-facets-csv-download'), 'Skipped via live-config.json skip list');
        // Known Playwright+WebKit limitation (not an app bug): clicking a target="_blank"
        // link whose response is a routed/mocked download opens a genuinely blank popup
        // page (empty URL, empty body) in headless WebKit, and no 'download' event ever
        // fires on either page -- confirmed by instrumenting both page.on('download')
        // and the popup's page.on('download'). Chromium and Firefox both fire the event
        // correctly on the original `page`. The modal's displayed values (asserted below,
        // all 3 browsers) already cover "the table shows the right values"; only the
        // additional "the downloaded file's content also matches" check is WebKit-skipped.
        test.skip(browserName === 'webkit', 'WebKit does not fire a download event for routed target="_blank" responses');

        const seenUrls = await setupMocks(page);
        await mockFacetsDownload(page, seenUrls);
        await loadResults(page);

        await page.getByText('Attribution', { exact: true }).click();
        await page.locator('#group_dataResourceUid').getByText('choose more').click();

        const modal = page.getByRole('dialog');
        await expect(modal.getByText('eBird Australia')).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            modal.getByTitle('Download this list').click(),
        ]);
        const csvPath = await download.path();
        const csv = fs.readFileSync(csvPath!, 'utf-8');
        expect(csv).toContain('eBird Australia,250000');
        expect(csv).toContain('ALA specimen records,100000');
    });
});

test.describe('Search results - Map tab', () => {
    test('shows a loaded map with a WMS occurrence-heatmap layer request', async ({ page }) => {
        test.skip(shouldSkip('results-map-dots-continent'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page);
        await mockWmsTiles(page, seenUrls);
        await loadResults(page);

        await page.getByRole('tab', { name: 'Map' }).click();
        await expect(page.locator('.leaflet-container').first()).toBeVisible();

        // Structural check only (no pixel inspection, matching the skill's convention):
        // the WMS tile layer requests biocache-ws's /ogc/wms/reflect endpoint, which
        // renders "dots over the entire continent" in a real environment.
        await expect(async () => {
            const tileImgs = await page.locator('img.leaflet-tile[src*="ogc/wms/reflect"]').count();
            expect(tileImgs).toBeGreaterThan(0);
        }).toPass({ timeout: 10000 });
    });
});

test.describe('Search results - Charts tab', () => {
    test('shows populated charts for each configured facet', async ({ page }) => {
        test.skip(shouldSkip('results-charts-tab-content'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page);
        await mockChart(page, seenUrls);
        await loadResults(page);

        await page.getByRole('tab', { name: 'Charts' }).click();
        // src/config/charts.json's 7 entries, fetched sequentially -- wait for the last
        // one (typeStatus) to confirm the whole chain completed, not just the first.
        for (const label of ['By license', 'By month', 'By genus', 'By decade', 'By family', 'By data assertion', 'By type status']) {
            await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 10000 });
        }
        // Chart.js renders to <canvas> -- one per configured chart once its data resolves.
        await expect(page.locator('canvas')).toHaveCount(7);
    });
});

test.describe('Search results - Record images tab', () => {
    test('shows a thumbnail gallery of occurrence images', async ({ page }) => {
        test.skip(shouldSkip('results-record-images-tab'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page);
        await mockImages(page, seenUrls);
        await mockRecordImagesSearch(page, seenUrls, [
            {
                uuid: 'aaaaaaaa-1111-2222-3333-444444444444',
                thumbnailUrl: 'https://images.test.ala.org.au/image/proxyImageThumbnail?imageId=img-1',
                largeImageUrl: 'https://images.test.ala.org.au/image/proxyImage?imageId=img-1',
                image: 'img-1',
                imageUrl: 'https://images.test.ala.org.au/image/proxyImage?imageId=img-1',
                raw_scientificName: 'Acacia dealbata',
                institutionName: 'CSIRO',
            },
        ]);
        await loadResults(page);

        await page.getByRole('tab', { name: 'Record images' }).click();
        await expect(page.getByText('Images from occurrence records')).toBeVisible();
        await expect(page.locator('#container .imgCon').first()).toBeVisible();
        await expect(page.locator('#container .imgCon img').first()).toHaveAttribute('alt', /Acacia dealbata/);
    });
});

// ===========================================================================
// Event search — PPBES partial-match tests (ALA Biocache only; manual test says
// n/a for AVH and Ozcam)
// ===========================================================================

test.describe('Home page - Event search PPBES partial-match', () => {

    // DOM order of the Event tab's 5 Search buttons (see OccurrenceSearch.tsx):
    // 0 = general terms (all 4 fields), 1 = event_ids, 2 = parent_event_ids,
    // 3 = field_numbers, 4 = dataset_name.
    const eventForms: { id: string; textareaId: string; buttonIndex: number; field: string }[] = [
        { id: 'event-search-event-id', textareaId: '#event_ids', buttonIndex: 1, field: 'text_eventID' },
        { id: 'event-search-parent-event-id', textareaId: '#parent_event_ids', buttonIndex: 2, field: 'text_parentEventID' },
        { id: 'event-search-field-number', textareaId: '#field_numbers', buttonIndex: 3, field: 'text_fieldNumber' },
        { id: 'event-search-dataset-name', textareaId: '#dataset_name', buttonIndex: 4, field: 'text_datasetName' },
    ];

    for (const { id, textareaId, buttonIndex, field } of eventForms) {
        test(`${field} form performs a partial-text qid search for "PPBES"`, async ({ page }) => {
            test.skip(shouldSkip(id), 'Skipped via live-config.json skip list');
            const seenUrls = await setupMocks(page);
            await mockQid(page, seenUrls, 'ppbes-qid-001');
            await load(page);

            await page.getByRole('tab', { name: 'Event search' }).click();
            const tabpanel = page.getByRole('tabpanel', { name: 'Event search' });
            await tabpanel.locator(textareaId).fill('PPBES');
            await tabpanel.getByRole('button', { name: 'Search' }).nth(buttonIndex).click();

            await expect(page).toHaveURL(/\/occurrences\/search\?q=qid:ppbes-qid-001/);
        });
    }

    test('"choose more" search (general terms box) matches across all 4 event fields at once', async ({ page }) => {
        test.skip(shouldSkip('event-search-general-terms'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page);
        await mockQid(page, seenUrls, 'ppbes-qid-general');
        await load(page);

        await page.getByRole('tab', { name: 'Event search' }).click();
        const tabpanel = page.getByRole('tabpanel', { name: 'Event search' });
        await tabpanel.locator('#event_keywords').fill('PPBES');
        await tabpanel.getByRole('button', { name: 'Search' }).first().click();

        await expect(page).toHaveURL(/\/occurrences\/search\?q=qid:ppbes-qid-general/);
    });

    test('PPBES* values appear in the Event facet group once eventID is added to the sidebar', async ({ page }) => {
        test.skip(shouldSkip('event-search-facet-listed'), 'Skipped via live-config.json skip list');
        // FacetWell only shows facets present in BOTH src/config/defaultFacets.json AND
        // the relevant searchGroupedFacets.json group -- eventID is in the "Event" group
        // but NOT a default facet, so a real user must first add it via "Customise
        // filters" (customizeFilterModal.tsx) before it appears. Simulate that saved
        // preference directly via localStorage (the same key OccurrenceList.tsx reads)
        // rather than driving the modal's checkbox UI, since that's a separate concern.
        await page.addInitScript(() => {
            const defaults = ['scientificName', 'family', 'speciesGroup', 'vernacularName', 'month', 'decade', 'state', 'basisOfRecord', 'multimedia', 'occurrenceStatus', 'contentTypes', 'sensitive', 'institutionUid', 'dataResourceUid'];
            window.localStorage.setItem('customFacets', JSON.stringify([...defaults, 'eventID']));
        });
        await setupMocks(page, {
            biocache: {
                facetResponses: {
                    eventID: [
                        { label: 'PPBES-01', count: 12, fq: 'eventID:PPBES-01', i18nCode: 'facet.eventID.PPBES01' },
                        { label: 'PPBES-02', count: 8, fq: 'eventID:PPBES-02', i18nCode: 'facet.eventID.PPBES02' },
                    ],
                },
            },
        });
        await loadResults(page, 'qid:ppbes-qid-001', 'Acacia dealbata');

        await page.getByText('Event', { exact: true }).click();
        await expect(page.locator('#group_eventID')).toContainText('PPBES-01');
        await expect(page.locator('#group_eventID')).toContainText('PPBES-02');
    });
});

// ===========================================================================
// Downloads (Download.tsx -> CustomDownload.tsx -> DownloadStatus.tsx)
// ===========================================================================

/** Click the results page's "Download" button and land on /download/options1. */
async function goToDownloadOptions1(page: import('@playwright/test').Page) {
    await loadResults(page);
    await page.locator('#downloads').first().click();
    await expect(page).toHaveURL(/\/download\/options1\?/);
}

/** Download.tsx's 3 download-type "Select" buttons, in DOM order. */
const DOWNLOAD_TYPE_INDEX = { records: 0, checklist: 1, fieldguide: 2 } as const;

async function selectDownloadType(page: import('@playwright/test').Page, type: keyof typeof DOWNLOAD_TYPE_INDEX) {
    await page.locator('.option-btn').nth(DOWNLOAD_TYPE_INDEX[type]).click();
}

/** downloadReason=1 ("citizen science", VITE_DOWNLOAD_LOGGER_REASONS id 11 -- any non-empty value works). */
async function selectDownloadReasonAndNext(page: import('@playwright/test').Page) {
    await page.locator('#downloadReason').selectOption('1');
    await page.locator('button.option-btn.mt-4').click();
}

test.describe('Downloads', () => {

    test('anonymous users are redirected towards login', async ({ page }) => {
        test.skip(shouldSkip('download-requires-login'), 'Skipped via live-config.json skip list');
        await setupMocks(page); // SESSION_ANONYMOUS (default)
        await loadResults(page);
        await page.locator('#downloads').first().click();

        // handleLogin() does window.location.href = `${VITE_APP_API_URL}/login?path=...`
        // (a real navigation, not a fetch) -- mockLoginRedirect (in mockCommonApis,
        // part of setupMocks by default) fulfils it with a small placeholder page.
        await expect(page).toHaveURL(/localhost:8081\/login\?path=/);
    });

    test('records download - ALA legacy format completes and shows a working download link', async ({ page }) => {
        test.skip(shouldSkip('download-records-legacy'), 'Skipped via live-config.json skip list');
        const statusUrl = 'https://biocache-ws.ala.org.au/ws/occurrences/offline/status/mock-legacy-001';
        const finalUrl = 'https://biocache-ws.ala.org.au/ws/biocache-download/mock-legacy-001.zip';
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        // DISCOVERED BUG (see PLAYWRIGHT_TEST.md "Discrepancies found"): Download.tsx's
        // onNext() for downloadType==='records' navigates to /download/confirm WITHOUT
        // forwarding `downloadFormat` or `fileType` at all (only the format==='custom'
        // branch, which redirects via CustomDownload.tsx instead, forwards them). So on
        // DownloadStatus.tsx, `downloadFormat` is always undefined for this direct path,
        // and `if (downloadFormat !== 'legacy')` is therefore always true -- selecting
        // "ALA legacy format" has no actual effect: it still fetches /index/fields and
        // resolves DwC-term fields, exactly like selecting "dwc" would. Mocking and
        // asserting that real (buggy) behaviour here, not the seemingly-intended one.
        await mockIndexFields(page, seenUrls);
        await mockOfflineDownload(page, seenUrls, statusUrl);
        await mockDownloadStatusPolling(page, seenUrls, statusUrl, [
            { status: 'QUEUED', statusUrl },
            { status: 'RUNNING', statusUrl },
            { status: 'finished', downloadUrl: finalUrl },
        ]);
        await goToDownloadOptions1(page);

        await selectDownloadType(page, 'records');
        await page.locator('#downloadFormat-legacy').check();
        await selectDownloadReasonAndNext(page);

        await expect(page).toHaveURL(/\/download\/confirm\?/);
        // "An email containing a link..." copy (download-offline-email-note) --
        // shown for any records/fieldguide download once it has started.
        await expect(page.getByText(/email/i)).toBeVisible();
        await expect(page.getByRole('link', { name: /download.*now/i })).toHaveAttribute('href', finalUrl, { timeout: 10000 });
    });

    test('records download - DwC format completes (fetches /index/fields for DwC terms)', async ({ page }) => {
        test.skip(shouldSkip('download-records-dwc'), 'Skipped via live-config.json skip list');
        const statusUrl = 'https://biocache-ws.ala.org.au/ws/occurrences/offline/status/mock-dwc-001';
        const finalUrl = 'https://biocache-ws.ala.org.au/ws/biocache-download/mock-dwc-001.zip';
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await mockIndexFields(page, seenUrls);
        await mockOfflineDownload(page, seenUrls, statusUrl);
        await mockDownloadStatusPolling(page, seenUrls, statusUrl, [{ status: 'finished', downloadUrl: finalUrl }]);
        await goToDownloadOptions1(page);

        await selectDownloadType(page, 'records');
        // VITE_DOWNLOAD_FORMATS=dwc,legacy,custom -- "dwc" is already the default
        // selection, but check it explicitly so this test doesn't silently pass
        // if the env-driven default order ever changes.
        await page.locator('#downloadFormat-dwc').check();
        await selectDownloadReasonAndNext(page);

        await expect(page).toHaveURL(/\/download\/confirm\?/);
        await expect(page.getByRole('link', { name: /download.*now/i })).toHaveAttribute('href', finalUrl, { timeout: 10000 });
    });

    test('records download - custom format lets the user pick field-group classes', async ({ page }) => {
        test.skip(shouldSkip('download-records-custom'), 'Skipped via live-config.json skip list');
        const statusUrl = 'https://biocache-ws.ala.org.au/ws/occurrences/offline/status/mock-custom-001';
        const finalUrl = 'https://biocache-ws.ala.org.au/ws/biocache-download/mock-custom-001.zip';
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await mockIndexFields(page, seenUrls);
        await mockOfflineDownload(page, seenUrls, statusUrl);
        await mockDownloadStatusPolling(page, seenUrls, statusUrl, [{ status: 'finished', downloadUrl: finalUrl }]);
        await goToDownloadOptions1(page);

        await selectDownloadType(page, 'records');
        await page.locator('#downloadFormat-custom').check();
        await selectDownloadReasonAndNext(page);

        await expect(page).toHaveURL(/\/download\/options2\?/);
        // recordLevelTerms + occurrence (VITE_DOWNLOAD_CUSTOM_MANDATORY_GROUPS) are
        // pre-selected and locked; pick a couple of additional, non-mandatory classes.
        await page.getByText('Taxon', { exact: true }).click();
        await page.getByText('Location', { exact: true }).click();
        // DownloadToolbar.tsx's Next button (className='btn btn-primary') is the only
        // .btn-primary on this page, rendered twice (toolbar above and below the panel).
        await page.locator('button.btn-primary').first().click();

        await expect(page).toHaveURL(/\/download\/confirm\?/);
        await expect(page.getByRole('link', { name: /download.*now/i })).toHaveAttribute('href', finalUrl, { timeout: 10000 });
    });

    test('species checklist download shows an immediate download link (no polling)', async ({ page }) => {
        test.skip(shouldSkip('download-checklist'), 'Skipped via live-config.json skip list');
        await setupMocks(page, { session: SESSION_USER });
        await goToDownloadOptions1(page);

        await selectDownloadType(page, 'checklist');
        await selectDownloadReasonAndNext(page);

        await expect(page).toHaveURL(/\/download\/confirm\?/);
        // startDownloadChecklist() builds the URL client-side (no fetch involved) --
        // verify the link itself rather than actually following it.
        await expect(page.getByRole('link', { name: /download.*now/i })).toHaveAttribute('href', /occurrences\/facets\/download/);
    });

    test('field guide (PDF) download completes via species_guid facet lookup + POST', async ({ page }) => {
        test.skip(shouldSkip('download-field-guide'), 'Skipped via live-config.json skip list');
        const statusUrl = 'https://biocache-ws.ala.org.au/ws/occurrences/offline/status/mock-fieldguide-001';
        const finalUrl = 'https://biocache-ws.ala.org.au/ws/fieldguide/mock-fieldguide-001.pdf';
        const seenUrls = await setupMocks(page, {
            session: SESSION_USER,
            biocache: {
                facetResponses: {
                    species_guid: [
                        { label: 'https://id.biodiversity.org.au/node/apni/2895958', count: 3000, fq: 'species_guid:"https://id.biodiversity.org.au/node/apni/2895958"', i18nCode: '' },
                        { label: 'https://id.biodiversity.org.au/node/apni/2901308', count: 2000, fq: 'species_guid:"https://id.biodiversity.org.au/node/apni/2901308"', i18nCode: '' },
                    ],
                },
            },
        });
        await mockFieldguideDownload(page, seenUrls, statusUrl);
        await mockDownloadStatusPolling(page, seenUrls, statusUrl, [
            { status: 'RUNNING', statusUrl },
            { status: 'finished', downloadUrl: finalUrl },
        ]);
        await goToDownloadOptions1(page);

        await selectDownloadType(page, 'fieldguide');
        await selectDownloadReasonAndNext(page);

        await expect(page).toHaveURL(/\/download\/confirm\?/);
        await expect(page.getByRole('link', { name: /download.*now/i })).toHaveAttribute('href', finalUrl, { timeout: 10000 });
    });
});

// ===========================================================================
// Record display (Occurrence.tsx + components/occurrence/*)
// ===========================================================================

async function loadRecord(page: import('@playwright/test').Page, uuid: string = g_acaciaRecord.processed.uuid) {
    await page.goto(`${BASE_URL}/occurrence/${uuid}`);
    await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 15000 });
}

test.describe('Record display', () => {

    test('shows Dataset/Event/Taxonomy/Geospatial core sections, DQ tests, and environmental/political info', async ({ page }) => {
        test.skip(shouldSkip('record-core-sections'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls);
        await loadRecord(page);

        // Dataset section (recordCore.tsx's DwC fields section)
        await expect(page.locator('#occurrenceDataset')).toBeVisible();
        await expect(page.locator('#datasetTable')).toContainText('CANB123456');
        await expect(page.locator('#datasetTable')).toContainText('CSIRO');

        // Event / Taxonomy / Geospatial sections
        await expect(page.locator('#occurrenceEvent')).toBeVisible();
        await expect(page.locator('#occurrenceTaxonomy')).toContainText('Acacia dealbata');
        await expect(page.locator('#occurrenceGeospatial')).toContainText('Australian Capital Territory');

        // Data quality tests (dataQualityOccurrence.tsx) -- always renders once record loads
        await expect(page.locator('#dataQualityInfo')).toBeVisible();
        await expect(page.locator('#dataQualityInfo')).toContainText('Data quality tests');

        // "Additional political boundaries information" (cl fields) + "Environmental
        // sampling for this location" (el fields) -- en.json's actual translated
        // heading differs from environmentalSampleInfo.tsx's own defaultMessage for the
        // cl-fields heading (see PLAYWRIGHT_TEST.md "Discrepancies found"); asserting
        // the id + real rendered text, not the code's defaultMessage.
        await expect(page.locator('#contextualSampleInfo')).toContainText('Additional political boundaries information');
        await expect(page.locator('#environmentalSampleInfo')).toContainText('Environmental sampling for this location');
    });

    test('a record with existing user annotations shows them', async ({ page }) => {
        test.skip(shouldSkip('record-with-annotations'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const store = createAssertionsStore([
            {
                uuid: 'assertion-001', code: 30000, comment: 'This looks like a duplicate record',
                userId: SESSION_USER.userId, userDisplayName: 'Jane Smith', created: '2024-01-01T00:00:00Z',
                referenceRowKey: g_acaciaRecord.processed.uuid, relatedRecordId: '', relatedRecordReason: '',
            },
        ]);
        await setupRecordMocks(page, seenUrls, { assertionsStore: store });
        await loadRecord(page);

        await expect(page.locator('#userAnnotationsDiv')).toBeVisible();
        await expect(page.locator('#userAnnotationsDiv')).toContainText('This looks like a duplicate record');
        // Owned by the logged-in user and not yet verified -> Edit/Delete shown.
        await expect(page.locator('.editAnnotationButton')).toBeVisible();
        await expect(page.locator('.deleteAnnotationButton')).toBeVisible();
    });

    test('flag an issue: adding an annotation persists after the resulting reload', async ({ page }) => {
        test.skip(shouldSkip('record-flag-issue-add'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const store = createAssertionsStore([]);
        await setupRecordMocks(page, seenUrls, { assertionsStore: store });
        await loadRecord(page);

        await expect(page.locator('#userAnnotationsDiv')).not.toBeVisible();
        await page.locator('#assertionButton').click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await modal.locator('#issue').selectOption({ index: 1 });
        await modal.locator('#issueComment').fill('Coordinates look wrong for this species');
        await modal.locator('#issueFormSubmit').click();

        // Submitting does not auto-close/reload -- the form shows a "Close" button
        // (#close) once submitSuccess is true, which the user must click.
        await modal.locator('#close').click({ timeout: 10000 });

        // #assertionButton's onClose always does window.location.reload() regardless
        // of how the modal was dismissed -- the reload re-fetches assertions from the
        // (now-mutated) stateful mock, so the new annotation should now be visible.
        await expect(page.locator('#userAnnotationsDiv')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#userAnnotationsDiv')).toContainText('Coordinates look wrong for this species');
    });

    test('delete annotation removes it after the resulting reload', async ({ page }) => {
        test.skip(shouldSkip('record-flag-issue-delete'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const store = createAssertionsStore([
            {
                uuid: 'assertion-002', code: 30001, comment: 'Location seems off',
                userId: SESSION_USER.userId, userDisplayName: 'Jane Smith', created: '2024-01-01T00:00:00Z',
                referenceRowKey: g_acaciaRecord.processed.uuid, relatedRecordId: '', relatedRecordReason: '',
            },
        ]);
        await setupRecordMocks(page, seenUrls, { assertionsStore: store });
        await loadRecord(page);

        await expect(page.locator('#userAnnotationsDiv')).toContainText('Location seems off');

        page.once('dialog', dialog => dialog.accept());
        await page.locator('.deleteAnnotationButton').click();

        // deleteAssertion() reloads unconditionally on a successful delete.
        await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#userAnnotationsDiv')).not.toBeVisible();
    });

    test('a record with outlier information shows the correct number of layers', async ({ page }) => {
        test.skip(shouldSkip('record-outlier-layers'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const outlierRecord = JSON.parse(JSON.stringify(g_acaciaRecord));
        outlierRecord.processed.occurrence.outlierForLayers = ['el882', 'cl1048', 'el883'];
        await setupRecordMocks(page, seenUrls, { record: outlierRecord });
        await mockSpatialLayer(page, seenUrls, {
            '882': { name: 'el882', displayname: 'Annual Mean Temperature', source: 'ALA', notes: '', description: 'Climate layer', scale: '1:100,000' },
            '1048': { name: 'cl1048', displayname: 'IBRA Region', source: 'ALA', notes: '', description: 'Bioregion layer', scale: '1:250,000' },
            '883': { name: 'el883', displayname: 'Annual Precipitation', source: 'ALA', notes: '', description: 'Climate layer', scale: '1:100,000' },
        });
        await loadRecord(page, outlierRecord.processed.uuid);

        await expect(page.locator('#outlierInformation')).toBeVisible();
        // The dynamic per-layer list is the FIRST <ul> -- a second <ul> further down
        // has 2 static "more information" links, so a plain "#outlierInformation li"
        // selector would over-match (5, not 3).
        await expect(page.locator('#outlierInformation ul').first().locator('li')).toHaveCount(3, { timeout: 10000 });
        await expect(page.locator('#outlierInformation')).toContainText('Annual Mean Temperature');
        await expect(page.locator('#outlierInformation')).toContainText('IBRA Region');
        await expect(page.locator('#outlierInformation')).toContainText('Annual Precipitation');
    });

    test('a record with images links them to the image service', async ({ page }) => {
        test.skip(shouldSkip('record-images-link-to-image-service'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls);
        await loadRecord(page);

        const image = page.locator('#occurrenceImages img').first();
        await expect(image).toBeVisible();
        // VITE_APP_IMAGE_VIEWER_URL / VITE_APP_IMAGE_METADATA_URL / thumbnail src all
        // point at the image service host -- assert on that, not a literal mocked URL
        // (per the skill's Common Pitfall re: asserting hrefs across builds).
        await expect(image).toHaveAttribute('src', /images\.test\.ala\.org\.au/);
        const viewerLink = page.locator('#occurrenceImages a').first();
        await expect(viewerLink).toHaveAttribute('href', /images\.test\.ala\.org\.au/);
    });
});

// ===========================================================================
// Explore your area (ExploreYourArea.tsx)
// ===========================================================================

/**
 * #latlng=<lat>,<lng> is read on mount (see PLAYWRIGHT_TEST.md's ExploreYourArea notes)
 * and takes priority over geolocation -- the reliable, deterministic way to set the
 * page's location in a test without depending on navigator.geolocation permission timing.
 */
async function loadExploreYourArea(page: import('@playwright/test').Page, lat = -35.28, lng = 149.13) {
    await page.goto(`${BASE_URL}/explore/your-area#latlng=${lat},${lng}`);
    // The <Marker> only renders once `latLng` state resolves -- a reliable "location
    // has settled" signal (see PLAYWRIGHT_TEST.md notes on MapContainer's center/zoom
    // props only applying at initial mount, not reactively).
    await expect(page.locator('.leaflet-marker-icon')).toBeVisible({ timeout: 15000 });
}

test.describe('Explore your area', () => {

    test('shows the species-group breakdown table with counts', async ({ page }) => {
        test.skip(shouldSkip('eya-species-groups-load'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await loadExploreYourArea(page);

        // The group table's rows come from a static config (speciesGroupsMap.json), not
        // the API response -- only the counts are API-driven (see PLAYWRIGHT_TEST.md).
        await expect(page.locator('span.speciesItem', { hasText: 'Birds' })).toBeVisible();
        await expect(page.locator('span.speciesItem', { hasText: 'Mammals' })).toBeVisible();
        const birdsRow = page.locator('tr', { has: page.locator('span.speciesItem', { hasText: 'Birds' }) });
        await expect(birdsRow).toContainText('320');
    });

    test('clicking a species group fetches and shows that group\'s species list', async ({ page }) => {
        test.skip(shouldSkip('eya-species-group-click'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await loadExploreYourArea(page);

        await page.locator('span.speciesItem', { hasText: 'Birds' }).click();

        await expect(page.getByText('Superb Fairywren')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Laughing Kookaburra')).toBeVisible();
        // Names render verbatim (no client-side formatting/cleanup at all -- see
        // PLAYWRIGHT_TEST.md's finding that punctuation/bracket-free display is
        // entirely a biocache-service data-quality concern, not this component's).
        await expect(page.getByText('Gymnorhina tibicen')).toBeVisible();

        // Selected group's row gets the CSS-module "speciesItemSelected" class (its
        // exact hashed name changes per build, so match by substring).
        const birdsRow = page.locator('tr', { has: page.locator('span.speciesItem', { hasText: 'Birds' }) });
        await expect(birdsRow).toHaveAttribute('class', /speciesItemSelected/);
    });

    test('sorting the species list by column header re-orders rows client-side', async ({ page }) => {
        test.skip(shouldSkip('eya-sort-columns'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await loadExploreYourArea(page);
        await page.locator('span.speciesItem', { hasText: 'Birds' }).click();
        await expect(page.getByText('Superb Fairywren')).toBeVisible({ timeout: 10000 });

        // DISCOVERED (see PLAYWRIGHT_TEST.md): there is no visual "active sort column"
        // indicator anywhere (no arrow icon, no aria-sort) -- the only way to verify
        // sorting is to check the actual row order changes.
        const commonNameCells = () => page.locator('table').last().locator('tbody tr td:first-child');

        // Default sort is "records" (descending count): Magpie(4200), Fairywren(2800), Kookaburra(1900).
        await expect(commonNameCells().nth(0)).toHaveText('Australian Magpie');

        await page.getByRole('columnheader', { name: 'Common Name' }).click();
        // Alphabetical by common name: Australian Magpie, Laughing Kookaburra, Superb Fairywren.
        await expect(commonNameCells().nth(0)).toHaveText('Australian Magpie');
        await expect(commonNameCells().nth(1)).toHaveText('Laughing Kookaburra');
        await expect(commonNameCells().nth(2)).toHaveText('Superb Fairywren');
    });

    test('changing the radius refetches groups and species with the new radius', async ({ page }) => {
        test.skip(shouldSkip('eya-radius-and-zoom'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await loadExploreYourArea(page);

        const requestedRadii: string[] = [];
        page.on('request', req => {
            const url = req.url();
            if (url.includes('/explore/group/')) {
                requestedRadii.push(new URL(url).searchParams.get('radius') || '');
            }
        });

        await page.getByRole('combobox').filter({ has: page.locator('option[value="10"]') }).selectOption('10');

        await expect(async () => {
            expect(requestedRadii).toContain('10');
        }).toPass({ timeout: 5000 });

        // Zoom controls are present (structural check only -- no pixel-level map assertion).
        await expect(page.locator('.leaflet-control-zoom-in')).toBeVisible();
        await expect(page.locator('.leaflet-control-zoom-out')).toBeVisible();
    });

    test('a group with 50+ species renders all of them without a "show more" button', async ({ page }) => {
        test.skip(shouldSkip('eya-show-more-species'), 'Skipped via live-config.json skip list');
        // DISCOVERED (see PLAYWRIGHT_TEST.md): ExploreYourArea.tsx has NO "show more
        // species" button/link at all -- the full (up to VITE_EYA_SPECIES_PAGE_SIZE)
        // list is always rendered in one fetch, inside a scrollable div. This test
        // asserts the actual behaviour: a 60-species fixture renders all 60 rows
        // up front, reachable by scrolling (not by clicking anything).
        const manySpecies = Array.from({ length: 60 }, (_, i) => ({
            guid: `urn:lsid:biodiversity.org.au:afd.taxon:bird-${i}`,
            commonName: `Test Bird ${String(i).padStart(2, '0')}`,
            name: `Testus birdus ${i}`,
            count: 60 - i,
        }));
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls, { speciesByGroup: { ...g_speciesByGroup, Birds: manySpecies } });
        await loadExploreYourArea(page);
        await page.locator('span.speciesItem', { hasText: 'Birds' }).click();

        await expect(page.getByText('Test Bird 00')).toBeVisible({ timeout: 10000 });
        // All 60 rows already in the DOM -- scrolling the container (not clicking a
        // button) is the only way a real user reaches rows below the fold.
        await expect(page.getByText('Test Bird 59')).toBeAttached();
        await expect(page.getByText('Test Bird 59')).toHaveCount(1);
    });

    test('"View records for" / "Download records for" links carry the current group/location/radius', async ({ page }) => {
        test.skip(shouldSkip('eya-download-and-records-links'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await loadExploreYourArea(page);
        await page.locator('span.speciesItem', { hasText: 'Birds' }).click();
        await expect(page.getByText('Superb Fairywren')).toBeVisible({ timeout: 10000 });

        await expect(page.getByRole('link', { name: 'View records for Birds' })).toHaveAttribute('href', /\/occurrences\/search\?/);
        await expect(page.getByRole('link', { name: 'Download records for Birds' })).toHaveAttribute('href', /\/download\/options1\?/);
    });

    test('species list entries link to both the records page and the BIE species page', async ({ page }) => {
        test.skip(shouldSkip('eya-species-list-links'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await loadExploreYourArea(page);
        await page.locator('span.speciesItem', { hasText: 'Birds' }).click();
        await expect(page.getByText('Superb Fairywren')).toBeVisible({ timeout: 10000 });

        // Clicking a species row expands a detail sub-row with the two links.
        await page.getByText('Superb Fairywren').click();
        await expect(page.getByRole('link', { name: 'Species profile' })).toHaveAttribute('href', /bie\.test\.ala\.org\.au\/species\//);
        await expect(page.getByRole('link', { name: 'List records' })).toHaveAttribute('href', /occurrences\/search\?q=lsid/);
    });

    test('the location search box shows a "not configured" alert when Google geocoding has no API key', async ({ page }) => {
        test.skip(shouldSkip('eya-address-search-not-configured'), 'Skipped via live-config.json skip list');
        // DISCOVERED (see PLAYWRIGHT_TEST.md): VITE_GOOGLE_MAP_API_KEY is intentionally
        // empty in .env.playwright (matching regions-ui/search-ui convention), which
        // means typing an address or lat,lng into the search box and clicking Search
        // cannot actually geocode -- the app shows a plain alert() instead. Testing the
        // real working address/lat-lng search requires either a configured Google Maps
        // API key + a stubbed window.google.maps.Geocoder, or live-mode testing against
        // a real deployment; tracked as follow-up, not attempted here.
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await loadExploreYourArea(page);

        const alerts: string[] = [];
        page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });

        await page.getByPlaceholder(/street address/).fill('Canberra, ACT');
        await page.getByRole('button', { name: 'Search', exact: true }).click();
        await expect(async () => {
            expect(alerts.some(a => a.toLowerCase().includes('geocoding'))).toBe(true);
        }).toPass({ timeout: 5000 });
    });

    test('falls back to the default location when geolocation is unavailable/denied', async ({ page }) => {
        test.skip(shouldSkip('eya-geolocation-fallback'), 'Skipped via live-config.json skip list');
        // No #latlng hash, and getCurrentPosition() stubbed to fail immediately -- this
        // exercises ExploreYourArea.tsx's geolocation-error fallback (setLatLng(center))
        // deterministically across all 3 browsers. Relying on the REAL permission-prompt
        // flow (navigator.geolocation present, but permission neither granted nor
        // denied) is flaky: Chromium/WebKit auto-deny quickly in automated/headless
        // mode, but Firefox can hang indefinitely waiting for a prompt that never
        // appears. `delete navigator.geolocation` is also unreliable (the property is
        // non-configurable in some browsers, so the delete silently no-ops) -- directly
        // overriding getCurrentPosition is the robust way to force the error branch.
        await page.addInitScript(() => {
            if (navigator.geolocation) {
                (navigator.geolocation as any).getCurrentPosition = (_success: unknown, error: (err: unknown) => void) => {
                    error({ code: 1, message: 'Permission denied (stubbed for test)' });
                };
            }
        });
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await page.goto(`${BASE_URL}/explore/your-area`);
        await expect(page.locator('.leaflet-marker-icon')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('span.speciesItem', { hasText: 'Birds' })).toBeVisible();
    });
});

// ===========================================================================
// MultiValued fields (occurrenceRow.tsx / recordCore.tsx / originalVsProcessedModal.tsx)
// ===========================================================================
//
// biocache stores multi-valued DwC fields (otherCatalogNumbers, recordedByID, ...) as a
// single "|"-delimited string, not a JSON array -- there is no server-side array type for
// these. The three rendering paths handle this differently:
//   1. Fields hardcoded into createDatasetTable() (e.g. otherCatalogNumbers, recordedBy)
//      read straight from record.raw.occurrence.* and render the raw "|"-joined string
//      verbatim (no reformatting at all).
//   2. Fields NOT in VITE_RECORD_MANUAL_DATASET_FIELDS/_DWC_EXCLUDE_FIELDS (e.g.
//      recordedByID) instead flow from compareRecord.Occurrence through
//      addAllExtraDwcFields(), which applies pipeWhitespace() -- inserting a space on
//      each side of "|" for readability ("a|b" -> "a | b").
//   3. originalVsProcessedModal.tsx renders compareRecord's field.raw/field.processed
//      completely verbatim (no pipeWhitespace, no translation) for ANY field, regardless
//      of the manual/exclude lists above.
// None of the three paths ever produces a bracketed "[a, b]" array-literal rendering --
// this only happens if `text` is a genuine JS array (Array.isArray branch, joined with
// ", " -- also unbracketed), which biocache never sends for these fields.

test.describe('MultiValued fields', () => {

    test('a multi-valued otherCatalogNumbers field displays both values without brackets', async ({ page }) => {
        test.skip(shouldSkip('multivalue-other-catalog-numbers'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls); // g_acaciaRecord already has raw.occurrence.otherCatalogNumbers = "ANH0001|ANH0002"
        await loadRecord(page);

        // otherCatalogNumbers is in VITE_RECORD_MANUAL_DATASET_FIELDS -> hardcoded row,
        // sourced directly from record.raw.occurrence.otherCatalogNumbers (no compareRecord
        // involvement, no pipeWhitespace reformatting).
        const row = page.locator('#otherCatalogNumbers');
        await expect(row).toBeVisible();
        await expect(row).toContainText('ANH0001|ANH0002');
        await expect(row).not.toContainText('[');
        await expect(row).not.toContainText(']');
    });

    test('a multi-valued recordedByID field is formatted with spaced pipes, not brackets', async ({ page }) => {
        test.skip(shouldSkip('multivalue-recorded-by-id'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const recordedByID = 'https://orcid.org/0000-0000-0000-0001|https://orcid.org/0000-0000-0000-0002';
        const compareRecord = {
            ...g_emptyCompareRecord,
            Occurrence: [{ name: 'recordedByID', raw: recordedByID, processed: recordedByID }],
        };
        await setupRecordMocks(page, seenUrls, { compareRecord });
        await loadRecord(page);

        // recordedByID is NOT in the manual/exclude lists -> flows through
        // addAllExtraDwcFields() as an extra Dataset row, with pipeWhitespace() adding a
        // space on each side of "|" for readability.
        const row = page.locator('#recordedByID');
        await expect(row).toBeVisible();
        await expect(row).toContainText('https://orcid.org/0000-0000-0000-0001 | https://orcid.org/0000-0000-0000-0002');
        await expect(row).not.toContainText('[');
        await expect(row).not.toContainText(']');
        // Discrepancy: since the combined "a | b" string still starts with "https://" and
        // `new URL(...)` does not throw on embedded spaces (WHATWG parser percent-encodes
        // them), isUrl() incorrectly treats the WHOLE pipe-joined pair as one href, so both
        // values render inside a single anchor tag pointing at a mangled combined URL --
        // not tested here as it's peripheral to the display-text correctness this test
        // covers; see PLAYWRIGHT_TEST.md "Discrepancies found".
    });

    test('"Compare original vs processed values" shows a multi-valued recordedBy without brackets', async ({ page }) => {
        test.skip(shouldSkip('multivalue-compare-recorded-by'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const compareRecord = {
            ...g_emptyCompareRecord,
            Occurrence: [{ name: 'recordedBy', raw: 'Jane Botanist|John Doe', processed: 'Jane Botanist|John Doe' }],
        };
        await setupRecordMocks(page, seenUrls, { compareRecord });
        await loadRecord(page);

        await page.locator('#showRawProcessed').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        // originalVsProcessedModal.tsx renders field.raw/field.processed completely
        // verbatim (no pipeWhitespace) -- the "|" separator itself is unchanged here,
        // but it must still not render as a bracketed array literal.
        const row = modal.locator('tr', { hasText: 'recordedBy' });
        await expect(row).toBeVisible();
        await expect(row).toContainText('Jane Botanist|John Doe');
        await expect(row).not.toContainText('[');
        await expect(row).not.toContainText(']');
    });
});

// ===========================================================================
// Data Quality Profile filtering (OccurrenceList.tsx / dataQuality.tsx / dataQualitySettingsModal.tsx)
// ===========================================================================
//
// The "ALA General" profile fixture (tests/resources/dataQualityProfiles.json) has 3
// categories: spatiallySuspect, unidentified, lowQualityIdentification. g_acacia's
// totalRecords=806234 (fully filtered) / unfilteredTotalRecords=824877 (no DQ at all) --
// the gap (18643) is split across mockBiocacheSearch's qualityFilterExtraRecords config
// so that disabling all 3 categories individually sums to exactly the unfiltered total,
// matching what disableAllQualityFilters=true (the "Disable data profiles" option) returns.

/**
 * Toggle one category's checkbox in the (possibly collapsed) DQ bar, expanding it first
 * if needed. Each toggle causes a full window.location.replace() navigation (not client
 * routing) -- clicking the expand caret writes localStorage's `<appname>.dqExpanded`
 * immediately (not gated behind Settings' Save), so once expanded it STAYS expanded
 * across every subsequent reload for the rest of the test. Waiting for `#dataQuality`
 * itself (always rendered once results load, regardless of expanded state) rather than
 * the (conditionally-rendered) category row avoids racing the reload's re-render --
 * `expanded`'s useState initializer resolves synchronously at mount from localStorage,
 * so by the time #dataQuality is visible at all, the caret icon already reflects the
 * final state and a plain .isVisible() snapshot check is safe to read.
 */
async function toggleDqCategory(page: import('@playwright/test').Page, categoryName: string) {
    await expect(page.locator('#dataQuality')).toBeVisible({ timeout: 15000 });
    if (await page.locator('#dataQuality .bi-caret-right-fill').count() > 0) {
        await page.locator('#dataQuality b.dqLabel').click();
    }
    const row = page.locator('.dqFilter', { hasText: categoryName });
    await row.locator('.bi-check-square, .bi-square').click();
}

test.describe('Data Quality Profile filtering', () => {

    test('the "ALA General" data quality profile is selected by default', async ({ page }) => {
        test.skip(shouldSkip('dq-default-profile-selected'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await loadResults(page);

        // OccurrenceList.tsx redirects to append qualityProfile=<default> on first load
        // when no DQ params are present in the URL (VITE_APP_DQ_DEFAULT_PROFILE=ALA).
        await expect(page).toHaveURL(/qualityProfile=ALA/);
        await expect(page.locator('#dataQualitySelect select')).toHaveValue('ALA');

        // "X records returned of Y" -- X reflects the ALA-filtered count.
        await expect(async () => {
            const digitsOnly = (await page.locator('#returnedText').innerText()).replace(/[^0-9]/g, '');
            expect(digitsOnly).toContain('806234');
        }).toPass({ timeout: 10000 });

        // Expand the (collapsed-by-default) category list -- all 3 ALA categories are
        // present and enabled (checked) by default.
        await page.locator('#dataQuality b.dqLabel').click();
        for (const name of ['Exclude spatially suspect records', 'Exclude unidentified records', 'Exclude records with low quality identification']) {
            const row = page.locator('.dqFilter', { hasText: name });
            await expect(row).toBeVisible();
            await expect(row.locator('.bi-check-square')).toBeVisible();
        }
    });

    test('disabling one DQ category increases the returned count', async ({ page }) => {
        test.skip(shouldSkip('dq-toggle-filter-increases-count'), 'Skipped via live-config.json skip list');
        await setupMocks(page, {
            biocache: { qualityFilterExtraRecords: { spatiallySuspect: 10000, unidentified: 5000, lowQualityIdentification: 3643 } },
        });
        await loadResults(page);

        await expect(async () => {
            const digitsOnly = (await page.locator('#returnedText').innerText()).replace(/[^0-9]/g, '');
            expect(digitsOnly).toContain('806234');
        }).toPass({ timeout: 10000 });

        // addParams() applies DQ toggles via a full window.location.replace() navigation
        // (not client-side routing) -- await the resulting URL change before reading count.
        await toggleDqCategory(page, 'Exclude spatially suspect records');
        await expect(page).toHaveURL(/disableQualityFilter=spatiallySuspect/);

        await expect(async () => {
            const digitsOnly = (await page.locator('#returnedText').innerText()).replace(/[^0-9]/g, '');
            expect(digitsOnly).toContain('816234'); // 806234 + 10000
        }).toPass({ timeout: 10000 });
    });

    test('disabling every DQ category matches the unfiltered total', async ({ page }) => {
        test.skip(shouldSkip('dq-all-disabled-matches-total'), 'Skipped via live-config.json skip list');
        await setupMocks(page, {
            biocache: { qualityFilterExtraRecords: { spatiallySuspect: 10000, unidentified: 5000, lowQualityIdentification: 3643 } },
        });
        await loadResults(page);

        // Each toggle causes a full navigation (window.location.replace), which remounts
        // dataQuality.tsx and re-collapses the category list (its `expanded` local state
        // re-reads localStorage/dataQualityInfo.expand, neither of which this test sets) --
        // toggleDqCategory() re-expands before every click as needed.
        await toggleDqCategory(page, 'Exclude spatially suspect records');
        await expect(page).toHaveURL(/disableQualityFilter=spatiallySuspect/);
        await toggleDqCategory(page, 'Exclude unidentified records');
        await expect(page).toHaveURL(/disableQualityFilter=unidentified/);
        await toggleDqCategory(page, 'Exclude records with low quality identification');
        await expect(page).toHaveURL(/disableQualityFilter=lowQualityIdentification/);

        await expect(async () => {
            // #returnedText has 3 <strong> elements: [0] the filtered "X" count, [1] the
            // unfiltered "Y" count, [2] the query title -- indexed rather than a single
            // combined-text check since both counts now read the same value (824877).
            const strongs = page.locator('#returnedText strong');
            const filtered = (await strongs.nth(0).innerText()).replace(/[^0-9]/g, '');
            const unfiltered = (await strongs.nth(1).innerText()).replace(/[^0-9]/g, '');
            expect(filtered, 'all-disabled.filteredCount').toBe('824877');
            expect(unfiltered, 'all-disabled.unfilteredCount').toBe('824877');
        }).toPass({ timeout: 10000 });
    });

    test('a saved DQ profile persists for a logged-in user on their next fresh search', async ({ page }) => {
        test.skip(shouldSkip('dq-profile-persists-for-logged-in-user'), 'Skipped via live-config.json skip list');
        await setupMocks(page, { session: SESSION_USER });
        // mockUserProperty (wired via mockCommonApis -> setupMocks) starts with no saved
        // value (GET 404) and becomes stateful once Settings' Save POSTs one -- see its
        // doc comment in apiMocks.ts.
        await loadResults(page);
        await expect(page.locator('#dataQualitySelect select')).toHaveValue('ALA');

        await page.locator('#usersettings').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await modal.locator('#dataQualitySelect select').selectOption('ENVIRO');
        // save() fires the POST but calls onClose() immediately without awaiting it --
        // wait for the actual response so the mock's saved state is updated before the
        // next navigation below, or it may race ahead of the save.
        await Promise.all([
            page.waitForResponse((r) => r.url().includes('/v2/user/property') && r.request().method() === 'POST'),
            modal.locator('#updateFacetOptions').click(),
        ]);
        await expect(modal).not.toBeVisible();

        // updateAndSaveDataQualityInfoWithQueryString() only ever *applies* the saved
        // preference when the URL has no qualityProfile/disableAllQualityFilters param at
        // all -- if one is already present (as it now is, from the initial load's own
        // default-profile redirect) it takes priority and the saved preference is never
        // even consulted. A plain page.reload() would therefore just re-confirm ALA, not
        // exercise persistence at all -- a fresh navigation (as if the user started a new
        // search from scratch) is required to reach the "no params yet" branch.
        await loadResults(page);
        await expect(page).toHaveURL(/qualityProfile=ENVIRO/);
        await expect(page.locator('#dataQualitySelect select')).toHaveValue('ENVIRO');
    });
});

// ===========================================================================
// Referenced by publication -- ALA Biocache only (customizeFilterModal.tsx /
// facetWell.tsx / referencedPublications.tsx)
// ===========================================================================
//
// src/config/searchGroupedFacets.json defines a "Publication" facet group with a single
// field, annotationsUid (facet.annotationsUid: "Referenced by publication") -- not part
// of defaultFacets.json, so it must be explicitly enabled via "Customise filters" before
// it appears in the sidebar.

test.describe('Referenced by publication', () => {

    test('the "Referenced by publication" facet can be enabled via "Customise filters"', async ({ page }) => {
        test.skip(shouldSkip('referenced-pub-facet-visible'), 'Skipped via live-config.json skip list');
        await setupMocks(page, {
            biocache: { facetResponses: { annotationsUid: [
                { label: 'Australian National Herbarium data', count: 42, fq: 'annotationsUid:dr123', i18nCode: 'facet.annotationsUid.dr123' },
            ] } },
        });
        await loadResults(page);
        await expect(page.locator('#facetWell')).not.toContainText('Publication');

        await page.getByText('Customise filters', { exact: true }).click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('Publication');
        const checkbox = modal.locator('input.facetOpts[value="annotationsUid"]');
        await expect(checkbox).toBeVisible();
        await expect(checkbox).not.toBeChecked();
        await checkbox.check();
        await modal.locator('#updateFacetOptions').click();
        await expect(modal).not.toBeVisible();

        // Update() persists to localStorage AND updates facetList state directly (no
        // reload needed) -- the sidebar's "Publication" group heading now renders, but a
        // newly-appeared group defaults to collapsed (facetWell.tsx's lookupIsOpen()
        // defaults to closed for any group name not already in localStorage) -- expand it
        // to reach the annotationsUid section itself.
        const groupHeading = page.locator('.facetGroupName', { hasText: 'Publication' });
        await expect(groupHeading).toBeVisible();
        await groupHeading.click();

        const group = page.locator('#group_annotationsUid');
        await expect(group).toBeVisible();
        await expect(group).toContainText('Referenced by publication');
        await expect(group).toContainText('Australian National Herbarium data');
    });

    test('searching with an annotationsUid filter shows a labelled active filter and results', async ({ page }) => {
        test.skip(shouldSkip('referenced-pub-records-linked'), 'Skipped via live-config.json skip list');
        await setupMocks(page);
        await page.goto(`${BASE_URL}/occurrences/search?q=${encodeURIComponent('taxa:"acacia"')}&fq=annotationsUid:dr123`);
        await expect(page.getByText('Acacia dealbata')).toBeVisible({ timeout: 15000 });

        // activeFilters.tsx's fqLabel() renders "facet.<field>: <value>" for any fq --
        // "Referenced by publication: dr123" confirms the annotationsUid fq round-trips
        // through the URL and is both recognised and human-readable, not just a raw fq.
        await expect(page.getByText('Referenced by publication: dr123')).toBeVisible();
    });

    test('a record\'s "Referenced in publications" section shows the linked publication', async ({ page }) => {
        test.skip(shouldSkip('referenced-pub-record-anchor'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const identifier = 'https://doi.test.ala.org.au/10.1234/example-study';
        const publicationRecord = JSON.parse(JSON.stringify(g_acaciaRecord));
        publicationRecord.referencedPublications = [
            { id: 'pub-001', dataResourceUid: 'dr123', identifier, scientificName: 'Acacia dealbata', decimalLatitude: -35.28, decimalLongitude: 149.13, year: 2020 },
        ];
        await setupRecordMocks(page, seenUrls, { record: publicationRecord });
        // referencedPublications.tsx fetches each entry's own arbitrary `identifier` URL
        // directly (not a fixed ALA hostname) -- must be mocked per-fixture.
        await mockPublicationMetadata(page, seenUrls, {
            [identifier]: {
                name: 'Assessing the distribution of Acacia dealbata in the ACT',
                description: 'A study examining occurrence records of Acacia dealbata.',
                '@id': identifier,
            },
        });
        await loadRecord(page, publicationRecord.processed.uuid);

        const section = page.locator('#referencedPublications');
        await expect(section).toBeVisible();
        await expect(section).toContainText('Assessing the distribution of Acacia dealbata in the ACT');
        await expect(section.locator('a', { hasText: 'Assessing the distribution' }))
            .toHaveAttribute('href', 'https://collections.test.ala.org.au/public/show/dr123');
        await expect(section).toContainText('Acacia dealbata'); // annotation.scientificName row
        await expect(section.locator('a', { hasText: 'View all data referenced by this publication' }))
            .toHaveAttribute('href', '/occurrences/search?q=annotationsUid:dr123');
    });
});
