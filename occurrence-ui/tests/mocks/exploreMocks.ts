import { Page } from '@playwright/test';
import { mockWmsTiles } from './imageMocks';

export interface SpeciesGroupCount {
    name: string;
    count: number;
    speciesCount: number;
    level?: number;
}

/** Default species-group counts covering a few groups from speciesGroupsMap.json. */
export const g_speciesGroups: SpeciesGroupCount[] = [
    { name: 'ALL_SPECIES', count: 90000, speciesCount: 850 },
    { name: 'Birds', count: 40000, speciesCount: 320 },
    { name: 'Mammals', count: 12000, speciesCount: 95 },
    { name: 'Reptiles', count: 8000, speciesCount: 140 },
    { name: 'Insects', count: 15000, speciesCount: 210 },
];

/** Mock GET VITE_APP_BIOCACHE_URL/explore/groups (species-group breakdown table). */
export async function mockExploreGroups(page: Page, seenUrls: Set<URL>, groups: SpeciesGroupCount[] = g_speciesGroups) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/explore/groups**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/explore/groups'));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(groups) });
    });
}

export interface SpeciesListEntry {
    guid: string | null;
    commonName: string | null;
    name: string;
    count: number;
}

/** Default per-group species lists, keyed by the exact group name used in the URL path. */
export const g_speciesByGroup: Record<string, SpeciesListEntry[]> = {
    ALL_SPECIES: [
        { guid: 'urn:lsid:biodiversity.org.au:afd.taxon:bird-001', commonName: 'Australian Magpie', name: 'Gymnorhina tibicen', count: 4200 },
        { guid: 'urn:lsid:biodiversity.org.au:afd.taxon:mammal-001', commonName: 'Red Kangaroo', name: 'Osphranter rufus', count: 3100 },
    ],
    Birds: [
        { guid: 'urn:lsid:biodiversity.org.au:afd.taxon:bird-001', commonName: 'Australian Magpie', name: 'Gymnorhina tibicen', count: 4200 },
        { guid: 'urn:lsid:biodiversity.org.au:afd.taxon:bird-002', commonName: 'Superb Fairywren', name: 'Malurus cyaneus', count: 2800 },
        { guid: 'urn:lsid:biodiversity.org.au:afd.taxon:bird-003', commonName: 'Laughing Kookaburra', name: 'Dacelo novaeguineae', count: 1900 },
    ],
    Mammals: [
        { guid: 'urn:lsid:biodiversity.org.au:afd.taxon:mammal-001', commonName: 'Red Kangaroo', name: 'Osphranter rufus', count: 3100 },
    ],
};

/**
 * Mock GET VITE_APP_BIOCACHE_URL/explore/group/:group (per-group species list). Dispatches
 * on the URL PATH segment (the group name, or the literal "ALL_SPECIES"), not a query param.
 */
export async function mockExploreGroup(page: Page, seenUrls: Set<URL>, speciesByGroup: Record<string, SpeciesListEntry[]> = g_speciesByGroup) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/explore/group/**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/explore/group/'));
    await page.context().route(pattern, async (route) => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const groupParam = decodeURIComponent(url.pathname.split('/explore/group/')[1] || '');
        const list = speciesByGroup[groupParam] ?? [];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
    });
}

/** Composite: everything ExploreYourArea.tsx needs (excluding OSM tiles -- already in setupMocks). */
/**
 * Composite: everything ExploreYourArea.tsx needs (excluding OSM tiles -- already in
 * setupMocks). ExploreYourArea's WMS occurrence-heatmap layer mounts immediately
 * (no lazy-loading, unlike OccurrenceList's Map tab), so mockWmsTiles is required here.
 */
export async function setupExploreMocks(page: Page, seenUrls: Set<URL>, options: {
    groups?: SpeciesGroupCount[];
    speciesByGroup?: Record<string, SpeciesListEntry[]>;
} = {}) {
    await mockExploreGroups(page, seenUrls, options.groups ?? g_speciesGroups);
    await mockExploreGroup(page, seenUrls, options.speciesByGroup ?? g_speciesByGroup);
    await mockWmsTiles(page, seenUrls);
}
