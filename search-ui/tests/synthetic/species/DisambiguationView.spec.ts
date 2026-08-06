import { test, expect } from '../../fixtures';
import { shouldSkip } from '../../mocks/liveConfig';
import { setupSpeciesPageMocks, load, speciesUrl, SPECIES_PLANT_MINIMAL } from './helpers';

// ---------------------------------------------------------------------------
// disambiguationView.tsx — branches not covered by acceptance.spec.ts's
// "Species page - Names tab > disambiguation section" test.
//
// 1. Zero matches -> component renders nothing at all (not even the heading)
// ---------------------------------------------------------------------------

test.describe('DisambiguationView.tsx', () => {
    test('renders nothing when there are no disambiguation matches', async ({ page }) => {
        test.skip(shouldSkip('disambiguationview-empty'), 'Skipped via live-config.json skip list');
        // species-plant-minimal has no vernacularData/additionalNames_m_s, but it
        // does have a `name`, so a query is still made — mock it to return no hits.
        await setupSpeciesPageMocks(page, {
            searchConfig: { disambiguationByGuid: { [SPECIES_PLANT_MINIMAL.guid]: { searchResults: [] } } },
        });
        await load(page, speciesUrl(SPECIES_PLANT_MINIMAL.guid, 'tab=names'));

        expect(await page.getByText('Disambiguation', { exact: true }).count()).toBe(0);
        expect(await page.locator('text=About disambiguation').count()).toBe(0);
    });
});
