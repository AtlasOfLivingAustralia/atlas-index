import { test, expect, Locator, Page, TestInfo } from '@playwright/test';
// @ts-ignore
import fs from 'fs';
import AdmZip from 'adm-zip';
import { apiMocks } from './mocks/apiMocks';
import { logMissingMocks } from './mocks/logMissingMocks';

//22 widgets for now
const expectedWidgets = JSON.parse(fs.readFileSync('tests/resources/expectedWidgets.json', 'utf-8'));

interface ExtendedTestInfo extends TestInfo {
    seenUrls: Set<URL>;
}

test.beforeEach(async ({ page }, testInfo) => {
    const seenUrls = new Set<URL>();
    await logMissingMocks(page, seenUrls); // must be first otherwise it will intercept all requests
    await apiMocks(page, seenUrls);
    (testInfo as ExtendedTestInfo).seenUrls = seenUrls;
});

test('first sight on the board', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);
    // Find widgets
    const panels = page.locator('div.dashboardPanel.card');
    await expect(panels).toHaveCount(expectedWidgets.length);

    const headers = page.locator('div.dashboardPanelHeader.card-header h1.dashboardH1');
    for (let i = 0; i < expectedWidgets.length; i++) {
        const headerText = await headers.nth(i).innerText();
        const regex = new RegExp(expectedWidgets[i].titlePattern);
        expect(headerText).toMatch(regex);
    }

    const count = await panels.count();
    for (let i = 0; i < count; i++) {
        const panel = panels.nth(i);
        const header = panel.locator('div.dashboardPanelHeader.card-header h1.dashboardH1');
        const headerTitle = await header.innerText();

        //Find the matched widget defined in target JSON file
        const widget = expectedWidgets.find(it => headerTitle.match(it.title));
        expect(widget, `Widget not found for header: "${headerTitle}"`).toBeDefined();

        if (widget) {
            if (widget.content) {
                //e.g Occurrence Records
                const panelBody = panel.locator('div.dashboardPanelBody.card-body');
                const allText = await panelBody.innerText();
                expect(allText.trim().replace(/[\n\t]/g, ' ')).toBe(widget.content);
            }
            if (widget.table) {
                //e.g. Datasets, Basis Of Record
                let rows = panel.locator('table.dashboardTable tbody tr');
                let count = await rows.count();
                if (count == 0) {
                    //e.g Occurrence Tree
                    rows = panel.locator('table.dashboardTree tbody tr');
                    count = await rows.count();
                }

                const srcValuesInTable: string[] = [];

                for (let i = 0; i < count; i++) {
                    const cells = rows.nth(i).locator('td');
                    // Grab all cell texts in one shot
                    const cellTexts = await cells.allInnerTexts();
                    const rowText = cellTexts.map(t => t.trim()).join(' ');

                    // Only push if not empty after trimming
                    if (rowText.trim().length > 0) {
                        srcValuesInTable.push(rowText.trim());
                    }
                }

                for (const expected of widget.table) {
                    // Find a matching row in multiArray
                    const match = srcValuesInTable.find(it => it === expected);

                    // Assert that the row exists
                    if (!match) {
                        // Log out what was expected vs what was found
                        console.error(`Expected: ${expected}`);
                        console.error('Source table values:', srcValuesInTable);
                    }
                    expect(match).toBeDefined();
                }
            }
        }
    }
});

test('datasets', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panel = await findPanelByHeaderRegex(page, /\d{1,3}(,\d{3})* Datasets/);
    expect(panel).toBeDefined();
    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const link = panelBody.locator('a.dashboardLargeLink');

    const href = await link.getAttribute('href');
    const text = await link.innerText();

    expect(href).toMatch(/^https?:\/\/collections(?:\.test)?\.ala\.org\.au\/ws\/dataResource\/.*$/);
    expect(text).toBe('Zosteria fulvipubescens');
});

//Clickable tables and select
test('basis of record, Most Recorded Species, Type Specimens etc', async ({ page }) => {
    test.setTimeout(60000);
    const widgetsWithExtra = expectedWidgets.filter(w => w.select || w.expectedUrl);

    for (const { title, expectedUrl, select } of widgetsWithExtra) {
        await page.goto('http://localhost:5173');
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveTitle(/Dashboard \| Atlas of Living Australia/);

        const regexTitle = new RegExp(title);
        const panel = await findPanelByHeaderRegex(page, regexTitle);

        expect(panel, `Panel not found: ${regexTitle}`).toBeDefined();

        if (select) {
            const selectOptions = select.selectOptions;
            const expectedSelectedValuesInTable = select.expectedSelectedValuesInTable;
            await testSelect(page, panel, selectOptions, expectedSelectedValuesInTable);
        }

        // follows a URL, put this block at the end
        if (expectedUrl) {
            const regexUrl = new RegExp(expectedUrl);
            await testDashboardPanelNavigation(page, panel, regexUrl);
        }
    }
});

