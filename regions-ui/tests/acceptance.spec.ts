import { test, expect } from './fixtures';
import { isLiveMode, getBaseUrl, shouldSkip } from './mocks/liveConfig';
import { mapMocks } from './mocks/layerServiceMocks';
import { apiMocks } from './mocks/apiMocks';
import { logMissingMocks } from './mocks/logMissingMocks';
import { staticServerMocks } from './mocks/staticServerMocks';

/**
 * Parse a formatted count produced by FormatNumber.tsx, e.g. "4.56M", "13,478", "1.2B",
 * into a raw number so it can be compared numerically (see live-config.json overrides,
 * which relax these to "gte <current live value>" rather than an exact mock-only match).
 */
function parseFormattedCount(s: string): number {
    const clean = s.replace(/,/g, '');
    if (clean.endsWith('B')) return parseFloat(clean) * 1e9;
    if (clean.endsWith('M')) return parseFloat(clean) * 1e6;
    if (clean.endsWith('K')) return parseFloat(clean) * 1e3;
    return parseFloat(clean);
}


test.beforeEach(async ({ page }) => {
    if (!isLiveMode()) {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls); // must be first otherwise it will intercept all requests
        await staticServerMocks(page, seenUrls);
        await mapMocks(page, seenUrls);
        await apiMocks(page, seenUrls);
    }
});

