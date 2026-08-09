import { test, expect } from '../fixtures';
import { setupMocks, loadResults, BASE_URL } from './helpers';
import { setupRecordMocks } from '../mocks/recordMocks';

// ===========================================================================
// Synthetic coverage: src/components/list/recordsView.tsx (398 lines, 40.81%
// stmt coverage) -- the Records tab's row list + manual pagination bar + the 3
// per-page/sort/order selects. Per lcov data, openOccurrence() (row click),
// all 3 selects' onChange bodies, and every pagination button's onClick (page
// number, "1", Previous, Next) had never fired in any existing test.
// ===========================================================================

function pageButton(page: import('@playwright/test').Page, label: string) {
    return page.locator('.d-flex.justify-content-center').getByText(label, { exact: true });
}

test.describe('RecordsView pagination', () => {
    test('clicking a page number, "1", Previous, and Next all navigate and toggle the disabled state correctly', async ({ page }) => {
        await setupMocks(page, { biocache: { totalRecords: 500 } });
        await loadResults(page);

        await expect(pageButton(page, '1')).toBeDisabled();
        await expect(page.locator('.d-flex.justify-content-center').getByRole('button', { name: /Previous/ })).toHaveCount(0);

        await pageButton(page, '3').click();
        await expect(page).toHaveURL(/page=3/);
        await expect(pageButton(page, '3')).toBeDisabled();
        await expect(pageButton(page, '1')).toBeEnabled();

        const prevButton = page.locator('.d-flex.justify-content-center').getByRole('button', { name: /Previous/ });
        await expect(prevButton).toBeVisible();
        await prevButton.click();
        await expect(page).toHaveURL(/page=2/);

        const nextButton = page.locator('.d-flex.justify-content-center').getByRole('button', { name: /Next/ });
        await nextButton.click();
        await expect(page).toHaveURL(/page=3/);

        // nuqs's parseAsInteger.withDefault(1) clears the `page` param entirely once
        // it's set back to the default (1), rather than writing a literal "page=1" --
        // the "1" button's own disabled state is the reliable signal here instead.
        await pageButton(page, '1').click();
        await expect(pageButton(page, '1')).toBeDisabled();
        await expect(page.locator('.d-flex.justify-content-center').getByRole('button', { name: /Previous/ })).toHaveCount(0);
    });

    test('the per-page/sort/order selects update their URL query params and reset back to page 1', async ({ page }) => {
        await setupMocks(page, { biocache: { totalRecords: 500 } });
        await loadResults(page);

        // Move off page 1 first, so the "resets to page 1" behaviour is observable.
        // (nuqs clears the `page` param once it's back at its default of 1, so the
        // "1" button's disabled state -- not a literal "page=1" in the URL -- is
        // what each assertion below checks.)
        await pageButton(page, '3').click();
        await expect(page).toHaveURL(/page=3/);
        await page.locator('#per-page').selectOption('50');
        await expect(page).toHaveURL(/pageSize=50/);
        await expect(pageButton(page, '1')).toBeDisabled();

        await pageButton(page, '3').click();
        await page.locator('#sort').selectOption('taxon_name');
        await expect(page).toHaveURL(/sort=taxon_name/);
        await expect(pageButton(page, '1')).toBeDisabled();

        await pageButton(page, '3').click();
        await page.locator('#dir').selectOption('asc');
        await expect(page).toHaveURL(/order=asc/);
        await expect(pageButton(page, '1')).toBeDisabled();
    });

    test('an empty result set shows no rows and only the "1" pagination button', async ({ page }) => {
        await setupMocks(page, { biocache: { occurrences: [], totalRecords: 0, unfilteredTotalRecords: 0 } });
        await page.goto(`${BASE_URL}/occurrences/search?q=${encodeURIComponent('taxa:"nonexistent"')}`);
        await expect(page.locator('#resultsContainer')).toBeVisible({ timeout: 15000 });

        await expect(page.locator('#resultsContainer > div')).toHaveCount(0);
        const paginationButtons = page.locator('.d-flex.justify-content-center button');
        await expect(paginationButtons).toHaveCount(1);
        await expect(paginationButtons.first()).toHaveText('1');
    });
});

test.describe('RecordsView row navigation', () => {
    test('clicking a result row navigates to its record-detail page', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        // The default acacia search fixture's first row shares its uuid with
        // g_acaciaRecord -- mock the record-detail page's own fetches too, since
        // navigating there for real (not just checking the URL) fires them.
        await setupRecordMocks(page, seenUrls);
        await loadResults(page);

        const uuid = 'aaaaaaaa-1111-2222-3333-444444444444';
        await page.locator(`#${uuid}`).click();
        await expect(page).toHaveURL(new RegExp(`/occurrence/${uuid}$`));
    });
});
