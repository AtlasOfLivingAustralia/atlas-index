import { test, expect } from '../fixtures';
import { BASE_URL, DOI_BIOCACHE_UUID, SESSION_ANONYMOUS, SESSION_USER } from './helpers';
import { logMissingMocks } from '../mocks/logMissingMocks';
import { staticServerMocks } from '../mocks/staticServerMocks';
import { mockSession, mockDoiDetail, mockDoiDownload } from '../mocks/apiMocks';

// ---------------------------------------------------------------------------
// Doi.tsx — branches NOT covered by acceptance tests
//
// 1. entityUid empty (no pathname segment) → "No DOI found with ID"
// 2. Network error → red error message "Failed to load DOI information"
// 3. No providerMetadata.title → title span absent (no crash)
// 4. No data.doi → DOI link absent (no crash)
// 5. download() → download URL missing → alert("Download URL not found")
// 6. download() → request fails (non-200) → alert("Download failed")
// 7. defaultMetadata template: customLandingPageUrl present → landing page link shown
// 8. defaultMetadata template: fileSize present → formatted file size shown
// 9. defaultMetadata template: null applicationMetadata → no crash (renderMetadata(null))
// 10. Doi embedded in modal (doi prop provided) → no header/breadcrumb rendered
// ---------------------------------------------------------------------------

