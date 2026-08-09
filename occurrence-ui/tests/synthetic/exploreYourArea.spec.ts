import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { setupMocks, BASE_URL } from './helpers';
import { setupExploreMocks } from '../mocks/exploreMocks';
import { mockOccurrencesInfo } from '../mocks/biocacheMocks';
import { mockRelatedOccurrence } from '../mocks/recordMocks';

// ===========================================================================
// Synthetic coverage: src/views/ExploreYourArea.tsx (929 lines, 56.98% stmt
// coverage). acceptance.spec.ts's "Explore your area" describe block covers
// species-group loading/selection/sorting/radius/download-links/geolocation
// fallback, but never: the map-click occurrence-lookup popup (mapClick(),
// fetchOccurrence(), popupDiv(), next/prevOccurrence() -- a large,
// independent re-implementation of the same pattern already synthetic-tested
// for mapView.tsx), the "My location" custom Leaflet control button, an empty
// location-search submit, sorting by "Scientific Name" specifically, and the
// species-list fetch-failure branch.
// ===========================================================================

async function loadExploreYourArea(page: Page, lat = -35.28, lng = 149.13) {
    await page.goto(`${BASE_URL}/explore/your-area#latlng=${lat},${lng}`);
    await expect(page.locator('.leaflet-marker-icon')).toBeVisible({ timeout: 15000 });
}

test.describe('ExploreYourArea map-click occurrence-lookup popup', () => {
    test('clicking the search-radius circle opens a record popup with Prev/Next navigation', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        const uuid1 = 'eya-popup-rec-001';
        const uuid2 = 'eya-popup-rec-002';
        await mockOccurrencesInfo(page, seenUrls, [uuid1, uuid2]);
        await mockRelatedOccurrence(page, seenUrls, {
            [uuid1]: {
                raw: { occurrence: { catalogNumber: 'EYA-CAT-001', recordedBy: 'Jane Botanist' } },
                processed: {
                    uuid: uuid1,
                    classification: { scientificName: 'Acacia dealbata', taxonRankID: 7000 },
                    attribution: { institutionName: 'CSIRO' },
                    event: { eventDate: '2020-07-20' },
                },
            },
            [uuid2]: {
                raw: { occurrence: { catalogNumber: 'EYA-CAT-002' } },
                processed: { uuid: uuid2, classification: { scientificName: 'Acacia melanoxylon' } },
            },
        });
        await loadExploreYourArea(page);

        // The drawn Circle (the search-radius indicator) is the ONLY element in
        // ExploreYourArea.tsx wired to mapClick() -- there's no separate whole-map
        // click handler like mapView.tsx's MapClickHandler, so the click must land on
        // the circle's own interactive layer, not just anywhere on the map. The
        // draggable location Marker sits exactly at the circle's centre and would
        // intercept a dead-centre click, so click off-centre instead (still well
        // within the filled circle, which is hit-testable across its whole area).
        const map = page.locator('#leafletMap .leaflet-container');
        await map.scrollIntoViewIfNeeded();
        const circle = page.locator('.leaflet-interactive').first();
        const box = (await circle.boundingBox())!;
        await circle.click({ position: { x: box.width * 0.15, y: box.height * 0.5 } });

        const popup = page.locator('.leaflet-popup-content');
        await expect(popup).toBeVisible();
        await expect(popup).toContainText('Viewing 1 of 2 occurrences', { timeout: 10000 });
        await expect(popup).toContainText('EYA-CAT-001');
        await expect(popup).toContainText('CSIRO');
        await expect(popup).toContainText('Jane Botanist');
        await expect(popup).toContainText('Acacia dealbata');
        await expect(popup.locator('a', { hasText: 'View record' })).toHaveAttribute('href', `/occurrence/${uuid1}`);
        // search.map.viewAllRecords is translated to "view all" (not the JSX
        // default "view all records").
        await expect(popup.locator('a', { hasText: 'view all' })).toHaveAttribute('href', /occurrences\/search\?/);

        const buttons = popup.locator('button');
        await expect(buttons.nth(0)).toBeDisabled(); // "< Prev" disabled on the first item
        await buttons.nth(1).click(); // "Next >"
        await expect(popup).toContainText('Viewing 2 of 2 occurrences', { timeout: 10000 });
        await expect(popup).toContainText('EYA-CAT-002');
        await expect(buttons.nth(1)).toBeDisabled(); // "Next >" disabled on the last item

        await buttons.nth(0).click(); // "< Prev"
        await expect(popup).toContainText('Viewing 1 of 2 occurrences', { timeout: 10000 });
    });
});

test.describe('ExploreYourArea misc controls', () => {
    test('clicking the custom "My location" map control re-centres via geolocation', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await mockOccurrencesInfo(page, seenUrls, []);

        await page.addInitScript(() => {
            if (navigator.geolocation) {
                (navigator.geolocation as any).getCurrentPosition = (success: (pos: unknown) => void) => {
                    success({ coords: { latitude: -33.87, longitude: 151.21 } });
                };
            }
        });

        // Load with a DIFFERENT starting location so the "My location" click has an
        // observable effect (a change in addressText's coordinate fallback).
        await loadExploreYourArea(page, -35.28, 149.13);
        await expect(page.getByText('-35.2800, 149.1300')).toBeVisible();

        await page.locator('#my-location-btn').click();

        await expect(page.getByText('-33.8700, 151.2100')).toBeVisible({ timeout: 10000 });
    });

    test('submitting the location search box while empty does nothing (no geocoding alert, no crash)', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await loadExploreYourArea(page);

        const alerts: string[] = [];
        page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });

        await page.getByPlaceholder(/street address/).fill('   '); // whitespace-only -- trim().length === 0
        await page.getByRole('button', { name: 'Search', exact: true }).click();
        await page.waitForTimeout(300);

        expect(alerts).toHaveLength(0);
    });

    test('sorting by "Scientific Name" re-orders the species list alphabetically by binomial', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        await loadExploreYourArea(page);

        await page.locator('span.speciesItem', { hasText: 'Birds' }).click();
        await expect(page.getByText('Superb Fairywren')).toBeVisible({ timeout: 10000 });

        const scientificNameCells = () => page.locator('table').last().locator('tbody tr td:nth-child(2)');
        await page.getByRole('columnheader', { name: 'Scientific Name' }).click();

        // Alphabetical by binomial: Dacelo novaeguineae, Gymnorhina tibicen, Malurus cyaneus.
        await expect(scientificNameCells().nth(0)).toHaveText('Dacelo novaeguineae');
        await expect(scientificNameCells().nth(1)).toHaveText('Gymnorhina tibicen');
        await expect(scientificNameCells().nth(2)).toHaveText('Malurus cyaneus');
    });

    test('a species-list fetch failure shows an empty list rather than leaving the spinner forever', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await setupExploreMocks(page, seenUrls);
        // Override AFTER setupExploreMocks() so this failing route wins. A real
        // network-level abort (not just an HTTP error status) is required to reach
        // fetchSpeciesList()'s .catch() -- the code never checks response.ok, so an
        // HTTP 500 with a valid (even empty) JSON body would flow through the
        // success branch instead.
        await page.context().route('https://biocache-ws.ala.org.au/ws/explore/group/**', route => route.abort());
        seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/explore/group/'));

        await loadExploreYourArea(page);

        await expect(page.getByText('No species found')).toBeVisible({ timeout: 10000 });
    });
});
