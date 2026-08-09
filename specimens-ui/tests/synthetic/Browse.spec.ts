/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Synthetic coverage tests for Browse.tsx.
 */

import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { imageMocks } from '../mocks/imageServiceMocks';
import { logMissingMocks } from '../mocks/logMissingMocks';
import { staticServerMocks } from '../mocks/staticServerMocks';
import { mockSession } from '../mocks/apiServiceMocks';
import {
    BASE_URL,
    BIOCACHE_PATTERN,
    multiImageOccurrence,
    occurrenceWithoutImages,
    kingdomFacetResponse,
    phylumFacetResponse,
    setupMocks,
    setupDefaultMock,
    setupNoResultsMock,
    setupErrorMock,
    setupAbortMock,
} from './helpers';

// ---------------------------------------------------------------------------
// Default view
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — default all-collections view', () => {
    test('shows images-summary and images after load', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('div.images-summary')).toBeVisible();
        await expect(page.locator('div.images-container .imgCon').first()).toBeVisible();
    });

    test('images-summary shows correct record count', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        const total = page.locator('div.images-summary .total-records');
        await expect(total).toBeVisible();
        expect(parseInt((await total.innerText()).replace(/,/g, ''), 10)).toBeGreaterThan(0);
    });

    test('taxonomy facet renders kingdom clickable items', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        const taxonomyFacet = page.locator('div#taxonomyFacet');
        await expect(taxonomyFacet).toBeVisible();
        await expect(taxonomyFacet.locator('span.clickable').first()).toBeVisible();
    });

    test('typeStatus facet is rendered', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('div.typeStatus-facet')).toBeVisible();
        await expect(page.locator('div.typeStatus-facet span.clickable').first()).toBeVisible();
    });

    test('raw_sex facet renders "Not supplied" for -field:* fq', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        const sexFacet = page.locator('div.raw_sex-facet');
        await expect(sexFacet).toBeVisible();
        const spans = sexFacet.locator('span.clickable');
        const count = await spans.count();
        let found = false;
        for (let i = 0; i < count; i++) {
            if ((await spans.nth(i).innerText()).includes('Not supplied')) { found = true; break; }
        }
        expect(found).toBe(true);
    });

    test('image cards have 3 links', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await expect(
            page.locator('div.images-container .imgCon').first().locator('a')
        ).toHaveCount(3);
    });

    test('image card DOM contains scientificName, vernacularName and typeStatus', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        // meta.full is CSS-hidden (hover-target) but present in DOM
        const html = await page.locator('div.images-container .imgCon').first().innerHTML();
        expect(html).toContain('Apis mellifera');
        expect(html).toContain('European Honey Bee');
        expect(html).toContain('HOLOTYPE');
    });

    test('image onError fallback replaces src', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        const firstImg = page.locator('div.images-container .imgCon img').first();
        await expect(firstImg).toBeVisible();
        await firstImg.evaluate((img: HTMLImageElement) => img.dispatchEvent(new Event('error')));

        // Vite bundles the SVG as a data URI; either way it changes from the original thumbUrl
        const src = await firstImg.getAttribute('src');
        expect(src).not.toMatch(/^https:\/\/images\.ala\.org\.au/);
    });
});

// ---------------------------------------------------------------------------
// Error and empty states
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — error states', () => {
    test('404 exercises no-results branch', async ({ page }) => {
        // Browse.tsx sets 'no results' on 404; no error is thrown afterwards.
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await imageMocks(page, seenUrls);
        await setupNoResultsMock(page);
        await mockSession(page, seenUrls);

        await page.goto(BASE_URL + '/browse');
        await expect(page.locator('.alert.alert-warning')).toBeVisible({ timeout: 15000 });
    });

    test('500 shows error alert', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await imageMocks(page, seenUrls);
        await setupErrorMock(page);
        await mockSession(page, seenUrls);

        await page.goto(BASE_URL + '/browse');
        await expect(page.locator('.alert.alert-error')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.alert.alert-error')).toContainText('error occurred');
    });

    test('aborted fetch shows error alert', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await imageMocks(page, seenUrls);
        await setupAbortMock(page);
        await mockSession(page, seenUrls);

        await page.goto(BASE_URL + '/browse');
        await expect(page.locator('.alert.alert-error')).toBeVisible({ timeout: 15000 });
    });
});

