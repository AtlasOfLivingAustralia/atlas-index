import { test, expect } from '../../fixtures';
import { shouldSkip } from '../../mocks/liveConfig';
import { setupSpeciesPageMocks, load, speciesUrl, waitForContent, SPECIES_BIRD_FULL } from './helpers';

// ---------------------------------------------------------------------------
// resourcesView.tsx — branches not covered by acceptance.spec.ts's
// "Species page - Resources tab" describe block.
//
// 1. isResourceVisible's `inSpeciesList` rule branch (only `inSpeciesGroup` is exercised by acceptance tests)
// 2. formatAuthor: a single-token author name (no comma) is returned unchanged
// ---------------------------------------------------------------------------

const SPECIES_LIST_GUID = 'https://biodiversity.org.au/afd/taxa/species-list-rule-species';

test.describe('ResourcesView.tsx', () => {
    test('"Other resources" honours the inSpeciesList rule', async ({ page }) => {
        test.skip(shouldSkip('resourcesview-inspecieslist-rule'), 'Skipped via live-config.json skip list');
        const speciesWithList = {
            ...SPECIES_BIRD_FULL,
            guid: SPECIES_LIST_GUID,
            speciesGroup: ['NoMatchingGroup'], // deliberately does not match any inSpeciesGroup rule
            speciesList: ['dr650'], // matches at least one real onlineResources.json inSpeciesList rule
        };
        await setupSpeciesPageMocks(page, { extraSpeciesByPath: { [SPECIES_LIST_GUID]: speciesWithList } });
        await load(page, speciesUrl(SPECIES_LIST_GUID, 'tab=resources'));
        await waitForContent(page);

        await expect(page.locator('text=Other resources')).toBeVisible();
        const resourceButtons = page.locator('a.ala-btn-primary');
        expect(await resourceButtons.count()).toBeGreaterThan(0);
    });

    test('a single-token BHL author name (no comma) renders unchanged', async ({ page }) => {
        test.skip(shouldSkip('resourcesview-formatauthor-single-token'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page, {
            bhlByGuid: {
                [SPECIES_BIRD_FULL.guid]: [
                    { BHLType: 'Part', Authors: [{ Name: 'Anonymous' }], Title: 'An old unattributed record', PartUrl: 'https://www.biodiversitylibrary.org/part/1', Date: '1900' },
                ],
            },
        });
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=resources'));
        await waitForContent(page);

        await expect(page.locator('text=Anonymous')).toBeVisible();
    });
});
