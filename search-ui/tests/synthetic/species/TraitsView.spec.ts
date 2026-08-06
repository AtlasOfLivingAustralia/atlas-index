import { test, expect } from '../../fixtures';
import { shouldSkip } from '../../mocks/liveConfig';
import { setupSpeciesPageMocks, load, speciesUrl, waitForContent, SPECIES_PLANT_TRAITS } from './helpers';

// ---------------------------------------------------------------------------
// traitsView.tsx — branches not covered by acceptance.spec.ts's
// "Species page - Traits tab" describe block.
//
// 1. Network error fetching _count.json -> FlaggedAlert error message (distinct from the plain 404 "no data" case)
// 2. Network error fetching _summary.json -> FlaggedAlert error message
// ---------------------------------------------------------------------------

test.describe('TraitsView.tsx', () => {
    test('a network error fetching the traits count shows an error message', async ({ page }) => {
        test.skip(shouldSkip('traitsview-count-network-error'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await page.context().route('https://static.test.ala.org.au/taxon-traits/**_count.json', (route) => route.abort('failed'));

        await load(page, speciesUrl(SPECIES_PLANT_TRAITS.guid, 'tab=traits'));
        await waitForContent(page);

        await expect(page.locator('text=Error loading trait data.')).toBeVisible();
        await expect(page.locator('code', { hasText: 'Traits counts' })).toBeVisible();
    });

    test('a network error fetching the traits summary shows an error message', async ({ page }) => {
        test.skip(shouldSkip('traitsview-summary-network-error'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await page.context().route('https://static.test.ala.org.au/taxon-traits/**_summary.json', (route) => route.abort('failed'));

        await load(page, speciesUrl(SPECIES_PLANT_TRAITS.guid, 'tab=traits'));
        await waitForContent(page);

        await expect(page.locator('code', { hasText: 'Traits summary' })).toBeVisible();
    });
});
