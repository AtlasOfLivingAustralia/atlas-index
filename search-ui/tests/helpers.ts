import { Page } from '@playwright/test';
import { logMissingMocks } from './mocks/logMissingMocks';
import { staticServerMocks } from './mocks/staticServerMocks';
import { imageMocks } from './mocks/imageMocks';
import { getBaseUrl, isLiveMode } from './mocks/liveConfig';
import {
    mockSession,
    mockSpeciesDetail,
    mockSpeciesSearch,
    mockAutocomplete,
    SpeciesSearchConfig,
    SESSION_ANONYMOUS,
    SPECIES_BIRD_FULL,
    SPECIES_PLANT_MINIMAL,
    SPECIES_PLANT_TRAITS,
    SPECIES_PLANT_NO_TRAITS,
    g_disambiguationResults,
} from './mocks/apiMocks';
import { mockBiocacheSearch, mockWmsTiles, BiocacheSearchConfig } from './mocks/biocacheMocks';
import {
    mockDescriptions,
    mockTraits,
    mockBhl,
    mockTaxonMap,
    TraitsEntry,
    TAXON_MAP_METADATA_FIXTURE,
    DESCRIPTIONS_MULTI_SECTION_FIXTURE,
    BHL_RESULTS_FIXTURE,
    TRAITS_ENTRY_FIXTURE,
} from './mocks/staticContentMocks';

// Resolves to the live-config.json baseUrl when LIVE_CONFIG_PATH is set (see
// tests/mocks/liveConfig.ts), otherwise the standard mock-mode localhost URL.
// Evaluated once at module load, which happens after run-live-test.sh /
// run-playwright-test.sh have already set (or not set) the env var.
export const BASE_URL = getBaseUrl();

export {
    SESSION_ANONYMOUS,
    SPECIES_BIRD_FULL,
    SPECIES_PLANT_MINIMAL,
    SPECIES_PLANT_TRAITS,
    SPECIES_PLANT_NO_TRAITS,
    g_disambiguationResults as DISAMBIGUATION_RESULTS,
    TAXON_MAP_METADATA_FIXTURE,
    DESCRIPTIONS_MULTI_SECTION_FIXTURE,
    BHL_RESULTS_FIXTURE,
    TRAITS_ENTRY_FIXTURE,
};

/** Navigate and wait for networkidle. */
export async function load(page: Page, url: string = BASE_URL) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
}

export interface SearchPageMockOptions {
    session?: object;
    autocomplete?: any;
    search?: SpeciesSearchConfig;
}

/**
 * Full mock setup for the Search page (`/`). Registers, in priority order:
 * logMissingMocks (catch-all) -> imageMocks -> session/search/autocomplete mocks.
 *
 * Skipped entirely in live mode (LIVE_CONFIG_PATH set) — live tests must let
 * all traffic flow through to the real site unmocked.
 */
export async function setupSearchPageMocks(page: Page, options: SearchPageMockOptions = {}): Promise<Set<URL>> {
    const seenUrls = new Set<URL>();
    if (isLiveMode()) return seenUrls;
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await imageMocks(page, seenUrls);
    await mockSession(page, seenUrls, options.session ?? SESSION_ANONYMOUS);
    await mockSpeciesSearch(page, seenUrls, options.search ?? {});
    await mockAutocomplete(page, seenUrls, options.autocomplete);
    return seenUrls;
}

export interface SpeciesPageMockOptions {
    session?: object;
    extraSpeciesByPath?: Record<string, any>;
    searchConfig?: SpeciesSearchConfig;
    biocacheConfig?: BiocacheSearchConfig;
    descriptionsByGuid?: Record<string, any>;
    traitsByGuid?: Record<string, TraitsEntry>;
    bhlByGuid?: Record<string, any>;
    taxonMapByGuid?: Record<string, any>;
    /** Also register WMS-tile mocks (only needed for a test that overrides VITE_GOOGLE_MAP_API_KEY at runtime — not needed by default). */
    includeWmsTiles?: boolean;
}

/**
 * Full mock setup for the Species page (`/species/*`). Registers, in priority
 * order: logMissingMocks (catch-all) -> imageMocks -> session -> species
 * detail/search -> biocache -> static taxon content (descriptions/traits/bhl/map).
 *
 * Sensible per-guid defaults are wired in automatically (bird-full gets rich
 * descriptions/BHL/cached-map data; plant-traits gets AusTraits data) so most
 * tests don't need to pass anything. Pass an explicit `{}` for a given option
 * to force the "no data" / "unavailable" branch for every guid instead.
 *
 * Skipped entirely in live mode (LIVE_CONFIG_PATH set) — live tests must let
 * all traffic flow through to the real site unmocked.
 */
export async function setupSpeciesPageMocks(page: Page, options: SpeciesPageMockOptions = {}): Promise<Set<URL>> {
    const seenUrls = new Set<URL>();
    if (isLiveMode()) return seenUrls;
    await logMissingMocks(page, seenUrls);
    await staticServerMocks(page, seenUrls);
    await imageMocks(page, seenUrls);
    await mockSession(page, seenUrls, options.session ?? SESSION_ANONYMOUS);
    await mockSpeciesDetail(page, seenUrls, options.extraSpeciesByPath ?? {});
    await mockSpeciesSearch(page, seenUrls, options.searchConfig ?? {});
    await mockBiocacheSearch(page, seenUrls, options.biocacheConfig ?? {});
    await mockDescriptions(page, seenUrls, options.descriptionsByGuid ?? { [SPECIES_BIRD_FULL.guid]: DESCRIPTIONS_MULTI_SECTION_FIXTURE });
    await mockTraits(page, seenUrls, options.traitsByGuid ?? { [SPECIES_PLANT_TRAITS.guid]: TRAITS_ENTRY_FIXTURE });
    await mockBhl(page, seenUrls, options.bhlByGuid ?? { [SPECIES_BIRD_FULL.guid]: BHL_RESULTS_FIXTURE });
    await mockTaxonMap(page, seenUrls, options.taxonMapByGuid ?? { [SPECIES_BIRD_FULL.guid]: TAXON_MAP_METADATA_FIXTURE });
    if (options.includeWmsTiles) {
        await mockWmsTiles(page, seenUrls);
    }
    return seenUrls;
}

/** Wait for a `.placeholder-glow` skeleton to disappear (used across many components). */
export async function waitForContent(page: Page, timeout = 5000) {
    await page.locator('.placeholder-glow').first().waitFor({ state: 'hidden', timeout }).catch(() => {
        // skeleton may never appear for fast/mocked responses — that's fine
    });
}

/**
 * Species.tsx always mounts every tab's content (desktop view hides inactive
 * tabs via `display:none` rather than unmounting them), so an unscoped text
 * locator frequently matches the same string in multiple (hidden) tabs at
 * once. Use this to match only the currently-visible occurrence. Pass
 * `exact: true` for a case-sensitive whole-string match (e.g. to distinguish
 * a box heading like "Ecology" from an inner section label "ecology").
 */
export function visibleText(page: Page, text: string, options: { exact?: boolean } = {}) {
    const quoted = options.exact ? `"${text}"` : text;
    return page.locator(`text=${quoted} >> visible=true`);
}
