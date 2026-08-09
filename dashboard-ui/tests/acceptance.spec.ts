import { test, expect } from './fixtures';
import { Locator, Page } from '@playwright/test';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { apiMocks } from './mocks/apiMocks';
import { logMissingMocks } from './mocks/logMissingMocks';
import { staticServerMocks } from './mocks/staticServerMocks';
import { isLiveMode, getBaseUrl, shouldSkip, getOverride, getTimeouts } from './mocks/liveConfig';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Widget definitions — mock-exact values used in mock mode.
// In live mode, individual assertions are relaxed via live-config.json overrides.
//
// Override key scheme:
//   first-sight.<TitleSlug>.content          — exact panel body text
//   first-sight.<TitleSlug>.table.<RowSlug>  — exact table row string
//   datasets.mostRecentName                  — exact most-recent dataset link text
//   clickable-tables.<TitleSlug>.expectedUrl — exact URL regex (first-row click)
//   clickable-tables.<TitleSlug>.select.<OptionSlug>.<RowSlug> — exact selected table row
//
// Slug derivation: camelCase from the original string, non-alphanumerics stripped.
// e.g. "Basis Of Record" -> "BasisOfRecord"
//      "Human Observation 121.44M" -> "HumanObservation12144M"
// ---------------------------------------------------------------------------

type Widget = {
    title: string;                              // regex matched against panel header
    content?: string;                           // exact panel body text (mock)
    table?: string[];                           // exact row strings expected in table (mock)
    expectedUrl?: string;                       // exact regex for first-row click URL (mock)
    select?: {
        selectOptions: string[];
        expectedSelectedValuesInTable: Record<string, string[]>;
    };
};

const WIDGETS: Widget[] = [
    {
        title: 'Occurrence Records',
        content: '150,749,276 records in total.',
    },
    {
        title: '\\d{1,3}(,\\d{3})* Datasets',
        table: [
            'Institutions 1,001',
            'Collections 205',
        ],
    },
    {
        title: 'Basis Of Record',
        table: [
            'Human Observation 121.44M',
            'Preserved Specimen 17.07M',
        ],
        expectedUrl: '^https:\\/\\/biocache.ala.org.au\\/occurrences\\/search\\?q=basisOfRecord:%22HUMAN_OBSERVATION%22$',
    },
    {
        title: '\\d{1,3}(,\\d{3})* Collections',
    },
    {
        title: 'Records by Date',
        table: [
            'Latest Record 2025-05-26 10:00',
            'Last Image Added 2025-05-26 01:56',
        ],
    },
    {
        title: 'National Species Lists',
        table: [
            'Accepted Names 367,184',
            'Synonyms 367,184',
        ],
    },
    {
        title: '\\d{1,3}(,\\d{3})* Spatial Layers',
        table: [
            'Contextual Layers 139',
            'Environmental/Raster Layers 49',
        ],
    },
    {
        title: 'Records by State and Territory',
    },
    {
        title: 'Most Recorded Species',
        table: [
            'Gymnorhina tibicen - Australian Magpie 2.22M',
            'Grallina cyanoleuca - Magpie-lark 1.65M',
        ],
        expectedUrl: '^http:\\/\\/bie.test.ala.org.au\\/species\\/https:\\/\\/id\\.biodiversity\\.org\\.au\\/taxon\\/apni\\/51447682$',
        select: {
            selectOptions: ['All Lifeforms', 'Plants', 'Animals'],
            expectedSelectedValuesInTable: {
                Plants: [
                    'Lycium ferocissimum - African Boxthorn 146,916',
                    'Halodule uninervis - Halodule 144,314',
                ],
            },
        },
    },
    {
        title: 'Type Specimens',
        table: [
            'ALLOLECTOTYPE 1',
            'ALLOTYPE 2,225',
        ],
        expectedUrl: '^https:\\/\\/biocache\\.ala\\.org\\.au\\/occurrences\\/search\\?q=typeStatus:%22ALLOTYPE%22$',
        select: {
            selectOptions: ['All Occurrences', 'Occurrences with Images'],
            expectedSelectedValuesInTable: {
                'Occurrences with Images': [
                    'ALLOTYPE 97',
                    'COTYPE 11',
                ],
            },
        },
    },
    {
        title: 'Biodiversity Heritage Library',
        table: [
            'Pages 63.16M',
            'Volumes 318,151',
            'Titles 197,510',
        ],
    },
    {
        title: 'DigiVol \\(Volunteer Portal\\)',
        table: [
            'Volunteers 16,403',
            'Expedition Tasks 7.79M',
            'Expedition Tasks Completed 7.48M',
        ],
    },
    {
        title: 'Conservation Status',
        table: [
            'Vulnerable 1,755',
            'Endangered 2,375',
            'Critically Endangered 1,073',
        ],
        expectedUrl: '^https:\\/\\/biocache\\.ala\\.org\\.au\\/occurrences\\/search\\?q=stateConservation:%22Vulnerable%22$',
    },
    {
        title: 'Records by Data Provider',
        table: [
            'BirdLife Australia 15.13M',
            'Department of Planning, Industry and Environment representing the State of New South Wales 14.25M',
        ],
        expectedUrl: '^https:\\/\\/biocache\\.ala\\.org\\.au\\/occurrences\\/search\\?q=dataProviderUid:%22dp28%22$',
    },
    {
        title: 'Records by Institution',
        table: [
            'Australian Museum 1.56M',
            'Royal Botanic Gardens Victoria 1.09M',
        ],
        expectedUrl: '^https:\\/\\/biocache\\.ala\\.org\\.au\\/occurrences\\/search\\?q=institutionUid:%22in4%22$',
    },
    {
        title: 'Occurrence Tree',
        table: [
            'Animalia - 115.51M',
            'Plantae - 29.18M',
            'Fungi - 2.79M',
        ],
    },
    {
        title: 'Records by Lifeform',
        table: [
            'Algae 1.55M',
            'Amphibians 1.64M',
        ],
        expectedUrl: '^https:\\/\\/biocache\\.ala\\.org\\.au\\/occurrences\\/search\\?q=speciesGroup:%22Algae%22$',
    },
    {
        title: 'Records and Species by Decade',
    },
    {
        title: 'Usage Statistics',
        table: [
            'Records Downloaded 56.26B',
            'Number of Downloads 2.42M',
        ],
    },
    {
        title: 'Occurrence Downloads by Reason',
        table: [
            'Total 2.42M 56.26B',
            'biosecurity management/planning 11,785 932.56M',
            'citizen science 22,370 2.05B',
        ],
    },
    {
        title: 'Occurrence Downloads by User Type',
        table: [
            'Education 150,070 10.46B',
            'Government 37,862 4.03B',
            'Other 472,012 28.94B',
        ],
    },
    {
        title: 'Species Images',
        table: [
            'Total Number of Images 23.24M',
            'Taxa with Images 100,744',
        ],
    },
];

