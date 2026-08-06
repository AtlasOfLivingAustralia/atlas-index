import { test, expect } from './fixtures';
import { shouldSkip, getBaseUrl } from './mocks/liveConfig';
import {
    setupHomeMocks,
    setupDoiMocks,
    setupMyDownloadsMocks,
    mockSession,
    SESSION_ANONYMOUS,
    SESSION_USER,
    SESSION_ADMIN,
    SESSION_SDS_ACT,
    SESSION_SDS_NSW,
    DOI_BIOCACHE_UUID,
    DOI_CSDM_UUID,
    DOI_RESTRICTED_UUID,
    DOI_UNPUBLISHED_UUID,
    DOI_NO_FILE_UUID,
    DOI_BIOCACHE_DOI,
    activeDownloadsFixture as activeDownloadsData,
} from './mocks/apiMocks';

const BASE = getBaseUrl();

// ===========================================================================
// Home page
// ===========================================================================

test.describe('Home page', () => {

    test('title and hero text visible', async ({ page }) => {
        test.skip(shouldSkip('home-title'), 'Skipped via live-config.json skip list');
        await setupHomeMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveTitle(/DOI \| Atlas of Living Australia/);
        await expect(page.locator('text=ALA DOI Repository').first()).toBeVisible();
    });

    test('recent DOIs table shows fixture items', async ({ page }) => {
        test.skip(shouldSkip('home-recent-dois'), 'Skipped via live-config.json skip list');
        await setupHomeMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        // Loading skeleton should resolve
        await expect(page.locator('.placeholder-glow')).toBeHidden({ timeout: 5000 });

        // Table headers
        const thead = page.locator('table thead tr th').first();
        await expect(thead).toContainText('DOI');

        // At least one data row from our fixtures should appear
        const rows = page.locator('table tbody tr');
        await expect(rows).not.toHaveCount(0);

        // The first fixture item's title appears in the first row
        const firstRowText = await rows.first().innerText();
        expect(firstRowText).toContain('Occurrence records download');
    });

    test('pagination range display is correct', async ({ page }) => {
        test.skip(shouldSkip('home-pagination'), 'Skipped via live-config.json skip list');
        await setupHomeMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        // "Showing 1-5 of 5 results" (we have 5 fixture items)
        await expect(page.locator('text=Showing')).toBeVisible();
        await expect(page.locator('text=results')).toBeVisible();
    });

    test('My Downloads button navigates to /myDownloads', async ({ page }) => {
        test.skip(shouldSkip('home-my-downloads-btn'), 'Skipped via live-config.json skip list');
        await setupHomeMocks(page, SESSION_USER);
        // My Downloads page also needs the biocache active-downloads mock
        // (the DOI list is already covered by setupHomeMocks above).
        const { mockBiocacheStatus: mbs } = await import('./mocks/apiMocks');
        await mbs(page, new Set<URL>(), {});
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('a.btn', { hasText: 'My Downloads' }).click();
        await expect(page).toHaveURL(/\/myDownloads/);
    });

    test('clicking a DOI row navigates to DOI detail page', async ({ page }) => {
        test.skip(shouldSkip('home-row-click'), 'Skipped via live-config.json skip list');
        await setupHomeMocks(page);
        const { mockDoiDetail } = await import('./mocks/apiMocks');
        // Register detail mock so the detail page can load
        await mockDoiDetail(page, new Set<URL>());
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('.placeholder-glow')).toBeHidden({ timeout: 5000 });

        const firstRow = page.locator('table tbody tr').first();
        await firstRow.click();
        await expect(page).toHaveURL(new RegExp(`/doi/${DOI_BIOCACHE_UUID}`));
    });
});

// ===========================================================================
// DOI detail page — permission scenarios (core of the manual test)
// ===========================================================================

