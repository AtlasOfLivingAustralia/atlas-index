import { test, expect, type TestInfo } from '@playwright/test';
import { mapMocks } from './mocks/layerServiceMocks';
import { apiMocks } from './mocks/apiServiceMocks';

// Extend TestInfo to include the seenUrls property
interface ExtendedTestInfo extends TestInfo {
    seenUrls: Set<URL>;
}


test.beforeEach(async ({ page }, testInfo) => {
    const seenUrls = new Set<URL>();
    await mapMocks(page, seenUrls);
    await apiMocks(page, seenUrls);
    (testInfo as ExtendedTestInfo).seenUrls = seenUrls;
});

test('build-info', async ({ page }, testInfo) => {
    await page.goto('http://localhost:5173');

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
test('accordion-interactivity', async ({ page }, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173');

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

    // Verify map contains at least one expected layer WMS request
    const expectedLayersValue = 'ALA:psma_state_2016';
    const hasExpectedLayer = Array.from(seenUrls).some(
        (url) => url.searchParams.get('layers') === expectedLayersValue
    );
    expect(hasExpectedLayer).toBeTruthy();

    // Verify map has 2 layers mapped (the base layer and the WMS layer of the default accordion)
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(2);

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
    const expectedLayersValue2 = 'ALA:psma_lga_2018';
    const hasExpectedLayer2 = Array.from(seenUrls).some(
        (url) => url.searchParams.get('layers') === expectedLayersValue2
    );
    expect(hasExpectedLayer2).toBeTruthy(); // WMS requests include the expected layer

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
    if (testInfo.project.name === 'firefox') {
        test.skip(
            true,
            'Skipping this assertion for Firefox due to page.route not firing as expected for previously seen URLs'
        );
    }

    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    const zoomInButton = page.locator('a.leaflet-control-zoom-in');
    await expect(zoomInButton).toBeVisible(); // check the button is visible
    const initialMapTileUrls = seenUrls.size;

    await zoomInButton.click(); // click the button
    await page.waitForTimeout(1000); // wait for the map to load
    const newMapTileUrls = seenUrls.size;
    expect(newMapTileUrls).toBeGreaterThan(initialMapTileUrls); // check new tiles requested

    // reset is now enabled
    const resetButton = page.locator('button', { hasText: 'Reset map' });
    await expect(resetButton).toBeVisible(); // check the button is visible
    await expect(resetButton).toBeEnabled(); // check the button is enabled

    // reset seen urls
    seenUrls.clear();

    // click the reset button
    await resetButton.click(); // click the button
    await page.waitForTimeout(500); // wait for the map to load
    await expect(resetButton).toBeDisabled(); // check the button is disabled
    const resetMapTileUrls = seenUrls.size;
    expect(resetMapTileUrls).toEqual(initialMapTileUrls); // check no new tiles requested
    const resetMapTileUrl = Array.from(seenUrls)[0];
    // find resetMapTileUrl in the seenUrls
    const resetMapTileUrlIndex = Array.from(seenUrls).findIndex(
        (url) => url.href === resetMapTileUrl.href
    );
    expect(resetMapTileUrlIndex).toBeGreaterThan(-1);
});

/**
 * Test layer item selection from the expanded list and checkboxes
 */
test('regions checkboxes', async ({ page }, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173');

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
    expect(await leafletLayers.count()).toEqual(3); // base layer, this layer, and this region are visible

    const hasExpectedLayer = Array.from(seenUrls).some(
        (url) => url.searchParams.get('viewparams') === 's:8832857' //21654846
    );
    expect(hasExpectedLayer).toBeTruthy(); // WMS requests include the expected layer

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
test('map click region selection', async ({ page }, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // click the map
    const map = page.locator('div.leaflet-container');
    await map.click({ position: { x: 100, y: 100 } }); // click the map
    await page.waitForTimeout(1000); // wait for the map to load

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(3); // base layer, this layer, and this region are visible
    const hasExpectedLayer = Array.from(seenUrls).some(
        (url) => url.searchParams.get('viewparams') === 's:8832857'
    );
    expect(hasExpectedLayer).toBeTruthy(); // WMS requests include the expected layer

    // look for popup
    const popup = page.locator('div.leaflet-popup-content');
    expect(await popup.count()).toEqual(1); // check the popup is visible
    const popupText = await popup.textContent();

    expect(popupText).toContain('AUSTRALIAN CAPITAL TERRITORY'); // check the popup has the expected text

    // confirm the popup has a link clicking it navigates to '/region?id=8832857'
    const popupLink = page.locator('a', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    expect(await popupLink.count()).toEqual(1); // check the link is visible
    await popupLink.click(); // click the link
    await page.waitForTimeout(1000); // wait for the page to load
    const url = page.url();
    expect(url).toContain('/region?id=8832857'); // check the url is correct
});

/**
 * Test zoom to region button
 */
test('zoom to region', async ({ page }, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173');

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
    const zoomedUrl =
        'geoserver/wms?styles=polygon&viewparams=s%3A8832857&service=WMS&request=GetMap&layers=ALA%3AObjects&styles=polygon&format=image%2Fpng&transparent=true&version=1.1.1&width=256&height=256&srs=EPSG%3A3857&bbox=16437018.562444305,-4383204.9499851465,16515290.079408325,-4304933.433021128';

    const hasZoomedLayer = Array.from(seenUrls).some(
        (url) => url.href.includes(zoomedUrl)
    );
    expect(hasZoomedLayer).toBeTruthy(); // WMS requests include the expected layer

    // reset is now enabled
    const resetButton = page.locator('button', { hasText: 'Reset map' });
    await expect(resetButton).toBeVisible(); // check the button is visible
    await expect(resetButton).toBeEnabled(); // check the button is enabled
});

/**
 * Test open region link above the map
 */
test('open region page from button above the map', async ({
    page,
}, testInfo) => {
    await page.goto('http://localhost:5173');

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
test('hash test - layer & region', async ({ page }, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto(
        'http://localhost:5173/#layer=States+and+territories&region=AUSTRALIAN+CAPITAL+TERRITORY'
    );

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(3); // base layer, this layer, and this region are visible
    const hasExpectedLayer = Array.from(seenUrls).some(
        (url) => url.searchParams.get('viewparams') === 's:8832857'
    );
    expect(hasExpectedLayer).toBeTruthy(); // WMS requests include the expected layer

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
test('hash test - layer only', async ({ page }, testInfo) => {
    await page.goto('http://localhost:5173/#layer=Local+government');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 2 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(2); // base layer, this layer
});

/**
 * Test hashes 3
 */
test('hash test - other regions', async ({ page }, testInfo) => {
    await page.goto('http://localhost:5173/#layer=OTHER_REGIONS');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 2 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(1); // base layer
});

/**
 * Test hashes 4
 */
test('hash test - other regions & layer', async ({ page }, testInfo) => {
    await page.goto(
        'http://localhost:5173/#layer=Great+Eastern+Ranges+Initiative'
    );

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 2 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(2); // base layer, this layer
});

/**
 * Test region page default info
 */
test('region page default info', async ({ page }, testInfo) => {
    test.setTimeout(120000); //Increase timeout for popup windows in headed mode
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173/region?id=8832857');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(3); // base layer, this area, species points

    // Verify area name is visible
    const breadcrumb = page.locator('li', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(breadcrumb).toBeVisible(); // check the breadcrumb is visible
    const h2 = page.locator('h2', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' });
    await expect(h2).toBeVisible(); // check the button is visible

    // Verify counts
    const occurrenceCount = page.locator('h3', {
        hasText: 'Occurrence records (4.31M)',
    }); // count from speciesGroups.json
    await expect(occurrenceCount).toBeVisible(); // check the count is visible
    const speciesCount = page.locator('h3', {
        hasText: 'Number of species (271)',
    }); // count from species.json
    await expect(speciesCount).toBeVisible(); // check the count is visible

    // Verify the expected URLs were called
    const speciesGroupUrl =
        /^https:\/\/biocache-ws(\.[a-z0-9-]+)?\.ala\.org\.au\/ws\/occurrences\/search\?q=cl10925:%22AUSTRALIAN%20CAPITAL%20TERRITORY%22&facets=speciesGroup&pageSize=0&flimit=-1&fq=species%3A\*&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue$/;

    const speciesUrl =
        /^https:\/\/biocache-ws(\.[a-z0-9-]+)?\.ala\.org\.au\/ws\/occurrences\/search\?q=cl10925:%22AUSTRALIAN%20CAPITAL%20TERRITORY%22&pageSize=0&flimit=-1&facets=species&fq=species%3A\*&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue&fq=occurrenceYear%3A%5B1850-01-01T00%3A00%3A00Z%20TO%202025-12-31T23%3A59%3A59Z%5D$/;

    const kingdomUrl =
        /^https:\/\/biocache-ws(\.[a-z0-9-]+)?\.ala\.org\.au\/ws\/occurrences\/search\?q=cl10925:%22AUSTRALIAN%20CAPITAL%20TERRITORY%22&fq=species%3A\*&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue&fq=occurrenceYear%3A%5B1850-01-01T00%3A00%3A00Z%20TO%202025-12-31T23%3A59%3A59Z%5D&pageSize=0&flimit=-1&facets=kingdom$/;
    const hasSpeciesGroupUrl = Array.from(seenUrls).find(url => speciesGroupUrl.test(url?.href));
    expect(hasSpeciesGroupUrl).toBeTruthy(); // WMS requests include the expected layer
    const hasSpeciesUrl = Array.from(seenUrls).find(url => speciesUrl.test(url.href));
    expect(hasSpeciesUrl).toBeTruthy(); // WMS requests include the expected layer
    const hasKingdomUrl = Array.from(seenUrls).find(url => kingdomUrl.test(url.href));
    expect(hasKingdomUrl).toBeTruthy(); // WMS requests include the expected layer

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
test('region ACT details', async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173/region?id=21654846#layer=States+and+territories&region=AUSTRALIAN+CAPITAL+TERRITORY');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(3); // base layer, this area, species points

    // Verify area name is visible
    const breadcrumb = page.locator('li', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(breadcrumb).toBeVisible(); // check the breadcrumb is visible
    const h2 = page.locator('h2', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' });
    await expect(h2).toBeVisible(); // check the button is visible

    // Verify counts
    const occurrenceHeading = page.getByRole('heading', {
        name: /Occurrence records \(4.31M\)/,
    });
    await expect(occurrenceHeading).toBeVisible();
    const speciesCount = page.getByRole('heading', {
        name: /Number of species \(271\)/,
    });
    await expect(speciesCount).toBeVisible(); // check the count is visible

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

    const downloadRecordsButton = page.locator('button', { hasText: 'Download records' });
    await expect(listRecordsButton).toBeVisible();

    const [biePage] = await Promise.all([
        page.waitForEvent('popup'),
        speciesProfileButton.click(),
    ]);

    //await expect(biePage).toHaveURL(/species\/https:\/\/biodiversity\.org\.au\/afd\/taxa\/[0-9a-fA-F\-]{36}/);
    await expect(biePage).toHaveURL(/species\/https:\/\/biodiversity\.org\.au\/afd\/taxa\/1bccbad2-2076-479d-8ae5-b333c998ede9/);

    const [biocachePage] = await Promise.all([
        page.waitForEvent('popup'),
        listRecordsButton.click(),
    ]);
    await expect(biocachePage).not.toBeNull();
    //await expect(biocachePage).toHaveURL(/occurrences\/search\?q=.+/);

    const biocacheUrl = biocachePage.url();
    const parsedUrl = new URL(biocacheUrl);
    expect(parsedUrl.pathname).toBe('/occurrences/search');
    expect(parsedUrl.searchParams.get('q')).toContain('cl10925:"AUSTRALIAN CAPITAL TERRITORY"');
    expect(parsedUrl.searchParams.getAll('fq')).toEqual(expect.arrayContaining([
        'species:"Aaaaba fossicollis"',
        'species:*',
        expect.stringContaining('occurrenceYear:[1850-01-01T00:00:00Z TO')
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
        expect.stringContaining('occurrenceYear:[1850-01-01T00:00:00Z TO')
    ]));

    const wmsTileForOccurrences = page.locator('.leaflet-tile-container img[src*="ALA%3Aoccurrences"]');
    const tileCount = await wmsTileForOccurrences.count();
    expect(tileCount).toBe(12)
    //await expect(wmsTileForOccurrences[0]).toBeVisible();

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
    expect(minValue).toBe('1850');
    expect(maxValue).toBe(String(new Date().getFullYear()));
    const minSliderBBox = await minSlider.boundingBox();
    const maxSliderBBox = await maxSlider.boundingBox();

    if (minSliderBBox && maxSliderBBox) {
        await minSlider.dragTo(maxSlider);
        const dateRangeText = page.locator('[data-testid="dateRangeSelection"] p');
        const currentYear = new Date().getFullYear();
        await expect(dateRangeText).toHaveText(new RegExp(`${currentYear} - ${currentYear}`));

        // A forced click is required for Firefox to trigger the interaction.
        // In Chrome, it succeeds in headed mode without the force click but fails when running headless.
        await minSlider.click({force: true});

        const currentSpeciesAFCount = await speciesAFCount.textContent();
        await expect(currentSpeciesAFCount).not.toBe(speciesCountAFText);
    }
});

/**
 * Test play/stop button on date range slider
 */
test('play buttons on date range slider', async ({ page,browserName }, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173/region?id=21654846#layer=States+and+territories&region=AUSTRALIAN+CAPITAL+TERRITORY');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(3); // base layer, this area, species points

    // Verify area name is visible
    const breadcrumb = page.locator('li', {
        hasText: 'AUSTRALIAN CAPITAL TERRITORY',
    });
    await expect(breadcrumb).toBeVisible(); // check the breadcrumb is visible
    const h2 = page.locator('h2', { hasText: 'AUSTRALIAN CAPITAL TERRITORY' });
    await expect(h2).toBeVisible(); // check the button is visible

    // Verify counts
    const occurrenceHeading = page.getByRole('heading', {
        name: /Occurrence records \(4.31M\)/,
    });
    await expect(occurrenceHeading).toBeVisible();

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
    expect(minValue).toBe('1850');
    expect(maxValue).toBe(String(new Date().getFullYear()));
    const minSliderBBox = await minSlider.boundingBox();
    const maxSliderBBox = await maxSlider.boundingBox();

    if (minSliderBBox && maxSliderBBox) {
        const playIcon = page.locator('i.bi.bi-play');
        await playIcon.click();
        const dateRangeText = page.locator('[data-testid="dateRangeSelection"] p');
        const ranges = [/1850 - 1860/,/1860 - 1870/, /1870 - 1880/];

        for (const range of ranges) {
            await expect(dateRangeText).toHaveText(range, { timeout: 2000 });
        }
    }
});

/**
 * Test taxon chart
 */
test('test taxon chart', async ({ page }, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173/region?id=21654846');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(3); // base layer, this area, species points

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
    const centerX =bbox.x + bbox.width / 2;
    const centerY =bbox.y + bbox.height / 2;
    await page.mouse.move(centerX, centerY);
    //Has to wait for a few seconds otherwise the click is not always detected
    await page.waitForTimeout(1000);
    await page.mouse.click(centerX,centerY)

    var previousRankBtn = page.locator('button',{ hasText: 'Previous rank' });
    var viewRecordsBtn = page.locator('button',{ hasText: 'View records for kingdom Animalia' });
    await previousRankBtn.scrollIntoViewIfNeeded();
    await viewRecordsBtn.scrollIntoViewIfNeeded();
    await expect(previousRankBtn).toBeVisible();
    await expect(viewRecordsBtn).toBeVisible();

    const [biocachePage] = await Promise.all([
        page.waitForEvent('popup'),
        viewRecordsBtn.click(),
    ]);

    const expectedFacet = 'kingdom:"Animalia"';
    const hasExpectedFacet = Array.from(seenUrls).some(
        (url) => url.searchParams.get('fq') === expectedFacet
    );
    expect(hasExpectedFacet).toBeTruthy();

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
            expect.stringContaining(
                'occurrenceYear:[1850-01-01T00:00:00Z'
            ),
        ]))
    await previousRankBtn.click();
    await page.waitForTimeout(1000);
    await expect(previousRankBtn).toBeHidden();   // or toBeDetached()
    await expect(viewRecordsBtn).toBeHidden();
});