const EXPECTED_CSV_FILES = [
    'dataProviderUid.csv', 'kingdoms.csv', 'basisOfRecord.csv', 'digivol.csv',
    'institutionUid.csv', 'speciesAllLifeforms.csv', 'speciesPlants.csv',
    'speciesAnimals.csv', 'speciesBirds.csv', 'speciesReptiles.csv',
    'speciesArthropods.csv', 'speciesMammals.csv', 'speciesFishes.csv',
    'speciesInsects.csv', 'speciesAmphibians.csv', 'speciesBacteria.csv',
    'speciesFungi.csv', 'collections.csv', 'reasonDownloads.csv',
    'nationalSpeciesLists.csv', 'recordsByDate.csv',
    'specimenTypesAllSpecimenOccurrences.csv', 'specimenTypesSpecimenOccurrencesWithImages.csv',
    'speciesGroup.csv', 'emailDownloads.csv', 'usageStats.csv',
];

// ---------------------------------------------------------------------------
// Slug helper — produces stable camelCase keys for override lookup
// ---------------------------------------------------------------------------
function slug(s: string): string {
    return s
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
        .replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Extract the name portion of a table row string by stripping the trailing
 * formatted count(s) and date-like tokens.  e.g.:
 *   "Plantae - 29.18M"           -> "Plantae -"   -> slug -> "Plantae"
 *   "Human Observation 121.44M"  -> "Human Observation"
 *   "Total 2.42M 56.26B"         -> "Total"
 *   "Vulnerable 1,755"           -> "Vulnerable"
 *   "Latest Record 2025-05-26 10:00" -> "Latest Record"
 */
function rowNameSlug(row: string): string {
    // Strip trailing date tokens (YYYY-MM-DD HH:MM patterns)
    let name = row.replace(/\s+\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2})?$/, '');
    // Strip trailing formatted count tokens
    name = name.replace(/(\s+[\d,]+\.?\d*[MBKmgk]?)+$/, '').trim();
    return slug(name);
}