// ---------------------------------------------------------------------------
// entityUid prefix routing
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — entityUid prefix routing', () => {
    async function setupEntityMock(
        page: Page,
        expectedFqPrefix: string,
        collectionFieldName: string,
        collectionFieldValue: string
    ): Promise<void> {
        await page.route(BIOCACHE_PATTERN, async (route) => {
            const url = new URL(route.request().url());
            const fqs = url.searchParams.getAll('fq');
            const hasExpected = fqs.some((f) => f.startsWith(expectedFqPrefix));
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    pageSize: 2, startIndex: 0, totalRecords: 5, status: 'OK',
                    facetResults: [
                        { fieldName: 'typeStatus', fieldResult: [] },
                        { fieldName: 'raw_sex', fieldResult: [] },
                        {
                            fieldName: 'kingdom',
                            fieldResult: [
                                { label: 'Animalia', count: 5, fq: 'kingdom:"Animalia"' },
                                { label: 'Plantae', count: 1, fq: 'kingdom:"Plantae"' },
                            ],
                        },
                    ],
                    occurrences: hasExpected
                        ? [{
                            uuid: 'entity-occ-001',
                            [collectionFieldName]: collectionFieldValue,
                            scientificName: 'Test species',
                            imageMetadata: [{
                                imageId: 'img-entity-001',
                                thumbWidth: 400, thumbHeight: 300,
                                thumbUrl: 'https://images.ala.org.au/image/proxyImageThumbnail?imageId=img-entity-001',
                            }],
                        }]
                        : [],
                }),
            });
        });
    }

    test('"c…" adds collectionUid fq, entity name from collectionName', async ({ page }) => {
        await setupMocks(page, (p) =>
            setupEntityMock(p, 'collectionUid:co56', 'collectionName', 'My Collection')
        );
        await page.goto(BASE_URL + '/browse/co56');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('div.page-header h2 span')).toContainText('My Collection');
    });

    test('"dr…" adds dataResourceUid fq, entity name from dataResourceName', async ({ page }) => {
        await setupMocks(page, (p) =>
            setupEntityMock(p, 'dataResourceUid:dr1', 'dataResourceName', 'My Data Resource')
        );
        await page.goto(BASE_URL + '/browse/dr1');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('div.page-header h2 span')).toContainText('My Data Resource');
    });

    test('"dp…" adds dataProviderUid fq, entity name from dataProviderName', async ({ page }) => {
        await setupMocks(page, (p) =>
            setupEntityMock(p, 'dataProviderUid:dp1', 'dataProviderName', 'My Data Provider')
        );
        await page.goto(BASE_URL + '/browse/dp1');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('div.page-header h2 span')).toContainText('My Data Provider');
    });

    test('"i…" adds institutionUid fq, entity name from institutionName', async ({ page }) => {
        await setupMocks(page, (p) =>
            setupEntityMock(p, 'institutionUid:in1', 'institutionName', 'My Institution')
        );
        await page.goto(BASE_URL + '/browse/in1');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('div.page-header h2 span')).toContainText('My Institution');
    });

    test('empty occurrences falls back to uid as entity name', async ({ page }) => {
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, (route) =>
                route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify({
                        pageSize: 2, startIndex: 0, totalRecords: 0, status: 'OK',
                        facetResults: [
                            { fieldName: 'typeStatus', fieldResult: [] },
                            { fieldName: 'raw_sex', fieldResult: [] },
                            { fieldName: 'kingdom', fieldResult: [] },
                        ],
                        occurrences: [],
                    }),
                })
            );
        });
        await page.goto(BASE_URL + '/browse/co999');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('div.page-header h2 span')).toContainText('co999');
    });
});

