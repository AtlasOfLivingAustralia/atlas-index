import { test, expect } from '../fixtures';
import { setupMocks, BASE_URL, g_indexFieldsWithBadges } from './helpers';
import { mockIndexFields } from '../mocks/biocacheMocks';

// ===========================================================================
// Synthetic coverage: src/views/Fields.tsx (457 lines, routed at /fields),
// confirmed via real lcov data to be genuinely 0%-executed per
// PLAYWRIGHT_TEST.md §5.3.4. Standalone page, unrelated to the Download wizard
// despite sharing the /index/fields endpoint via mockIndexFields(). No login
// gate, no route params beyond the optional ?filter=<expr> (nuqs's
// useQueryState, same library/pattern as OccurrenceList.tsx's pagination params).
// ===========================================================================

async function loadFields(page: import('@playwright/test').Page) {
    await page.goto(`${BASE_URL}/fields`);
    await expect(page.locator('#fieldsTable')).toBeVisible({ timeout: 15000 });
}

test.describe('Fields', () => {
    test('loads the field table with all 13 default rows; no pagination nav for a single page', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls);
        await loadFields(page);

        await expect(page.locator('#fieldsTable tbody tr')).toHaveCount(13);
        // "1–13" uses an EN DASH (U+2013), not a hyphen -- copied verbatim from en.json.
        await expect(page.locator('#pagination-details')).toContainText('Showing 1–13 of 13 results');
        await expect(page.locator('nav[aria-label="Fields pagination"]')).toHaveCount(0);
    });

    test('the "only DwC terms" preset narrows to the 7 rows with a dwcTerm; the button becomes active and the search box mirrors the raw filter string', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls);
        await loadFields(page);

        const dwcButton = page.locator('#filters').getByText('only DwC terms', { exact: true });
        await dwcButton.click();

        await expect(dwcButton).toHaveClass(/active/);
        await expect(page.locator('#fieldsTable tbody tr')).toHaveCount(7);
        // applyFilter() overwrites the visible search input with the raw filter
        // string, not just the applied (URL) filter -- an implementation quirk.
        await expect(page.locator('#filters input[type="text"]')).toHaveValue('dwcTerm:.*');
    });

    test('the "only JSON output fields" preset matches nothing (no fixture row sets jsonName) and shows the empty-results row', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls);
        await loadFields(page);

        await page.locator('#filters').getByText('only JSON output fields', { exact: true }).click();

        await expect(page.locator('#fieldsTable tbody tr')).toHaveCount(1);
        // Literal (non-translated) text, not a FormattedMessage.
        await expect(page.locator('#fieldsTable')).toContainText('No fields match your filter.');
    });

    test('free-text search only applies on Search submit, not on every keystroke', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls, g_indexFieldsWithBadges);
        await loadFields(page);

        await expect(page.locator('#fieldsTable tbody tr')).toHaveCount(14);
        await page.locator('#filters input[type="text"]').fill('specialField');
        // Typing alone must not narrow the table yet.
        await expect(page.locator('#fieldsTable tbody tr')).toHaveCount(14);

        await page.locator('#filters').getByRole('button', { name: 'Search', exact: true }).click();
        await expect(page.locator('#fieldsTable tbody tr')).toHaveCount(1);
        await expect(page.locator('#fieldsTable')).toContainText('specialField');
    });

    test('the clear (×) button only appears once a filter is applied, and resets to all fields', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls);
        await loadFields(page);

        await expect(page.locator('button[title="clear"]')).toHaveCount(0);

        await page.locator('#filters').getByText('only DwC terms', { exact: true }).click();
        await expect(page.locator('#fieldsTable tbody tr')).toHaveCount(7);
        const clearButton = page.locator('button[title="clear"]');
        await expect(clearButton).toBeVisible();

        await clearButton.click();
        await expect(page.locator('#fieldsTable tbody tr')).toHaveCount(13);
        await expect(page.locator('#filters input[type="text"]')).toHaveValue('');
        await expect(clearButton).toHaveCount(0);
        // nuqs syncs the URL slightly after the state update -- a synchronous
        // page.url() read here can observe a stale value, so poll instead.
        await expect.poll(() => page.url()).not.toContain('filter=');
    });

    test('sorting by "DwC class" always keeps rows with no class value last, in both Ascending and Descending order', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls);
        await loadFields(page);

        await page.locator('#sort-widgets select').nth(1).selectOption('classs');

        // ASC (default order): the 4 classs-less rows (el882, cl1048, assertions,
        // species_guid) sort last regardless of alphabetical order -- confirmed via
        // compareFields()'s explicit "empty always last" branch, checked BEFORE the
        // ASC/DESC-dependent localeCompare.
        let classValues = await page.locator('#fieldsTable tbody tr td:nth-child(5)').allTextContents();
        expect(classValues.slice(0, 9).every(v => v.trim() !== '')).toBe(true);
        expect(classValues.slice(9).every(v => v.trim() === '')).toBe(true);
        expect(classValues[0]).toBe('Event'); // alphabetically first of Event/Location/Occurrence/Record/Taxon

        await page.locator('#sort-widgets select').nth(2).selectOption('DESC');
        classValues = await page.locator('#fieldsTable tbody tr td:nth-child(5)').allTextContents();
        // Empty values stay LAST even in Descending order -- not a plain ASC/DESC
        // mirror image.
        expect(classValues.slice(9).every(v => v.trim() === '')).toBe(true);
        expect(classValues[0]).toBe('Taxon'); // alphabetically last -- now sorts first
    });

    test('changing "Items per page" to 10 paginates the 13 default rows across 2 pages', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls);
        await loadFields(page);

        await page.locator('#sort-widgets select').nth(0).selectOption('10');
        await expect(page.locator('#fieldsTable tbody tr')).toHaveCount(10);
        await expect(page.locator('#pagination-details')).toContainText('Showing 1–10 of 13 results');

        const nav = page.locator('nav[aria-label="Fields pagination"]');
        await expect(nav).toBeVisible();
        await nav.getByText('»', { exact: true }).click();

        await expect(page.locator('#fieldsTable tbody tr')).toHaveCount(3);
        await expect(page.locator('#pagination-details')).toContainText('Showing 11–13 of 13 results');
    });

    test('badges and the Wiki link render for a fully-populated row', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls, g_indexFieldsWithBadges);
        await loadFields(page);

        const row = page.locator('#fieldsTable tbody tr', { hasText: 'specialField' });
        await expect(row.locator('.badge.bg-info')).toHaveText('I');
        await expect(row.locator('.badge.bg-success')).toHaveText('S');
        await expect(row.locator('.badge.bg-dark')).toHaveText('M');
        await expect(row.locator('.badge.bg-danger')).toHaveText('i18n');
        await expect(row.locator('.badge.bg-secondary')).toHaveText('string');
        await expect(row.getByRole('link', { name: 'Wiki' })).toHaveAttribute('href', g_indexFieldsWithBadges[g_indexFieldsWithBadges.length - 1].infoUrl!);
    });

    test('an error response shows the fetch error message instead of the table', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        // Deliberately not using mockIndexFields for this one test -- override with a
        // plain failing response instead.
        await page.context().route('https://biocache-ws.ala.org.au/ws/index/fields**', async (route) => {
            seenUrls.add(new URL(route.request().url()));
            await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({}) });
        });
        await page.goto(`${BASE_URL}/fields`);

        const alert = page.locator('.alert-danger');
        await expect(alert).toBeVisible({ timeout: 15000 });
        await expect(alert).toContainText('HTTP 500');
        await expect(page.locator('#fieldsTable')).toHaveCount(0);
    });
});
