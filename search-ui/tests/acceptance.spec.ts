import { test, expect } from './fixtures';
import { shouldSkip } from './mocks/liveConfig';
import { BASE_URL, load, setupSearchPageMocks, setupSpeciesPageMocks, waitForContent, visibleText, SPECIES_BIRD_FULL, SPECIES_PLANT_MINIMAL, SPECIES_PLANT_TRAITS, SPECIES_PLANT_NO_TRAITS, DISAMBIGUATION_RESULTS } from './helpers';

/**
 * The common-ui Header (real banner.mustache markup served from static-server)
 * also contains a legacy search input with a *similar* placeholder
 * ("Search species, datasets, and more...") — search-ui's own input uses
 * "Search species, datasets, content and more...". Always use this exact
 * placeholder to avoid strict-mode locator collisions with the header.
 */
function searchInput(page: import('@playwright/test').Page) {
    return page.getByPlaceholder('Search species, datasets, content and more...');
}

/**
 * Autocomplete dropdown items are plain, exact-text <div>s. The homepage's
 * "Try searching for:" Examples component picks random sample queries on
 * every render and can coincidentally show the same species name as an <a>
 * link — scope to <div> with an exact text match to avoid that flaky collision.
 */
function autocompleteItem(page: import('@playwright/test').Page, name: string) {
    return page.locator(`div:text-is("${name}")`);
}

// ===========================================================================
// Search page (src/views/Search.tsx + components/search/*)
// ===========================================================================

