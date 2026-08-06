import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { setupMocks, loadResults, BASE_URL, mockWmsTiles } from './helpers';
import { mockMapLegend, mockDensityLegend, mockOccurrencesInfo } from '../mocks/biocacheMocks';
import { mockRelatedOccurrence } from '../mocks/recordMocks';

// ===========================================================================
// Synthetic coverage: src/components/list/mapView.tsx (718 lines, 28.51% stmt
// coverage), mapLayerControls.tsx (136 lines, 42.85%), mapLegendControls.tsx
// (97 lines, 27.27%) -- the single biggest low-coverage opportunity in the app.
// The only existing test touching this component at all (acceptance.spec.ts's
// "Search results - Map tab") is a pure structural smoke test: it never opens
// MapLayerControls/MapLegendControls, never clicks a drawn/loaded shape, and
// never clicks the plain map to trigger the record-lookup popup.
// ===========================================================================

async function openMapTab(page: Page, seenUrls: Set<URL>) {
    // MapView mounts Leaflet's WMS heatmap layer (ogc/wms/reflect) immediately once
    // the Map tab is first selected -- unmocked, this throws via logMissingMocks
    // before the tab's own content is ever reachable (same helper as listModals.spec.ts).
    await mockWmsTiles(page, seenUrls);
    await page.getByRole('tab', { name: 'Map' }).click();
    await expect(page.locator('.leaflet-container').first()).toBeVisible();
}