/**
 * Parse a formatted count string to a raw number for gte comparison.
 *   "29.18M" -> 29_180_000
 *   "1,755"  -> 1755
 *   "56.26B" -> 56_260_000_000
 */
function parseCount(s: string): number {
    const clean = s.replace(/,/g, '');
    if (clean.endsWith('B')) return parseFloat(clean) * 1e9;
    if (clean.endsWith('M')) return parseFloat(clean) * 1e6;
    if (clean.endsWith('K')) return parseFloat(clean) * 1e3;
    return parseFloat(clean);
}

/**
 * Extract the first formatted count token from a row string.
 *   "Plantae - 29.18M"  -> "29.18M"
 *   "Total 2.42M 56.26B" -> "2.42M"
 *   "Vulnerable 1,755"   -> "1,755"
 */
function rowFirstCount(row: string): string | null {
    const m = row.match(/([\d,]+\.?\d*[MBKmgk]?)(?:\s|$)/);
    return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
    if (!isLiveMode()) {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await apiMocks(page, seenUrls);
    }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('first sight on the board', async ({ page }) => {
    test.skip(shouldSkip('first-sight'), 'Skipped via live-config.json skip list');
    await page.goto(getBaseUrl());
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panels = page.locator('div.dashboardPanel.card');
    await expect(panels).toHaveCount(WIDGETS.length);

    const count = await panels.count();
    for (let i = 0; i < count; i++) {
        const panel = panels.nth(i);
        const headerTitle = await panel
            .locator('div.dashboardPanelHeader.card-header h1.dashboardH1')
            .innerText();

        const widget = WIDGETS.find(w => headerTitle.match(w.title));
        expect(widget, `Widget not found for header: "${headerTitle}"`).toBeDefined();
        if (!widget) continue;

        if (widget.content) {
            const panelBody = panel.locator('div.dashboardPanelBody.card-body');
            const normalised = (await panelBody.innerText()).trim().replace(/[\n\t]/g, ' ');
            expect(normalised, `first-sight.${slug(widget.title)}.content`).toBe(widget.content);
        }

        if (widget.table) {
            let rows = panel.locator('table.dashboardTable tbody tr');
            if (await rows.count() === 0) {
                rows = panel.locator('table.dashboardTree tbody tr');
            }

            const srcValuesInTable: string[] = [];
            const rowCount = await rows.count();
            for (let j = 0; j < rowCount; j++) {
                const cellTexts = await rows.nth(j).locator('td').allInnerTexts();
                const rowText = cellTexts.map(t => t.trim()).join(' ').trim();
                if (rowText.length > 0) srcValuesInTable.push(rowText);
            }

            for (const expected of widget.table) {
                // Override key uses name only (no count) for stability.
                // e.g. "Plantae - 29.18M" -> "first-sight.OccurrenceTree.table.Plantae"
                // Override op: gte, value: <mocked numeric count> — live count must be >= mock count.
                const overrideKey = `first-sight.${slug(widget.title)}.table.${rowNameSlug(expected)}`;
                const override = getOverride(overrideKey);
                if (override) {
                    // Find the row by name prefix (strip dates and counts from the expected string)
                    const namePrefix = expected
                        .replace(/\s+\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2})?$/, '')
                        .replace(/(\s+[\d,]+\.?\d*[MBKmgk]?)+$/, '')
                        .trim();
                    const liveRow = srcValuesInTable.find(row => row.startsWith(namePrefix));
                    expect(liveRow, `${overrideKey} — no row starting with "${namePrefix}"`).toBeDefined();
                    if (liveRow && override.op === 'gte') {
                        const liveCount = rowFirstCount(liveRow.slice(namePrefix.length).trim());
                        expect(liveCount, `${overrideKey} — could not parse count from "${liveRow}"`).not.toBeNull();
                        expect(parseCount(liveCount!), overrideKey).toBeGreaterThanOrEqual(Number(override.value));
                    }
                } else {
                    const match = srcValuesInTable.find(it => it === expected);
                    if (!match) {
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
    test.skip(shouldSkip('datasets'), 'Skipped via live-config.json skip list');
    await page.goto(getBaseUrl());
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panel = await findPanelByHeaderRegex(page, /\d{1,3}(,\d{3})* Datasets/);
    expect(panel).toBeDefined();
    const link = panel!.locator('div.dashboardPanelBody.card-body a.dashboardLargeLink');

    expect(await link.getAttribute('href')).toMatch(
        /^https?:\/\/collections(?:\.test)?\.ala\.org\.au\/ws\/dataResource\/.*$/
    );
    // Override: datasets.mostRecentName -> op: exists  (live data, name changes)
    expect(await link.innerText(), 'datasets.mostRecentName').toBe('Zosteria fulvipubescens');
});

test('basis of record, Most Recorded Species, Type Specimens etc', async ({ page }) => {
    test.skip(shouldSkip('clickable-tables'), 'Skipped via live-config.json skip list');
    test.setTimeout(60000);

    for (const widget of WIDGETS.filter(w => w.select || w.expectedUrl)) {
        await page.goto(getBaseUrl());
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveTitle(/Dashboard \| Atlas of Living Australia/);

        const panel = await findPanelByHeaderRegex(page, new RegExp(widget.title));
        expect(panel, `Panel not found: ${widget.title}`).toBeDefined();
        if (!panel) continue;

        if (widget.select) {
            await testSelect(panel, widget.select, slug(widget.title));
        }

        if (widget.expectedUrl) {
            const urlKey = `clickable-tables.${slug(widget.title)}.expectedUrl`;
            const override = getOverride(urlKey);
            const regexUrl = new RegExp(override ? String(override.value) : widget.expectedUrl);
            await testDashboardPanelNavigation(page, panel, regexUrl);
        }
    }
});

test('collections -> chart', async ({ page }) => {
    test.skip(shouldSkip('collections-chart'), 'Skipped via live-config.json skip list');
    if (isLiveMode()) test.setTimeout(getTimeouts().navigation + 30000);
    await page.goto(getBaseUrl());
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panel = await findPanelByHeaderRegex(page, /\d{1,3}(,\d{3})* Collections/);
    expect(panel).toBeDefined();
    const canvas = panel!.locator('div.dashboardPanelBody.card-body canvas[role="img"]');
    await expect(canvas).toHaveCount(1);

    const openedUrl = await captureChartClickUrl(canvas, 0, 0);
    expect(openedUrl).toMatch(/^https?:\/\/collections(?:\.test)?\.ala\.org\.au\/?\?start=.*$/);
});

test('Records by State and Territory -> chart', async ({ page }) => {
    test.skip(shouldSkip('state-territory-chart'), 'Skipped via live-config.json skip list');
    if (isLiveMode()) test.setTimeout(getTimeouts().navigation + 30000);
    await page.goto(getBaseUrl());
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panel = await findPanelByHeaderRegex(page, /Records by State and Territory/);
    expect(panel).toBeDefined();
    const canvas = panel!.locator('div.dashboardPanelBody.card-body canvas[role="img"]');
    await expect(canvas).toHaveCount(1);

    const openedUrl = await captureChartClickUrl(canvas, 0, 0);
    expect(openedUrl).toMatch(/^https?:\/\/biocache(?:\.test)?\.ala\.org\.au\/occurrences\/search\?q=stateProvince:.*$/);
});

test('Records and Species by Decade -> chart', async ({ page }) => {
    test.skip(shouldSkip('decade-chart'), 'Skipped via live-config.json skip list');
    if (isLiveMode()) test.setTimeout(getTimeouts().navigation + 30000);

    if (isLiveMode()) {
        // Intercept dashboard.json to capture the actual HTTP response status/headers from
        // static.ala.org.au. A WAF or CDN block would manifest here as a non-200 or redirect.
        let dashboardJsonStatus: number | null = null;
        let dashboardJsonUrl: string | null = null;
        let dashboardJsonContentType: string | null = null;
        page.on('response', response => {
            if (response.url().includes('dashboard.json')) {
                dashboardJsonStatus = response.status();
                dashboardJsonUrl = response.url();
                dashboardJsonContentType = response.headers()['content-type'] ?? null;
            }
        });

        await page.goto(getBaseUrl());
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

        console.log(`[decade-chart] dashboard.json url:          ${dashboardJsonUrl}`);
        console.log(`[decade-chart] dashboard.json status:       ${dashboardJsonStatus}`);
        console.log(`[decade-chart] dashboard.json content-type: ${dashboardJsonContentType}`);

        // Inspect browser state: is __ChartJS set? Is there a canvas? Does getChart() return anything?
        const diagnostics = await page.evaluate(() => {
            const hasChartJS = typeof (window as any).__ChartJS !== 'undefined';
            const canvases = Array.from(document.querySelectorAll('canvas[role="img"]'));
            const chartInstances = canvases.map((c, i) => {
                const chart = (window as any).__ChartJS?.getChart(c as HTMLCanvasElement);
                return {
                    index: i,
                    chartFound: !!chart,
                    datasetCount: chart ? chart.data.datasets.length : null,
                    dataLength: chart ? (chart.getDatasetMeta(0)?.data?.length ?? null) : null,
                };
            });
            return {
                hasChartJS,
                canvasCount: canvases.length,
                chartInstances,
                // Check if the decade panel heading exists at all
                decadePanelExists: !!document.querySelector('h1.dashboardH1'),
                allHeadings: Array.from(document.querySelectorAll('h1.dashboardH1')).map(h => h.textContent?.trim()),
            };
        });
        console.log(`[decade-chart] __ChartJS set:     ${diagnostics.hasChartJS}`);
        console.log(`[decade-chart] canvas[role=img] count: ${diagnostics.canvasCount}`);
        console.log(`[decade-chart] chart instances:   ${JSON.stringify(diagnostics.chartInstances)}`);
        console.log(`[decade-chart] all panel headings: ${JSON.stringify(diagnostics.allHeadings)}`);
    } else {
        await page.goto(getBaseUrl());
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);
    }

    const panel = await findPanelByHeaderRegex(page, /Records and Species by Decade/);
    expect(panel).toBeDefined();
    const canvas = panel!.locator('div.dashboardPanelBody.card-body canvas[role="img"]');
    await expect(canvas).toHaveCount(1);

    const openedUrl = await captureChartClickUrl(canvas, 0, 0);
    expect(openedUrl).toMatch(/^https?:\/\/biocache(?:\.test)?\.ala\.org\.au\/occurrences\/search\?q=decade:.*$/);
});

test('CSV download', async ({ page, browserName }) => {
    test.skip(shouldSkip('csv-download'), 'Skipped via live-config.json skip list');
    // WebKit does not reliably fire the "download" event for a route-fulfilled
    // response opened via target="_blank" (a WebKit engine quirk, unrelated to
    // whether the response comes from a real server or a mock).
    test.skip(browserName === 'webkit', 'WebKit does not reliably surface downloads intercepted via page.route() for target="_blank" links');
    await page.goto(getBaseUrl());
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    if (isLiveMode()) {
        // In live mode the app requests dashboard.zip from a remote server (e.g. static.ala.org.au).
        // We intercept that request and fulfill it with the fixture zip so the test is not dependent
        // on network access to the static host, while still exercising the button and zip contents.
        const fixtureZip = fs.readFileSync(path.resolve(__dirname, 'resources/dashboard.zip'));
        await page.route('**/dashboard.zip', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/zip',
                headers: { 'Content-Disposition': 'attachment; filename="dashboard.zip"' },
                body: fixtureZip,
            })
        );
    }

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('a.btn', { hasText: 'Download as CSV' }).click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const entries = new AdmZip(downloadPath!).getEntries().map(e => e.entryName);
    for (const file of EXPECTED_CSV_FILES) {
        expect(entries).toContain(file);
    }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function testSelect(
    panel: Locator,
    select: NonNullable<Widget['select']>,
    titleSlug: string
) {
    const selectEl = panel.locator('div.dashboardPanelBody.card-body div.dashboardSelectWrapper select');
    await selectEl.scrollIntoViewIfNeeded();

    const optionTexts = await selectEl.locator('option').allTextContents();
    for (const expected of select.selectOptions) {
        expect(optionTexts).toContain(expected);
    }

    await selectEl.selectOption({ index: 1 });
    const selectedText = (await selectEl.locator('option:checked').textContent())!;
    expect(selectedText).toBe(select.selectOptions[1]);

    const rows = panel.locator('table.dashboardTable tbody tr');
    const srcValuesInTable: string[] = [];
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
        const cellTexts = await rows.nth(i).locator('td').allInnerTexts();
        const rowText = cellTexts.map(t => t.trim()).join(' ').trim();
        if (rowText.length > 0) srcValuesInTable.push(rowText);
    }

    for (const value of select.expectedSelectedValuesInTable[selectedText] ?? []) {
        const optionSlug = slug(selectedText);
        const overrideKey = `clickable-tables.${titleSlug}.select.${optionSlug}.${rowNameSlug(value)}`;
        const override = getOverride(overrideKey);
        if (override && override.op === 'gte') {
            const namePrefix = value
                .replace(/\s+\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2})?$/, '')
                .replace(/(\s+[\d,]+\.?\d*[MBKmgk]?)+$/, '')
                .trim();
            const liveRow = srcValuesInTable.find(row => row.startsWith(namePrefix));
            expect(liveRow, `${overrideKey} — no row starting with "${namePrefix}"`).toBeDefined();
            if (liveRow) {
                const liveCount = rowFirstCount(liveRow.slice(namePrefix.length).trim());
                expect(liveCount, `${overrideKey} — could not parse count from "${liveRow}"`).not.toBeNull();
                expect(parseCount(liveCount!), overrideKey).toBeGreaterThanOrEqual(Number(override.value));
            }
        } else {
            expect(srcValuesInTable).toContain(value);
        }
    }
}

