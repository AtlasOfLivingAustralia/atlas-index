import { test, expect } from '../fixtures';
import { BASE_URL, load, setupSearchPageMocks } from '../helpers';

// ---------------------------------------------------------------------------
// Search.tsx / App.tsx / allView.tsx / genericView.tsx / examples.tsx —
// branches NOT covered by tests/acceptance.spec.ts's "Search page" describe
// blocks. See PLAYWRIGHT_TEST.md Phase 5 for the coverage-gap rationale.
//
// 1. App.tsx SearchRedirect — legacy /search?q=X route
// 2. App.tsx resize listener — dispatched after mount (not just a fixed initial viewport)
// 3. App.tsx visibilitychange listener — re-checks login state, no crash
// 4. AllView — API error response (!response.ok) resets state without crashing
// 5. Autocomplete — <3 chars (no fetch), fetch error (catch block), blur-hide delay
// 6. Autocomplete — clicking a dropdown item directly (onMouseDown path, not keyboard)
// 7. Examples — clicking a random example link (both desktop asText and mobile landing page variants)
// 8. GenericView — mobile refine dialog open/close
// 9. GenericView — facet "Show more" / "Show less" toggle (lessNumber overflow)
// 10. speciesDefn custom facets — zero-result branches (facet section omitted entirely)
// ---------------------------------------------------------------------------

test.describe('App.tsx — legacy redirects and responsive listeners', () => {
    test('legacy /search?q=X route redirects to /?q=X', async ({ page }) => {
        await setupSearchPageMocks(page);
        await page.goto(`${BASE_URL}/search?q=Acacia`);
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveURL(/\/\?q=Acacia/);
    });

    test('legacy /search route with no q redirects to /', async ({ page }) => {
        await setupSearchPageMocks(page);
        await page.goto(`${BASE_URL}/search`);
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveURL(`${BASE_URL}/`);
    });

    test('window resize dispatched after mount updates the mobile layout', async ({ page }) => {
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia`);

        // Confirm desktop tab bar first
        await expect(page.locator('select')).toHaveCount(0);

        await page.setViewportSize({ width: 400, height: 800 });
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));

        await expect(page.locator('select')).toBeVisible({ timeout: 3000 });
    });

    test('visibilitychange event does not crash the page and re-checks login state', async ({ page }) => {
        await setupSearchPageMocks(page);
        await load(page, BASE_URL);

        await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await expect(page.locator('text=Search Atlas of Living Australia')).toBeVisible();
    });
});

test.describe('AllView — API error handling', () => {
    test('idxtype-facet API error resets state without crashing', async ({ page }) => {
        await setupSearchPageMocks(page);
        await page.context().route('http://localhost:8081/v2/search**', async (route) => {
            const url = new URL(route.request().url());
            if (url.searchParams.get('facets') === 'idxtype') {
                return route.fulfill({ status: 500, contentType: 'text/plain', body: 'Internal Server Error' });
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalRecords: 0, searchResults: [] }) });
        });

        await load(page, `${BASE_URL}/?q=Acacia`);

        // total<=0 with a non-empty query shows "No results found" (the
        // "Try searching" fallback is only for the *empty*-query case)
        await expect(page.locator('text=No results found')).toBeVisible();
        expect(await page.locator('a', { hasText: /^See \d+ results$/ }).count()).toBe(0);
    });
});

test.describe('Autocomplete — branches not covered by acceptance tests', () => {
    test('fewer than 3 characters does not trigger a fetch or show a dropdown', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await setupSearchPageMocks(page);
        await page.context().route('http://localhost:8081/v1/bie/search/auto**', (route) => {
            seenUrls.add(new URL(route.request().url()));
            return route.continue();
        });

        await load(page, BASE_URL);
        await page.getByPlaceholder('Search species, datasets, content and more...').fill('Ac');
        await page.waitForTimeout(500); // longer than the 300ms debounce

        expect(seenUrls.size).toBe(0);
    });

    test('autocomplete fetch error is handled gracefully (no dropdown, no crash)', async ({ page }) => {
        await setupSearchPageMocks(page);
        await page.context().route('http://localhost:8081/v1/bie/search/auto**', (route) => route.abort('failed'));

        await load(page, BASE_URL);
        const input = page.getByPlaceholder('Search species, datasets, content and more...');
        await input.fill('Aca');
        await page.waitForTimeout(500);

        // Page must still be usable — no dropdown, but typing/searching still works
        await input.press('Enter');
        await expect(page).toHaveURL(/\?q=Aca/);
    });

    test('blur hides the dropdown after a short delay', async ({ page }) => {
        await setupSearchPageMocks(page);
        await load(page, BASE_URL);

        const input = page.getByPlaceholder('Search species, datasets, content and more...');
        await input.fill('Aca');
        const dropdownItem = page.locator('div:text-is("Acacia dealbata")');
        await expect(dropdownItem).toBeVisible({ timeout: 3000 });

        await input.blur();
        await expect(dropdownItem).toBeHidden({ timeout: 1000 });
    });

    test('clicking a dropdown item directly (mousedown) selects it and navigates', async ({ page }) => {
        await setupSearchPageMocks(page);
        await load(page, BASE_URL);

        const input = page.getByPlaceholder('Search species, datasets, content and more...');
        await input.fill('Aca');
        const dropdownItem = page.locator('div:text-is("Acacia pycnantha")');
        await expect(dropdownItem).toBeVisible({ timeout: 3000 });
        await dropdownItem.click();

        await expect(page).toHaveURL(/\?q=Acacia\+pycnantha/);
        await expect(input).toHaveValue('Acacia pycnantha');
    });
});

test.describe('Examples — clicking a randomly-selected example link', () => {
    test('desktop: clicking an inline example link switches tab but the query param is lost', async ({ page }) => {
        await setupSearchPageMocks(page);
        await load(page, BASE_URL);

        // Examples renders as plain <a> text links directly after "Try searching for:"
        // in the persistent search-info line — scope precisely to that container to
        // avoid matching unrelated <a> tags elsewhere (tab bar, site nav, etc).
        const searchInfoLine = page.locator('div', { hasText: 'Try searching for:' }).last();
        const exampleLink = searchInfoLine.locator('a').first();
        await expect(exampleLink).toBeVisible();
        const clickedQuery = await exampleLink.textContent();
        await exampleLink.click();

        // tab hash updates and the input reflects the clicked example's text...
        await expect(page).toHaveURL(/#tab=/);
        await expect(page.getByPlaceholder('Search species, datasets, content and more...')).toHaveValue(clickedQuery ?? '');
        // ...but the URL's `q` search param is never set, so no search runs
        expect(page.url()).not.toContain('?q=');
    });

    test('mobile landing page: clicking a button-styled example link switches tab but the query param is lost', async ({ page }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await setupSearchPageMocks(page);
        await load(page, BASE_URL);

        const landingHeading = page.locator('div', { hasText: 'Try searching for' }).last();
        await expect(landingHeading).toBeVisible();
        // Scope to links within the landing-page examples container specifically —
        // the common-ui header also has its own "Login" button using the same
        // Bootstrap classes (btn btn-primary btn-sm).
        const exampleButton = page.locator('a.btn.btn-primary.btn-sm').filter({ hasNotText: 'Login' }).first();
        await expect(exampleButton).toBeVisible();
        await exampleButton.click();

        await expect(page).toHaveURL(/#tab=/);
        expect(page.url()).not.toContain('?q=');
    });
});

test.describe('GenericView — mobile refine dialog', () => {
    test('opens via the "Refine results" button and closes via the close button', async ({ page }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await setupSearchPageMocks(page);
        await load(page, `${BASE_URL}/?q=Acacia#tab=species`);

        const refineButton = page.getByRole('button', { name: 'Refine results' });
        await expect(refineButton).toBeVisible();
        await refineButton.click();

        const dialogHeading = page.locator('span', { hasText: 'Refine results' }).last();
        await expect(dialogHeading).toBeVisible();
        await expect(page.locator('text=Taxonomic rank')).toBeVisible();

        await page.locator('button[aria-label="Close"]').click();
        await expect(page.locator('text=Taxonomic rank')).toBeHidden();
    });
});

