import { test, expect } from '../../fixtures';
import { shouldSkip } from '../../mocks/liveConfig';
import { setupSpeciesPageMocks, load, speciesUrl, SPECIES_BIRD_FULL } from './helpers';

// ---------------------------------------------------------------------------
// statusView.tsx — branches not covered by acceptance.spec.ts's
// "Species page - Status tab" describe block.
//
// 1. Only nativeIntroduced present (no conservation status) — the <hr>
//    separator between sections must NOT render
// 2. Only conservation status present (no nativeIntroduced)
// 3. "Find out more" links (openUrl -> window.open) for both sections
// ---------------------------------------------------------------------------

const NATIVE_ONLY_GUID = 'https://biodiversity.org.au/afd/taxa/native-only-species';
const CONSERVATION_ONLY_GUID = 'https://biodiversity.org.au/afd/taxa/conservation-only-species';

test.describe('StatusView.tsx', () => {
    test('shows only the native/introduced table when there is no conservation status', async ({ page }) => {
        test.skip(shouldSkip('statusview-native-only'), 'Skipped via live-config.json skip list');
        const nativeOnlySpecies = {
            ...SPECIES_BIRD_FULL,
            guid: NATIVE_ONLY_GUID,
            nativeIntroduced: '{"Queensland":"native"}',
            listNames: undefined,
            iucn_dr123_s: undefined,
            conservation_dr456: undefined,
        };
        await setupSpeciesPageMocks(page, { extraSpeciesByPath: { [NATIVE_ONLY_GUID]: nativeOnlySpecies } });
        await load(page, speciesUrl(NATIVE_ONLY_GUID, 'tab=status'));

        await expect(page.getByText('Native / introduced', { exact: true })).toBeVisible();
        expect(await page.getByText('Conservation status', { exact: true }).count()).toBe(0);
    });

    test('shows only the conservation status table when there is no native/introduced data', async ({ page }) => {
        test.skip(shouldSkip('statusview-conservation-only'), 'Skipped via live-config.json skip list');
        const conservationOnlySpecies = {
            ...SPECIES_BIRD_FULL,
            guid: CONSERVATION_ONLY_GUID,
            nativeIntroduced: undefined,
        };
        await setupSpeciesPageMocks(page, { extraSpeciesByPath: { [CONSERVATION_ONLY_GUID]: conservationOnlySpecies } });
        await load(page, speciesUrl(CONSERVATION_ONLY_GUID, 'tab=status'));

        expect(await page.getByText('Native / introduced', { exact: true }).count()).toBe(0);
        await expect(page.getByText('Conservation status', { exact: true })).toBeVisible();
    });

    test('"Find out more" links open the correct info URLs', async ({ page }) => {
        test.skip(shouldSkip('statusview-find-out-more'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        // These are real external ALA sites (not part of search-ui's own domain
        // model) — mock them minimally so the popups can open without a real
        // network request, while still letting us assert on the exact URL.
        await page.context().route('https://lists.ala.org.au/list/dr22952**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
        await page.context().route('https://support.ala.org.au/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));

        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=status'));

        const findOutMoreLinks = page.locator('a', { hasText: 'Find out more' });
        await expect(findOutMoreLinks).toHaveCount(2);

        const [nativeIntroducedPopup] = await Promise.all([
            page.waitForEvent('popup'),
            findOutMoreLinks.first().click(),
        ]);
        await expect(nativeIntroducedPopup).toHaveURL(/lists\.ala\.org\.au\/list\/dr22952/);

        const [sdsPopup] = await Promise.all([
            page.waitForEvent('popup'),
            findOutMoreLinks.last().click(),
        ]);
        await expect(sdsPopup).toHaveURL(/support\.ala\.org\.au/);
    });
});