// ---------------------------------------------------------------------------
// Taxonomy drill-down
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — taxonomy drill-down', () => {
    test('clicking a kingdom value shows phylum facet and breadcrumb', async ({ page }) => {
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const fqs = url.searchParams.getAll('fq');
                const hasKingdom = fqs.some((f) => f.startsWith('kingdom:'));
                const facets = url.searchParams.get('facets') ?? '';
                await route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify(
                        hasKingdom && facets.includes('phylum')
                            ? phylumFacetResponse()
                            : kingdomFacetResponse()
                    ),
                });
            });
        });

        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await page.locator('div#taxonomyFacet span.clickable', { hasText: 'Animalia' }).first().click();
        await expect(page.locator('div#taxonomyFacet span.clickable', { hasText: 'Arthropoda' }).first()).toBeVisible();
        await expect(page.locator('div#taxonomyFacet li.taxon-rank').first()).toBeVisible();
        await expect(
            page.locator('div#taxonomyFacet li.taxon-rank').first().locator('span', { hasText: /animalia/i })
        ).toBeVisible();
    });

    test('clicking a taxon-rank breadcrumb span triggers removeLowerRanks', async ({ page }) => {
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const fqs = url.searchParams.getAll('fq');
                const hasKingdom = fqs.some((f) => f.startsWith('kingdom:'));
                const hasPhylum = fqs.some((f) => f.startsWith('phylum:'));
                const facets = url.searchParams.get('facets') ?? '';

                if (hasKingdom && hasPhylum && facets.includes('class')) {
                    await route.fulfill({
                        status: 200, contentType: 'application/json',
                        body: JSON.stringify({
                            pageSize: 2, startIndex: 0, totalRecords: 1000, status: 'OK',
                            facetResults: [
                                { fieldName: 'typeStatus', fieldResult: [] },
                                { fieldName: 'raw_sex', fieldResult: [] },
                                { fieldName: 'class', fieldResult: [
                                    { label: 'Insecta', count: 800, fq: 'class:"Insecta"' },
                                    { label: 'Arachnida', count: 200, fq: 'class:"Arachnida"' },
                                ]},
                            ],
                            occurrences: [multiImageOccurrence],
                        }),
                    });
                } else if (hasKingdom && facets.includes('phylum')) {
                    await route.fulfill({
                        status: 200, contentType: 'application/json',
                        body: JSON.stringify(phylumFacetResponse()),
                    });
                } else {
                    await route.fulfill({
                        status: 200, contentType: 'application/json',
                        body: JSON.stringify(kingdomFacetResponse()),
                    });
                }
            });
        });

        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await page.locator('div#taxonomyFacet span.clickable', { hasText: 'Animalia' }).first().click();
        await expect(page.locator('div#taxonomyFacet span.clickable', { hasText: 'Arthropoda' }).first()).toBeVisible();

        await page.locator('div#taxonomyFacet span.clickable', { hasText: 'Arthropoda' }).first().click();
        await expect(page.locator('div#taxonomyFacet span.clickable', { hasText: 'Insecta' }).first()).toBeVisible();

        const taxonRanks = page.locator('div#taxonomyFacet li.taxon-rank');
        expect(await taxonRanks.count()).toBeGreaterThanOrEqual(2);

        // Click the last rank's name span — the || condition means only the last item
        // in the hierarchy actually calls removeLowerRanks.
        await taxonRanks.last().locator('span').last().click();
        await expect(async () => {
            await expect(page.locator('div#taxonomyFacet span.clickable').first()).toBeVisible();
        }).toPass({ timeout: 10000 });
    });

    test('auto-drills through single-value kingdom facet and stops at multi-value phylum', async ({ page }) => {
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const fqs = url.searchParams.getAll('fq');
                const hasKingdom = fqs.some((f) => f.startsWith('kingdom:'));
                const facets = url.searchParams.get('facets') ?? '';

                if (hasKingdom && facets.includes('phylum')) {
                    await route.fulfill({
                        status: 200, contentType: 'application/json',
                        body: JSON.stringify(phylumFacetResponse()),
                    });
                } else {
                    await route.fulfill({
                        status: 200, contentType: 'application/json',
                        body: JSON.stringify({
                            pageSize: 2, startIndex: 0, totalRecords: 1000, status: 'OK',
                            facetResults: [
                                { fieldName: 'typeStatus', fieldResult: [] },
                                { fieldName: 'raw_sex', fieldResult: [] },
                                { fieldName: 'kingdom', fieldResult: [
                                    { label: 'Animalia', count: 1000, fq: 'kingdom:"Animalia"' },
                                ]},
                            ],
                            occurrences: [multiImageOccurrence],
                        }),
                    });
                }
            });
        });

        await page.goto(BASE_URL + '/browse');
        await expect(
            page.locator('div#taxonomyFacet span.clickable', { hasText: 'Arthropoda' }).first()
        ).toBeVisible({ timeout: 20000 });
        await expect(page.locator('div#taxonomyFacet li.taxon-rank').first()).toBeVisible();
    });
});