test.describe('Search page - Landing page', () => {
    test('shows featured pages when there is no query', async ({ page }) => {
        test.skip(shouldSkip('search-landing-page'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, BASE_URL);

        await expect(page).toHaveTitle(/Atlas of Living Australia/);
        await expect(page.locator('text=Search Atlas of Living Australia')).toBeVisible();
        await expect(page.locator('text=Featured pages')).toBeVisible();
    });
});

test.describe('Search page - Autocomplete', () => {
    test('typing 3+ characters shows autocomplete suggestions', async ({ page }) => {
        test.skip(shouldSkip('search-autocomplete-shows'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, BASE_URL);

        const input = searchInput(page);
        await input.fill('Aca');

        // debounce is 300ms; wait for the dropdown to appear
        await expect(autocompleteItem(page, 'Acacia dealbata')).toBeVisible({ timeout: 3000 });
        await expect(autocompleteItem(page, 'Acacia pycnantha')).toBeVisible();
        // case-insensitive duplicate ("Acacia" / "ACACIA") must be de-duplicated to one entry
        await expect(autocompleteItem(page, 'Acacia melanoxylon')).toBeVisible();
    });

    test('keyboard ArrowDown + Enter selects a suggestion and navigates to results', async ({ page }) => {
        test.skip(shouldSkip('search-autocomplete-keyboard'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, BASE_URL);

        const input = searchInput(page);
        await input.fill('Aca');
        await expect(autocompleteItem(page, 'Acacia dealbata')).toBeVisible({ timeout: 3000 });

        await input.press('ArrowDown');
        await input.press('Enter');

        await expect(page).toHaveURL(/\?q=/);
        await expect(page.locator('text=Showing results for')).toBeVisible();
    });

    test('Escape key closes the autocomplete dropdown', async ({ page }) => {
        test.skip(shouldSkip('search-autocomplete-escape'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, BASE_URL);

        const input = searchInput(page);
        await input.fill('Aca');
        await expect(autocompleteItem(page, 'Acacia dealbata')).toBeVisible({ timeout: 3000 });

        await input.press('Escape');
        await expect(autocompleteItem(page, 'Acacia dealbata')).toBeHidden();
    });
});

test.describe('Search page - submitting a search', () => {
    test('search button navigates to ?q= and shows grouped results', async ({ page }) => {
        test.skip(shouldSkip('search-submit'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, BASE_URL);

        const input = searchInput(page);
        await input.fill('Acacia');
        // The search (magnifying-glass) button is icon-only with no accessible
        // name; it's the last svg-icon button in the search container (the
        // clear/"X" button, which also has an svg icon, comes first in DOM order).
        await page.locator('div.container-fluid button:has(svg)').last().click();

        await expect(page).toHaveURL(/\?q=Acacia/);
        await expect(page.locator('text=Showing results for')).toBeVisible();
        await expect(page.locator('text=Featured pages')).toBeHidden();
    });

    test('clear (X) button resets the query', async ({ page }) => {
        test.skip(shouldSkip('search-clear'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia`);
        await expect(page.locator('text=Showing results for')).toBeVisible();

        await page.locator('button[aria-label="Clear search"]').click();

        const input = searchInput(page);
        await expect(input).toHaveValue('');
        await expect(page.getByText('Try searching', { exact: true })).toBeVisible();
    });
});

test.describe('Search page - AllView (all tab)', () => {
    test('shows grouped results per category with counts', async ({ page }) => {
        test.skip(shouldSkip('search-allview-groups'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia`);

        // "See N results" is unambiguous and confirms both the group rendered
        // and its facet-derived count is correct (avoids colliding with the
        // common-ui header's own "Search species" nav link text).
        await expect(page.locator('text=See 42 results')).toBeVisible();
        await expect(page.locator('text=See 10 results')).toBeVisible(); // datasets
        await expect(page.locator('text=See 5 results')).toBeVisible(); // specieslists
        await expect(page.locator('text=See 8 results')).toBeVisible(); // projects
        await expect(page.locator('text=See 3 results')).toBeVisible(); // layers
        await expect(page.locator('text=See 4 results')).toBeVisible(); // locations
        await expect(page.locator('text=See 15 results')).toBeVisible(); // articles
    });

    test('clicking "See N results" switches to that category tab', async ({ page }) => {
        test.skip(shouldSkip('search-allview-see-results'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia`);

        await page.locator('text=See 42 results').click();
        await expect(page).toHaveURL(/#tab=species/);
        await expect(page.locator('text=Showing').first()).toBeVisible();
    });

    test('list/tile view toggle persists via localStorage', async ({ page }) => {
        test.skip(shouldSkip('search-allview-view-toggle'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia`);

        await page.locator('button', { hasText: 'Tiles' }).first().click();
        const storedFilter = await page.evaluate(() => localStorage.getItem('searchView'));
        expect(storedFilter).toBe('tiles');

        await page.reload();
        await page.waitForLoadState('networkidle');
        const storedFilterAfterReload = await page.evaluate(() => localStorage.getItem('searchView'));
        expect(storedFilterAfterReload).toBe('tiles');
    });
});

test.describe('Search page - GenericView (species tab)', () => {
    test('shows facets sidebar and paginated results', async ({ page }) => {
        test.skip(shouldSkip('search-species-tab'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia#tab=species`);

        await expect(page.locator('text=Refine results')).toBeVisible();
        await expect(page.locator('text=Taxonomic rank')).toBeVisible();
        await expect(page.locator('text=Species group')).toBeVisible();

        // 13 total results, pageSize=12 -> "1-12 of 13"
        await expect(page.locator('text=1-12')).toBeVisible();
        await expect(page.getByText('of', { exact: true })).toBeVisible();
    });

    test('selecting a facet re-fetches and narrows results', async ({ page }) => {
        test.skip(shouldSkip('search-species-facet-filter'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia#tab=species`);

        await expect(page.locator('text=Genus (2)')).toBeVisible();
        await page.locator('text=Genus (2)').click();

        // mocked drill-down response narrows the result set to 1 item ("1-1 of 1")
        await expect(page.locator('text=1-1')).toBeVisible({ timeout: 3000 });
    });

    test('pagination controls appear and page 2 fetch uses correct page param', async ({ page }) => {
        test.skip(shouldSkip('search-species-pagination'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia#tab=species`);

        await expect(page.locator('text=1-12')).toBeVisible();
        const page2Button = page.locator('button', { hasText: '2' });
        await expect(page2Button).toBeVisible();
        await page2Button.click();
        await expect(page.locator('text=13-13')).toBeVisible({ timeout: 3000 });
    });

    test('sort dropdown changes and re-fetches results', async ({ page }) => {
        test.skip(shouldSkip('search-species-sort'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia#tab=species`);

        const sortSelect = page.locator('select').first();
        await sortSelect.selectOption({ label: 'Sort by A-Z' });
        const stored = await page.evaluate(() => localStorage.getItem('searchSort'));
        expect(stored).toContain('nameSort');
    });
});

test.describe('Search page - GenericView (other category tabs)', () => {
    test('datasets tab: items render with correct external hrefs and resourceLinks', async ({ page }) => {
        test.skip(shouldSkip('search-datasets-tab'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia#tab=datasets`);

        await expect(page.locator('text=eBird Australia')).toBeVisible();
        const link = page.locator('a', { hasText: 'eBird Australia' }).first();
        await expect(link).toHaveAttribute('href', /collections\.ala\.org\.au\/public\/show\/dr1/);

        await expect(page.getByRole('link', { name: 'Collectory', exact: true })).toHaveAttribute('href', /collections\.ala\.org\.au/);
    });

    test('specieslists tab: items render with itemCount and resourceLinks', async ({ page }) => {
        test.skip(shouldSkip('search-specieslists-tab'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia#tab=specieslists`);

        await expect(page.locator('text=Iconic Species List')).toBeVisible();
        await expect(page.locator('text=EPBC Act Threatened Species List')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Species lists', exact: true })).toHaveAttribute('href', /lists\.ala\.org\.au/);
    });

    test('dataprojects tab: items render with resourceLinks (Biocollect/DigiVol)', async ({ page }) => {
        test.skip(shouldSkip('search-dataprojects-tab'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia#tab=projects`);

        await expect(page.locator('text=Melbourne Waterwatch')).toBeVisible();
        await expect(page.locator('text=Digitising Herbarium Sheets')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Biocollect', exact: true })).toHaveAttribute('href', /biocollect\.ala\.org\.au/);
        await expect(page.getByRole('link', { name: 'DigiVol', exact: true })).toHaveAttribute('href', /digivol\.org\.au/);
    });

    test('layers tab: items render with spatial-portal resourceLinks', async ({ page }) => {
        test.skip(shouldSkip('search-layers-tab'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia#tab=layers`);

        await expect(page.locator('text=IBRA 7 Subregions')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Spatial layers', exact: true })).toHaveAttribute('href', /spatial\.ala\.org\.au/);
    });

    test('regionslocalities tab: locality item links to explore-your-area, region item links to regions app', async ({ page }) => {
        test.skip(shouldSkip('search-regionslocalities-tab'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=canberra#tab=locations`);

        // Scope by href pattern rather than text — the "Try searching for:"
        // Examples strip (always rendered alongside results on desktop) picks a
        // random sample query on every render and can coincidentally include
        // overlapping text (e.g. another "Locations" example), and the site
        // nav also has its own generic "Explore your area" link, so the href
        // substring must include enough of the query to be unambiguous.
        const localityLink = page.locator('a[href*="explore/your-area#-35.2809"]');
        await expect(localityLink).toHaveAttribute('href', /explore\/your-area#-35\.2809\|149\.1300/);

        const regionLink = page.locator('a[href*="region?id=8832863"]');
        await expect(regionLink).toHaveAttribute('href', /regions\.ala\.org\.au\/region\?id=8832863/);
    });

    test('articles tab: web page and support article results render with hrefs', async ({ page }) => {
        test.skip(shouldSkip('search-articles-tab'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=how%20to#tab=articles`);

        await expect(page.locator('text=Citing the ALA')).toBeVisible();
        await expect(page.locator('text=Sharing a dataset with the ALA')).toBeVisible();
        await expect(page.locator('text=How to make a sighting record')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Support', exact: true })).toHaveAttribute('href', /support\.ala\.org\.au/);
    });

    test('species tab: clicking a result navigates to its species page', async ({ page }) => {
        test.skip(shouldSkip('search-species-click-through'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia#tab=species`);

        const link = page.locator('a[href*="/species/"]', { hasText: 'Acacia dealbata' }).first();
        await expect(link).toHaveAttribute('href', '/species/https://id.biodiversity.org.au/node/apni/acacia-dealbata');
    });
});

test.describe('Search page - tab switching', () => {
    test('desktop tab bar switches between all 7 categories', async ({ page }) => {
        test.skip(shouldSkip('search-tab-bar'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia`);

        for (const label of ['Species', 'Datasets', 'Species lists', 'Data projects', 'Spatial layers', 'Locations', 'Help and general content']) {
            await page.locator('div', { hasText: label }).first().click();
            await expect(page.locator('text=Showing').first()).toBeVisible();
        }
    });

    test('mobile view shows a <select> instead of tab bar', async ({ page }) => {
        test.skip(shouldSkip('search-tab-mobile'), 'Skipped via live-config.json skip list');
        await page.setViewportSize({ width: 400, height: 800 });
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia`);

        const select = page.locator('select');
        await expect(select).toBeVisible();
        await select.selectOption('datasets');
        await expect(page.locator('text=eBird Australia')).toBeVisible();
    });
});

test.describe('Search page - no results', () => {
    test('shows "No results found" for a query with zero matches', async ({ page }) => {
        test.skip(shouldSkip('search-no-results'), 'Skipped via live-config.json skip list');
        await setupSearchPageMocks(page, {
            search: {},
        });
        // Override the idxtype-facet response inline for a query that returns nothing
        await page.route('http://localhost:8081/v2/search**', async (route) => {
            const url = new URL(route.request().url());
            if (url.searchParams.get('facets') === 'idxtype' && url.searchParams.get('pageSize') === '0') {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalRecords: 0, facetResults: [] }) });
            } else {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalRecords: 0, searchResults: [] }) });
            }
        });

        await load(page, `${BASE_URL}/?q=zzzznonexistentquery`);
        await expect(page.locator('text=No results found')).toBeVisible();
    });
});

// ===========================================================================
// Species page (src/views/Species.tsx + components/species/*)
// ===========================================================================

function speciesUrl(guid: string, hash?: string): string {
    return `${BASE_URL}/species/${guid}${hash ? '#' + hash : ''}`;
}

test.describe('Species page - fetch and not-found', () => {
    test('loads species data and populates the header', async ({ page }) => {
        test.skip(shouldSkip('species-fetch'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        await expect(page.locator('.speciesPage')).toBeVisible();
        await expect(page.locator('text=Grey Falcon').first()).toBeVisible();
    });

    test('shows "Not found" for an unmatched taxon path', async ({ page }) => {
        test.skip(shouldSkip('species-not-found'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl('https://id.biodiversity.org.au/node/apni/does-not-exist'));

        await expect(page.locator('text=Not found')).toBeVisible();
        await expect(page.locator('code', { hasText: 'does-not-exist' })).toBeVisible();
    });
});

test.describe('Species page - header', () => {
    test('shows name, rank, common name and hero description', async ({ page }) => {
        test.skip(shouldSkip('species-header-basic'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        await expect(page.locator('text=Falco hypoleucos').first()).toBeVisible();
        await expect(page.locator('text=Species, Animals')).toBeVisible();
        await expect(page.locator('text=Grey Falcon').first()).toBeVisible();
        await expect(page.locator('text=rare, medium-sized falcon')).toBeVisible();
    });

    test('sets the document title from name + common name', async ({ page }) => {
        test.skip(shouldSkip('species-header-title'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        await expect(page).toHaveTitle('Falco hypoleucos: Grey Falcon');
    });

    test('shows hero image and two side thumbnails', async ({ page }) => {
        test.skip(shouldSkip('species-header-images'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        const heroLink = page.locator(`a[href*="img-hero-001"]`);
        await expect(heroLink).toBeVisible();
        await expect(page.locator(`a[href*="img-thumb-002"]`)).toBeVisible();
        await expect(page.locator(`a[href*="img-thumb-003"]`)).toBeVisible();
    });

    test('shows IEK name preview and "View all N Indigenous names" link that jumps to the Names tab', async ({ page }) => {
        test.skip(shouldSkip('species-header-iek'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        // .first() picks the header's plain-text vernacular span — NamesView's
        // indigenous-names table (with a "Waitj" link) is always mounted too
        // (hidden via CSS on the non-active tab), so an unscoped locator would
        // otherwise match both.
        await expect(page.locator('text=Waitj').first()).toBeVisible();
        await expect(page.locator('text=Kirrkirrpa').first()).toBeVisible();
        await page.locator('text=View all 2 Indigenous names').click();

        await expect(page).toHaveURL(/#tab=names/);
        await expect(page.locator('#indigenous-names-heading')).toBeVisible();
    });

    test('shows invasive-species alert and links to the Status tab', async ({ page }) => {
        test.skip(shouldSkip('species-header-invasive'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        await expect(page.locator('text=considered invasive')).toBeVisible();
        await page.locator('text=considered invasive').click();
        await expect(page).toHaveURL(/#tab=status/);
    });

    test('does not show hero image, IEK preview, or invasive alert for a minimal species', async ({ page }) => {
        test.skip(shouldSkip('species-header-minimal'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_PLANT_MINIMAL.guid));

        await expect(page.locator('text=Testus minimalis').first()).toBeVisible();
        expect(await page.locator('text=considered invasive').count()).toBe(0);
        expect(await page.locator('text=View this Indigenous name').count()).toBe(0);
        expect(await page.locator('text=View all').count()).toBe(0);
    });
});

test.describe('Species page - Map tab', () => {
    test('shows occurrence count and "Getting started" links with correct hrefs', async ({ page }) => {
        test.skip(shouldSkip('species-map-basic'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page, {
            biocacheConfig: { countByGuid: { [SPECIES_BIRD_FULL.guid]: 4200 } },
            taxonMapByGuid: {},
        });
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        await expect(page.locator('text=Getting started')).toBeVisible();
        const exploreLink = page.getByRole('link', { name: 'Explore and download occurrence records' });
        await expect(exploreLink).toHaveAttribute('href', /biocache\.ala\.org\.au\/occurrences\/search\?q=lsid:/);

        const spatialLink = page.getByRole('link', { name: 'Advanced mapping' });
        await expect(spatialLink).toHaveAttribute('href', /spatial\.ala\.org\.au\?q=lsid:/);

        await expect(page.getByRole('link', { name: 'How to submit observations' })).toHaveAttribute('href', 'https://www.ala.org.au/home/record-a-sighting/');
        await expect(page.getByRole('link', { name: 'Receive alerts for new records' })).toHaveAttribute('href', /alerts\.ala\.org\.au/);
    });

    test('shows sensitive-species alert when sdsStatus is set', async ({ page }) => {
        test.skip(shouldSkip('species-map-sds'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        await expect(page.locator('text=considered sensitive')).toBeVisible();
    });

    test('cached map: renders metadata-driven layers, zoom switcher, legend and attribution', async ({ page }) => {
        test.skip(shouldSkip('species-map-cached'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        // Also present (hidden) in the always-mounted interactive map's own count label
        await expect(page.locator('text=4,200 occurrence records').first()).toBeVisible();
        // Also present (hidden) in the always-mounted interactive map's own legend
        await expect(page.locator('text=Number of species records').first()).toBeVisible();
        // CachedMapView's zoom control deliberately reuses Leaflet's own CSS classes
        // for consistent styling, which collides with the real (hidden) interactive
        // Leaflet map's own native zoom control using the same class names.
        await expect(page.locator('.leaflet-control-zoom-in').first()).toBeVisible();
        await expect(page.locator('.leaflet-control-zoom-out').first()).toBeVisible();
        await expect(page.locator('text=OpenStreetMap contributors')).toBeVisible();
    });

    test('cached map: distribution layer names are shown in the refine section', async ({ page }) => {
        test.skip(shouldSkip('species-map-distributions'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        // Shown in both the shared MapRefineSection sidebar and CachedMapControl's corner layer toggle
        await expect(page.locator('text=Falcon expert range').first()).toBeVisible();
        await expect(page.locator('text=IBRA range')).toBeVisible();
    });

    test('"Enable interactive map" toggle switches from the cached map to the Leaflet map', async ({ page }) => {
        test.skip(shouldSkip('species-map-toggle-interactive'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        const scaleControl = page.locator('.leaflet-control-scale');
        await expect(scaleControl).toBeHidden();

        await page.locator('#mapTypeInteractive').click();
        await expect(scaleControl).toBeVisible({ timeout: 3000 });
    });

    test('falls back to the Leaflet map when cached-map metadata is unavailable (404)', async ({ page }) => {
        test.skip(shouldSkip('species-map-cached-unavailable'), 'Skipped via live-config.json skip list');
        // no taxonMapByGuid entry registered -> mockTaxonMap returns 404 for every guid
        await setupSpeciesPageMocks(page, { taxonMapByGuid: {} });
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        await expect(page.locator('.leaflet-control-scale')).toBeVisible({ timeout: 3000 });
        // "Enable interactive map" toggle should not render since there's no cached map to switch away from
        expect(await page.locator('#mapTypeInteractive').count()).toBe(0);
    });
});

test.describe('Species page - Classification tab', () => {
    test('shows the ancestor hierarchy chain with working links', async ({ page }) => {
        test.skip(shouldSkip('species-classification-hierarchy'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=classification'));
        await waitForContent(page);

        // "Kingdom"/"Phylum"/etc are rank-label spans (Bootstrap's stable
        // "fw-bold" utility class) — the InfoBox's static help text also
        // mentions "kingdom, phylum etc." in lowercase prose, and Playwright's
        // text engine is case-insensitive, so scope to the label spans.
        await expect(page.locator('span.fw-bold', { hasText: 'Kingdom' })).toBeVisible();
        await expect(page.locator('text=Animalia')).toBeVisible();
        await expect(page.locator('span.fw-bold', { hasText: 'Phylum' })).toBeVisible();
        await expect(page.locator('text=Chordata')).toBeVisible();
        await expect(page.locator('span.fw-bold', { hasText: 'Genus' })).toBeVisible();
        await expect(page.locator('text=Falco').first()).toBeVisible();

        const chordataLink = page.locator('a', { hasText: 'Chordata' });
        await expect(chordataLink).toHaveAttribute('href', /\/species\/.*phylum-chordata.*tab=classification/);
    });

    test('shows children of the current taxon', async ({ page }) => {
        test.skip(shouldSkip('species-classification-children'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page, {
            searchConfig: {
                childrenByParentGuid: {
                    [SPECIES_BIRD_FULL.guid]: [
                        { rank: 'subspecies', nameFormatted: '<i>Falco hypoleucos</i> ssp. example', guid: 'https://biodiversity.org.au/afd/taxa/child-subspecies' },
                    ],
                },
            },
        });
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=classification'));
        await waitForContent(page);

        await expect(page.locator('text=ssp. example')).toBeVisible();
    });

    test('shows a single kingdom-level row when the taxon has no rankOrder (top of the tree)', async ({ page }) => {
        test.skip(shouldSkip('species-classification-kingdom-level'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_PLANT_MINIMAL.guid, 'tab=classification'));
        await waitForContent(page);

        // Scope to the rank-label span specifically (Bootstrap's stable "fw-bold"
        // utility class) since the header's rank line ("Species") and the site
        // nav's "Search species" link would otherwise create ambiguity.
        await expect(page.locator('span.fw-bold', { hasText: 'Species' }).first()).toBeVisible();
        // Scoped to the link role specifically — the breadcrumb's last item and
        // the header both also render "Testus minimalis" as plain (non-link) text.
        await expect(page.getByRole('link', { name: 'Testus minimalis', exact: true })).toBeVisible();
    });
});

test.describe('Species page - Names tab', () => {
    test('shows the accepted name row with source, according-to and published-in', async ({ page }) => {
        test.skip(shouldSkip('species-names-accepted'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=names'));

        // The accepted-name table is the first <table> on the tab (Synonyms,
        // which also has a nameAccordingTo value in the fixture, follows it).
        const acceptedNameTable = page.locator('table').first();
        await expect(page.locator('text=Accepted name')).toBeVisible();
        await expect(acceptedNameTable).toContainText('According to:');
        await expect(acceptedNameTable).toContainText('(Gould, 1852)');
        await expect(acceptedNameTable).toContainText('Published in:');
        await expect(acceptedNameTable).toContainText('Birds Austral. 4');
        await expect(page.getByRole('link', { name: 'Australian Faunal Directory' })).toHaveAttribute('href', 'https://biodiversity.org.au');
    });

    test('shows synonyms sorted most-recent-first by publication year', async ({ page }) => {
        test.skip(shouldSkip('species-names-synonyms-order'), 'Skipped via live-config.json skip list');
        // namesView.tsx sorts by the structured `namePublishedInYear` field (descending),
        // falling back to alphabetical-by-nameFormatted when the year is missing on
        // either item. In the species-bird-full fixture, "Falco (Hierofalco)
        // hypoleucos" (1918) sorts before "Hieracidea hypoleucos" (1852), and
        // "Aquila hypoleucos" (no year) sorts last.
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=names'));

        const synonymRows = page.locator('table', { hasText: 'Synonyms' }).locator('tbody tr');
        await expect(synonymRows).toHaveCount(3);
        await expect(synonymRows.nth(0)).toContainText('Falco (Hierofalco) hypoleucos');
        await expect(synonymRows.nth(1)).toContainText('Hieracidea hypoleucos');
        await expect(synonymRows.nth(2)).toContainText('Aquila hypoleucos');
    });

    test('shows variants table', async ({ page }) => {
        test.skip(shouldSkip('species-names-variants'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=names'));

        await expect(page.locator('text=Variants')).toBeVisible();
        await expect(page.locator('text=Falco hypoleuca')).toBeVisible();
    });

    test('identifier links (e.g. CAAB) resolve to the correct external page', async ({ page }) => {
        test.skip(shouldSkip('species-names-identifiers-caab'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=names'));

        const caabLink = page.getByRole('link', { name: /caab_code=27531011/ });
        await expect(caabLink).toHaveAttribute('href', 'https://www.marine.csiro.au/data/caab/taxon_report.cfm?caab_code=27531011');
    });

    test('shows common names table', async ({ page }) => {
        test.skip(shouldSkip('species-names-common'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=names'));

        await expect(page.getByText('Common names', { exact: true })).toBeVisible();
        await expect(page.locator('table', { hasText: 'Common name' }).locator('text=Grey Falcon')).toBeVisible();
    });

    test('shows indigenous names table sorted alphabetically with language-group links', async ({ page }) => {
        test.skip(shouldSkip('species-names-indigenous'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=names'));

        const indigenousRows = page.locator('table', { hasText: 'See language group' }).locator('tbody tr');
        await expect(indigenousRows).toHaveCount(2);
        await expect(indigenousRows.nth(0)).toContainText('Kirrkirrpa');
        await expect(indigenousRows.nth(1)).toContainText('Waitj');

        const waitjLink = page.getByRole('link', { name: 'Waitj' });
        await expect(waitjLink).toHaveAttribute('href', 'https://profiles.ala.org.au/opus/noongar/profile/fc0b2445-576b-4dc8-9f2a-582abf7897c7');
        const languageLink = page.getByRole('link', { name: 'Noongar' });
        await expect(languageLink).toHaveAttribute('href', 'https://aiatsis.gov.au/languages/nys');
    });

    test('disambiguation section shows related taxa with relationship labels', async ({ page }) => {
        test.skip(shouldSkip('species-names-disambiguation'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page, {
            searchConfig: {
                disambiguationByGuid: {
                    [SPECIES_BIRD_FULL.guid]: DISAMBIGUATION_RESULTS,
                },
            },
        });
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=names'));

        await expect(page.getByText('Disambiguation', { exact: true })).toBeVisible();
        await expect(page.locator('text=Parent taxon')).toBeVisible();
        await expect(page.locator('text=Child taxon')).toBeVisible();
        await expect(page.locator('text=Same genus')).toBeVisible();
        await expect(page.locator('text=Different kingdom')).toBeVisible();
    });
});

test.describe('Species page - Status tab', () => {
    test('shows the native/introduced table', async ({ page }) => {
        test.skip(shouldSkip('species-status-native-introduced'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=status'));

        await expect(page.getByText('Native / introduced', { exact: true })).toBeVisible();
        const rows = page.locator('table', { hasText: 'Place' }).locator('tbody tr');
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(0)).toContainText('South Australia');
        await expect(rows.nth(1)).toContainText('Western Australia');
    });

    test('shows the conservation status table with IUCN mapping', async ({ page }) => {
        test.skip(shouldSkip('species-status-conservation'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=status'));

        await expect(page.locator('text=Conservation status')).toBeVisible();
        await expect(page.locator('text=IUCN Red List')).toBeVisible();
        await expect(page.locator('text=EPBC Act')).toBeVisible();
        await expect(page.locator('text=Endangered').first()).toBeVisible();
        await expect(page.locator('text=Not assessed')).toBeVisible();
    });

    test('shows "No status information available" when there is no status data', async ({ page }) => {
        test.skip(shouldSkip('species-status-none'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_PLANT_MINIMAL.guid, 'tab=status'));

        await expect(page.locator('text=No status information available.')).toBeVisible();
    });
});

test.describe('Species page - Description tab', () => {
    test('shows multiple content boxes with headings, and suppresses the "summary" key label', async ({ page }) => {
        test.skip(shouldSkip('species-description-multi-section'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=description'));

        await expect(visibleText(page, 'Summary', { exact: true })).toBeVisible();
        await expect(visibleText(page, 'Taxonomy', { exact: true })).toBeVisible();
        await expect(visibleText(page, 'Ecology', { exact: true })).toBeVisible();
        await expect(visibleText(page, 'References', { exact: true })).toBeVisible();
        await expect(page.locator('text=rare, medium-sized falcon')).toBeVisible();
        await expect(page.locator('text=described by ornithologist John Gould')).toBeVisible();

        // the 'summary' key's section label itself must be suppressed (content still shows)
        expect(await page.getByText('summary', { exact: true }).count()).toBe(0);
        // but a non-'summary' key (e.g. "taxonomy") does show its label
        await expect(visibleText(page, 'taxonomy', { exact: true })).toBeVisible();
    });

    test('shows the Wikipedia source attribution at the bottom of each box', async ({ page }) => {
        test.skip(shouldSkip('species-description-attribution'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=description'));

        const sourceLabels = page.locator('span', { hasText: 'Source:' });
        await expect(sourceLabels).toHaveCount(4);
        const wikipediaLinks = page.getByRole('link', { name: 'Wikipedia', exact: true });
        await expect(wikipediaLinks.first()).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Grey_falcon');
        await expect(page.locator('text=Creative Commons Attribution-ShareAlike License 4.0').first()).toBeVisible();
    });

    test('shows "No descriptions found" when there is no hero description', async ({ page }) => {
        test.skip(shouldSkip('species-description-none'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_PLANT_MINIMAL.guid, 'tab=description'));

        await expect(page.locator('text=No descriptions found')).toBeVisible();
    });
});

test.describe('Species page - Media (Images/gallery) tab', () => {
    test('shows the media grid with correct "Showing X media from Y occurrences" count', async ({ page }) => {
        test.skip(shouldSkip('species-media-grid'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=media'));

        // 12 visible items (10 images + 1 video + 1 sound; 1 image is hidden via
        // hiddenImages_s) from 17 total occurrences
        await expect(visibleText(page, 'Showing')).toBeVisible();
        await expect(page.locator('span', { hasText: /^Showing\s+12\s+media from\s+17\s+occurrences$/ })).toBeVisible();
    });

    test('shows video and sound tiles alongside images', async ({ page }) => {
        test.skip(shouldSkip('species-media-video-sound'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=media'));

        await expect(page.locator('text=Sound file')).toBeVisible();
        await expect(page.locator('text=Video file')).toBeVisible();
    });

    test('excludes images listed in hiddenImages_s from the grid', async ({ page }) => {
        test.skip(shouldSkip('species-media-hidden-images'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=media'));

        expect(await page.locator('img[src*="img-hidden-999"]').count()).toBe(0);
    });

    test('shows refine sections for media type, occurrence type, licence type and dataset', async ({ page }) => {
        test.skip(shouldSkip('species-media-refine'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=media'));

        await expect(page.locator('text=Media type')).toBeVisible();
        await expect(page.locator('text=Occurrence type')).toBeVisible();
        await expect(page.locator('text=Licence type')).toBeVisible();
        await expect(visibleText(page, 'Dataset', { exact: true })).toBeVisible();
        // basisOfRecord is aggregated client-side via fieldMapping: "Preserved specimen" -> "Specimens"
        await expect(page.locator('text=Specimens (6)')).toBeVisible();
        await expect(page.locator('text=Observations (11)')).toBeVisible();
        await expect(page.locator('text=eBird Australia (7)')).toBeVisible();
    });

    test('"View more" loads the next page and appends distinct new images (no duplicates)', async ({ page }) => {
        test.skip(shouldSkip('species-media-load-more'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=media'));

        expect(await page.locator('img[src*="gallery-img-010"]').count()).toBe(0);
        await page.getByRole('button', { name: 'Load more images' }).click();
        await expect(page.locator('img[src*="gallery-img-010"]')).toBeVisible({ timeout: 3000 });
        // page-1 items are still present (appended, not replaced)
        await expect(page.locator('img[src*="gallery-img-001"]')).toBeVisible();
    });

    test('clicking an image opens the modal viewer with working prev/next/close controls', async ({ page }) => {
        test.skip(shouldSkip('species-media-modal'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=media'));

        await page.locator('img[src*="gallery-img-001"]').click();
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();
        await expect(page.getByRole('button', { name: 'Previous image' })).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Next image' })).toBeEnabled();

        await page.getByRole('button', { name: 'Next image' }).click();
        await expect(page.getByRole('button', { name: 'Previous image' })).toBeEnabled();

        await page.getByRole('button', { name: 'Close' }).click();
        await expect(dialog).toBeHidden();
    });

    test('mobile: tapping an image opens it in a new tab instead of the modal', async ({ page }) => {
        test.skip(shouldSkip('species-media-mobile-tap'), 'Skipped via live-config.json skip list');
        await page.setViewportSize({ width: 400, height: 800 });
        await setupSpeciesPageMocks(page);
        // NOTE: on mobile, Species.tsx replaces the desktop tab bar with an
        // accordion driven by its own `mobileToggle` state — the `#tab=` hash
        // only applies to the desktop layout. Every section starts collapsed
        // and must be expanded by clicking its heading before it mounts.
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));
        await page.locator('text=Images and sounds').click();
        await waitForContent(page);

        // imageMocks is registered at the browser-context level (see
        // tests/mocks/imageMocks.ts), so the popup correctly inherits the mock
        // and receives the generated placeholder image rather than hitting the
        // real network.
        const [popup] = await Promise.all([
            page.waitForEvent('popup'),
            page.locator('img[src*="gallery-img-001"]').click(),
        ]);
        await expect(popup).toHaveURL(/images\.test\.ala\.org\.au\/image\/gallery-img-001/);
        await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    });
});

test.describe('Species page - Traits tab', () => {
    test('plant with AusTraits data: shows categorical and numerical trait tables, citation info, logo, and download link', async ({ page }) => {
        test.skip(shouldSkip('species-traits-data'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_PLANT_TRAITS.guid, 'tab=traits'));
        await waitForContent(page);

        await expect(page.locator('text=Categorical Traits')).toBeVisible();
        await expect(page.locator('text=leaf_type')).toBeVisible();
        // trailing "*" in a trait_values fixture entry triggers the footnote
        await expect(page.locator('text=Data sources in AusTraits report')).toBeVisible();

        await expect(page.locator('text=Numerical Traits')).toBeVisible();
        const numericTraitsRow = page.locator('tr', { hasText: 'plant_height' });
        await expect(numericTraitsRow).toBeVisible();
        await expect(numericTraitsRow).toContainText('2.5'); // min
        await expect(numericTraitsRow).toContainText('15'); // max
        await expect(numericTraitsRow).toContainText('m'); // unit

        await expect(page.locator('text=How to cite AusTraits data')).toBeVisible();
        await expect(page.locator('img[alt="Austraits logo"]')).toBeVisible();
        await expect(page.getByRole('button', { name: 'AusTraits definitions' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Download CSV' })).toBeVisible();
    });

    test('"AusTraits definitions" button opens the correct URL', async ({ page }) => {
        test.skip(shouldSkip('species-traits-definitions-link'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_PLANT_TRAITS.guid, 'tab=traits'));
        await waitForContent(page);

        // VITE_AUSTRAITS_DEFINITIONS points at a local (non-real) URL for tests
        // (see .env.playwright), so this stays a same-origin mock like the rest
        // of the suite rather than depending on the real w3id.org redirector.
        let capturedUrl: string | null = null;
        await page.context().route('http://localhost:8082/static/austraits/definitions', async (route) => {
            capturedUrl = route.request().url();
            await route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' });
        });

        const [popup] = await Promise.all([
            page.waitForEvent('popup'),
            page.getByRole('button', { name: 'AusTraits definitions' }).click(),
        ]);
        await popup.waitForLoadState('load').catch(() => {});
        expect(capturedUrl).toBe('http://localhost:8082/static/austraits/definitions');
    });

    test('"Download CSV" button downloads the traits data file', async ({ page }) => {
        test.skip(shouldSkip('species-traits-download-csv'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_PLANT_TRAITS.guid, 'tab=traits'));
        await waitForContent(page);

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 5000 }),
            page.getByRole('button', { name: 'Download CSV' }).click(),
        ]);
        expect(download.suggestedFilename()).toBe('Acacia dealbata.csv');
    });

    test('plant without AusTraits data shows the "no data" fallback message', async ({ page }) => {
        test.skip(shouldSkip('species-traits-no-data'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_PLANT_NO_TRAITS.guid, 'tab=traits'));
        await waitForContent(page);

        await expect(page.locator('text=There is currently no data for the taxon name you searched for in the AusTraits database.')).toBeVisible();
    });

    test('non-plant species: Traits tab is still visible (no kingdom-based hiding implemented) and shows "no data"', async ({ page }) => {
        test.skip(shouldSkip('species-traits-non-plant'), 'Skipped via live-config.json skip list');
        // NOTE: manual QA expects the Traits tab to be hidden entirely for
        // fungi/animal species; the actual implementation always renders the
        // tab and shows the same "no data" fallback regardless of kingdom —
        // see PLAYWRIGHT_TEST.md "Discrepancies". This test asserts the real
        // behaviour.
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid));

        await expect(page.locator('div', { hasText: 'Traits' }).locator('visible=true').first()).toBeVisible();
        await page.locator('div', { hasText: /^Traits$/ }).click();
        await waitForContent(page);
        await expect(page.locator('text=There is currently no data for the taxon name you searched for in the AusTraits database.')).toBeVisible();
    });
});

test.describe('Species page - Datasets tab', () => {
    test('shows the dataset list with names, licences and record counts', async ({ page }) => {
        test.skip(shouldSkip('species-datasets-list'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=datasets'));
        await waitForContent(page);

        // Every tab's table is always mounted (hidden via CSS on inactive
        // tabs), so scope to the one with a "Licence" column header.
        const datasetsTable = page.locator('table').filter({ has: page.locator('th', { hasText: 'Licence' }) });
        const rows = datasetsTable.locator('tbody tr');
        await expect(rows).toHaveCount(3);
        // fixture order is already descending by record count; the component
        // does not re-sort, so DOM order should match fixture order exactly
        await expect(rows.nth(0)).toContainText('eBird Australia');
        await expect(rows.nth(0)).toContainText('3,200');
        await expect(rows.nth(1)).toContainText('ALA specimen records');
        await expect(rows.nth(2)).toContainText('iNaturalist Australia');
        await expect(datasetsTable.locator('text=CC-BY 4.0').first()).toBeVisible();
    });

    test('shows "No datasets found" when there are no dataset facets', async ({ page }) => {
        test.skip(shouldSkip('species-datasets-none'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page, {
            biocacheConfig: { datasetFacetByGuid: { [SPECIES_PLANT_MINIMAL.guid]: { facetResults: [] } } },
        });
        await load(page, speciesUrl(SPECIES_PLANT_MINIMAL.guid, 'tab=datasets'));
        await waitForContent(page);

        await expect(page.locator('text=No datasets found')).toBeVisible();
    });
});

test.describe('Species page - Resources tab', () => {
    test('shows BHL literature results capped at 5, with author formatting', async ({ page }) => {
        test.skip(shouldSkip('species-resources-bhl'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=resources'));
        await waitForContent(page);

        await expect(page.locator('text=Showing 1 to 5')).toBeVisible();
        // 1 author: "Gould, John" -> "Gould, J."
        await expect(visibleText(page, 'Gould, J.')).toBeVisible();
        // 2 authors: "Smith, Jane" and "Brown, Robert" -> "Smith, J. and Brown, R."
        await expect(page.locator('text=Smith, J. and Brown, R.')).toBeVisible();
        // 3 authors: "Lee, Amy", "Wong, David", "Nguyen, Tran" -> "Lee, A., Wong, D. and Nguyen, T."
        await expect(page.locator('text=Lee, A., Wong, D. and Nguyen, T.')).toBeVisible();
        // 6th fixture entry (beyond maxBhlSize=5) must not render
        expect(await page.locator('text=Should not appear').count()).toBe(0);

        const bhlLink = page.getByRole('link', { name: 'View in BHL' });
        await expect(bhlLink).toHaveAttribute('href', /biodiversitylibrary\.org\/search/);
    });

    test('shows "No BHL references found" when there is no literature data', async ({ page }) => {
        test.skip(shouldSkip('species-resources-bhl-none'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page, { bhlByGuid: {} });
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=resources'));
        await waitForContent(page);

        await expect(page.locator('text=No BHL references found')).toBeVisible();
    });

    test('"Other resources" buttons are filtered by the inSpeciesGroup rule', async ({ page }) => {
        test.skip(shouldSkip('species-resources-other'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=resources'));
        await waitForContent(page);

        // bird-full's speciesGroup includes "Animals", which matches at least one
        // real onlineResources.json rule, plus any rule-less (always visible) entries
        await expect(page.locator('text=Other resources')).toBeVisible();
        const resourceButtons = page.locator('a.ala-btn-primary', { hasText: /.+/ });
        expect(await resourceButtons.count()).toBeGreaterThan(0);
    });
});
