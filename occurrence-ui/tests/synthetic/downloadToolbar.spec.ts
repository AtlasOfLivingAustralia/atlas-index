import { test, expect } from '../fixtures';
import { setupMocks, BASE_URL } from './helpers';
import { SESSION_USER } from '../mocks/apiMocks';
import { mockIndexFields, g_indexFields } from '../mocks/biocacheMocks';

// ===========================================================================
// Synthetic coverage: src/components/download/DownloadToolbar.tsx (63 lines).
// The only existing coverage (tests/acceptance.spec.ts's "records download -
// custom format..." test) clicks only the enabled Next button; Select all,
// Unselect all, Save preferences, and the disabled-Next branch had never fired.
// ===========================================================================

async function goToCustomDownload(page: import('@playwright/test').Page) {
    await page.goto(`${BASE_URL}/download/options2?searchParams=${encodeURIComponent('?q=taxa:"acacia"')}&downloadType=records&downloadReason=1`);
    await expect(page.locator('.well .list-group-item').first()).toBeVisible({ timeout: 15000 });
}

test.describe('DownloadToolbar (CustomDownload page)', () => {
    test('"Select all" selects every field group; "Unselect all" reverts to only the mandatory (disabled) groups', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await mockIndexFields(page, seenUrls);
        await goToCustomDownload(page);

        const total = await page.locator('.well .list-group-item').count();
        // Only the 2 mandatory groups (recordLevelTerms, occurrence) are pre-selected
        // by default, per g_indexFields' classs:Record/classs:Occurrence rows.
        await expect(page.locator('.well .list-group-item.download-custom-selected')).toHaveCount(2);

        await page.getByText('Select all', { exact: true }).first().click();
        await expect(page.locator('.well .list-group-item.download-custom-selected')).toHaveCount(total);

        await page.getByText('Unselect all', { exact: true }).first().click();
        await expect(page.locator('.well .list-group-item.download-custom-selected')).toHaveCount(2);
        await expect(page.locator('.well .list-group-item.download-custom-selected.disabled')).toHaveCount(2);
    });

    test('"Save preferences" persists the current selection to a cookie and shows a transient success alert', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await mockIndexFields(page, seenUrls);
        await goToCustomDownload(page);

        await page.getByText('Taxon', { exact: true }).click();
        await page.getByText('Save preferences', { exact: true }).first().click();

        await expect(page.locator('.alert-success')).toContainText('Preferences saved.');

        const cookies = await page.context().cookies();
        const downloadFieldsCookie = cookies.find(c => c.name === 'download_fields');
        expect(downloadFieldsCookie?.value).toContain('taxon');

        // setTimeout(() => setSaveMessage(null), 3000) -- give it a bit more than 3s.
        await expect(page.locator('.alert-success')).toHaveCount(0, { timeout: 6000 });
    });

    test('Next is disabled when the mocked /index/fields has no mandatory-group fields at all', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        // Excludes classs:Record/classs:Occurrence rows entirely -- buildSections()
        // drops both mandatory groups from `sections`, so initialSelection stays empty
        // and canNext (selectedGroups.size > 0) is false.
        await mockIndexFields(page, seenUrls, g_indexFields.filter(f => f.classs !== 'Record' && f.classs !== 'Occurrence'));
        await goToCustomDownload(page);

        await expect(page.locator('button.btn-primary').first()).toBeDisabled();
    });
});