test.describe('GenericView — facet "Show more" / "Show less" toggle', () => {
    test('a facet with more items than lessNumber is truncated, and can be expanded/collapsed', async ({ page }) => {
        await setupSearchPageMocks(page);
        // Override the datasets-tab response with a license facet that exceeds
        // datasetsDefn's lessNumber:5, to exercise the "Show more"/"Show less" toggle.
        await page.context().route('http://localhost:8081/v2/search**', async (route) => {
            const url = new URL(route.request().url());
            const fqs = url.searchParams.getAll('fq');
            if (fqs.some((f) => f.includes('idxtype:DATARESOURCE'))) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        totalRecords: 7,
                        searchResults: [],
                        facetResults: [
                            {
                                fieldName: 'license',
                                fieldResult: [
                                    { label: 'CC BY 1.0', count: 1 }, { label: 'CC BY 2.0', count: 1 },
                                    { label: 'CC BY 3.0', count: 1 }, { label: 'CC BY 4.0', count: 1 },
                                    { label: 'CC0', count: 1 }, { label: 'CC BY-NC', count: 1 }, { label: 'CC BY-SA', count: 1 },
                                ],
                            },
                        ],
                    }),
                });
            }
            return route.fallback();
        });

        await load(page, `${BASE_URL}/?q=Acacia#tab=datasets`);

        await expect(page.locator('text=Show more')).toBeVisible();
        expect(await page.locator('text=Cc By-sa').count()).toBe(0);

        await page.locator('text=Show more').click();
        await expect(page.locator('text=Show less')).toBeVisible();

        await page.locator('text=Show less').click();
        await expect(page.locator('text=Show more')).toBeVisible();
    });
});

test.describe('speciesDefn custom facets — zero-result branches', () => {
    test('when image/iconic-list/IEK-name custom facets all return zero, the "Type" facet section is omitted entirely', async ({ page }) => {
        // NOTE: `hasIekName:*` (customFacetCounts.iekName) is a distinct code path
        // from the regular `status` facet's traditionalKnowledge branch (which
        // ALSO produces a "Names" section item labelled "Indigenous Ecological
        // Knowledge name", sourced from search-species.json's `status` facet
        // fixture) — that item is expected to still render regardless of this override.
        await setupSearchPageMocks(page, {
            search: {
                customFacetCounts: { image: 0, iconicList: 0, iekName: 0 },
            },
        });
        await load(page, `${BASE_URL}/?q=Acacia#tab=species`);

        expect(await page.getByText('Image available', { exact: true }).count()).toBe(0);
        // exact match — the real site nav has an unrelated "Australian iconic species" link
        expect(await page.getByText('Iconic species', { exact: true }).count()).toBe(0);
        // the regular (non-custom) status facet's IEK item is unaffected by this override
        await expect(page.locator('text=Indigenous Ecological Knowledge name')).toBeVisible();
    });
});
