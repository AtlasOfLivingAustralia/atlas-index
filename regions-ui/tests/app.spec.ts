import {test, expect, type TestInfo} from '@playwright/test';
import {createCanvas, type CanvasRenderingContext2D} from 'canvas';
import {Buffer} from 'buffer'; // Node.js Buffer module
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// load resources
// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const g_kingdomsPath = path.resolve(__dirname, './resources/kingdoms.json');
const g_kingdoms = JSON.parse(fs.readFileSync(g_kingdomsPath, 'utf-8'));
const g_speciesPath = path.resolve(__dirname, './resources/species.json');
const g_species = JSON.parse(fs.readFileSync(g_speciesPath, 'utf-8'));
const g_speciesGroupsPath = path.resolve(__dirname, './resources/speciesGroups.json');
const g_speciesGroups = JSON.parse(fs.readFileSync(g_speciesGroupsPath, 'utf-8'));

// Extend TestInfo to include the seenUrls property
interface ExtendedTestInfo extends TestInfo {
    seenUrls: Set<URL>;
}

// Function to convert tile X coordinate and zoom level to longitude
function tileToLong(x: number, z: number): number {
    return x / Math.pow(2, z) * 360 - 180;
}

// Function to convert tile Y coordinate and zoom level to latitude (using inverse Mercator)
function tileToLat(y: number, z: number): number {
    const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// Function to get decimal degrees for the four corners of a tile
function getTileCorners(x: number, y: number, z: number): {
    topLeft: { lat: number; lon: number };
    topRight: { lat: number; lon: number };
    bottomLeft: { lat: number; lon: number };
    bottomRight: { lat: number; lon: number };
} {
    const lonLeft = tileToLong(x, z);
    const latTop = tileToLat(y, z);
    const lonRight = tileToLong(x + 1, z);
    const latBottom = tileToLat(y + 1, z); // Latitude of the top edge of the tile below

    return {
        topLeft: {lat: latTop, lon: lonLeft},
        topRight: {lat: latTop, lon: lonRight},
        bottomLeft: {lat: latBottom, lon: lonLeft},
        bottomRight: {lat: latBottom, lon: lonRight},
    };
}

const R = 6378137; // Earth's radius in meters

// Convert projected coordinates to decimal degrees
const toLon = (x: number) => (x / R) * (180 / Math.PI);
const toLat = (y: number) => (180 / Math.PI) * (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2);

// Function to generate a PNG buffer with tile info drawn on it
async function generateTileImage(
    x: number,
    y: number,
    z: number,
    corners: ReturnType<typeof getTileCorners>,
    size: number = 256 // Default tile size
): Promise<Buffer> {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background color (light gray)
    ctx.fillStyle = '#CCCCCC';
    ctx.fillRect(0, 0, size, size);

    // Border
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);

    // Set text properties
    ctx.fillStyle = '#000000'; // Black text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw Z/X/Y in the center
    const mainFontSize = size / 16; // Adjust font size relative to tile size
    ctx.font = `${mainFontSize}px Arial`;
    ctx.fillText(`${z}/${x}/${y} ${size}`, size / 4, size / 4);

    // Set smaller font for corner coordinates
    const cornerFontSize = size / 24;
    ctx.font = `${cornerFontSize}px Arial`;
    const padding = 1; // Padding from edges

    // Helper to format coordinates
    const formatCoord = (coord: number) => coord.toFixed(4); // Format to 4 decimal places

    // Draw corner coordinates
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`TL: ${formatCoord(corners.topLeft.lat)}, ${formatCoord(corners.topLeft.lon)}`, padding, padding);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`TR: ${formatCoord(corners.topRight.lat)}, ${formatCoord(corners.topRight.lon)}`, size - padding, padding);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`BL: ${formatCoord(corners.bottomLeft.lat)}, ${formatCoord(corners.bottomLeft.lon)}`, padding, size - padding);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`BR: ${formatCoord(corners.bottomRight.lat)}, ${formatCoord(corners.bottomRight.lon)}`, size - padding, size - padding);

    // Convert canvas to PNG buffer
    return new Promise((resolve, reject) => {
        const stream = canvas.createPNGStream();
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err) => reject(err));
    });
}

