import { test, expect } from '../../fixtures';
import { shouldSkip } from '../../mocks/liveConfig';
import { setupSpeciesPageMocks, load, speciesUrl, SPECIES_BIRD_FULL } from './helpers';

// ---------------------------------------------------------------------------
// namesView.tsx — branches not covered by acceptance.spec.ts's
// "Species page - Names tab" describe block.
//
// 1. A synonym/variant/identifier/common-name row with no `source` renders as
//    plain (non-link) text instead of an <a>
// ---------------------------------------------------------------------------

const NO_SOURCE_GUID = 'https://biodiversity.org.au/afd/taxa/no-source-species';

test.describe('NamesView.tsx', () => {
    test('rows without a source render as plain text, not links', async ({ page }) => {
        test.skip(shouldSkip('namesview-no-source'), 'Skipped via live-config.json skip list');
        const speciesNoSource = {
            ...SPECIES_BIRD_FULL,
            guid: NO_SOURCE_GUID,
            synonymData: [{ nameFormatted: '<i>No Source Synonym</i>', datasetName: 'AFD' }], // no `source`
            variantData: [{ nameFormatted: 'No Source Variant', datasetName: 'AFD' }], // no `source`
            identifierData: [{ guid: 'urn:lsid:no-source-identifier', datasetName: 'AFD' }], // no `source`
            vernacularData: [{ name: 'No Source Common Name', status: 'common' }], // no `source`
        };
        await setupSpeciesPageMocks(page, { extraSpeciesByPath: { [NO_SOURCE_GUID]: speciesNoSource } });
        await load(page, speciesUrl(NO_SOURCE_GUID, 'tab=names'));

        await expect(page.locator('text=No Source Synonym')).toBeVisible();
        expect(await page.locator('a', { hasText: 'No Source Synonym' }).count()).toBe(0);

        await expect(page.locator('text=No Source Variant')).toBeVisible();
        expect(await page.locator('a', { hasText: 'No Source Variant' }).count()).toBe(0);

        await expect(page.locator('text=urn:lsid:no-source-identifier')).toBeVisible();
        expect(await page.locator('a', { hasText: 'urn:lsid:no-source-identifier' }).count()).toBe(0);

        await expect(page.locator('text=No Source Common Name')).toBeVisible();
        expect(await page.locator('a', { hasText: 'No Source Common Name' }).count()).toBe(0);
    });
});
