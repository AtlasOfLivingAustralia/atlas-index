import { test, expect } from './fixtures';
import { apiMocks } from './mocks/apiServiceMocks';
import { logMissingMocks } from './mocks/logMissingMocks';
import { staticServerMocks } from './mocks/staticServerMocks';
import { isLiveMode, getBaseUrl, shouldSkip } from './mocks/liveConfig';

test.beforeEach(async ({ page }) => {
    if (!isLiveMode()) {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls); // must be first otherwise it will intercept all requests
        await staticServerMocks(page, seenUrls);
        await apiMocks(page, seenUrls);
    }
});

test('Sensitive Data Service page renders its key sections and resource links', async ({ page }) => {
    test.skip(shouldSkip('sds-page-content'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl());
    await page.waitForLoadState('networkidle');

    // Page heading
    await expect(page.locator('#main h2').first()).toHaveText('Sensitive Data Service');

    // Breadcrumb updated by the page's own setBreadcrumbs() call
    const lastBreadcrumb = page.locator('#breadcrumb li.breadcrumb-item').last();
    await expect(lastBreadcrumb).toHaveText('Sensitive Data Service');

    // "Data Sensitivity" help link
    const helpLink = page.locator('#main a', { hasText: 'Data Sensitivity' });
    await expect(helpLink).toBeVisible();
    expect(await helpLink.getAttribute('href')).toContain('support.ala.org.au');

    // "Sensitive Data Service API" swagger link — points at the report endpoint
    const swaggerLink = page.locator('#main a', { hasText: 'Sensitive Data Service API' });
    await expect(swaggerLink).toBeVisible();
    expect(await swaggerLink.getAttribute('href')).toMatch(/\/swagger#\/Conservation%20status%20management\/report$/);

    // Resources table — 4 fixed rows: XML data, categories, zones, layers
    const rows = page.locator('#main table.table tbody tr');
    await expect(rows).toHaveCount(4);

    const xmlLink = rows.nth(0).locator('a', { hasText: 'Sensitive Species Data' });
    await expect(xmlLink).toBeVisible();
    expect(await xmlLink.getAttribute('href')).toMatch(/\.xml$/);

    const categoriesLink = rows.nth(1).locator('a', { hasText: 'Sensitive Categories' });
    expect(await categoriesLink.getAttribute('href')).toMatch(/\/categories$/);

    const zonesLink = rows.nth(2).locator('a', { hasText: 'Sensitive Zones' });
    expect(await zonesLink.getAttribute('href')).toMatch(/\/zones$/);

    const layersLink = rows.nth(3).locator('a', { hasText: 'List of sensitive layer IDs' });
    expect(await layersLink.getAttribute('href')).toMatch(/\/layers$/);

    // "list tool" link at the bottom of the page
    const listToolLink = page.locator('#main a', { hasText: 'list tool' });
    await expect(listToolLink).toBeVisible();
    expect(await listToolLink.getAttribute('href')).toContain('isSDS');
});

test('sensitive species data file shows a generated date from the Last-Modified header', async ({ page }) => {
    test.skip(shouldSkip('xml-last-modified'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl());
    await page.waitForLoadState('networkidle');

    const lastModifiedEl = page.locator('#xmlLastModified');
    await expect(lastModifiedEl).toBeVisible();

    // Starts as "(loading...)" until the fetch resolves — wait for it to settle.
    await expect(async () => {
        const text = await lastModifiedEl.innerText();
        expect(text).not.toBe('(loading...)');
    }).toPass({ timeout: 15000 });

    // Formatted via toLocaleString('en-AU', { weekday, month, day, hour, minute, second, timeZoneName }),
    // e.g. "Wed, 21 Oct, 7:28:00 am GMT+10". Loosely match weekday abbreviation + a time,
    // since the exact date/time differs between mock data and the live XML file.
    const text = await lastModifiedEl.innerText();
    expect(text, 'xml-last-modified.format').toMatch(/^[A-Za-z]{3},.*\d{1,2}:\d{2}:\d{2}/);
});