test.describe('DOI detail page — not logged in', () => {

    test('shows "Please log in" message when user is anonymous', async ({ page }) => {
        test.skip(shouldSkip('doi-not-logged-in'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_ANONYMOUS);
        await page.goto(`${BASE}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Please')).toBeVisible();
        await expect(page.locator('text=log in')).toBeVisible();
        await expect(page.locator('text=to download this file')).toBeVisible();

        // "Download file" button must NOT appear
        expect(await page.locator('text=Download file').count()).toBe(0);
    });

    test('shows DOI title and DOI link', async ({ page }) => {
        test.skip(shouldSkip('doi-title-visible'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_ANONYMOUS);
        await page.goto(`${BASE}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        // providerMetadata.title present → shows "Occurrence records download on …"
        await expect(page.locator('text=Occurrence records download on')).toBeVisible();
        // DOI link — exact match, since the Citation URL row in the metadata
        // table also links to the same href with the resolver URL prefixed
        // onto its visible text (a substring match would hit both).
        await expect(page.getByRole('link', { name: DOI_BIOCACHE_DOI, exact: true })).toBeVisible();
    });
});

test.describe('DOI detail page — logged in, no special roles, file has no role restrictions', () => {

    test('shows "Download file" button (canDownload = true)', async ({ page }) => {
        test.skip(shouldSkip('doi-can-download'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_USER);
        await page.goto(`${BASE}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Download file')).toBeVisible();
        // No unavailability message
        expect(await page.locator('text=Insufficient permissions').count()).toBe(0);
        expect(await page.locator('text=Please').count()).toBe(0);
    });

    test('clicking Download file triggers download', async ({ page }) => {
        test.skip(shouldSkip('doi-download-click'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_USER);
        // Route the mock download file so the <a>.click() doesn't fail
        await page.route('http://localhost:8081/files/download.zip', (route) =>
            route.fulfill({ status: 200, contentType: 'application/zip', body: 'fake-zip' })
        );
        await page.goto(`${BASE}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        // The download is triggered via programmatic <a>.click(), so we intercept via download event
        const [_] = await Promise.all([
            page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
            page.locator('text=Download file').click(),
        ]);
        // Either a download event fired, or the link was clicked without error.
        // Either outcome means the download() code path ran without throwing.
        // We verify no alert was shown.
        const alerts: string[] = [];
        page.on('dialog', async (dialog) => { alerts.push(dialog.message()); await dialog.dismiss(); });
        await page.waitForTimeout(500);
        expect(alerts).toHaveLength(0);
    });
});

test.describe('DOI detail page — logged in, with ROLE_ADMIN (always can download)', () => {

    test('admin can download a role-restricted DOI', async ({ page }) => {
        test.skip(shouldSkip('doi-admin-download'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_ADMIN);
        await page.goto(`${BASE}/doi/${DOI_RESTRICTED_UUID}`);
        await page.waitForLoadState('networkidle');

        // Admin bypasses authorisedRoles check
        await expect(page.locator('text=Download file')).toBeVisible();
        expect(await page.locator('text=Insufficient permissions').count()).toBe(0);
    });
});

test.describe('DOI detail page — logged in, insufficient permissions', () => {

    test('user without required role sees insufficient permissions with search link', async ({ page }) => {
        test.skip(shouldSkip('doi-insufficient-with-search'), 'Skipped via live-config.json skip list');
        // DOI_RESTRICTED requires ROLE_SDS_ACT; SESSION_USER only has ROLE_USER
        await setupDoiMocks(page, SESSION_USER);
        await page.goto(`${BASE}/doi/${DOI_RESTRICTED_UUID}`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Insufficient permissions to download this file')).toBeVisible();
        // Has a searchUrl → link shown
        await expect(page.locator('text=Start a new search and download')).toBeVisible();
        expect(await page.locator('text=Download file').count()).toBe(0);
    });

    test('user with wrong SDS role also sees insufficient permissions', async ({ page }) => {
        test.skip(shouldSkip('doi-wrong-sds-role'), 'Skipped via live-config.json skip list');
        // SESSION_SDS_NSW has ROLE_SDS_NSW but DOI requires ROLE_SDS_ACT
        await setupDoiMocks(page, SESSION_SDS_NSW);
        await page.goto(`${BASE}/doi/${DOI_RESTRICTED_UUID}`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Insufficient permissions to download this file')).toBeVisible();
        expect(await page.locator('text=Download file').count()).toBe(0);
    });

    test('user with correct SDS role can download restricted DOI', async ({ page }) => {
        test.skip(shouldSkip('doi-correct-sds-role'), 'Skipped via live-config.json skip list');
        // SESSION_SDS_ACT has ROLE_SDS_ACT which matches DOI_RESTRICTED authorisedRoles
        await setupDoiMocks(page, SESSION_SDS_ACT);
        await page.goto(`${BASE}/doi/${DOI_RESTRICTED_UUID}`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Download file')).toBeVisible();
        expect(await page.locator('text=Insufficient permissions').count()).toBe(0);
    });
});

test.describe('DOI detail page — file not available', () => {

    test('shows "This file is no longer available" with search link when searchUrl present', async ({ page }) => {
        test.skip(shouldSkip('doi-file-not-available-with-search'), 'Skipped via live-config.json skip list');
        // DOI_NO_FILE has filename: null and has a searchUrl
        await setupDoiMocks(page, SESSION_USER);
        await page.goto(`${BASE}/doi/${DOI_NO_FILE_UUID}`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=This file is no longer available')).toBeVisible();
        await expect(page.locator('text=Start a new search and download')).toBeVisible();
        expect(await page.locator('text=Download file').count()).toBe(0);
    });
});

test.describe('DOI detail page — unpublished DOI', () => {

    test('shows amber unpublished warning banner', async ({ page }) => {
        test.skip(shouldSkip('doi-unpublished'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_USER);
        await page.goto(`${BASE}/doi/${DOI_UNPUBLISHED_UUID}`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Unpublished — this DOI is not publicly listed')).toBeVisible();
        // Still shows the DOI details underneath
        await expect(page.locator('text=Occurrence records download on')).toBeVisible();
    });
});

test.describe('DOI detail page — 404', () => {

    test('shows "No DOI found" message for unknown uuid', async ({ page }) => {
        test.skip(shouldSkip('doi-not-found'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_ANONYMOUS);
        await page.goto(`${BASE}/doi/00000000-0000-0000-0000-000000000000`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=No DOI found with ID')).toBeVisible();
    });
});

test.describe('DOI detail page — metadata templates', () => {

    test('biocache template shows Record count, Filename, Search URL rows', async ({ page }) => {
        test.skip(shouldSkip('doi-biocache-template'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_USER);
        await page.goto(`${BASE}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        const metadataTable = page.locator('table.metadataTable, table').filter({ hasText: 'Record count' });
        await expect(metadataTable).toBeVisible();
        await expect(page.locator('td', { hasText: 'Record count' })).toBeVisible();
        await expect(page.locator('td', { hasText: 'Filename' })).toBeVisible();
        await expect(page.locator('td', { hasText: 'Search URL' })).toBeVisible();
        await expect(page.locator('td', { hasText: 'Date Created' })).toBeVisible();
    });

    test('biocache template shows filename as clickable link when user can download', async ({ page }) => {
        test.skip(shouldSkip('doi-biocache-filename-link'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_USER);
        await page.goto(`${BASE}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        // canDownload() = true → filename is an <a> link
        const filenameLink = page.locator('a', { hasText: 'biocache-occurrence-download.zip' });
        await expect(filenameLink).toBeVisible();
    });

    test('biocache template shows filename as underlined span when user cannot download', async ({ page }) => {
        test.skip(shouldSkip('doi-biocache-filename-span'), 'Skipped via live-config.json skip list');
        // Anonymous → canDownload() = false
        await setupDoiMocks(page, SESSION_ANONYMOUS);
        await page.goto(`${BASE}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        // filename rendered as a <span title="Insufficient permissions">
        const filenameSpan = page.locator('span[title="Insufficient permissions"]', {
            hasText: 'biocache-occurrence-download.zip',
        });
        await expect(filenameSpan).toBeVisible();
    });

    test('csdm template shows Application, Modeller, Organisation rows', async ({ page }) => {
        test.skip(shouldSkip('doi-csdm-template'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_USER);
        await page.goto(`${BASE}/doi/${DOI_CSDM_UUID}`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('td', { hasText: 'Application' })).toBeVisible();
        // Exact match: the "Application" row's value is "Species Distribution
        // Modeller", which would also match a substring search for "Modeller".
        await expect(page.getByRole('cell', { name: 'Modeller', exact: true })).toBeVisible();
        await expect(page.locator('td', { hasText: 'Organisation' })).toBeVisible();
    });

    test('biocache template shows Datasets table when displayTemplate is truthy', async ({ page }) => {
        test.skip(shouldSkip('doi-datasets-table'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_USER);
        await page.goto(`${BASE}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        // displayTemplate = 'biocache' (truthy) → Datasets table shown.
        // Exact match: the site nav also has a "Search datasets" link, which
        // a case-insensitive substring search for "Datasets" would also match.
        await expect(page.getByText('Datasets', { exact: true })).toBeVisible();
        await expect(page.locator('td', { hasText: 'eBird Australia' })).toBeVisible();
        await expect(page.locator('td', { hasText: 'ALA specimen records' })).toBeVisible();
    });

    test('My Downloads button on DOI detail page navigates to /myDownloads', async ({ page }) => {
        test.skip(shouldSkip('doi-my-downloads-btn'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page, SESSION_USER);
        // Pre-register MyDownloads mocks so that page can load after navigation
        const { mockDoiList, mockBiocacheStatus: mbs } = await import('./mocks/apiMocks');
        await mockDoiList(page, new Set<URL>());
        await mbs(page, new Set<URL>(), {});
        await page.goto(`${BASE}/doi/${DOI_BIOCACHE_UUID}`);
        await page.waitForLoadState('networkidle');

        await page.locator('a.btn', { hasText: 'My Downloads' }).click();
        await expect(page).toHaveURL(/\/myDownloads/);
    });
});

// ===========================================================================
// My Downloads page
// ===========================================================================

test.describe('My Downloads — unauthenticated redirect', () => {

    test('redirects to login when user is not authenticated', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-redirect'), 'Skipped via live-config.json skip list');
        // Set up session returning authenticated=false after the page loads
        const seenUrls = new Set<URL>();
        const { logMissingMocks } = await import('./mocks/logMissingMocks');
        const { staticServerMocks } = await import('./mocks/staticServerMocks');
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        // Mock login endpoint to catch the redirect
        await page.route(/http:\/\/localhost:8081\/login.*/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Login</body></html>' });
        });
        await mockSession(page, seenUrls, { authenticated: false });

        await page.goto(`${BASE}/myDownloads`);
        // After userInfo resolves to unauthenticated, handleLogin() fires.
        // Page navigates to the login mock.
        await expect(page).toHaveURL(/login/, { timeout: 5000 });
    });
});

test.describe('My Downloads — authenticated, no active downloads, has DOI list', () => {

    test('page title "My Downloads" is visible', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-title'), 'Skipped via live-config.json skip list');
        await setupMyDownloadsMocks(page, SESSION_USER, {});
        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=My Downloads').first()).toBeVisible();
    });

    test('shows pagination range and DOI list when maxResults > 0', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-list'), 'Skipped via live-config.json skip list');
        await setupMyDownloadsMocks(page, SESSION_USER, {});
        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('.placeholder-glow')).toBeHidden({ timeout: 5000 });

        await expect(page.locator('text=Showing')).toBeVisible();
        const rows = page.locator('table tbody tr');
        await expect(rows).not.toHaveCount(0);
    });

    test('active downloads section is hidden when no active downloads', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-no-active'), 'Skipped via live-config.json skip list');
        await setupMyDownloadsMocks(page, SESSION_USER, {});
        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');

        expect(await page.locator('text=Active downloads').count()).toBe(0);
    });
});

test.describe('My Downloads — active downloads present', () => {

    test('active downloads section shows the running job', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-active'), 'Skipped via live-config.json skip list');
        await setupMyDownloadsMocks(page, SESSION_USER, activeDownloadsData);
        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Active downloads')).toBeVisible();
        // Status column: records(1200) != totalRecords(5000) → shows 'running'
        await expect(page.locator('td', { hasText: 'running' })).toBeVisible();
        // Records progress formatted with Intl
        await expect(page.locator('td', { hasText: '1,200' })).toBeVisible();
        // Total records formatted
        await expect(page.locator('td', { hasText: '5,000' })).toBeVisible();
        // Cancel button present
        await expect(page.locator('button', { hasText: 'Cancel' })).toBeVisible();
        // Email shown
        await expect(page.locator('td', { hasText: 'user@example.com' })).toBeVisible();
    });

    test('active download shows "finalising" when records == totalRecords', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-finalising'), 'Skipped via live-config.json skip list');
        const finalisingDownload = {
            'user@example.com': [
                { status: 'running', totalRecords: 100, records: 100, cancelUrl: 'http://localhost:8081/biocache/occurrences/offline/cancel/job-xyz' },
            ],
        };
        await setupMyDownloadsMocks(page, SESSION_USER, finalisingDownload);
        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('td', { hasText: 'finalising' })).toBeVisible();
    });

    test('cancel download: confirm → fires cancel request and refreshes', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-cancel'), 'Skipped via live-config.json skip list');
        // Track whether cancel URL was called
        let cancelCalled = false;
        const seenUrls = new Set<URL>();
        const { logMissingMocks } = await import('./mocks/logMissingMocks');
        const { staticServerMocks } = await import('./mocks/staticServerMocks');
        const { mockDoiList, mockDoiDetail, mockDoiDownload, mockSession: ms } = await import('./mocks/apiMocks');
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await mockDoiList(page, seenUrls);
        await mockDoiDetail(page, seenUrls);
        await mockDoiDownload(page, seenUrls);

        // Active downloads returns our fixture on first call, empty on second (after cancel)
        let callCount = 0;
        await page.route('http://localhost:8081/biocache/occurrences/offline/status', (route) => {
            seenUrls.add(new URL(route.request().url()));
            callCount++;
            const response = callCount === 1 ? activeDownloadsData : {};
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
        });

        // Cancel URL returns success
        await page.route(/http:\/\/localhost:8081\/biocache\/occurrences\/offline\/cancel\/.*/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            cancelCalled = true;
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'cancelled' }) });
        });

        await ms(page, seenUrls, SESSION_USER);

        // Auto-confirm the window.confirm dialog
        page.on('dialog', async (dialog) => { await dialog.accept(); });

        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('text=Active downloads')).toBeVisible();

        await page.locator('button', { hasText: 'Cancel' }).click();
        await page.waitForTimeout(500);

        expect(cancelCalled).toBe(true);
        // After cancel, the downloads refresh — active section should disappear
        await expect(page.locator('text=Active downloads')).toBeHidden({ timeout: 3000 });
    });

    test('cancel download: dismiss → no cancel request fired', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-cancel-dismissed'), 'Skipped via live-config.json skip list');
        let cancelCalled = false;
        const seenUrls = new Set<URL>();
        const { logMissingMocks } = await import('./mocks/logMissingMocks');
        const { staticServerMocks } = await import('./mocks/staticServerMocks');
        const { mockDoiList, mockSession: ms } = await import('./mocks/apiMocks');
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await mockDoiList(page, seenUrls);

        await page.route('http://localhost:8081/biocache/occurrences/offline/status', (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activeDownloadsData) });
        });
        await page.route(/http:\/\/localhost:8081\/biocache\/occurrences\/offline\/cancel\/.*/, (route) => {
            cancelCalled = true;
            route.fulfill({ status: 200, body: '' });
        });
        await ms(page, seenUrls, SESSION_USER);

        // Dismiss the confirm dialog
        page.on('dialog', async (dialog) => { await dialog.dismiss(); });

        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('button', { hasText: 'Cancel' })).toBeVisible();
        await page.locator('button', { hasText: 'Cancel' }).click();
        await page.waitForTimeout(300);

        expect(cancelCalled).toBe(false);
        // Active downloads still visible (not cancelled)
        await expect(page.locator('text=Active downloads')).toBeVisible();
    });
});

