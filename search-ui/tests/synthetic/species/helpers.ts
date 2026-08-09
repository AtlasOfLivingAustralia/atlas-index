import { Page } from '@playwright/test';
import { setupSpeciesPageMocks, SpeciesPageMockOptions, SPECIES_BIRD_FULL, SPECIES_PLANT_MINIMAL, SPECIES_PLANT_TRAITS, SPECIES_PLANT_NO_TRAITS, BASE_URL, load, waitForContent, visibleText, TAXON_MAP_METADATA_FIXTURE, DESCRIPTIONS_MULTI_SECTION_FIXTURE, BHL_RESULTS_FIXTURE, TRAITS_ENTRY_FIXTURE, DISAMBIGUATION_RESULTS } from '../../helpers';

export {
    SPECIES_BIRD_FULL,
    SPECIES_PLANT_MINIMAL,
    SPECIES_PLANT_TRAITS,
    SPECIES_PLANT_NO_TRAITS,
    BASE_URL,
    load,
    waitForContent,
    visibleText,
    setupSpeciesPageMocks,
    TAXON_MAP_METADATA_FIXTURE,
    DESCRIPTIONS_MULTI_SECTION_FIXTURE,
    BHL_RESULTS_FIXTURE,
    TRAITS_ENTRY_FIXTURE,
    DISAMBIGUATION_RESULTS,
};
export type { SpeciesPageMockOptions };

export function speciesUrl(guid: string, hash?: string): string {
    return `${BASE_URL}/species/${guid}${hash ? '#' + hash : ''}`;
}

/** Convenience: load a species page directly on a given tab with the given mock options. */
export async function loadSpeciesTab(page: Page, guid: string, tab: string, options: SpeciesPageMockOptions = {}) {
    await setupSpeciesPageMocks(page, options);
    await load(page, speciesUrl(guid, `tab=${tab}`));
}