// Set up mocking for all tests
test.beforeEach(async ({page}, testInfo) => {
    const seenUrls = new Set<URL>();

    // Mock base layer requests to OSM base layers
    await page.route('**/spatial.ala.org.au/osm/*/*/*.png', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const pathname = url.pathname;

        let requestedSize = 256; // Default tile size

        const pathParts = pathname.split('/');
        // Look for sequences that might be z, x, y numbers
        let z: number | undefined = parseInt(pathParts[pathParts.length - 3], 10);
        let x: number | undefined = parseInt(pathParts[pathParts.length - 2], 10);
        let y: number | undefined = parseInt(pathParts[pathParts.length - 1].replace('@2x', '').replace('.png', ''), 10);

        // detect high DPI
        if (pathParts[pathParts.length - 1].indexOf('@2x') !== -1) {
            requestedSize = 512;
        }

        const corners = getTileCorners(x, y, z);

        // Generate the tile image dynamically
        try {
            const imageBuffer = await generateTileImage(x, y, z, corners, requestedSize);

            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: imageBuffer
            });
        } catch (error) {
            console.error(`Error generating mock tile image for ${z}/${x}/${y}:`, error);
            // If image generation fails, fulfill with an error status or a fallback
            await route.fulfill({
                status: 500, // Internal Server Error
                contentType: 'text/plain',
                body: `Error generating mock tile for ${z}/${x}/${y}`
            });
        }
    });

    await page.route('**/spatial*.ala.org.au/geoserver/wms*', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const params = url.searchParams;

        // Extract query parameters
        const width = parseInt(params.get('width') || '256', 10);
        const height = parseInt(params.get('height') || '256', 10);
        const bbox = params.get('bbox')?.split(',').map(parseFloat); // [minX, minY, maxX, maxY]

        if (!bbox || bbox.length !== 4) {
            await route.fulfill({
                status: 400, // Bad Request
                contentType: 'text/plain',
                body: 'Invalid or missing bbox parameter',
            });
            return;
        }

        const [minX, minY, maxX, maxY] = bbox;

        // Generate the image dynamically
        try {
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Fill background
            ctx.fillStyle = '#CCCCCC';
            ctx.fillRect(0, 0, width, height);

            // Draw border
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, width, height);

            // Set text properties
            ctx.fillStyle = '#000000';
            ctx.font = `${Math.min(width, height) / 32}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw info in the center
            let layers = params.get('layers') || 'Unknown Layer';
            ctx.fillText(`${layers}`, width / 2, height / 2 - 20);
            ctx.fillText(`${toLon(minX).toFixed(4)}, ${toLat(minY).toFixed(4)}`, width / 2, height / 2 + 10);
            ctx.fillText(`${toLon(maxX).toFixed(4)}, ${toLat(maxY).toFixed(4)}`, width / 2, height / 2 + 30);

            const buffer = canvas.toBuffer('image/png');

            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: buffer,
            });
        } catch (error) {
            await route.fulfill({
                status: 500, // Internal Server Error
                contentType: 'text/plain',
                body: 'Error generating mock WMS image',
            });
        }
    });

    await page.route('**/spatial*.ala.org.au/ws/intersect/cl10925/*/*', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        // always return the same response, a successful intersection
        const response = [
            {
                "field": "cl10925",
                "description": "AUSTRALIAN CAPITAL TERRITORY",
                "layername": "PSMA States (2016)",
                "pid": "21654846",
                "value": "AUSTRALIAN CAPITAL TERRITORY"
            }
        ]
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response)
        });
    });

    await page.route('**/spatial*.ala.org.au/ws/object/*', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        // always return the same response, a successful intersection
        const response = {
            pid: "21654846",
            name: "AUSTRALIAN CAPITAL TERRITORY",
            wmsurl: "https://spatial.ala.org.au/geoserver/wms?service=WMS&version=1.1.0&request=GetMap&layers=ALA:Objects&format=image/png&viewparams=s:21654846",
            fid: "cl10925",
            fieldname: "PSMA States (2016)",
            bbox: "POLYGON((148.762675104 -35.9207620485,148.762675104 -35.124517035,149.399284512 -35.124517035,149.399284512 -35.9207620485,148.762675104 -35.9207620485))",
            description: "AUSTRALIAN CAPITAL TERRITORY",
            area_km: 2363.2136863251985,
            id: "21654846"
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response)
        });
    });

    await page.route('**/biocache-ws.ala.org.au/ws/occurrences/search**', async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);

        const facets = url.searchParams.get('facets');

        var response;
        if (facets === 'species') {
            response = g_species;
        } else if (facets === 'kingdom') {
            response = g_kingdoms;
        } else if (facets === 'speciesGroup') {
            response = g_speciesGroups;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response)
        });
    });

    (testInfo as ExtendedTestInfo).seenUrls = seenUrls;
});

test('build-info', async ({page}, testInfo) => {
    await page.goto('http://localhost:5173');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // get build info meta tag
    const jsonContent = await page.locator('meta[name="buildInfo"]').getAttribute('content');
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
test('accordion-interactivity', async ({page}, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Locate the accordion button with the text "States and territories"
    const accordionButton = page.locator('button.accordion-button', {hasText: 'States and territories'});

    // Ensure the button is visible
    await expect(accordionButton).toBeVisible();

    // Verify the parent h2's next sibling div has the "show" class
    const accordionContent = accordionButton.locator('xpath=../following-sibling::div');
    await expect(accordionContent).toHaveClass(/show/);

    // Verify no other accordion-collapse divs have the "show" class, as it should be the only one expanded
    const otherAccordions = page.locator('div.accordion-collapse.collapse:not(.show)');
    await expect(otherAccordions).toHaveCount(await page.locator('div.accordion-collapse.collapse').count() - 1);

    // Verify that it is actually visible by checking some of the content is visible
    const actContent = accordionContent.locator('p', {hasText: 'AUSTRALIAN CAPITAL TERRITORY'});
    const nswContent = accordionContent.locator('p', {hasText: 'NEW SOUTH WALES'});
    await expect(actContent).toBeVisible();
    await expect(nswContent).toBeVisible();

    // Verify map contains at least one expected layer WMS request
    const expectedLayersValue = 'ALA:psma_state_2016';
    const hasExpectedLayer = Array.from(seenUrls).some(url => url.searchParams.get('layers') === expectedLayersValue);
    expect(hasExpectedLayer).toBeTruthy();

    // Verify map has 2 layers mapped (the base layer and the WMS layer of the default accordion)
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(2);

    // Verify a collapse
    await accordionButton.click(); // collapse the accordion
    await expect(accordionContent).not.toHaveClass(/show/); // content is now collapsed
    const otherAccordions2 = page.locator('div.accordion-collapse.collapse:not(.show)');
    await expect(otherAccordions2).toHaveCount(await page.locator('div.accordion-collapse.collapse').count()); // no accordions open
    const leafletLayers2 = page.locator('div.leaflet-layer');
    expect(await leafletLayers2.count()).toEqual(1); // only the base layer is visible

    // Verify a second accordion
    const secondAccordionButton = page.locator('button.accordion-button', {hasText: 'Local government'});
    await expect(secondAccordionButton).toBeVisible(); // check the button is visible
    await secondAccordionButton.click();
    const accordionContent2 = secondAccordionButton.locator('xpath=../following-sibling::div'); // get the content div for this button
    await expect(accordionContent2).toHaveClass(/show/); // content is now expanded
    const otherAccordions3 = page.locator('div.accordion-collapse.collapse:not(.show)');
    await expect(otherAccordions3).toHaveCount(await page.locator('div.accordion-collapse.collapse').count() - 1); // only one accordion open
    const adelaideCityCouncilContent = accordionContent2.locator('p', {hasText: 'ADELAIDE CITY COUNCIL'});
    const alpineShireContent = accordionContent2.locator('p', {hasText: 'ALPINE SHIRE'});
    await expect(adelaideCityCouncilContent).toBeVisible(); // check some of the content is visible
    await expect(alpineShireContent).toBeVisible(); // check some of the content is visible
    const leafletLayers3 = page.locator('div.leaflet-layer');
    expect(await leafletLayers3.count()).toEqual(2); // base layer and this layer are visible
    const expectedLayersValue2 = 'ALA:psma_lga_2018';
    const hasExpectedLayer2 = Array.from(seenUrls).some(url => url.searchParams.get('layers') === expectedLayersValue2);
    expect(hasExpectedLayer2).toBeTruthy(); // WMS requests include the expected layer

    // Verify the "other layers" accordion
    const otherAccordionButton = page.locator('button.accordion-button', {hasText: 'Other regions'});
    // scroll into view
    await otherAccordionButton.scrollIntoViewIfNeeded();
    await expect(otherAccordionButton).toBeVisible(); // check the button is visible
    await otherAccordionButton.click();
    const accordionContent3 = otherAccordionButton.locator('xpath=../following-sibling::div'); // get the content div for this button
    await expect(accordionContent3).toHaveClass(/show/); // content is now expanded
    const otherAccordions4 = page.locator('div.accordion-collapse.collapse:not(.show)');
    await expect(otherAccordions4).toHaveCount(await page.locator('div.accordion-collapse.collapse').count() - 1); // only one accordion open
    const otherContent1 = accordionContent3.locator('p', {hasText: 'Great Eastern Ranges Initiative'});
    const otherContent2 = accordionContent3.locator('p', {hasText: 'Directory of Important Wetlands'});
    await expect(otherContent1).toBeVisible(); // check some of the content is visible
    await expect(otherContent2).toBeVisible(); // check some of the content is visible
    const leafletLayers4 = page.locator('div.leaflet-layer');
    expect(await leafletLayers4.count()).toEqual(1); // base layer only is visible

    // Verify the default accordion, again
    await accordionButton.scrollIntoViewIfNeeded();
    await accordionButton.click();
    const accordionContent4 = accordionButton.locator('xpath=../following-sibling::div'); // get the content div for this button
    await expect(accordionContent4).toHaveClass(/show/); // content is now expanded
    const otherAccordions5 = page.locator('div.accordion-collapse.collapse:not(.show)');
    await expect(otherAccordions5).toHaveCount(await page.locator('div.accordion-collapse.collapse').count() - 1); // only one accordion open
    const actContent2 = accordionContent.locator('p', {hasText: 'AUSTRALIAN CAPITAL TERRITORY'});
    const nswContent2 = accordionContent.locator('p', {hasText: 'NEW SOUTH WALES'});
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
test('regions map controls', async ({page}, testInfo) => {
    if (testInfo.project.name === 'firefox') {
        test.skip(true, 'Skipping this assertion for Firefox due to page.route not firing as expected for previously seen URLs');
    }

    // skip the test if running in codepipeline, it fails due to aggressive caching in headless chrome
    if (process.env.CODEBUILD_BUILD_NUMBER) {
        test.skip(true, 'Skipping because $CODEBUILD_BUILD_NUMBER is not set');
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
    const resetButton = page.locator('button', {hasText: 'Reset map'});
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
    const resetMapTileUrlIndex = Array.from(seenUrls).findIndex(url => url.href === resetMapTileUrl.href);
    expect(resetMapTileUrlIndex).toBeGreaterThan(-1);
});

/**
 * Test layer item selection from the expanded list and checkboxes
 */
test('regions checkboxes', async ({page}, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    const actContent = page.locator('p', {hasText: 'AUSTRALIAN CAPITAL TERRITORY'});
    await expect(actContent).toBeVisible(); // check some of the content is visible
    await actContent.click(); // click the region

    await page.waitForTimeout(500); // wait for the map to load

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(3); // base layer, this layer, and this region are visible

    const hasExpectedLayer = Array.from(seenUrls).some(url => url.searchParams.get('viewparams') === 's:21654846');
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
test('map click region selection', async ({page}, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // click the map
    const map = page.locator('div.leaflet-container');
    await map.click({position: {x: 100, y: 100}}); // click the map
    await page.waitForTimeout(1000); // wait for the map to load

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(3); // base layer, this layer, and this region are visible
    const hasExpectedLayer = Array.from(seenUrls).some(url => url.searchParams.get('viewparams') === 's:21654846');
    expect(hasExpectedLayer).toBeTruthy(); // WMS requests include the expected layer

    // look for popup
    const popup = page.locator('div.leaflet-popup-content');
    expect(await popup.count()).toEqual(1); // check the popup is visible
    const popupText = await popup.textContent();

    expect(popupText).toContain('AUSTRALIAN CAPITAL TERRITORY'); // check the popup has the expected text

    // confirm the popup has a link clicking it navigates to '/region?id=21654846'
    const popupLink = page.locator('a', {hasText: 'AUSTRALIAN CAPITAL TERRITORY'});
    expect(await popupLink.count()).toEqual(1); // check the link is visible
    await popupLink.click(); // click the link
    await page.waitForTimeout(1000); // wait for the page to load
    const url = page.url();
    expect(url).toContain('/region?id=21654846'); // check the url is correct
});

/**
 * Test zoom to region button
 */
test('zoom to region', async ({page}, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    const actContent = page.locator('p', {hasText: 'AUSTRALIAN CAPITAL TERRITORY'});
    await expect(actContent).toBeVisible(); // check some of the content is visible
    await actContent.click(); // click the region

    // Verify the zoom to region button
    const zoomToRegionButton = page.locator('button', {hasText: 'Zoom to region'});
    await expect(zoomToRegionButton).toBeVisible(); // check the button is visible
    await expect(zoomToRegionButton).toBeEnabled(); // check the button is enabled
    await zoomToRegionButton.click(); // click the button

    await page.waitForTimeout(1000); // wait for the map to load
    const zoomedUrl = 'https://spatial.ala.org.au/geoserver/wms?styles=polygon&viewparams=s%3A21654846&service=WMS&request=GetMap&layers=ALA%3AObjects&styles=polygon&format=image%2Fpng&transparent=true&version=1.1.1&width=256&height=256&srs=EPSG%3A3857&bbox=16437018.562444305,-4383204.9499851465,16515290.079408325,-4304933.433021128'
    const hasZoomedLayer = Array.from(seenUrls).some(url => url.href === zoomedUrl);
    expect(hasZoomedLayer).toBeTruthy(); // WMS requests include the expected layer

    // reset is now enabled
    const resetButton = page.locator('button', {hasText: 'Reset map'});
    await expect(resetButton).toBeVisible(); // check the button is visible
    await expect(resetButton).toBeEnabled(); // check the button is enabled
});

/**
 * Test open region link above the map
 */
test('open region page from button above the map', async ({page}, testInfo) => {
    await page.goto('http://localhost:5173');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    const actContent = page.locator('p', {hasText: 'AUSTRALIAN CAPITAL TERRITORY'});
    await expect(actContent).toBeVisible(); // check some of the content is visible
    await actContent.click(); // click the region

    // Verify the zoom to region button
    const zoomToRegionButton = page.locator('button', {hasText: 'AUSTRALIAN CAPITAL TERRITORY'});
    await expect(zoomToRegionButton).toBeVisible(); // check the button is visible
    await expect(zoomToRegionButton).toBeEnabled(); // check the button is enabled
    await zoomToRegionButton.click(); // click the button

    // Verify the page opened
    await page.waitForTimeout(1000); // wait for the page to load
    const url = page.url();
    expect(url).toContain('/region?id=21654846'); // check the url is correct
});

/**
 * Test hashes 1
 */
test('hash test - layer & region', async ({page}, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173/#layer=States+and+territories&region=AUSTRALIAN+CAPITAL+TERRITORY');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(3); // base layer, this layer, and this region are visible
    const hasExpectedLayer = Array.from(seenUrls).some(url => url.searchParams.get('viewparams') === 's:21654846');
    expect(hasExpectedLayer).toBeTruthy(); // WMS requests include the expected layer

    // Verify the zoom to region button
    const zoomToRegionButton = page.locator('button', {hasText: 'AUSTRALIAN CAPITAL TERRITORY'});
    await expect(zoomToRegionButton).toBeVisible(); // check the button is visible
    await expect(zoomToRegionButton).toBeEnabled(); // check the button is enabled
    await zoomToRegionButton.click(); // click the button

    // Verify the page opened
    await page.waitForTimeout(1000); // wait for the page to load
    const url = page.url();
    expect(url).toContain('/region?id=21654846'); // check the url is correct
});

/**
 * Test hashes 2
 */
test('hash test - layer only', async ({page}, testInfo) => {
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
test('hash test - other regions', async ({page}, testInfo) => {
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
test('hash test - other regions & layer', async ({page}, testInfo) => {
    await page.goto('http://localhost:5173/#layer=Great+Eastern+Ranges+Initiative');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 2 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(2); // base layer, this layer
});

/**
 * Test region page default info
 */
test('region page default info', async ({page}, testInfo) => {
    const seenUrls = (testInfo as ExtendedTestInfo).seenUrls;

    await page.goto('http://localhost:5173/region?id=21654846');

    // Wait for images to load
    await page.waitForLoadState('networkidle');

    // Verify that 3 layers are now visible
    const leafletLayers = page.locator('div.leaflet-layer');
    expect(await leafletLayers.count()).toEqual(3); // base layer, this area, species points

    // Verify area name is visible
    const breadcrumb = page.locator('li', {hasText: 'AUSTRALIAN CAPITAL TERRITORY'});
    await expect(breadcrumb).toBeVisible(); // check the breadcrumb is visible
    const h2 = page.locator('h2', {hasText: 'AUSTRALIAN CAPITAL TERRITORY'});
    await expect(h2).toBeVisible(); // check the button is visible

    // Verify counts
    const occurrenceCount = page.locator('h3', {hasText: 'Occurrence records (4.31M)'}); // count from speciesGroups.json
    await expect(occurrenceCount).toBeVisible(); // check the count is visible
    const speciesCount = page.locator('h3', {hasText: 'Number of species (271)'}); // count from species.json
    await expect(speciesCount).toBeVisible(); // check the count is visible

    // Verify the expected URLs were called
    const speciesGroupUrl = "https://biocache-ws.ala.org.au/ws/occurrences/search?q=cl10925:%22AUSTRALIAN%20CAPITAL%20TERRITORY%22&facets=speciesGroup&pageSize=0&flimit=-1&fq=species%3A*&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue"
    const speciesUrl = "https://biocache-ws.ala.org.au/ws/occurrences/search?q=cl10925:%22AUSTRALIAN%20CAPITAL%20TERRITORY%22&pageSize=0&flimit=-1&facets=species&fq=species%3A*&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue&fq=occurrenceYear%3A%5B1850-01-01T00%3A00%3A00Z%20TO%202025-12-31T23%3A59%3A59Z%5D"
    const kingdomUrl = "https://biocache-ws.ala.org.au/ws/occurrences/search?q=cl10925:%22AUSTRALIAN%20CAPITAL%20TERRITORY%22&fq=species%3A*&fq=-occurrenceStatus%3Aabsent&fq=spatiallyValid%3Atrue&fq=occurrenceYear%3A%5B1850-01-01T00%3A00%3A00Z%20TO%202025-12-31T23%3A59%3A59Z%5D&pageSize=0&flimit=-1&facets=kingdom"

    const hasSpeciesGroupUrl = Array.from(seenUrls).some(url => url.href === speciesGroupUrl);
    expect(hasSpeciesGroupUrl).toBeTruthy(); // WMS requests include the expected layer
    const hasSpeciesUrl = Array.from(seenUrls).some(url => url.href === speciesUrl);
    expect(hasSpeciesUrl).toBeTruthy(); // WMS requests include the expected layer
    const hasKingdomUrl = Array.from(seenUrls).some(url => url.href === kingdomUrl);
    expect(hasKingdomUrl).toBeTruthy(); // WMS requests include the expected layer

    // Verify some species groups
    const speciesGroup1 = page.locator('div.speciesItem', {hasText: 'All Species'});
    const speciesGroup2 = page.locator('div.speciesItem', {hasText: 'Mammals'});
    const speciesGroup3 = page.locator('div.speciesItem', {hasText: 'Bacteria'});
    await expect(speciesGroup1).toBeVisible(); // check the species group is visible
    await expect(speciesGroup2).toBeVisible(); // check the species group is visible
    await expect(speciesGroup3).toBeVisible(); // check the species group is visible

    // Verify some species
    const species1 = page.locator('div[class^="_speciesName_"]', { hasText: 'Aaaaba nodosus' });
    const species2 = page.locator('div[class^="_speciesName_"]', {hasText: 'Abantiades labyrinthicus'});
    await expect(species1).toBeVisible(); // check the species is visible
    await expect(species2).toBeVisible(); // check the species is visible
});