// ---------------------------------------------------------------------------
// Deep taxonomy drill-down (family / genus / species)
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — deep taxonomy drill-down (family/genus/species)', () => {
    function buildDeepDrillMock() {
        return async (p: Page) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const fqs = url.searchParams.getAll('fq');
                const facets = url.searchParams.get('facets') ?? '';

                const has = (prefix: string) => fqs.some((f) => f.startsWith(prefix));
                const single = (name: string, label: string, fq: string) => ({
                    pageSize: 2, startIndex: 0, totalRecords: 500, status: 'OK',
                    facetResults: [
                        { fieldName: 'typeStatus', fieldResult: [] },
                        { fieldName: 'raw_sex', fieldResult: [] },
                        { fieldName: name, fieldResult: [{ label, count: 500, fq }] },
                    ],
                    occurrences: [multiImageOccurrence],
                });
                const multi = (name: string, items: Array<{ label: string; fq: string; count: number }>) => ({
                    pageSize: 2, startIndex: 0, totalRecords: 500, status: 'OK',
                    facetResults: [
                        { fieldName: 'typeStatus', fieldResult: [] },
                        { fieldName: 'raw_sex', fieldResult: [] },
                        { fieldName: name, fieldResult: items },
                    ],
                    occurrences: [multiImageOccurrence],
                });

                let body;
                if (has('species:')) {
                    body = { pageSize: 2, startIndex: 0, totalRecords: 5, status: 'OK',
                        facetResults: [{ fieldName: 'typeStatus', fieldResult: [] }, { fieldName: 'raw_sex', fieldResult: [] }],
                        occurrences: [multiImageOccurrence] };
                } else if (has('genus:') && facets.includes('species')) {
                    body = multi('species', [
                        { label: 'Carabus coriaceus', count: 300, fq: 'species:"Carabus coriaceus"' },
                        { label: 'Carabus auratus', count: 200, fq: 'species:"Carabus auratus"' },
                    ]);
                } else if (has('family:') && facets.includes('genus')) {
                    body = multi('genus', [
                        { label: 'Carabus', count: 400, fq: 'genus:"Carabus"' },
                        { label: 'Trechus', count: 100, fq: 'genus:"Trechus"' },
                    ]);
                } else if (has('order:') && facets.includes('family')) {
                    body = single('family', 'Carabidae', 'family:"Carabidae"');
                } else if (has('class:') && facets.includes('order')) {
                    body = single('order', 'Coleoptera', 'order:"Coleoptera"');
                } else if (has('phylum:') && has('class:') && facets.includes('order')) {
                    body = single('order', 'Coleoptera', 'order:"Coleoptera"');
                } else if (has('kingdom:') && has('phylum:') && facets.includes('class')) {
                    body = single('class', 'Insecta', 'class:"Insecta"');
                } else if (has('kingdom:') && facets.includes('phylum')) {
                    body = single('phylum', 'Arthropoda', 'phylum:"Arthropoda"');
                } else {
                    body = single('kingdom', 'Animalia', 'kingdom:"Animalia"');
                }
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
            });
        };
    }

    test('drill to genus level exercises setRankFq for family and genus', async ({ page }) => {
        await setupMocks(page, buildDeepDrillMock());
        await page.goto(BASE_URL + '/browse');

        const genusItem = page.locator('div#taxonomyFacet span.clickable', { hasText: 'Carabus' });
        await expect(genusItem.first()).toBeVisible({ timeout: 30000 });

        await genusItem.first().click();
        await expect(
            page.locator('div#taxonomyFacet span.clickable', { hasText: 'Carabus coriaceus' }).first()
        ).toBeVisible({ timeout: 15000 });
    });

    test('drill to species level sets fqSpecies → getCurrentRank returns ""', async ({ page }) => {
        await setupMocks(page, buildDeepDrillMock());
        await page.goto(BASE_URL + '/browse');

        await expect(
            page.locator('div#taxonomyFacet span.clickable', { hasText: 'Carabus' }).first()
        ).toBeVisible({ timeout: 30000 });

        await page.locator('div#taxonomyFacet span.clickable', { hasText: 'Carabus' }).first().click();
        const speciesItem = page.locator('div#taxonomyFacet span.clickable', { hasText: 'Carabus coriaceus' });
        await expect(speciesItem.first()).toBeVisible({ timeout: 15000 });

        await speciesItem.first().click();
        await expect(page.locator('div.images-summary')).toBeVisible({ timeout: 15000 });
    });
});

