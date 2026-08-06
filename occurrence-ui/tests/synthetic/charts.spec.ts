import { test, expect } from '../fixtures';
import { setupMocks, loadResults } from './helpers';
import { mockChart } from '../mocks/biocacheMocks';

// ===========================================================================
// Synthetic coverage: src/components/list/pieChart.tsx (33.33%),
// horizontalBarChart.tsx (23.88%), verticalBarChart.tsx (35.71%). The only
// existing test touching these (acceptance.spec.ts's "Search results - Charts
// tab") only asserts all 7 configured charts render SOME <canvas> -- it never
// clicks a slice/bar, never clicks or hovers a legend row, and never overrides
// mockChart()'s data per-facet. Chart.js renders to a bare <canvas> with no
// id/class/aria-label of its own, so every locator here is either the chart's
// labelled wrapper column or the custom HTML legend rows pieChart.tsx renders
// beside its canvas.
// ===========================================================================

function chartWrapper(page: import('@playwright/test').Page, label: string) {
    return page.locator('.col-6.mb-5', { hasText: label });
}

async function openChartsTab(page: import('@playwright/test').Page) {
    await page.getByRole('tab', { name: 'Charts' }).click();
    // src/config/charts.json's 7 entries are fetched sequentially -- wait for the
    // last one (typeStatus) so every chart (including the ones this file overrides)
    // has actually resolved before interacting with any of them.
    for (const label of ['By license', 'By month', 'By genus', 'By decade', 'By family', 'By data assertion', 'By type status']) {
        await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 10000 });
    }
    await expect(page.locator('canvas')).toHaveCount(7);
}

test.describe('PieChart interactions (By license / By genus / By family / By type status)', () => {
    test('clicking a slice navigates to that facet value\'s filtered search URL', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockChart(page, seenUrls, {
            license: [
                { fq: 'license:CC-BY', count: 100000, i18nCode: 'facet.license.CC-BY', label: 'CC-BY' },
                { fq: 'license:CC0', count: 50000, i18nCode: 'facet.license.CC0', label: 'CC0' },
            ],
        });
        await loadResults(page);
        await openChartsTab(page);

        const canvas = chartWrapper(page, 'By license').locator('canvas');
        const box = (await canvas.boundingBox())!;
        // Chart.js's pie/doughnut sweep starts at 12 o'clock and goes clockwise in
        // dataset order -- CC-BY (2/3 of the total) spans from 0deg to 240deg, so a
        // point on the ring at the "3 o'clock" position (90deg) is safely inside its
        // slice, well clear of both the CC0/CC-BY boundary (at 0/360deg, top-centre)
        // and the 50%-cutout hole in the middle.
        await canvas.click({ position: { x: box.width * 0.85, y: box.height * 0.5 } });

        await expect(page).toHaveURL(/\/occurrences\/search/);
        // charts.tsx builds this href via plain string concat ("&fq=" + fq), not
        // encodeURIComponent/URLSearchParams -- the colon stays literal, not %3A
        // (same convention as dataQualityCategoryInfoModal.tsx elsewhere).
        await expect(page).toHaveURL(/fq=license:CC-BY/);
    });

    test('clicking a legend row toggles its slice (dimmed + struck-through) without navigating; hovering highlights the row', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockChart(page, seenUrls, {
            genus: [
                { fq: 'genus:Acacia', count: 900, i18nCode: 'facet.genus.Acacia', label: 'Acacia' },
                { fq: 'genus:Eucalyptus', count: 400, i18nCode: 'facet.genus.Eucalyptus', label: 'Eucalyptus' },
            ],
        });
        await loadResults(page);
        await openChartsTab(page);

        const wrapper = chartWrapper(page, 'By genus');
        // getByText() resolves to the innermost matching element -- the label
        // <span> -- but the opacity/text-decoration/background-color styles this
        // test asserts on are all set on that span's PARENT <div> (the row itself,
        // which also carries the onClick/onMouseEnter/onMouseLeave handlers).
        const legendRow = wrapper.getByText('Acacia -', { exact: false }).locator('xpath=..');
        await expect(legendRow).toBeVisible();

        const urlBefore = page.url();
        await legendRow.click();
        await expect(legendRow).toHaveCSS('text-decoration-line', 'line-through');
        expect(page.url()).toBe(urlBefore); // legend clicks never navigate

        await legendRow.hover();
        await expect(legendRow).toHaveCSS('background-color', 'rgb(245, 245, 245)');

        // Click again to toggle the slice back on.
        await legendRow.click();
        await expect(legendRow).toHaveCSS('text-decoration-line', 'none');
    });
});

