import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { setupMocks, load } from './helpers';

// ===========================================================================
// Synthetic coverage: src/components/search/AdvancedSearch.tsx (426 lines).
// acceptance.spec.ts's 2 existing tests only ever populate the facet-backed
// dropdowns (on focus) and submit a date-range-only search with a BLANK text
// field -- every other one of the ~18 individual fields (taxa 2/3/4, raw taxon,
// species group, institution/collection, country, state, ibra, imcra, lga,
// type status, basis of record, collector, dataset-name typeahead, catalogue
// number, record number), the Enter-key submit shortcut, and the "Clear all"
// button had never been exercised.
// ===========================================================================

async function openAdvancedTab(page: Page) {
    await page.getByRole('tab', { name: 'Advanced search' }).click();
    const tabpanel = page.getByRole('tabpanel', { name: 'Advanced search' });
    await expect(tabpanel).toBeVisible();
    return tabpanel;
}

test.describe('AdvancedSearch — every field submits its own fq clause', () => {
    test('filling every field and submitting builds one fq per field, ORing the 4 taxa boxes together', async ({ page }) => {
        await setupMocks(page, { biocache: { totalRecords: 42 } });
        await load(page);
        const tabpanel = await openAdvancedTab(page);

        // The "ALL of these words (full text)" input has no id (its <label
        // htmlFor="text"> doesn't actually match anything) -- it's the very first
        // text input in the panel, ahead of the 4 taxa boxes and everything else.
        await tabpanel.locator('input[type="text"]').first().fill('riparian');

        await tabpanel.locator('#taxa_1').fill('Acacia dealbata');
        await tabpanel.locator('#taxa_2').fill('Acacia melanoxylon');
        await tabpanel.locator('#taxa_3').fill('Acacia pycnantha');
        await tabpanel.locator('#taxa_4').fill('Eucalyptus globulus');

        await tabpanel.locator('#raw_taxon_name').fill('Acacia sp.');

        // Each <select> only populates its options once focused (fetchFacet()) --
        // focus, wait for the fetched option, then select it.
        async function selectFacetOption(selector: string, optionText: string, value: string) {
            const select = tabpanel.locator(selector);
            await select.focus();
            await expect(select.getByText(optionText)).toBeAttached({ timeout: 5000 });
            await select.selectOption(value);
        }

        await selectFacetOption('#species_group', 'Birds', 'speciesGroup:Birds');
        await selectFacetOption('#country', 'Australia', 'country:Australia');
        await selectFacetOption('#state', 'New South Wales', 'state:"New South Wales"');
        await selectFacetOption('#ibra', 'Australian Alps', 'cl1048:"Australian Alps"');
        await selectFacetOption('#imcra', 'South-east Shelf Transition', 'cl21:"South-east Shelf Transition"');
        await selectFacetOption('#lga', 'Canberra', 'cl959:Canberra');
        await selectFacetOption('#type_status', 'Holotype', 'typeStatus:HOLOTYPE');
        await selectFacetOption('#basis_of_record', 'Preserved specimen', 'basisOfRecord:PreservedSpecimen');

        // Institution/Collection select shares fetchFacet('institutionUid') + ('collectionUid').
        const institutionSelect = tabpanel.locator('#institution_collection');
        await institutionSelect.focus();
        await expect(institutionSelect.getByText('CSIRO')).toBeAttached({ timeout: 5000 });
        await institutionSelect.selectOption('institutionUid:in1');

        // Dataset name typeahead -- distinct component, not a native <select>.
        const dataResourceInput = tabpanel.locator('input.rbt-input-main');
        await dataResourceInput.click();
        await dataResourceInput.fill('eBird');
        await expect(tabpanel.getByRole('option', { name: 'eBird Australia' })).toBeVisible();
        await tabpanel.getByRole('option', { name: 'eBird Australia' }).click();

        await tabpanel.locator('#collector_text').fill('Jane Botanist');
        await tabpanel.locator('#catalogue_number').fill('CAT-12345');
        await tabpanel.locator('#record_number').fill('REC-6789');

        await tabpanel.getByRole('button', { name: 'Search', exact: true }).click();

        await expect(page).toHaveURL(/\/occurrences\/search\?/);
        // encodeURIComponent(' ') -> '%20', but the app's later DQ-profile-injection
        // navigate() rewrites the URL via URLSearchParams.toString(), which serialises
        // spaces as '+' (application/x-www-form-urlencoded). Normalise both forms to a
        // literal space before decoding so the assertions below are encoding-agnostic.
        const url = decodeURIComponent(page.url().replace(/\+/g, '%20'));

        // The first fq becomes `q` (substring(1) trick) -- text:riparian is the
        // first fqPart pushed by advancedSearch(), so it appears as `q=`, not `fq=`.
        // "riparian" has no space/colon/paren/bracket, so quoteText() leaves it bare
        // (unlike the multi-word fields below, which all get wrapped in quotes).
        expect(url).toContain('q=text:riparian');

        // The 4 taxa fields are OR'd into a single fq clause.
        expect(url).toContain('taxa:"Acacia dealbata" OR taxa:"Acacia melanoxylon" OR taxa:"Acacia pycnantha" OR taxa:"Eucalyptus globulus"');

        expect(url).toContain('fq=raw_scientificName:"Acacia sp."');
        expect(url).toContain('fq=speciesGroup:Birds');
        expect(url).toContain('fq=institutionUid:in1');
        expect(url).toContain('fq=country:Australia');
        expect(url).toContain('fq=state:"New South Wales"');
        expect(url).toContain('fq=cl1048:"Australian Alps"');
        expect(url).toContain('fq=cl21:"South-east Shelf Transition"');
        expect(url).toContain('fq=cl959:Canberra');
        expect(url).toContain('fq=typeStatus:HOLOTYPE');
        expect(url).toContain('fq=basisOfRecord:PreservedSpecimen');
        expect(url).toContain('fq=dataResourceUid:dr123');
        expect(url).toContain('fq=collector_text:"Jane Botanist"');
        // Hyphens don't trigger quoteText()'s quoting condition (only space/:/(/[) --
        // these two stay bare, unlike the multi-word fields above.
        expect(url).toContain('fq=catalogNumber:CAT-12345');
        expect(url).toContain('fq=recordNumber:REC-6789');
    });

    test('pressing Enter in a text field submits the form the same as clicking Search', async ({ page }) => {
        await setupMocks(page);
        await load(page);
        const tabpanel = await openAdvancedTab(page);

        await tabpanel.locator('#collector_text').fill('Sam Naturalist');
        await tabpanel.locator('#collector_text').press('Enter');

        await expect(page).toHaveURL(/\/occurrences\/search\?q=collector_text/);
    });

    test('"Clear all" resets every field back to blank', async ({ page }) => {
        await setupMocks(page);
        await load(page);
        const tabpanel = await openAdvancedTab(page);

        const textInput = tabpanel.locator('input[type="text"]').first();
        await textInput.fill('some text');
        await tabpanel.locator('#taxa_1').fill('Acacia');
        await tabpanel.locator('#collector_text').fill('Someone');
        await tabpanel.locator('#catalogue_number').fill('X123');

        const urlBefore = page.url();
        await tabpanel.getByRole('button', { name: 'Clear all' }).click();

        await expect(textInput).toHaveValue('');
        await expect(tabpanel.locator('#taxa_1')).toHaveValue('');
        await expect(tabpanel.locator('#collector_text')).toHaveValue('');
        await expect(tabpanel.locator('#catalogue_number')).toHaveValue('');
        // Clearing must not itself trigger a navigation.
        expect(page.url()).toBe(urlBefore);
    });
});