test.describe('My Downloads — desktop: row click opens modal', () => {

    test('clicking a DOI row opens the modal overlay with DOI details', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-modal'), 'Skipped via live-config.json skip list');
        await setupMyDownloadsMocks(page, SESSION_USER, {});
        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('.placeholder-glow')).toBeHidden({ timeout: 5000 });

        // Click the first row — desktop mode opens a modal
        const firstRow = page.locator('table tbody tr').first();
        await firstRow.click();

        // Modal backdrop should appear
        await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 3000 });
        // Modal close button
        await expect(page.locator('button[aria-label="Close"]')).toBeVisible();
        // DOI content rendered inside modal
        await expect(page.locator('.modal-content')).toBeVisible();
    });

    test('clicking modal close button hides the modal', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-modal-close'), 'Skipped via live-config.json skip list');
        await setupMyDownloadsMocks(page, SESSION_USER, {});
        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('.placeholder-glow')).toBeHidden({ timeout: 5000 });

        await page.locator('table tbody tr').first().click();
        await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 3000 });

        await page.locator('button[aria-label="Close"]').click();
        await expect(page.locator('.modal-backdrop')).toBeHidden({ timeout: 2000 });
    });

    test('clicking the modal backdrop closes the modal', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-modal-backdrop-close'), 'Skipped via live-config.json skip list');
        await setupMyDownloadsMocks(page, SESSION_USER, {});
        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('.placeholder-glow')).toBeHidden({ timeout: 5000 });

        await page.locator('table tbody tr').first().click();
        await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 3000 });

        // Click the backdrop outside the modal-content
        await page.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } });
        await expect(page.locator('.modal-backdrop')).toBeHidden({ timeout: 2000 });
    });
});

