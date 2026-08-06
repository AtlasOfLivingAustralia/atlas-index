import { test, expect } from '../fixtures';
import { mockSession } from '../mocks/apiMocks';
import {
    load,
    setupMapMocks,
    setupRegionsListMock,
    setupRegionsMocks,
} from './helpers';

// ---------------------------------------------------------------------------
// Regions.tsx — branches NOT covered by acceptance tests
// ---------------------------------------------------------------------------

test.describe('Regions.tsx', () => {

    // -----------------------------------------------------------------------
    // handleMapClick — no intersection
    // When the intersect API returns an empty array the app does nothing
    // (no popup, no extra WMS layer). The seenUrls set will contain the
    // intersect request URL but the layer count must stay at 2 (base + layer).
    // -----------------------------------------------------------------------
    test('map click with no intersection result shows no popup and keeps 2 layers', async ({ page }) => {
        const seenUrls = new Set<URL>();
        const { logMissingMocks } = await import('../mocks/logMissingMocks');
        const { staticServerMocks } = await import('../mocks/staticServerMocks');
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await setupMapMocks(page, seenUrls);
        await setupRegionsListMock(page, seenUrls);

        // Return an empty intersection — no region under the click point.
        await page.route('**/spatial*.ala.org.au/ws/intersect/cl10925/*/*', async (route) => {
            const url = new URL(route.request().url());
            seenUrls.add(url);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([]),   // empty — no region found
            });
        });

        // Session must be mocked so checkLoginState does not leak to the network.
        await mockSession(page, seenUrls);

        await load(page);

        // Click in the middle of the map — will call the intersect API.
        const map = page.locator('div.leaflet-container');
        await map.click({ position: { x: 200, y: 200 } });
        await page.waitForTimeout(800);

        // No popup should appear.
        const popup = page.locator('div.leaflet-popup-content');
        expect(await popup.count()).toBe(0);

        // Layer count must stay at 2 (base tile + WMS layer for States).
        const layers = page.locator('div.leaflet-layer');
        expect(await layers.count()).toBe(2);
    });

    // -----------------------------------------------------------------------
    // setMapObject — same region clicked twice
    // Clicking the same region a second time hits the
    //   `selectedObject.pid === obj.pid`
    // branch which calls openObject() immediately (navigates to /region?id=…).
    // -----------------------------------------------------------------------
    test('clicking the same region twice navigates to the region page', async ({ page }) => {
        await setupRegionsMocks(page);
        await load(page);

        const actContent = page.locator('p', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' });
        await expect(actContent).toBeVisible();

        // First click — selects the region.
        await actContent.click();
        await page.waitForTimeout(600);

        // Verify a popup appeared (region is now selected).
        const popup = page.locator('div.leaflet-popup-content');
        await expect(popup).toBeVisible();

        // Second click on the same region — hits the pid === obj.pid branch
        // which calls openObject() and navigates to the region detail page.
        await actContent.click();
        await page.waitForTimeout(800);

        expect(page.url()).toContain('/region?id=8832857');
    });

    // -----------------------------------------------------------------------
    // setMapObject — layer switch resets zoom
    // When the user opens a different accordion panel while a region is
    // selected, setMapObject is called with a different layerName.
    // The branch `selectedLayer.layerName != layer.layerName` fires and
    // resets selectedObject to null while switching the layer.
    // We verify that the object WMS overlay disappears (3→2 layers) and
    // the popup is gone.
    // -----------------------------------------------------------------------
    test('switching accordion layer while a region is selected clears the selection', async ({ page }) => {
        await setupRegionsMocks(page);
        await load(page);

        // Select a region in the default layer (States and territories).
        const actContent = page.locator('p', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' });
        await expect(actContent).toBeVisible();
        await actContent.click();
        await page.waitForTimeout(600);

        // Confirm selection: 3 layers and popup visible.
        expect(await page.locator('div.leaflet-layer').count()).toBe(3);
        await expect(page.locator('div.leaflet-popup-content')).toBeVisible();

        // Now switch to a different accordion (Local government).
        const secondAccordionButton = page.locator('button.accordion-button', {
            hasText: 'Local government',
        });
        await secondAccordionButton.click();
        await page.waitForTimeout(600);

        // The object overlay and popup should be cleared; only base + new layer remain.
        expect(await page.locator('div.leaflet-layer').count()).toBe(2);
        expect(await page.locator('div.leaflet-popup-content').count()).toBe(0);
    });

});