//Charts
test('collections -> chart', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panel = await findPanelByHeaderRegex(page, /\d{1,3}(,\d{3})* Collections/);
    expect(panel).toBeDefined();
    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const canvas = panelBody.locator('canvas[role="img"]');
    await expect(canvas).toHaveCount(1);

    const openedUrl = await captureChartClickUrl(canvas, 0, 0);
    // URL has no trailing slash before '?' e.g. https://collections.ala.org.au?start=fauna
    expect(openedUrl).toMatch(/^https?:\/\/collections(?:\.test)?\.ala\.org\.au\/?\?start=.*$/);
});

test('Records by State and Territory -> chart', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panel = await findPanelByHeaderRegex(page, /Records by State and Territory/);
    expect(panel).toBeDefined();
    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const canvas = panelBody.locator('canvas[role="img"]');
    await expect(canvas).toHaveCount(1);

    const openedUrl = await captureChartClickUrl(canvas, 0, 0);
    expect(openedUrl).toMatch(/^https?:\/\/biocache(?:\.test)?\.ala\.org\.au\/occurrences\/search\?q=stateProvince:.*$/);
});

test('Records and Species by Decade -> chart', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panel = await findPanelByHeaderRegex(page, /Records and Species by Decade/);
    expect(panel).toBeDefined();
    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const canvas = panelBody.locator('canvas[role="img"]');
    await expect(canvas).toHaveCount(1);

    const openedUrl = await captureChartClickUrl(canvas, 0, 0);
    expect(openedUrl).toMatch(/^https?:\/\/biocache(?:\.test)?\.ala\.org\.au\/occurrences\/search\?q=decade:.*$/);
});

test('CSV download', async ({ page }) => {
    const expectedCSVFiles = fs.readFileSync('tests/resources/expectedCSVFiles.csv', 'utf-8').trim().split('\n');

    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);
    const [download] = await Promise.all([
        page.waitForEvent('download'), // wait for download to start
        page.locator('a.btn', { hasText: 'Download as CSV' }).click() // click the link that triggers download
    ]);

    const path = await download.path();
    expect(path).not.toBeNull();
    const zip = new AdmZip(path!);

    // List all files inside
    const entries = zip.getEntries().map(e => e.entryName);
    for (const file of expectedCSVFiles) {
        expect(entries).toContain(file);
    }
});

async function testSelect(page: Page, panel: Locator, expectedSelect: String[], expectedSelectedValueInTable: Record<string, string[]>) {
    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const select = panelBody.locator('div.dashboardSelectWrapper select');
    await select.scrollIntoViewIfNeeded();
    const options = select.locator('option');
    const optionTexts = await options.allTextContents();

    // Check each expected value is included
    for (const expected of expectedSelect) {
        expect(optionTexts).toContain(expected);
    }

    //Select the 2nd option
    await select.selectOption({ index: 1 });
    const selectedValue = await select.inputValue(); //value
    const selectedText = await select.locator('option:checked').textContent(); //text
    expect(selectedText).toBe(expectedSelect[1]);

    //Read and joined texts from td
    let rows = panel.locator('table.dashboardTable tbody tr');
    let count = await rows.count();
    const srcValuesInTable: string[] = [];

    for (let i = 0; i < count; i++) {
        const cells = rows.nth(i).locator('td');
        // Grab all cell texts in one shot
        const cellTexts = await cells.allInnerTexts();
        const rowText = cellTexts.map(t => t.trim()).join(' ');

        // Only push if not empty after trimming
        if (rowText.trim().length > 0) {
            srcValuesInTable.push(rowText.trim());
        }
    }

    const expected: String[] = expectedSelectedValueInTable[selectedText];
    for (const value of expected) {
        expect(srcValuesInTable).toContain(value);
    }
}

/**
 * Test navigation from a dashboard panel row.
 *
 * This helper function finds a dashboard panel by its header title regex,
 * verifies that it has rows, and then attempts to click the first row.
 * If the row is clickable (cursor style is "pointer"), it waits for the page
 * to navigate to the expected URL and asserts that the new URL matches.
 *
 * @param page - Playwright Page object (browser context for the test).
 * @param panel - Palywright selector - the panel of widget
 * @param expectedUrlRegex - Regular expression for the URL expected after clicking.
 *                           Example: ^https?:\/\/biocache(?:\.test)?\.ala\.org\.au\/occurrences\/search\?q=basisOfRecord:.*
 **/