test.describe('MapView toolbar', () => {
    test('"View in spatial portal" carries the current query params to the configured spatial-portal host', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await loadResults(page);
        await openMapTab(page, seenUrls);

        const link = page.getByRole('link', { name: 'View in spatial portal' });
        await expect(link).toHaveAttribute('href', /^https:\/\/spatial\.test\.ala\.org\.au/);
        await expect(link).toHaveAttribute('href', /q=/);
    });

    test('the "Download WKT" link only appears when the query string has a wkt param, with a matching data: href', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        const wkt = 'POLYGON((140 -30,141 -30,141 -31,140 -31,140 -30))';
        await page.goto(`${BASE_URL}/occurrences/search?q=${encodeURIComponent('taxa:"acacia"')}&wkt=${encodeURIComponent(wkt)}`);
        await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 15000 });
        await openMapTab(page, seenUrls);

        const link = page.getByText('Download WKT', { exact: true });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(wkt)}`);
        await expect(link).toHaveAttribute('download', 'polygon.wkt');
    });
});

test.describe('MapLayerControls', () => {
    test('adjusting the size/opacity sliders and the outline checkbox updates their displayed values', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await loadResults(page);
        await openMapTab(page, seenUrls);

        // Defaults from .env.playwright: VITE_MAP_DEFAULT_POINT_SIZE=5, VITE_MAP_DEFAULT_OPACITY=0.8.
        await expect(page.locator('#sizeslider-val')).toHaveText(' 5');
        await page.locator('#sizeslider').fill('3');
        await expect(page.locator('#sizeslider-val')).toHaveText(' 3');

        await expect(page.locator('#opacityslider-val')).toHaveText(' 0.8');
        await page.locator('#opacityslider').fill('0.3');
        await expect(page.locator('#opacityslider-val')).toHaveText(' 0.3');

        await expect(page.locator('#outlineDots')).not.toBeChecked();
        await page.locator('#outlineDots').check();
        await expect(page.locator('#outlineDots')).toBeChecked();
    });

    test('selecting a facet colour-by populates the legend checklist from /mapping/legend, and hiding a facet changes the WMS tile request', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockMapLegend(page, seenUrls, [
            { name: 'New South Wales', red: 196, green: 77, blue: 52 },
            { name: 'Victoria', red: 52, green: 122, blue: 196 },
        ]);
        // Defensive-only (same as the shape-click tests below): on Firefox, a click
        // on the legend control can occasionally also bubble through to the map's
        // own click handler despite TopRightControl's disableClickPropagation().
        await mockOccurrencesInfo(page, seenUrls, []);
        await loadResults(page);
        await openMapTab(page, seenUrls);

        await page.locator('#colourBySelect').selectOption('state');

        // The legend control starts collapsed (its own local isOpen state, reset
        // to false whenever the facets prop changes) -- expand it after selecting.
        await page.locator('#mapLegendControls').click();
        await expect(page.locator('#facetCheckbox-0')).toBeVisible();
        await expect(page.locator('#mapLegendControls')).toContainText('New South Wales');
        await expect(page.locator('#mapLegendControls')).toContainText('Victoria');

        const [request] = await Promise.all([
            page.waitForRequest(req => req.url().includes('/ogc/wms/reflect') && req.url().includes('HQ=0'), { timeout: 10000 }),
            page.locator('#facetCheckbox-0').uncheck(),
        ]);
        expect(request.url()).toContain('HQ=0');

        // The "X" collapses the legend control back down.
        await page.locator('#mapLegendControls').getByText('X', { exact: true }).click();
        await expect(page.locator('#facetCheckbox-0')).toHaveCount(0);
    });

    test('selecting "Record density grid" shows the density legend image and switches the WMS style to grid mode', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockDensityLegend(page, seenUrls);
        await loadResults(page);
        await openMapTab(page, seenUrls);

        const [request] = await Promise.all([
            // getAlaWmsUrl() inserts the "colormode:grid" style token as a raw
            // (non-encodeURIComponent'd) string -- the colon is a syntactically
            // valid, unencoded query-string character, so it reaches the network
            // layer literally as "colormode:grid", not "colormode%3Agrid".
            page.waitForRequest(req => req.url().includes('/ogc/wms/reflect') && req.url().includes('colormode:grid'), { timeout: 10000 }),
            page.locator('#colourBySelect').selectOption('grid'),
        ]);
        expect(request.url()).toContain('colormode:grid');

        await page.locator('#mapLegendControls').click();
        await expect(page.locator('#mapLegendControls').locator('img[alt="Legend"]')).toBeVisible({ timeout: 10000 });
    });
});

test.describe('MapView shape-click popups (drawn/loaded areas)', () => {
    test('drawing a rectangle then clicking it shows a species/occurrence count popup; the remove-area link deletes the shape', async ({ page }) => {
        const seenUrls = await setupMocks(page, {
            biocache: { totalRecords: 12345 },
            occurrenceFacets: { scientificName: { count: 42, fieldResult: [] } },
        });
        // Defensive-only: on Firefox, clicking the freshly-drawn interactive layer
        // occasionally also bubbles a click through to the underlying map's OWN
        // click handler (mapClick()) alongside the layer's own onFeatureClick() --
        // harmless here (an empty occurrences list never opens a second popup) but
        // otherwise throws via logMissingMocks since /occurrences/info isn't
        // otherwise mocked in this test.
        await mockOccurrencesInfo(page, seenUrls, []);
        await loadResults(page);
        await openMapTab(page, seenUrls);

        const map = page.locator('.leaflet-container').first();
        await page.locator('.leaflet-draw-draw-rectangle').click();
        // The map's centre often sits below the default viewport height -- raw
        // page.mouse coordinates (unlike locator.click()) don't auto-scroll, so an
        // explicit scroll first is required before doing coordinate-based mouse math.
        await map.scrollIntoViewIfNeeded();
        const box = (await map.boundingBox())!;
        await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.35);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.65, { steps: 5 });
        await page.mouse.up();

        // Locating by element + .click() (not raw coordinate math) reliably lands
        // inside the drawn shape, per the same convention established for the
        // Spatial-search map's identical draw+click flow in acceptance.spec.ts.
        await page.locator('.leaflet-interactive').first().click();

        const popup = page.locator('.leaflet-popup-content');
        await expect(popup).toBeVisible();
        await expect(popup).not.toContainText('calculating...', { timeout: 10000 });
        await expect(popup).toContainText('12345');
        await expect(popup).toContainText('42');
        await expect(popup.locator('a[href*="/occurrences/search?"]')).toHaveCount(1);

        await popup.locator('#remove-area-btn').click();
        await expect(page.locator('.leaflet-popup-content')).toHaveCount(0);
        await expect(page.locator('.leaflet-interactive')).toHaveCount(0);
    });

    test('drawing a circle then clicking it builds a radius/lat/lon area link in the popup', async ({ page }) => {
        const seenUrls = await setupMocks(page, {
            biocache: { totalRecords: 500 },
            occurrenceFacets: { scientificName: { count: 8, fieldResult: [] } },
        });
        // See the rectangle test above for why this defensive mock is here too.
        await mockOccurrencesInfo(page, seenUrls, []);
        await loadResults(page);
        await openMapTab(page, seenUrls);

        const map = page.locator('.leaflet-container').first();
        await page.locator('.leaflet-draw-draw-circle').click();
        await map.scrollIntoViewIfNeeded();
        const box = (await map.boundingBox())!;
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.5 + 60, box.y + box.height * 0.5, { steps: 5 });
        await page.mouse.up();

        await page.locator('.leaflet-interactive').first().click();
        const popup = page.locator('.leaflet-popup-content');
        await expect(popup).toBeVisible();
        await expect(popup).not.toContainText('calculating...', { timeout: 10000 });

        const link = popup.locator('a[href*="/occurrences/search?"]');
        await expect(link).toHaveAttribute('href', /radius=/);
        await expect(link).toHaveAttribute('href', /lat=/);
        await expect(link).toHaveAttribute('href', /lon=/);
    });
});

test.describe('MapView map-click record lookup popup', () => {
    test('clicking empty map area opens a record popup with Prev/Next navigation between the returned occurrences', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        const uuid1 = 'popup-rec-001';
        const uuid2 = 'popup-rec-002';
        await mockOccurrencesInfo(page, seenUrls, [uuid1, uuid2]);
        await mockRelatedOccurrence(page, seenUrls, {
            [uuid1]: { raw: { occurrence: { catalogNumber: 'CAT-001' } }, processed: { uuid: uuid1, classification: { scientificName: 'Acacia dealbata' } } },
            [uuid2]: { raw: { occurrence: { catalogNumber: 'CAT-002' } }, processed: { uuid: uuid2, classification: { scientificName: 'Acacia melanoxylon' } } },
        });
        await loadResults(page);
        await openMapTab(page, seenUrls);

        const map = page.locator('.leaflet-container').first();
        await map.scrollIntoViewIfNeeded();
        const box = (await map.boundingBox())!;
        // A plain click in the middle of the map (no drawn/loaded shape there) hits
        // MapClickHandler's single-click path (400ms debounce to rule out a dblclick)
        // rather than onFeatureClick().
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

        const popup = page.locator('.leaflet-popup-content');
        await expect(popup).toContainText('Viewing 1 of 2 occurrences', { timeout: 10000 });
        await expect(popup).toContainText('CAT-001');
        await expect(popup).toContainText('Acacia dealbata');
        await expect(popup.locator('a', { hasText: 'View record' })).toHaveAttribute('href', `/occurrence/${uuid1}`);

        const buttons = popup.locator('button');
        await expect(buttons.nth(0)).toBeDisabled(); // "< prev" disabled on the first item
        await buttons.nth(1).click(); // "next >"
        await expect(popup).toContainText('Viewing 2 of 2 occurrences', { timeout: 10000 });
        await expect(popup).toContainText('CAT-002');
        await expect(buttons.nth(1)).toBeDisabled(); // "next >" disabled on the last item

        await buttons.nth(0).click(); // "< prev"
        await expect(popup).toContainText('Viewing 1 of 2 occurrences', { timeout: 10000 });
    });
});