async function testDashboardPanelNavigation(page: Page, panel: Locator, expectedUrlRegex: RegExp) {
    const rows = panel.locator('div.dashboardPanelBody.card-body table.dashboardTable tbody tr');
    expect(await rows.count()).toBeGreaterThan(1);

    await panel.scrollIntoViewIfNeeded();
    const row1 = rows.nth(0);
    await row1.scrollIntoViewIfNeeded();
    await row1.hover();

    const cursor = await row1.evaluate(el => getComputedStyle(el).cursor);
    if (cursor !== 'pointer') return;

    // Intercept the navigation before the external page loads — we only need to
    // assert the URL, not actually load biocache or any other external service.
    const handler = async (route: any) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<html lang="en"></html>' });
    await page.route(expectedUrlRegex, handler);

    // Tie the URL wait directly to the click so there is no race between the
    // click's `document.location.href` navigation and the assertion below —
    // under CPU contention (e.g. many parallel workers) a plain
    // `click()` followed by `waitForLoadState()` can resolve against the
    // pre-navigation page, causing an intermittent false failure.
    await Promise.all([
        page.waitForURL(expectedUrlRegex, { waitUntil: 'domcontentloaded' }),
        row1.click(),
    ]);
    expect(page.url()).toMatch(expectedUrlRegex);
    await page.unroute(expectedUrlRegex, handler);
}