async function testDashboardPanelNavigation(page: Page, panel: Locator, expectedUrlRegex: RegExp) {
    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const rows = panelBody.locator('table.dashboardTable tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);

    await panel.scrollIntoViewIfNeeded();

    const row1 = rows.nth(0);
    await row1.scrollIntoViewIfNeeded();
    await row1.hover();

    const cursor = await row1.evaluate(el => getComputedStyle(el).cursor);

    if (cursor === 'pointer') {
        // Mock the expected external page
        const navigationHandler = async (route: any) => {
            await route.fulfill({ status: 200, contentType: 'text/html', body: '<html lang="en"></html>' });
        };
        await page.route(expectedUrlRegex, navigationHandler);

        await row1.click();
        await page.waitForLoadState('domcontentloaded');

        expect(page.url()).toMatch(expectedUrlRegex);

        await page.unroute(expectedUrlRegex, navigationHandler);
    }
}

/**
 * Wait for the Chart.js instance on the given canvas to finish rendering,
 * then programmatically fire its onClick handler for a specific data element
 * and return the URL that window.open was called with (percent-decoded).
 *
 * Why not click the canvas with mouse events?
 * – Coordinate-based hits are fragile across browsers (different pixel positions
 *   and animation timings).
 * – WebKit blocks window.open called from Playwright synthetic mouse events
 *   because they are not considered a user gesture for popup purposes.
 *
 * @param canvas       - Locator scoped to the <canvas> element
 * @param datasetIndex - Chart.js dataset index (usually 0)
 * @param elementIndex - Data element index within the dataset
 */
async function captureChartClickUrl(
    canvas: Locator,
    datasetIndex: number,
    elementIndex: number
): Promise<string> {
    // Wait until Chart.js has initialised the chart AND has at least one
    // rendered data element (data has been processed, not just mounted).
    await canvas.evaluate((canvasEl: HTMLCanvasElement) => new Promise<void>((resolve) => {
        const poll = () => {
            const chart = (window as any).__ChartJS?.getChart(canvasEl);
            if (chart && chart.getDatasetMeta(0).data.length > 0) { resolve(); return; }
            setTimeout(poll, 50);
        };
        poll();
    }));

    // Stub window.open, invoke the onClick handler, capture the URL, restore.
    // Everything happens synchronously inside the same evaluate call so there
    // is no async gap between the stub install and the URL capture.
    const rawUrl = await canvas.evaluate(
        (canvasEl: HTMLCanvasElement, { datasetIndex, elementIndex }: { datasetIndex: number; elementIndex: number }) => {
            let captured: string | null = null;
            const origOpen = window.open;
            (window as any).open = (url?: string | URL, ..._args: any[]) => {
                captured = url != null ? String(url) : null;
                return null;
            };
            try {
                const chart = (window as any).__ChartJS?.getChart(canvasEl);
                if (chart?.options?.onClick) {
                    // Replicate what Chart.js passes to the user callback:
                    // an elements array where each item has { index, datasetIndex }
                    chart.options.onClick(
                        {},
                        [{ index: elementIndex, datasetIndex }],
                        chart
                    );
                }
            } finally {
                window.open = origOpen;
            }
            return captured;
        },
        { datasetIndex, elementIndex }
    );

    expect(
        rawUrl,
        `window.open was not called for dataset=${datasetIndex}, element=${elementIndex} — ` +
        `check that __ChartJS is exposed and the chart has an onClick handler`
    ).not.toBeNull();
    return decodeURIComponent(rawUrl!);
}

/**
 *
 * @param page - Playwright Page object
 * @param pattern - Regex pattern to match against header text
 * @returns Locator for the matching panel, or undefined if not found
 */
async function findPanelByHeaderRegex(page: Page, pattern: RegExp): Promise<Locator | undefined> {
    const panels = page.locator('div.dashboardPanel.card');
    //TODO return this; await expect(panels).toHaveCount(expectedWidgets.length);
    const count = await panels.count();

    for (let i = 0; i < count; i++) {
        const panel = panels.nth(i);
        const header = panel.locator('div.dashboardPanelHeader.card-header h1.dashboardH1');
        const headerTitle = await header.innerText();

        if (pattern.test(headerTitle)) {
            return panel;
        }
    }

    return undefined;
}