// ---------------------------------------------------------------------------
// Facet filter interactions
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — facet filter interactions', () => {
    test('clicking typeStatus facet item filters results', async ({ page }) => {
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const isHolotype = url.searchParams.getAll('fq').some((f) => f.includes('HOLOTYPE'));
                await route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify(isHolotype
                        ? {
                            pageSize: 2, startIndex: 0, totalRecords: 12500, status: 'OK',
                            facetResults: [
                                { fieldName: 'typeStatus', fieldResult: [{ label: 'HOLOTYPE', count: 12500, fq: 'typeStatus:"HOLOTYPE"' }] },
                                { fieldName: 'raw_sex', fieldResult: [] },
                                { fieldName: 'kingdom', fieldResult: [
                                    { label: 'Animalia', count: 12500, fq: 'kingdom:"Animalia"' },
                                    { label: 'Plantae', count: 0, fq: 'kingdom:"Plantae"' },
                                ]},
                            ],
                            occurrences: [multiImageOccurrence],
                        }
                        : kingdomFacetResponse()),
                });
            });
        });

        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await page.locator('div.typeStatus-facet span.clickable', { hasText: 'HOLOTYPE' }).first().click();
        const total = page.locator('div.images-summary .total-records');
        await expect(total).toBeVisible();
        // The click triggers an async re-fetch; wait for the total to actually
        // update to the HOLOTYPE-filtered count rather than reading it immediately
        // (which can race and capture the stale default-mock value).
        await expect(total).toHaveText('12500');
    });

    test('"all values" in typeStatus facet calls removeFq (typeStatus)', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await page.locator('div.typeStatus-facet span.clickable', { hasText: 'all values' }).click();
        await expect(page.locator('div.images-summary')).toBeVisible();
    });

    test('"all values" in raw_sex facet calls removeFq (raw_sex)', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await page.locator('div.raw_sex-facet span.clickable', { hasText: 'all values' }).click();
        await expect(page.locator('div.images-summary')).toBeVisible();
    });

    test('clicking sex facet item sets fqSex filter', async ({ page }) => {
        let sexFilterRequested = false;
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const hasSex = url.searchParams.getAll('fq').some((f) => f.startsWith('raw_sex:'));
                if (hasSex) sexFilterRequested = true;
                await route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify(hasSex ? { ...kingdomFacetResponse(425000), totalRecords: 425000 } : kingdomFacetResponse()),
                });
            });
        });

        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await page.locator('div.raw_sex-facet span.clickable').nth(0).click();
        await expect(page.locator('div.images-summary .total-records')).toBeVisible();
        expect(sexFilterRequested).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Clear filters
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — clear filters', () => {
    test('clear filters resets all active taxonomy filters', async ({ page }) => {
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const fqs = url.searchParams.getAll('fq');
                const hasKingdom = fqs.some((f) => f.startsWith('kingdom:'));
                const facets = url.searchParams.get('facets') ?? '';
                await route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify(
                        hasKingdom && facets.includes('phylum') ? phylumFacetResponse() : kingdomFacetResponse()
                    ),
                });
            });
        });

        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await page.locator('div#taxonomyFacet span.clickable', { hasText: 'Animalia' }).first().click();
        await expect(page.locator('div#taxonomyFacet li.taxon-rank').first()).toBeVisible();

        await page.locator('button.btn.btn-outline-dark', { hasText: 'Clear filters' }).click();
        await expect(async () => {
            expect(await page.locator('div#taxonomyFacet li.taxon-rank').count()).toBe(0);
        }).toPass({ timeout: 10000 });
    });

    test('clear filters with no active filters is a no-op', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await page.locator('button.btn.btn-outline-dark', { hasText: 'Clear filters' }).click();
        await expect(page.locator('div.images-summary')).toBeVisible();
    });
});