test('build-info', async ({ page }) => {
    test.skip(shouldSkip('build-info'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl());

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // get build info meta tag
    const jsonContent = await page
        .locator('meta[name="buildInfo"]')
        .first()
        .getAttribute('content');
    const buildInfo = JSON.parse(jsonContent || '{}');

    // confirm it has the expected properties
    expect(buildInfo).toHaveProperty('commit');
    expect(buildInfo).toHaveProperty('branch');
    expect(buildInfo).toHaveProperty('buildDate');

    // confirm title
    await expect(page).toHaveTitle(/Regions | Atlas of Living Australia/);
});

/**
 * A long test to open and close accordions, and check the state of the map layers:
 * - checks default accordion is open and the default layer is loaded
 * - collapses the default accordion, and checks state
 * - opens a second layer accordion, and checks state
 * - opens the "other" layer accordion, and checks state
 * - opens the default accordion (again), and checks state
 */
test('accordion-interactivity', async ({ page }) => {
    test.skip(shouldSkip('accordion-interactivity'), 'Skipped via live-config.json skip list');
    await page.goto(getBaseUrl());

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Locate the accordion button with the text "States and territories"
    const accordionButton = page.locator('button.accordion-button', {
        hasText: 'States and territories',
    });

    await expect(accordionButton).toBeVisible();

    // Verify the parent h2's next sibling div has the "show" class
    const accordionContent = accordionButton.locator(
        'xpath=../following-sibling::div'
    );
    await expect(accordionContent).toHaveClass(/show/);

    // Verify no other accordion-collapse divs have the "show" class, as it should be the only one expanded
    const otherAccordions = page.locator(
        'div.accordion-collapse.collapse:not(.show)'
    );
    await expect(otherAccordions).toHaveCount(
        (await page.locator('div.accordion-collapse.collapse').count()) - 1
    );

    // Verify that it is actually visible by checking some of the content is visible
    const actContent = accordionContent.locator('p', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    const nswContent = accordionContent.locator('p', {
        hasText: 'NEW SOUTH WALES',
    });
    await expect(actContent).toBeVisible();
    await expect(nswContent).toBeVisible();

    // Verify a collapse
    await accordionButton.click(); // collapse the accordion
    await expect(accordionContent).not.toHaveClass(/show/); // content is now collapsed
    const otherAccordions2 = page.locator(
        'div.accordion-collapse.collapse:not(.show)'
    );
    await expect(otherAccordions2).toHaveCount(
        await page.locator('div.accordion-collapse.collapse').count()
    ); // no accordions open
    const leafletLayers2 = page.locator('div.leaflet-layer');
    expect(await leafletLayers2.count()).toEqual(1); // only the base layer is visible

    // Verify a second accordion
    const secondAccordionButton = page.locator('button.accordion-button', {
        hasText: 'Local government',
    });
    await expect(secondAccordionButton).toBeVisible(); // check the button is visible
    await secondAccordionButton.click();
    const accordionContent2 = secondAccordionButton.locator(
        'xpath=../following-sibling::div'
    ); // get the content div for this button
    await expect(accordionContent2).toHaveClass(/show/); // content is now expanded
    const otherAccordions3 = page.locator(
        'div.accordion-collapse.collapse:not(.show)'
    );
    await expect(otherAccordions3).toHaveCount(
        (await page.locator('div.accordion-collapse.collapse').count()) - 1
    ); // only one accordion open
    const adelaideCityCouncilContent = accordionContent2.locator('p', {
        hasText: 'ADELAIDE CITY COUNCIL',
    });
    const alpineShireContent = accordionContent2.locator('p', {
        hasText: 'ALPINE SHIRE',
    });
    await expect(adelaideCityCouncilContent).toBeVisible(); // check some of the content is visible
    await expect(alpineShireContent).toBeVisible(); // check some of the content is visible
    const leafletLayers3 = page.locator('div.leaflet-layer');
    expect(await leafletLayers3.count()).toEqual(2); // base layer and this layer are visible

    // Verify the "other layers" accordion
    const otherAccordionButton = page.locator('button.accordion-button', {
        hasText: 'Other regions',
    });
    // scroll into view
    await otherAccordionButton.scrollIntoViewIfNeeded();
    await expect(otherAccordionButton).toBeVisible(); // check the button is visible
    await otherAccordionButton.click();
    const accordionContent3 = otherAccordionButton.locator(
        'xpath=../following-sibling::div'
    ); // get the content div for this button
    await expect(accordionContent3).toHaveClass(/show/); // content is now expanded
    const otherAccordions4 = page.locator(
        'div.accordion-collapse.collapse:not(.show)'
    );
    await expect(otherAccordions4).toHaveCount(
        (await page.locator('div.accordion-collapse.collapse').count()) - 1
    ); // only one accordion open
    const otherContent1 = accordionContent3.locator('p', {
        hasText: 'Great Eastern Ranges Initiative',
    });
    const otherContent2 = accordionContent3.locator('p', {
        hasText: 'Directory of Important Wetlands',
    });
    await expect(otherContent1).toBeVisible(); // check some of the content is visible
    await expect(otherContent2).toBeVisible(); // check some of the content is visible
    const leafletLayers4 = page.locator('div.leaflet-layer');
    expect(await leafletLayers4.count()).toEqual(1); // base layer only is visible

    // Verify the default accordion, again
    await accordionButton.scrollIntoViewIfNeeded();
    await accordionButton.click();
    const accordionContent4 = accordionButton.locator(
        'xpath=../following-sibling::div'
    ); // get the content div for this button
    await expect(accordionContent4).toHaveClass(/show/); // content is now expanded
    const otherAccordions5 = page.locator(
        'div.accordion-collapse.collapse:not(.show)'
    );
    await expect(otherAccordions5).toHaveCount(
        (await page.locator('div.accordion-collapse.collapse').count()) - 1
    ); // only one accordion open
    const actContent2 = accordionContent.locator('p', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    const nswContent2 = accordionContent.locator('p', {
        hasText: 'NEW SOUTH WALES',
    });
    await expect(actContent2).toBeVisible();
    await expect(nswContent2).toBeVisible();
    const leafletLayers5 = page.locator('div.leaflet-layer');
    expect(await leafletLayers5.count()).toEqual(2); // base layer and this layer are visible
});

/**
 * Test reset map
 * - zoom in (so we can test the reset map button)
 * - the reset map button after the zoom
 */
test('regions map controls', async ({ page }, testInfo) => {
    test.skip(shouldSkip('regions-map-controls'), 'Skipped via live-config.json skip list');

    if (testInfo.project.name === 'firefox' || testInfo.project.name === 'webkit') {
        test.skip(
            true,
            'Skipping this assertion for Firefox and WebKit due to page.route not firing as expected for previously seen URLs'
        );
    }

    await page.goto(getBaseUrl());

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    const zoomInButton = page.locator('a.leaflet-control-zoom-in');
    await expect(zoomInButton).toBeVisible(); // check the button is visible

    await zoomInButton.click(); // click the button
    await page.waitForTimeout(1000); // wait for the map to load

    // reset is now enabled
    const resetButton = page.locator('button', { hasText: 'Reset map' });
    await expect(resetButton).toBeVisible(); // check the button is visible
    await expect(resetButton).toBeEnabled(); // check the button is enabled

    // click the reset button
    await resetButton.click(); // click the button
    await page.waitForTimeout(500); // wait for the map to load
    await expect(resetButton).toBeDisabled(); // check the button is disabled
});

/**
 * Test layer item selection from the expanded list and checkboxes
 */
test('regions checkboxes', async ({ page }) => {
    test.skip(shouldSkip('regions-checkboxes'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl());

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    const actContent = page.locator('p', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(actContent).toBeVisible(); // check some of the content is visible
    await actContent.click(); // click the region

    await page.waitForTimeout(500); // wait for the map to load

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count(), 'regions-checkboxes.leafletLayerCount').toEqual(3); // base layer, this layer, and this region are visible

    // look for popup
    const popup = page.locator('div.leaflet-popup-content');
    expect(await popup.count()).toEqual(1); // check the popup is visible
    const popupText = await popup.textContent();
    expect(popupText).toContain('AUSTRALIAN CAPITAL TERRITORY'); // check the popup has the expected text

    // uncheck the All regions checkbox
    const checkbox = page.locator('input.all-regions-cb');
    await checkbox.scrollIntoViewIfNeeded();
    await expect(checkbox).toBeVisible(); // check the checkbox is visible
    await expect(checkbox).toBeChecked(); // check the checkbox is checked
    await checkbox.click(); // click the checkbox
    await expect(checkbox).not.toBeChecked(); // check the checkbox is unchecked
    const leafletLayers2 = page.locator('div.leaflet-layer');
    expect(await leafletLayers2.count()).toEqual(2); // base layer, this region

    // uncheck the Selected region checkbox
    const checkbox2 = page.locator('input.selected-regions-cb');
    await checkbox2.scrollIntoViewIfNeeded();
    await expect(checkbox2).toBeVisible(); // check the checkbox is visible
    await expect(checkbox2).toBeChecked(); // check the checkbox is checked
    await checkbox2.click(); // click the checkbox
    await expect(checkbox2).not.toBeChecked(); // check the checkbox is unchecked
    const leafletLayers3 = page.locator('div.leaflet-layer');
    expect(await leafletLayers3.count()).toEqual(1); // base layer only is visible

    // check all regions checkbox to make the layer visible
    await checkbox.click(); // click the checkbox
    await expect(checkbox).toBeChecked(); // check the checkbox is checked
    const leafletLayers4 = page.locator('div.leaflet-layer');
    expect(await leafletLayers4.count()).toEqual(2); // base layer only, this layer

    // check the selected region checkbox to make the region visible
    await checkbox2.click(); // click the checkbox
    await expect(checkbox2).toBeChecked(); // check the checkbox is checked
    const leafletLayers5 = page.locator('div.leaflet-layer');
    expect(await leafletLayers5.count()).toEqual(3); // base layer, this layer, this region
});

/**
 * Test layer item selection from a map click, and test the popup link
 */
test('map click region selection', async ({ page }) => {
    test.skip(shouldSkip('map-click-region-selection'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl());

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // click the map
    const map = page.locator('div.leaflet-container');
    // Click the centre of the map container (default click position). The centre pixel always
    // corresponds to the map's configured centre coordinate (lat -28, lng 133 — inland South
    // Australia), which is a large region far from any border, unlike an arbitrary fixed offset
    // which may land in open ocean on the real map. The mocked intersect endpoint ignores click
    // position entirely (always returns ACT), so this has no effect on mock-mode behaviour.
    await map.click();
    await page.waitForTimeout(1000); // wait for the map to load

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count(), 'map-click.leafletLayerCount').toEqual(3); // base layer, this layer, and this region are visible

    // look for popup
    const popup = page.locator('div.leaflet-popup-content');
    expect(await popup.count()).toEqual(1); // check the popup is visible
    const popupText = await popup.textContent();

    expect(popupText, 'map-click.regionName').toContain('AUSTRALIAN CAPITAL TERRITORY'); // check the popup has the expected text

    // confirm the popup has a link; clicking it navigates to the region page for the clicked pid
    const popupLink = popup.locator('a');
    expect(await popupLink.count()).toEqual(1); // check the link is visible
    const popupLinkText = await popupLink.textContent();
    expect(popupLinkText, 'map-click.regionName').toContain('AUSTRALIAN CAPITAL TERRITORY');
    await popupLink.click(); // click the link
    await page.waitForTimeout(1000); // wait for the page to load
    const url = page.url();
    expect(url, 'map-click.regionUrl').toContain('/region?id=8832857'); // check the url is correct
});

/**
 * Test zoom to region button
 */
test('zoom to region', async ({ page }) => {
    test.skip(shouldSkip('zoom-to-region'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl());

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    const actContent = page.locator('p', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(actContent).toBeVisible(); // check some of the content is visible
    await actContent.click(); // click the region

    // Verify the zoom to region button
    const zoomToRegionButton = page.locator('button', {
        hasText: 'Zoom to region',
    });
    await expect(zoomToRegionButton).toBeVisible(); // check the button is visible
    await expect(zoomToRegionButton).toBeEnabled(); // check the button is enabled
    await zoomToRegionButton.click(); // click the button

    await page.waitForTimeout(1000); // wait for the map to load

    // reset is now enabled
    const resetButton = page.locator('button', { hasText: 'Reset map' });
    await expect(resetButton).toBeVisible(); // check the button is visible
    await expect(resetButton).toBeEnabled(); // check the button is enabled
});

/**
 * Test open region link above the map
 */
test('open region page from button above the map', async ({ page }) => {
    test.skip(shouldSkip('open-region-page-from-button'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl());

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    const actContent = page.locator('p', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(actContent).toBeVisible(); // check some of the content is visible
    await actContent.click(); // click the region

    // Verify the zoom to region button
    const zoomToRegionButton = page.locator('button', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(zoomToRegionButton).toBeVisible(); // check the button is visible
    await expect(zoomToRegionButton).toBeEnabled(); // check the button is enabled
    await zoomToRegionButton.click(); // click the button

    // Verify the page opened
    await page.waitForTimeout(1000); // wait for the page to load
    const url = page.url();
    expect(url).toContain('/region?id=8832857'); // check the url is correct
});

/**
 * Test hashes 1
 */
test('hash test - layer & region', async ({ page }) => {
    test.skip(shouldSkip('hash-test-layer-and-region'), 'Skipped via live-config.json skip list');

    await page.goto(
        getBaseUrl() + '/#layer=States+and+territories&region=AUSTRALIAN+CAPITAL+TERRITORY'
    );

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count(), 'hash-layer-region.leafletLayerCount').toEqual(3); // base layer, this layer, and this region are visible

    // Verify the zoom to region button
    const zoomToRegionButton = page.locator('button', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(zoomToRegionButton).toBeVisible(); // check the button is visible
    await expect(zoomToRegionButton).toBeEnabled(); // check the button is enabled
    await zoomToRegionButton.click(); // click the button

    // Verify the page opened
    await page.waitForTimeout(1000); // wait for the page to load
    const url = page.url();
    expect(url).toContain('/region?id=8832857'); // check the url is correct
});

/**
 * Test hashes 2
 */
test('hash test - layer only', async ({ page }) => {
    test.skip(shouldSkip('hash-test-layer-only'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl() + '/#layer=Local+government');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 2 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count(), 'hash-layer-only.leafletLayerCount').toEqual(2); // base layer, this layer
});

/**
 * Test hashes 3
 */
test('hash test - other regions', async ({ page }) => {
    test.skip(shouldSkip('hash-test-other-regions'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl() + '/#layer=OTHER_REGIONS');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 1 layer is now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count(), 'hash-other-regions.leafletLayerCount').toEqual(1); // base layer
});

/**
 * Test hashes 4
 */
test('hash test - other regions & layer', async ({ page }) => {
    test.skip(shouldSkip('hash-test-other-regions-and-layer'), 'Skipped via live-config.json skip list');

    await page.goto(
        getBaseUrl() + '/#layer=Great+Eastern+Ranges+Initiative'
    );

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 2 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count(), 'hash-other-regions-layer.leafletLayerCount').toEqual(2); // base layer, this layer
});

/**
 * Test region page default info
 */
test('region page default info', async ({ page }) => {
    test.skip(shouldSkip('region-page-default-info'), 'Skipped via live-config.json skip list');
    test.setTimeout(120000); //Increase timeout for popup windows in headed mode

    await page.goto(getBaseUrl() + '/region?id=8832857');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count(), 'region-default.leafletLayerCount').toEqual(3); // base layer, this area, species points

    // Verify area name is visible
    const breadcrumb = page.locator('li', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(breadcrumb).toBeVisible(); // check the breadcrumb is visible
    const h2 = page.locator('h2', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' });
    await expect(h2).toBeVisible(); // check the button is visible

    // Verify counts
    const occurrenceCount = page.locator('h3').filter({ hasText: /^Occurrence records/ });
    await expect(occurrenceCount).toBeVisible(); // check the count is visible
    const occurrenceCountMatch = (await occurrenceCount.innerText()).match(/\(([\d.,]+[MKB]?)\)/);
    expect(occurrenceCountMatch).not.toBeNull(); // structural: heading must contain a formatted count
    const occurrenceCountValue = parseFormattedCount(occurrenceCountMatch![1]);
    expect(occurrenceCountValue, 'region-default.occurrenceRecordsCount').toBe(4310000); // "4.31M" from species.json's 4,312,479, rounded by formatNumber()

    const speciesCount = page.locator('h3').filter({ hasText: /^Number of species/ });
    await expect(speciesCount).toBeVisible(); // check the count is visible
    const speciesCountMatch = (await speciesCount.innerText()).match(/\(([\d,]+)\)/);
    expect(speciesCountMatch).not.toBeNull();
    const speciesCountValue = parseFormattedCount(speciesCountMatch![1]);
    expect(speciesCountValue, 'region-default.speciesCount').toBe(271); // count from species.json

    // Verify some species groups
    const speciesGroup1 = page.locator('div.speciesItem', {
        hasText: 'All Species',
    });
    const speciesGroup2 = page.locator('div.speciesItem', {
        hasText: 'Mammals',
    });
    const speciesGroup3 = page.locator('div.speciesItem', {
        hasText: 'Bacteria',
    });
    await expect(speciesGroup1).toBeVisible(); // check the species group is visible
    await expect(speciesGroup2).toBeVisible(); // check the species group is visible
    await expect(speciesGroup3).toBeVisible(); // check the species group is visible

    // Verify some species
    const species1 = page.locator('div[class^="_speciesName_"]', {
        hasText: 'Aaaaba nodosus',
    });
    const species2 = page.locator('div[class^="_speciesName_"]', {
        hasText: 'Abantiades labyrinthicus',
    });
    await expect(species1).toBeVisible(); // check the species is visible
    await expect(species2).toBeVisible(); // check the species is visible
});

/**
 * Test ACT details
 */
test('region ACT details', async ({ page, context }) => {
    test.skip(shouldSkip('region-act-details'), 'Skipped via live-config.json skip list');

    await context.route(/https?:\/\/bie\..*\/species\/.*/, async route => {
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<html lang="en"></html>' });
    });

    test.setTimeout(120000);

    await page.goto(getBaseUrl() + '/region?id=8832857#layer=States+and+territories&region=AUSTRALIAN+CAPITAL+TERRITORY');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count(), 'region-act.leafletLayerCount').toEqual(3); // base layer, this area, species points

    // Verify area name is visible
    const breadcrumb = page.locator('li', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(breadcrumb).toBeVisible(); // check the breadcrumb is visible
    const h2 = page.locator('h2', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' });
    await expect(h2).toBeVisible(); // check the button is visible

    // Verify counts
    const occurrenceHeading = page.getByRole('heading', { name: /^Occurrence records/ });
    await expect(occurrenceHeading).toBeVisible();
    const occurrenceHeadingMatch = (await occurrenceHeading.innerText()).match(/\(([\d.,]+[MKB]?)\)/);
    expect(occurrenceHeadingMatch).not.toBeNull();
    const occurrenceHeadingValue = parseFormattedCount(occurrenceHeadingMatch![1]);
    expect(occurrenceHeadingValue, 'region-act.occurrenceRecordsCount').toBe(4310000); // "4.31M" rounded, see region-default test

    const speciesCount = page.getByRole('heading', { name: /^Number of species/ });
    await expect(speciesCount).toBeVisible(); // check the count is visible
    const speciesCountMatch = (await speciesCount.innerText()).match(/\(([\d,]+)\)/);
    expect(speciesCountMatch).not.toBeNull();
    const speciesCountValue = parseFormattedCount(speciesCountMatch![1]);
    expect(speciesCountValue, 'region-act.speciesCount').toBe(271);

    // Verify some species
    const speciesAF = page.locator('div[class^="_speciesName_"]', {
        hasText: 'Aaaaba fossicollis',
    });
    const species2 = page.locator('div[class^="_speciesName_"]', {
        hasText: 'Abantiades labyrinthicus',
    });
    await expect(speciesAF).toBeVisible(); // check the species is visible
    await expect(species2).toBeVisible(); // check the species is visible

    const speciesAFCount = speciesAF.locator('xpath=following-sibling::div[@data-testid="speciesCount"]');
    var speciesCountAFText = await speciesAFCount.textContent();
    await speciesCountAFText === '16' ; // check the species count is correct

    await speciesAF.click();
    const speciesProfileButton = page.locator('button', { hasText: 'Species profile' });
    await expect(speciesProfileButton).toBeVisible();

    const listRecordsButton = page.locator('button', { hasText: 'List records' });
    await expect(listRecordsButton).toBeVisible();

    const viewRecordsButton = page.locator('button', { hasText: 'View records' });
    await expect(listRecordsButton).toBeVisible();

    await expect(listRecordsButton).toBeVisible();

    const [biePage] = await Promise.all([
        page.waitForEvent('popup'),
        speciesProfileButton.click(),
    ]);

    const biePageUrl = biePage.url();
    // Static prefix is structural (doesn't vary between mock/live) — checked unconditionally.
    // The GUID itself is the species' real taxon identifier, which legitimately differs between
    // the mock fixture and the live namematching lookup, so only its *format* is verified.
    expect(biePageUrl).toMatch(/species\/https:\/\/biodiversity\.org\.au\/afd\/taxa\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

    const [biocachePage] = await Promise.all([
        page.waitForEvent('popup'),
        listRecordsButton.click(),
    ]);
    await expect(biocachePage).not.toBeNull();

    const biocacheUrl = biocachePage.url();
    const parsedUrl = new URL(biocacheUrl);
    expect(parsedUrl.pathname).toBe('/occurrences/search');
    expect(parsedUrl.searchParams.get('q')).toContain('cl10925:"AUSTRALIAN CAPITAL TERRITORY"');
    expect(parsedUrl.searchParams.getAll('fq')).toEqual(expect.arrayContaining([
        'species:"Aaaaba fossicollis"',
        'species:*',
        expect.stringContaining('occurrenceYear:[1820-01-01T00:00:00Z TO')
    ]));

    const [viewBiocachePage] = await Promise.all([
        page.waitForEvent('popup'),
        viewRecordsButton.click(),
    ]);
    await expect(viewBiocachePage).not.toBeNull();
    await expect(viewBiocachePage).toHaveURL(/occurrences\/search\?q=.+/);

    const viewBiocacheUrl = viewBiocachePage.url();
    const parsedviewBiocacheUrl = new URL(viewBiocacheUrl);

    expect(parsedviewBiocacheUrl.pathname).toBe('/occurrences/search');
    expect(parsedviewBiocacheUrl.searchParams.get('q')).toBe('cl10925:"AUSTRALIAN CAPITAL TERRITORY"');
    expect(parsedviewBiocacheUrl.searchParams.getAll('fq')).toEqual(expect.arrayContaining([
        'species:"Aaaaba fossicollis"',
        'species:*',
        expect.stringContaining('occurrenceYear:[1820-01-01T00:00:00Z TO')
    ]));

    const wmsTileForOccurrences = page.locator('.leaflet-tile-container img[src*="ALA%3Aoccurrences"]');
    const tileCount = await wmsTileForOccurrences.count();
    expect(tileCount, 'region-act.occurrenceTileCount').toBe(12);

    //Range slider
    const rangeContainer = page.locator('[data-testid="rangeSelection"]').locator('..'); // move up one level
    const minSlider = rangeContainer.locator('button[aria-label="minimum"]');
    const maxSlider = rangeContainer.locator('button[aria-label="maximum"]');
    await expect(minSlider).toBeVisible();
    await expect(minSlider).toBeEnabled();
    await expect(maxSlider).toBeVisible();
    await expect(maxSlider).toBeEnabled();
    var minValue = await minSlider.getAttribute('aria-valuenow');
    const maxValue = await maxSlider.getAttribute('aria-valuenow');
    expect(minValue).toBe('1820');
    expect(maxValue, 'region-act.sliderMaxYear').toBe(String(new Date().getFullYear()));
    const minSliderBBox = await minSlider.boundingBox();
    const maxSliderBBox = await maxSlider.boundingBox();

    if (minSliderBBox && maxSliderBBox) {
        await minSlider.dragTo(maxSlider);
        const dateRangeText = page.locator('[data-testid="dateRangeSelection"] p');
        const currentYear = new Date().getFullYear();
        await expect(dateRangeText).toHaveText(new RegExp(`2025 - ${currentYear}`));

        // A forced click is required for Firefox to trigger the interaction.
        // In Chrome, it succeeds in headed mode without the force click but fails when running headless.
        //
        // The click's mouseup should trigger yearRangeEnd (which re-fetches the species list for
        // the new range — see Region.tsx), but on a real network the first forced click after the
        // drag occasionally isn't registered as a genuine change-end (confirmed with a standalone
        // script against regions.test.ala.org.au: a second click reliably completes it, ~1-2s
        // after the request fires). Retry rather than relying on exactly one click.
        await expect(async () => {
            await minSlider.click({force: true});
            await expect(speciesAFCount).not.toHaveText(speciesCountAFText ?? '', { timeout: 3000 });
        }).toPass({ timeout: 15000 });
    }
});

/**
 * Test play/stop button on date range slider
 */
test('play buttons on date range slider', async ({ page }) => {
    test.skip(shouldSkip('play-buttons-on-date-range-slider'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl() + '/region?id=8832857#layer=States+and+territories&region=AUSTRALIAN+CAPITAL+TERRITORY');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count(), 'play-slider.leafletLayerCount').toEqual(3); // base layer, this area, species points

    // Verify area name is visible
    const breadcrumb = page.locator('li', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(breadcrumb).toBeVisible(); // check the breadcrumb is visible
    const h2 = page.locator('h2', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' });
    await expect(h2).toBeVisible(); // check the button is visible

    // Verify counts
    const occurrenceHeading = page.getByRole('heading', { name: /^Occurrence records/ });
    await expect(occurrenceHeading).toBeVisible();
    const occurrenceHeadingMatch = (await occurrenceHeading.innerText()).match(/\(([\d.,]+[MKB]?)\)/);
    expect(occurrenceHeadingMatch).not.toBeNull();
    const occurrenceHeadingValue = parseFormattedCount(occurrenceHeadingMatch![1]);
    expect(occurrenceHeadingValue, 'play-slider.occurrenceRecordsCount').toBe(4310000); // "4.31M" rounded, see region-default test

    //Range slider
    const rangeContainer = page.locator('[data-testid="rangeSelection"]').locator('..'); // move up one level
    const minSlider = rangeContainer.locator('button[aria-label="minimum"]');
    const maxSlider = rangeContainer.locator('button[aria-label="maximum"]');
    await expect(minSlider).toBeVisible();
    await expect(minSlider).toBeEnabled();
    await expect(maxSlider).toBeVisible();
    await expect(maxSlider).toBeEnabled();
    var minValue = await minSlider.getAttribute('aria-valuenow');
    const maxValue = await maxSlider.getAttribute('aria-valuenow');
    expect(minValue).toBe('1820');
    expect(maxValue, 'play-slider.sliderMaxYear').toBe(String(new Date().getFullYear()));
    const minSliderBBox = await minSlider.boundingBox();
    const maxSliderBBox = await maxSlider.boundingBox();

    if (minSliderBBox && maxSliderBBox) {
        const playIcon = page.locator('i.bi.bi-play');
        await playIcon.click();
        const dateRangeText = page.locator('[data-testid="dateRangeSelection"] p');
        const ranges = [/1820 - 1830/,/1830 - 1840/, /1840 - 1850/];

        for (const range of ranges) {
            await expect(dateRangeText).toHaveText(range, { timeout: 2000 });
        }
    }
});

/**
 * Test taxon chart
 */
test('test taxon chart', async ({ page }) => {
    test.skip(shouldSkip('test-taxon-chart'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl() + '/region?id=8832857');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count(), 'taxon-chart.leafletLayerCount').toEqual(3); // base layer, this area, species points

    // Verify area name is visible
    const breadcrumb = page.locator('li', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(breadcrumb).toBeVisible(); // check the breadcrumb is visible

    const taxonomyTab = page.getByRole('tab', { name: 'Explore by taxonomy' });
    await expect(taxonomyTab).toBeVisible();
    await taxonomyTab.click();

    const chartContainer = page.locator('div[data-testid="taxonChartContainer"]');
    await expect(chartContainer).toBeVisible();
    const canvas = chartContainer.locator('canvas');
    await expect(canvas).toBeVisible();
    const bbox = await canvas.boundingBox();

    // Clicking on the canvas at center point
    // Not sure why canvas.click() does not work here
    expect(bbox).not.toBeNull();
    if (!bbox) {
        throw new Error('canvas boundingBox() returned null');
    }
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    await page.mouse.move(centerX, centerY);
    //Has to wait for a few seconds otherwise the click is not always detected
    await page.waitForTimeout(1000);
    await page.mouse.click(centerX, centerY);

    var previousRankBtn = page.locator('button', { hasText: 'Previous rank' });
    var viewRecordsBtn = page.locator('button', { hasText: 'View records for kingdom Animalia' });
    await previousRankBtn.scrollIntoViewIfNeeded();
    await viewRecordsBtn.scrollIntoViewIfNeeded();
    await expect(previousRankBtn).toBeVisible();
    await expect(viewRecordsBtn).toBeVisible();

    const [biocachePage] = await Promise.all([
        page.waitForEvent('popup'),
        viewRecordsBtn.click(),
    ]);

    await expect(biocachePage).not.toBeNull();
    const viewBiocacheUrl = biocachePage.url();
    const parsedviewBiocacheUrl = new URL(viewBiocacheUrl);
    expect(parsedviewBiocacheUrl.pathname).toBe('/occurrences/search');
    expect(parsedviewBiocacheUrl.searchParams.get('q'))
        .toBe('cl10925:"AUSTRALIAN CAPITAL TERRITORY"');

    expect(parsedviewBiocacheUrl.searchParams.getAll('fq')).toEqual(
        expect.arrayContaining([
            'kingdom:"Animalia"',
            'species:*',
            expect.stringContaining('occurrenceYear:[1820-01-01T00:00:00Z'),
        ]));
    await previousRankBtn.click();
    await page.waitForTimeout(1000);
    await expect(previousRankBtn).toBeHidden();   // or toBeDetached()
    await expect(viewRecordsBtn).toBeHidden();
});