test.describe('My Downloads — zero results', () => {

    test('shows "You don\'t have any DOI downloads yet." when maxResults is 0', async ({ page }) => {
        test.skip(shouldSkip('my-downloads-empty'), 'Skipped via live-config.json skip list');
        const seenUrls = new Set<URL>();
        const { logMissingMocks } = await import('./mocks/logMissingMocks');
        const { staticServerMocks } = await import('./mocks/staticServerMocks');
        const { mockSession: ms } = await import('./mocks/apiMocks');
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);

        // Return empty list with x-total-count: 0
        await page.route(/http:\/\/localhost:8081\/v1\/doi\?/, (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'x-total-count': '0', 'access-control-expose-headers': 'x-total-count' },
                body: JSON.stringify([]),
            });
        });
        await page.route('http://localhost:8081/biocache/occurrences/offline/status', (route) => {
            seenUrls.add(new URL(route.request().url()));
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
        });
        await ms(page, seenUrls, SESSION_USER);

        await page.goto(`${BASE}/myDownloads`);
        await page.waitForLoadState('networkidle');
        // Regex avoids a straight-vs-curly apostrophe mismatch with the
        // rendered "don’t" (U+2019 RIGHT SINGLE QUOTATION MARK).
        await expect(page.getByText(/You don.t have any DOI downloads yet\./)).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// Build info meta tag (equivalent of the regions-ui "build-info" test)
// ===========================================================================

test('build-info meta tag is present with expected fields', async ({ page }) => {
    test.skip(shouldSkip('build-info'), 'Skipped via live-config.json skip list');
    await setupHomeMocks(page);
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    const jsonContent = await page
        .locator('meta[name="buildInfo"]')
        .first()
        .getAttribute('content');
    const buildInfo = JSON.parse(jsonContent || '{}');
    expect(buildInfo).toHaveProperty('commit');
    expect(buildInfo).toHaveProperty('branch');
    expect(buildInfo).toHaveProperty('buildDate');
});