// ---------------------------------------------------------------------------
// Show more / pagination
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — show more / pagination', () => {
    test('show-more button loads additional images', async ({ page }) => {
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const start = parseInt(url.searchParams.get('start') ?? '0', 10);
                const facets = url.searchParams.get('facets');
                await route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify(start === 0
                        ? {
                            pageSize: 2, startIndex: 0, totalRecords: 10, status: 'OK',
                            facetResults: facets ? [
                                { fieldName: 'typeStatus', fieldResult: [] },
                                { fieldName: 'raw_sex', fieldResult: [] },
                                { fieldName: 'kingdom', fieldResult: [
                                    { label: 'Animalia', count: 10, fq: 'kingdom:"Animalia"' },
                                    { label: 'Plantae', count: 0, fq: 'kingdom:"Plantae"' },
                                ]},
                            ] : null,
                            occurrences: [multiImageOccurrence, { ...multiImageOccurrence, uuid: 'occ-002' }],
                        }
                        : {
                            pageSize: 2, startIndex: start, totalRecords: 10, status: 'OK',
                            facetResults: null,
                            occurrences: [{ ...multiImageOccurrence, uuid: 'occ-page2' }],
                        }),
                });
            });
        });

        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('div.images-summary')).toBeVisible();

        const showMore = page.locator('.btn.show-more');
        await expect(showMore).toBeVisible();
        const initialCount = await page.locator('div.images-container .imgCon').count();
        await showMore.click();

        await expect(async () => {
            expect(await page.locator('div.images-container .imgCon').count()).toBeGreaterThan(initialCount);
        }).toPass({ timeout: 10000 });
    });
});

// ---------------------------------------------------------------------------
// firstImageOnly checkbox
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — firstImageOnly checkbox', () => {
    async function singleOccurrenceMock(p: Page) {
        await p.route(BIOCACHE_PATTERN, async (route) => {
            await route.fulfill({
                status: 200, contentType: 'application/json',
                body: JSON.stringify({
                    pageSize: 2, startIndex: 0, totalRecords: 1, status: 'OK',
                    facetResults: [
                        { fieldName: 'typeStatus', fieldResult: [] },
                        { fieldName: 'raw_sex', fieldResult: [] },
                        { fieldName: 'kingdom', fieldResult: [{ label: 'Animalia', count: 1, fq: 'kingdom:"Animalia"' }] },
                    ],
                    occurrences: [multiImageOccurrence],
                }),
            });
        });
    }

    test('unchecking firstImageOnly triggers re-fetch appending more image cards', async ({ page }) => {
        await setupMocks(page, singleOccurrenceMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('div.images-container .imgCon').first()).toBeVisible();
        const initial = await page.locator('div.images-container .imgCon').count();
        expect(initial).toBe(1);

        const checkbox = page.locator('#firstImageOnly');
        await expect(checkbox).toBeChecked();
        await checkbox.uncheck();

        await expect(async () => {
            expect(await page.locator('div.images-container .imgCon').count()).toBeGreaterThan(initial);
        }).toPass({ timeout: 10000 });
    });

    test('re-checking firstImageOnly reduces the image count back down', async ({ page }) => {
        await setupMocks(page, singleOccurrenceMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        const checkbox = page.locator('#firstImageOnly');
        const countAfterLoad = await page.locator('div.images-container .imgCon').count();

        await checkbox.uncheck();
        await expect(async () => {
            expect(await page.locator('div.images-container .imgCon').count()).toBeGreaterThan(countAfterLoad);
        }).toPass({ timeout: 10000 });

        const countAfterUncheck = await page.locator('div.images-container .imgCon').count();
        await checkbox.check();
        await expect(async () => {
            expect(await page.locator('div.images-container .imgCon').count()).toBeLessThan(countAfterUncheck);
        }).toPass({ timeout: 10000 });
    });
});