test.describe('Doi.tsx — empty entity UID', () => {
    test('shows "No DOI found" when path has no uuid', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        // DOI detail mock returns 404 for unknown uuids
        await mockDoiDetail(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await page.goto(`${BASE_URL}/doi/`);
        await page.waitForLoadState('networkidle');

        // entityUid will be '' after stripping /doi/ prefix
        await expect(page.locator('text=No DOI found with ID')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Doi.tsx — network error', () => {
    test('shows red error message on fetch failure', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        // Route the DOI endpoint to abort (network failure)
        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^?]+$/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.abort('failed');
        });
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await page.goto(`${BASE_URL}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Failed to load DOI information')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Doi.tsx — optional title and DOI fields', () => {
    test('DOI without providerMetadata.title renders without the title span', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        const noTitleDoi = {
            uuid: 'no-title-001', doi: '10.1/no-title', title: 'Raw Title',
            description: 'desc', active: true,
            displayTemplate: 'biocache', filename: 'file.zip',
            dateCreated: '2025-01-01T00:00:00Z', authorisedRoles: [],
            // providerMetadata intentionally absent
            applicationMetadata: { recordCount: 1, searchUrl: '', queryTitle: 'q', qualityFilters: [], datasets: [] },
            licence: ['CC BY 4.0'],
        };
        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^?]+$/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noTitleDoi) });
        });
        await mockDoiDownload(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_USER);

        await page.goto(`${BASE_URL}/doi/no-title-001`);
        await page.waitForLoadState('networkidle');

        // "Occurrence records download on" must NOT appear (providerMetadata.title missing)
        expect(await page.locator('text=Occurrence records download on').count()).toBe(0);
        // But the rest of the page must render
        await expect(page.locator('td', { hasText: 'Record count' })).toBeVisible();
    });

    test('DOI without doi field does not render the DOI link', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        const noDoi = {
            uuid: 'no-doi-001', title: 'No DOI Field',
            description: 'desc', active: true, displayTemplate: null, filename: null,
            dateCreated: '2025-01-01T00:00:00Z', authorisedRoles: [],
            applicationMetadata: null, licence: ['CC BY 4.0'],
            // doi field intentionally absent
        };
        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^?]+$/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noDoi) });
        });
        await mockDoiDownload(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await page.goto(`${BASE_URL}/doi/no-doi-001`);
        await page.waitForLoadState('networkidle');

        // The DOI: link block must not render
        expect(await page.locator('text=DOI:').count()).toBe(0);
    });
});

test.describe('Doi.tsx — download() error paths', () => {
    test('download URL missing → alert fires', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await mockDoiDetail(page, seenUrls);

        // Return 200 but with no url field in the response
        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^/]+\/download/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
        });
        await mockSession(page, seenUrls, SESSION_USER);

        const alerts: string[] = [];
        page.on('dialog', async (dialog) => { alerts.push(dialog.message()); await dialog.dismiss(); });

        await page.goto(`${BASE_URL}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        await page.locator('text=Download file').click();
        await page.waitForTimeout(500);

        expect(alerts).toContain('Download URL not found');
    });

    test('download request returns non-200 → "Download failed" alert fires', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await mockDoiDetail(page, seenUrls);

        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^/]+\/download/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 403, body: 'Forbidden' });
        });
        await mockSession(page, seenUrls, SESSION_USER);

        const alerts: string[] = [];
        page.on('dialog', async (dialog) => { alerts.push(dialog.message()); await dialog.dismiss(); });

        await page.goto(`${BASE_URL}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        await page.locator('text=Download file').click();
        await page.waitForTimeout(500);

        expect(alerts).toContain('Download failed');
    });
});

test.describe('Doi.tsx — defaultMetadata template branches', () => {
    test('customLandingPageUrl present → landing page link rendered', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        const doiWithLanding = {
            uuid: 'landing-001', doi: '10.1/landing', title: 'Custom Landing',
            description: 'Custom DOI', active: true, displayTemplate: null, filename: null,
            dateCreated: '2025-01-01T00:00:00Z', authorisedRoles: [],
            customLandingPageUrl: 'https://example.com/my-landing-page',
            applicationMetadata: null, licence: ['CC BY 4.0'],
        };
        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^?]+$/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doiWithLanding) });
        });
        await mockDoiDownload(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await page.goto(`${BASE_URL}/doi/landing-001`);
        await page.waitForLoadState('networkidle');

        // Exact match: the value cell text ("This DOI was registered with an
        // application-specific landing page...") also contains "landing page"
        // as a substring, which a non-exact match would collide with.
        await expect(page.getByRole('cell', { name: 'Landing page', exact: true })).toBeVisible();
        await expect(page.locator('a', { hasText: 'View the application landing page.' })).toBeVisible();
    });

    test('fileSize present → formatted size displayed', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        const doiWithSize = {
            uuid: 'size-001', doi: '10.1/size', title: 'Sized DOI',
            description: 'Has file size', active: true, displayTemplate: null, filename: null,
            dateCreated: '2025-01-01T00:00:00Z', authorisedRoles: [],
            fileSize: 1048576,   // 1 MiB
            applicationMetadata: null, licence: ['CC BY 4.0'],
        };
        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^?]+$/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doiWithSize) });
        });
        await mockDoiDownload(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await page.goto(`${BASE_URL}/doi/size-001`);
        await page.waitForLoadState('networkidle');

        // Exact match: the Description row's value is "Has file size", which
        // a non-exact substring match for "File Size" would also match.
        await expect(page.getByRole('cell', { name: 'File Size', exact: true })).toBeVisible();
        await expect(page.locator('td', { hasText: '1.00 MiB' })).toBeVisible();
    });

    test('null applicationMetadata in default template does not crash', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        const doiNullMeta = {
            uuid: 'null-meta-001', doi: '10.1/null-meta', title: 'Null Meta',
            description: 'No appMeta', active: true, displayTemplate: null, filename: null,
            dateCreated: '2025-01-01T00:00:00Z', authorisedRoles: [],
            applicationMetadata: null, licence: ['CC BY 4.0'],
        };
        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^?]+$/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doiNullMeta) });
        });
        await mockDoiDownload(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await page.goto(`${BASE_URL}/doi/null-meta-001`);
        await page.waitForLoadState('networkidle');

        // Additional row rendered with empty value (renderMetadata(null) → <></>)
        await expect(page.locator('td', { hasText: 'Additional' })).toBeVisible();
    });

    test('biocache template with dataProfile present shows quality filters', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        const doiWithProfile = {
            uuid: 'profile-001', doi: '10.1/profile', title: 'Profile DOI',
            description: 'With data profile', active: true, displayTemplate: 'biocache', filename: 'file.zip',
            dateCreated: '2025-01-01T00:00:00Z', authorisedRoles: [],
            providerMetadata: { title: 'Profile download' },
            applicationMetadata: {
                recordCount: 10,
                searchUrl: 'https://biocache.test.ala.org.au/occurrences/search?q=Acacia',
                queryTitle: 'Acacia query',
                dataProfile: 'ALA General',
                qualityFilters: [
                    { filter: 'hasCoordinate:true', description: 'Has coordinates' },
                    { filter: 'hasImage:true', description: '' },
                ],
                datasets: [],
            },
            licence: ['CC BY 4.0'],
        };
        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^?]+$/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doiWithProfile) });
        });
        await mockDoiDownload(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_USER);

        await page.goto(`${BASE_URL}/doi/profile-001`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('td', { hasText: 'Data profile' })).toBeVisible();
        await expect(page.locator('text=ALA General')).toBeVisible();
        // Quality filter descriptions rendered
        await expect(page.locator('text=Has coordinates')).toBeVisible();
        // Second filter uses filter key (description is empty string)
        await expect(page.locator('text=hasImage:true')).toBeVisible();
    });
});

test.describe('Doi.tsx — insufficient permissions, no searchUrl', () => {
    test('shows insufficient permissions WITHOUT search link when no searchUrl', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        const doiNoSearch = {
            uuid: 'no-search-001', doi: '10.1/no-search', title: 'No Search URL',
            description: 'Restricted, no search URL', active: true,
            displayTemplate: 'biocache', filename: 'file.zip',
            dateCreated: '2025-01-01T00:00:00Z', authorisedRoles: ['ROLE_SDS_ACT'],
            providerMetadata: { title: 'Restricted download' },
            applicationMetadata: {
                recordCount: 5,
                searchUrl: '',   // empty — no search link
                queryTitle: '', qualityFilters: [], datasets: [],
            },
            licence: ['CC BY 4.0'],
        };
        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^?]+$/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doiNoSearch) });
        });
        await mockDoiDownload(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_USER);

        await page.goto(`${BASE_URL}/doi/no-search-001`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Insufficient permissions to download this file')).toBeVisible();
        // No search link (searchUrl is empty)
        expect(await page.locator('text=Start a new search and download').count()).toBe(0);
    });
});

test.describe('Doi.tsx — "file not available", no searchUrl', () => {
    test('shows "This file is no longer available" WITHOUT search link when no searchUrl', async ({ page }) => {
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        const doiNoFile = {
            uuid: 'no-file-no-search-001', doi: '10.1/no-file-no-search', title: 'No file, no search',
            description: 'No file available', active: true, displayTemplate: null,
            filename: null,  // no file
            dateCreated: '2025-01-01T00:00:00Z', authorisedRoles: [],
            applicationMetadata: { recordCount: 0, searchUrl: '', qualityFilters: [], datasets: [] },
            licence: ['CC BY 4.0'],
        };
        await page.route(/http:\/\/localhost:8081\/v1\/doi\/[^?]+$/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doiNoFile) });
        });
        await mockDoiDownload(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_USER);

        await page.goto(`${BASE_URL}/doi/no-file-no-search-001`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=This file is no longer available')).toBeVisible();
        expect(await page.locator('text=Start a new search and download').count()).toBe(0);
    });
});