test.describe('VerticalBarChart interactions (By month / By decade)', () => {
    test('clicking a bar navigates to that facet value\'s filtered search URL', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockChart(page, seenUrls, {
            decade: [
                { fq: 'decade:2020', count: 300, i18nCode: 'facet.decade.2020', label: '2020s' },
                { fq: 'decade:2010', count: 150, i18nCode: 'facet.decade.2010', label: '2010s' },
            ],
        });
        await loadResults(page);
        await openChartsTab(page);

        const canvas = chartWrapper(page, 'By decade').locator('canvas');
        const box = (await canvas.boundingBox())!;
        // First category (index 0, "2020s") occupies roughly the left-hand quarter
        // of the plotted x-axis; clicking mid-height inside its bar is enough for
        // chart.js's 'nearest'+intersect:true hit test to resolve to it.
        await canvas.click({ position: { x: box.width * 0.25, y: box.height * 0.5 } });

        await expect(page).toHaveURL(/fq=decade:2020/);
    });
});

test.describe('HorizontalBarChart interactions (By data assertion)', () => {
    test('clicking a bar navigates to that facet value\'s filtered search URL', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockChart(page, seenUrls, {
            assertions: [
                { fq: 'assertions:missingCoords', count: 60, i18nCode: 'facet.assertions.missingCoords', label: 'Missing coordinates' },
                { fq: 'assertions:futureDate', count: 20, i18nCode: 'facet.assertions.futureDate', label: 'Future date' },
            ],
        });
        await loadResults(page);
        await openChartsTab(page);

        const canvas = chartWrapper(page, 'By data assertion').locator('canvas');
        const box = (await canvas.boundingBox())!;
        await canvas.click({ position: { x: box.width * 0.6, y: box.height * 0.25 } });

        await expect(page).toHaveURL(/fq=assertions:missingCoords/);
    });

    test('hovering the y-axis label region shows a pointer cursor; clicking it navigates the same as clicking the bar', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockChart(page, seenUrls, {
            assertions: [
                { fq: 'assertions:missingCoords', count: 60, i18nCode: 'facet.assertions.missingCoords', label: 'Missing coordinates' },
                { fq: 'assertions:futureDate', count: 20, i18nCode: 'facet.assertions.futureDate', label: 'Future date' },
            ],
        });
        await loadResults(page);
        await openChartsTab(page);

        const canvas = chartWrapper(page, 'By data assertion').locator('canvas');
        const box = (await canvas.boundingBox())!;
        // A few pixels in from the left edge is reliably inside the reserved y-axis
        // label margin (mouseX < chart.chartArea.left), not over any bar itself --
        // this is horizontalBarChart.tsx's own manually-reimplemented hover/click
        // handling for the label text (chart.js's built-in hit-testing only covers
        // the bars, not the axis labels).
        await canvas.hover({ position: { x: 3, y: box.height * 0.25 } });
        await expect(canvas).toHaveCSS('cursor', 'pointer', { timeout: 5000 });

        await canvas.click({ position: { x: 3, y: box.height * 0.25 } });
        await expect(page).toHaveURL(/fq=assertions:missingCoords/);
    });
});