// ---------------------------------------------------------------------------
// Occurrences without imageMetadata
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — occurrences without imageMetadata', () => {
    test('occurrence without imageMetadata does not produce an imgCon card', async ({ page }) => {
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                await route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify({
                        pageSize: 2, startIndex: 0, totalRecords: 2, status: 'OK',
                        facetResults: [
                            { fieldName: 'typeStatus', fieldResult: [] },
                            { fieldName: 'raw_sex', fieldResult: [] },
                            { fieldName: 'kingdom', fieldResult: [
                                { label: 'Animalia', count: 2, fq: 'kingdom:"Animalia"' },
                                { label: 'Plantae', count: 0, fq: 'kingdom:"Plantae"' },
                            ]},
                        ],
                        occurrences: [occurrenceWithoutImages, multiImageOccurrence],
                    }),
                });
            });
        });

        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('div.images-summary')).toBeVisible();
        expect(await page.locator('div.images-container .imgCon').count()).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// formatFq edge cases
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — formatFq edge cases', () => {
    test('fq starting with "-" is formatted as "Not supplied" in facet display', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        expect(await page.locator('div.raw_sex-facet').innerHTML()).toContain('Not supplied');
    });

    test('"-" prefix fq in taxonomy shows "Not supplied" in breadcrumb', async ({ page }) => {
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const fqs = url.searchParams.getAll('fq');
                const hasNegKingdom = fqs.some((f) => f.startsWith('-kingdom:'));
                const facets = url.searchParams.get('facets') ?? '';
                await route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify(hasNegKingdom && facets.includes('phylum')
                        ? phylumFacetResponse()
                        : {
                            ...kingdomFacetResponse(),
                            facetResults: [
                                { fieldName: 'typeStatus', fieldResult: [{ label: 'HOLOTYPE', count: 100, fq: 'typeStatus:"HOLOTYPE"' }] },
                                { fieldName: 'raw_sex', fieldResult: [] },
                                { fieldName: 'kingdom', fieldResult: [
                                    { label: 'Animalia', count: 8453030, fq: 'kingdom:"Animalia"' },
                                    { label: 'Not supplied', count: 100, fq: '-kingdom:*' },
                                    { label: 'Unknown', count: 50, fq: 'bareValue' },
                                ]},
                            ],
                        }),
                });
            });
        });

        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await page.locator('div#taxonomyFacet span.clickable', { hasText: 'Not supplied' }).first().click();
        await expect(async () => {
            expect(await page.locator('div#taxonomyFacet').innerHTML()).toContain('Not supplied');
        }).toPass({ timeout: 10000 });
    });

    test('fq without colon exercises formatFq fallback (line 329)', async ({ page }) => {
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const fqs = url.searchParams.getAll('fq');
                const hasBare = fqs.some((f) => f === 'bareValue');
                const facets = url.searchParams.get('facets') ?? '';
                await route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify(hasBare && facets.includes('phylum')
                        ? phylumFacetResponse()
                        : {
                            ...kingdomFacetResponse(),
                            facetResults: [
                                { fieldName: 'typeStatus', fieldResult: [] },
                                { fieldName: 'raw_sex', fieldResult: [] },
                                { fieldName: 'kingdom', fieldResult: [
                                    { label: 'BareValue', count: 100, fq: 'bareValue' },
                                    { label: 'Animalia', count: 8453030, fq: 'kingdom:"Animalia"' },
                                ]},
                            ],
                        }),
                });
            });
        });

        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');

        await page.locator('div#taxonomyFacet span.clickable', { hasText: 'BareValue' }).first().click();
        await expect(async () => {
            expect(await page.locator('div#taxonomyFacet').innerHTML()).toContain('bareValue');
        }).toPass({ timeout: 10000 });
    });
});

// ---------------------------------------------------------------------------
// Miscellaneous
// ---------------------------------------------------------------------------

test.describe('Browse.tsx — miscellaneous', () => {
    test('Browse sets breadcrumbs on load', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('main')).toBeVisible();
    });

    test('hash-state pre-fills kingdom filter on direct navigation', async ({ page }) => {
        let kingdomFilterSeen = false;
        await setupMocks(page, async (p) => {
            await p.route(BIOCACHE_PATTERN, async (route) => {
                const url = new URL(route.request().url());
                const hasKingdom = url.searchParams.getAll('fq').some((f) => f.startsWith('kingdom:'));
                if (hasKingdom) kingdomFilterSeen = true;
                await route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify(hasKingdom ? phylumFacetResponse() : kingdomFacetResponse()),
                });
            });
        });

        await page.goto(BASE_URL + '/browse#kingdom=kingdom%3A%22Animalia%22');
        await page.waitForLoadState('networkidle');
        await expect(async () => { expect(kingdomFilterSeen).toBe(true); }).toPass({ timeout: 10000 });
    });

    test('window resize triggers layoutImages; unmounting Browse cleans up listener', async ({ page }) => {
        await setupMocks(page, setupDefaultMock);
        await page.goto(BASE_URL + '/browse');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('div.images-container .imgCon').first()).toBeVisible();

        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        await page.waitForTimeout(200);

        // Navigate away — exercises the removeEventListener cleanup.
        await page.goto(BASE_URL + '/');
        await expect(page.locator('text=Images of specimens from Australia')).toBeVisible();
    });
});