async function captureChartClickUrl(canvas: Locator, datasetIndex: number, elementIndex: number): Promise<string> {
    // Wait until Chart.js has initialised the chart AND has at least one rendered data element.
    // The poll is bounded so it fails fast with a clear message rather than hitting the test timeout.
    const pollTimeoutMs = isLiveMode() ? getTimeouts().navigation : 10000;
    await canvas.evaluate((canvasEl: HTMLCanvasElement, timeoutMs: number) => new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const poll = () => {
            const win = window as any;
            const chart = win.__ChartJS?.getChart(canvasEl);
            if (chart && chart.getDatasetMeta(0).data.length > 0) { resolve(); return; }
            if (Date.now() > deadline) {
                const state = {
                    __ChartJS_set: typeof win.__ChartJS !== 'undefined',
                    getChart_result: chart ? 'instance found' : 'null/undefined',
                    datasetMeta0_length: chart ? (chart.getDatasetMeta(0)?.data?.length ?? 'meta missing') : 'n/a',
                    canvas_width: canvasEl.width,
                    canvas_height: canvasEl.height,
                    canvas_in_dom: document.contains(canvasEl),
                };
                reject(new Error(
                    'Chart did not initialise within timeout — state: ' + JSON.stringify(state)
                ));
                return;
            }
            setTimeout(poll, 50);
        };
        poll();
    }), pollTimeoutMs);

    const rawUrl = await canvas.evaluate(
        (canvasEl: HTMLCanvasElement, { datasetIndex, elementIndex }: { datasetIndex: number; elementIndex: number }) => {
            let captured: string | null = null;
            const origOpen = window.open;
            (window as any).open = (url?: string | URL) => { captured = url != null ? String(url) : null; return null; };
            try {
                const chart = (window as any).__ChartJS?.getChart(canvasEl);
                if (chart?.options?.onClick) {
                    chart.options.onClick({}, [{ index: elementIndex, datasetIndex }], chart);
                }
            } finally {
                window.open = origOpen;
            }
            return captured;
        },
        { datasetIndex, elementIndex }
    );

    expect(rawUrl, `window.open was not called — check __ChartJS is exposed and chart has onClick`).not.toBeNull();
    return decodeURIComponent(rawUrl!);
}

async function findPanelByHeaderRegex(page: Page, pattern: RegExp): Promise<Locator | undefined> {
    const panels = page.locator('div.dashboardPanel.card');
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
        const panel = panels.nth(i);
        const headerTitle = await panel
            .locator('div.dashboardPanelHeader.card-header h1.dashboardH1')
            .innerText();
        if (pattern.test(headerTitle)) return panel;
    }
    return undefined;
}
