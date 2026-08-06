import { test, expect } from '../fixtures';
import { setupMocks, loadRecord, loadResults } from './helpers';
import { setupRecordMocks, g_acaciaRecord } from '../mocks/recordMocks';

const appPort = process.env.PLAYWRIGHT_APP_PORT ?? '5173';

// ===========================================================================
// Synthetic coverage: src/components/apiModal.tsx (43 lines, 0% coverage --
// genuinely never mounted in any existing test). Triggered from 2 independent
// sites: Occurrence.tsx's record-detail page (.copyLink, a unique class) and
// OccurrenceList.tsx's search-results page (#downloads-api).
// ===========================================================================

test.describe('ApiModal', () => {
    test('the record-detail "API" trigger shows the JSON web service URL and copies it to the clipboard', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await setupRecordMocks(page, seenUrls);
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('.copyLink').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('JSON web service API');

        const expectedUrl = `https://biocache-ws.ala.org.au/ws/occurrences/${g_acaciaRecord.raw.uuid}`;
        await expect(modal.locator('input[readonly]')).toHaveValue(expectedUrl);

        await modal.getByRole('button', { name: 'Copy URL' }).click();
        // CopyTooltip's 1-second Overlay/Popover -- shares this same component with
        // no existing coverage anywhere else either. react-bootstrap's Overlay
        // portals its Popover to document.body, NOT as a descendant of the modal
        // dialog, so this must be located page-wide, not scoped to `modal`.
        await expect(page.getByText('Copy to Clipboard')).toBeVisible();

        await modal.getByRole('button', { name: 'Close' }).click();
        await expect(modal).not.toBeVisible();
    });

    test('the search-results-list "API" trigger (#downloads-api) shows the search URL', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);

        await page.locator('#downloads-api').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal.locator('input[readonly]')).toHaveValue(new RegExp(`^http://localhost:${appPort}/occurrences/search\\?`));
    });
});
