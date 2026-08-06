import { test, expect } from '../../fixtures';
import { shouldSkip } from '../../mocks/liveConfig';
import { setupSpeciesPageMocks, load, speciesUrl, SPECIES_BIRD_FULL } from './helpers';

// ---------------------------------------------------------------------------
// descriptionView.tsx — branches not covered by acceptance.spec.ts's
// "Species page - Description tab" describe block.
//
// 1. Mobile: section content is collapsed by default and toggles open on heading click
// ---------------------------------------------------------------------------

test.describe('DescriptionView.tsx', () => {
    test('mobile: section content is collapsed by default and expands on heading click', async ({ page }) => {
        test.skip(shouldSkip('description-mobile-toggle'), 'Skipped via live-config.json skip list');
        await page.setViewportSize({ width: 400, height: 800 });
        await setupSpeciesPageMocks(page);
        // Mobile uses Species.tsx's own accordion (mobileToggle state) — expand
        // the "Description" section first before DescriptionView's own mobile
        // per-box collapse behaviour can be exercised.
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));
        await page.locator('text=Description').first().click();

        const summaryHeading = page.locator('span', { hasText: 'Summary' }).first();
        await expect(summaryHeading).toBeVisible();

        // Content collapsed by default on mobile. Uses text unique to the
        // description box's own "Summary" fixture content — the species
        // header (always visible, not mobile-collapsed) shows a *different*
        // heroDescription string, so a distinct phrase avoids a false match there.
        expect(await page.locator('text=rarest birds of prey').count()).toBe(0);

        await summaryHeading.click();
        await expect(page.locator('text=rarest birds of prey')).toBeVisible();

        // Click again to collapse
        await summaryHeading.click();
        expect(await page.locator('text=rarest birds of prey').count()).toBe(0);
    });
});
