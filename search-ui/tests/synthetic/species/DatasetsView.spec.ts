import { test, expect } from '../../fixtures';
import { shouldSkip } from '../../mocks/liveConfig';
import { setupSpeciesPageMocks, load, speciesUrl, waitForContent, SPECIES_BIRD_FULL } from './helpers';

// ---------------------------------------------------------------------------
// datasetsView.tsx — branches not covered by acceptance.spec.ts's
// "Species page - Datasets tab" describe block.
//
// 1. The dataset facet fetch itself fails entirely -> error message
// ---------------------------------------------------------------------------

test.describe('DatasetsView.tsx', () => {
    test('dataset facet fetch failure shows an error message', async ({ page }) => {
        test.skip(shouldSkip('datasetsview-facet-error'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await page.context().route('https://biocache-ws.ala.org.au/ws/occurrences/search**', async (route) => {
            const url = new URL(route.request().url());
            if (url.searchParams.get('facets') === 'dataResourceUid') {
                return route.abort('failed');
            }
            return route.fallback();
        });

        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=datasets'));
        await waitForContent(page);

        await expect(page.locator('text=Error loading datasets')).toBeVisible();
        await expect(page.locator('code', { hasText: 'Failed to fetch datasets' })).toBeVisible();
    });
});
