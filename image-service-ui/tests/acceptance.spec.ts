import {test, expect} from './fixtures';
import {shouldSkip, getBaseUrl} from './mocks/liveConfig';
import {
    SESSION_ANONYMOUS,
    SESSION_USER,
    SESSION_IMAGE_ADMIN,
    SESSION_ADMIN,
    setupSearchMocks,
    setupImageDetailMocks,
    setupAdminDashboardMocks,
    setupBatchStatusMocks,
    setupTagsMocks,
    setupUploadMocks,
    mockSession,
    mockSearch,
    mockSearchFacets,
    mockSearchCriteria,
    searchResultFixture
} from './mocks/imageServiceMocks';
import {logMissingMocks} from './mocks/logMissingMocks';
import {staticServerMocks} from './mocks/staticServerMocks';

const BASE = getBaseUrl();

// Test-local, minimal, neutral search-result data for the handful of tests that need to assert
// on rendered result cards/facets/download availability. This is intentionally NOT part of the
// shared default fixtures (which are empty by default, see searchResultFixture) so that no other
// test in the suite is accidentally exposed to sample "image" content it didn't ask for.
const ONE_IMAGE_SEARCH_RESULT = {
    results: [
        {
            imageId: 'img-test-1',
            title: 'Test image 1',
            mimeType: 'image/jpeg',
            thumbnailUrl: 'http://localhost:8081/image/proxyImageThumbnail?imageId=img-test-1',
            isImage: true,
            isAudio: false,
            isDocument: false
        }
    ],
    totalRecords: 1,
    pageSize: 24,
    startIndex: 0
};
const ONE_IMAGE_SEARCH_FACETS = [
    {name: 'mimeType', label: 'Type', values: [{value: 'image/jpeg', label: 'image/jpeg', count: 1}]}
];

// ===========================================================================
// Public search
// ===========================================================================

test.describe('Public search', () => {
    test('renders search results from an explicit test-local result', async ({page}) => {
        test.skip(shouldSkip('search-results'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupSearchMocks(page);
        await mockSearch(page, seenUrls, ONE_IMAGE_SEARCH_RESULT);
        await mockSearchFacets(page, seenUrls, ONE_IMAGE_SEARCH_FACETS);

        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="result-count"]')).toContainText('1 image found');
        await expect(page.locator('[data-testid="thumbnail-card"]')).toHaveCount(1);
        await expect(page.locator('[data-testid="facet-panel"]')).toBeVisible();
    });

    test('shows an empty state when there are no results, with no images or fixture data rendered', async ({page}) => {
        test.skip(shouldSkip('search-empty'), 'Skipped via live-config.json skip list');
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);
        // searchResultFixture/[] are already the genuine empty defaults; passed explicitly
        // here for clarity that this test intentionally exercises the empty-result path.
        await mockSearch(page, seenUrls, searchResultFixture);
        await mockSearchFacets(page, seenUrls, []);
        await mockSearchCriteria(page, seenUrls);

        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="no-results"]')).toBeVisible();
        await expect(page.locator('[data-testid="result-count"]')).toContainText('0 images found');
        // A genuinely empty backend response must never fall back to rendering
        // any fixture/demo thumbnails — there should be zero result cards.
        await expect(page.locator('[data-testid="thumbnail-card"]')).toHaveCount(0);
    });

    test('advanced search panel shows the existing image-service public fields', async ({page}) => {
        test.skip(shouldSkip('search-advanced-criteria'), 'Skipped via live-config.json skip list');
        // The unchanged image-service does not expose these definitions as a
        // public API, so the UI mirrors the fields offered by its legacy page.
        await setupSearchMocks(page);

        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('[data-testid="toggle-advanced-criteria"]').click();

        await expect(page.locator('option', {hasText: 'Image alternateFilename'})).toBeAttached();
        await expect(page.locator('option', {hasText: 'Image dataResourceUid'})).toBeAttached();
    });

    test('does not show the authenticated ZIP download button when logged out', async ({page}) => {
        test.skip(shouldSkip('search-download-gated'), 'Skipped via live-config.json skip list');
        await setupSearchMocks(page, SESSION_ANONYMOUS);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="download-zip"]')).toHaveCount(0);
    });

    test('shows the authenticated ZIP download button when logged in', async ({page}) => {
        test.skip(shouldSkip('search-download-visible'), 'Skipped via live-config.json skip list');
        // The download button is only rendered when a non-empty result is present
        // (canDownload requires result.totalRecords > 0), so this test must supply
        // its own explicit non-empty result rather than relying on the (empty) default.
        const seenUrls = await setupSearchMocks(page, SESSION_USER);
        await mockSearch(page, seenUrls, ONE_IMAGE_SEARCH_RESULT);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="download-zip"]')).toBeVisible();
    });
});

// ===========================================================================
// Image / media detail
// ===========================================================================

test.describe('Image detail', () => {
    test('renders metadata tabs and tags for anonymous users without edit controls', async ({page}) => {
        test.skip(shouldSkip('detail-anonymous'), 'Skipped via live-config.json skip list');
        await setupImageDetailMocks(page, SESSION_ANONYMOUS);

        await page.goto(`${BASE}/image/img-test-1`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="tag-list"]')).toContainText('TestTag');
        await expect(page.locator('[data-testid="add-tag-input"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="delete-image"]')).toHaveCount(0);
    });

    test('shows authenticated edit controls (delete) when logged in, but not tag creation (admin-only)', async ({page}) => {
        test.skip(shouldSkip('detail-authenticated'), 'Skipped via live-config.json skip list');
        await setupImageDetailMocks(page, SESSION_USER);

        await page.goto(`${BASE}/image/img-test-1`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="delete-image"]')).toBeVisible();
        // Creating a new tag requires the admin-gated POST /api/v2/admin/tags
        // endpoint, so a plain authenticated (non-admin) user should not see it.
        await expect(page.locator('[data-testid="add-tag-input"]')).toHaveCount(0);
    });

    test('shows the add-tag form and admin actions for an admin user', async ({page}) => {
        test.skip(shouldSkip('detail-admin'), 'Skipped via live-config.json skip list');
        await setupImageDetailMocks(page, SESSION_ADMIN);

        await page.goto(`${BASE}/image/img-test-1`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="add-tag-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="delete-image"]')).toBeVisible();
        await expect(page.locator('[data-testid="regenerate-derivatives"]')).toBeVisible();
    });

    test('legacy /image/view/:imageId route redirects to /image/:imageId', async ({page}) => {
        test.skip(shouldSkip('detail-legacy-redirect'), 'Skipped via live-config.json skip list');
        await setupImageDetailMocks(page, SESSION_ANONYMOUS);

        await page.goto(`${BASE}/image/view/img-test-1`);
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveURL(/\/image\/img-test-1$/);
    });
});

// ===========================================================================
// Admin access control
// ===========================================================================

test.describe('Admin access control', () => {
    test('shows "Admin login required" when the user is not logged in', async ({page}) => {
        test.skip(shouldSkip('auth-not-logged-in'), 'Skipped via live-config.json skip list');
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await page.goto(`${BASE}/admin`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="admin-gate"]')).toContainText('Admin login required');
    });

    test('shows "Insufficient permissions" when logged in without an admin role', async ({page}) => {
        test.skip(shouldSkip('auth-insufficient-permissions'), 'Skipped via live-config.json skip list');
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_USER);

        await page.goto(`${BASE}/admin`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="admin-gate"]')).toContainText('Insufficient permissions.');
    });

    test('renders the admin dashboard for a user with ROLE_ADMIN', async ({page}) => {
        test.skip(shouldSkip('auth-admin-ok'), 'Skipped via live-config.json skip list');
        await setupAdminDashboardMocks(page, SESSION_ADMIN);

        await page.goto(`${BASE}/admin`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    });

    test('renders the admin dashboard for a user with ROLE_IMAGE_ADMIN', async ({page}) => {
        test.skip(shouldSkip('auth-image-admin-ok'), 'Skipped via live-config.json skip list');
        await setupAdminDashboardMocks(page, SESSION_IMAGE_ADMIN);

        await page.goto(`${BASE}/admin`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    });
});

// ===========================================================================
// Admin dashboard content + menu navigation
// ===========================================================================

test.describe('Admin dashboard', () => {
    test('displays repository stats and queue depths from fixtures', async ({page}) => {
        test.skip(shouldSkip('dashboard-stats'), 'Skipped via live-config.json skip list');
        await setupAdminDashboardMocks(page);

        await page.goto(`${BASE}/admin`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=125,430')).toBeVisible();
        await expect(page.locator('text=thumbnail-generation')).toBeVisible();
    });

    test('menu links to every admin section are present', async ({page}) => {
        test.skip(shouldSkip('dashboard-menu'), 'Skipped via live-config.json skip list');
        await setupAdminDashboardMocks(page);

        await page.goto(`${BASE}/admin`);
        await page.waitForLoadState('networkidle');

        for (const label of ['Dashboard', 'Upload', 'Batch status', 'Search criteria', 'Raw index search', 'Tags', 'Storage locations', 'Licences', 'Duplicates', 'Analytics', 'Settings', 'Tools', 'Swagger']) {
            await expect(page.locator('a.menu-link', {hasText: label})).toBeVisible();
        }
    });

    test('Swagger page loads the mocked OpenAPI spec', async ({page}) => {
        test.skip(shouldSkip('menu-swagger'), 'Skipped via live-config.json skip list');
        const seenUrls = await setupAdminDashboardMocks(page);
        const {mockSwagger} = await import('./mocks/imageServiceMocks');
        await mockSwagger(page, seenUrls);

        await page.goto(`${BASE}/admin/swagger`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Mock Service API')).toBeVisible({timeout: 5000});
    });
});

// ===========================================================================
// Batch upload queue (destructive admin actions)
// ===========================================================================

test.describe('Batch upload queue', () => {
    test('lists queued/failed files and reflects the active/queued counts', async ({page}) => {
        test.skip(shouldSkip('batch-list'), 'Skipped via live-config.json skip list');
        await setupBatchStatusMocks(page);

        await page.goto(`${BASE}/admin/batches`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="admin-batch-status"]')).toContainText('file-001');
        await expect(page.locator('[data-testid="admin-batch-status"]')).toContainText('file-002');
        await expect(page.locator('[data-testid="admin-batch-status"]')).toContainText('Unsupported file format');
    });

    test('deleting a file from the queue removes it from the list', async ({page}) => {
        test.skip(shouldSkip('batch-delete-file'), 'Skipped via live-config.json skip list');
        await setupBatchStatusMocks(page);

        await page.goto(`${BASE}/admin/batches`);
        await page.waitForLoadState('networkidle');

        page.once('dialog', dialog => dialog.accept());
        await page.locator('[data-testid="delete-file-002"]').click();

        await expect(page.locator('text=file-002')).toHaveCount(0, {timeout: 5000});
    });

    test('reloading a failed file clears its error and re-queues it', async ({page}) => {
        test.skip(shouldSkip('batch-reload-file'), 'Skipped via live-config.json skip list');
        await setupBatchStatusMocks(page);

        await page.goto(`${BASE}/admin/batches`);
        await page.waitForLoadState('networkidle');

        await page.locator('[data-testid="reload-file-002"]').click();

        await expect(page.locator('text=Unsupported file format')).toHaveCount(0, {timeout: 5000});
    });

    test('clearing the file queue removes queued files', async ({page}) => {
        test.skip(shouldSkip('batch-clear-queue'), 'Skipped via live-config.json skip list');
        await setupBatchStatusMocks(page);

        await page.goto(`${BASE}/admin/batches`);
        await page.waitForLoadState('networkidle');

        page.once('dialog', dialog => dialog.accept());
        await page.locator('[data-testid="clear-file-queue"]').click();

        await expect(page.locator('text=file-001')).toHaveCount(0, {timeout: 5000});
    });

    test('clearing all uploads empties the list', async ({page}) => {
        test.skip(shouldSkip('batch-clear-uploads'), 'Skipped via live-config.json skip list');
        await setupBatchStatusMocks(page);

        await page.goto(`${BASE}/admin/batches`);
        await page.waitForLoadState('networkidle');

        page.once('dialog', dialog => dialog.accept());
        await page.locator('[data-testid="clear-uploads"]').click();

        await expect(page.locator('text=No batch upload files found.')).toBeVisible({timeout: 5000});
    });

    test('toggling batch processing sends the new state', async ({page}) => {
        test.skip(shouldSkip('batch-toggle-processing'), 'Skipped via live-config.json skip list');
        await setupBatchStatusMocks(page);

        await page.goto(`${BASE}/admin/batches`);
        await page.waitForLoadState('networkidle');

        const toggle = page.locator('[data-testid="toggle-processing"]');
        await expect(toggle).toBeChecked();
        await toggle.uncheck();
        await expect(toggle).not.toBeChecked();
    });
});

// ===========================================================================
// Tags admin (destructive admin actions)
// ===========================================================================

test.describe('Tags admin', () => {
    test('lists existing tags', async ({page}) => {
        test.skip(shouldSkip('tags-list'), 'Skipped via live-config.json skip list');
        await setupTagsMocks(page);

        await page.goto(`${BASE}/admin/tags`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('[data-testid="admin-tags"]')).toContainText('Botany');
        await expect(page.locator('[data-testid="admin-tags"]')).toContainText('Zoology');
    });

    test('creating a new tag adds it to the list', async ({page}) => {
        test.skip(shouldSkip('tags-create'), 'Skipped via live-config.json skip list');
        await setupTagsMocks(page);

        await page.goto(`${BASE}/admin/tags`);
        await page.waitForLoadState('networkidle');

        await page.locator('[data-testid="new-tag-path"]').fill('Mineralogy');
        await page.locator('button', {hasText: 'Add'}).last().click();

        await expect(page.locator('td', {hasText: 'Mineralogy'})).toBeVisible({timeout: 5000});
    });

    test('deleting a tag removes it from the list', async ({page}) => {
        test.skip(shouldSkip('tags-delete'), 'Skipped via live-config.json skip list');
        await setupTagsMocks(page);

        await page.goto(`${BASE}/admin/tags`);
        await page.waitForLoadState('networkidle');

        const zoologyRow = page.locator('tr', {hasText: 'Zoology'});
        page.once('dialog', dialog => dialog.accept());
        await zoologyRow.locator('button', {hasText: 'Delete'}).click();

        await expect(page.locator('text=Zoology')).toHaveCount(0, {timeout: 5000});
    });

    test('filtering by path narrows the list via the q query param', async ({page}) => {
        test.skip(shouldSkip('tags-filter'), 'Skipped via live-config.json skip list');
        await setupTagsMocks(page);

        await page.goto(`${BASE}/admin/tags`);
        await page.waitForLoadState('networkidle');

        await page.locator('[data-testid="tag-filter"]').fill('Botany');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Zoology')).toHaveCount(0, {timeout: 5000});
        await expect(page.locator('text=Botany').first()).toBeVisible();
    });
});

// ===========================================================================
// Upload forms
// ===========================================================================

test.describe('Upload forms', () => {
    test('uploading a single file by URL reports the created image ID and sends the real value under imageUrl', async ({page}) => {
        test.skip(shouldSkip('upload-single-url'), 'Skipped via live-config.json skip list');
        await setupUploadMocks(page);

        await page.goto(`${BASE}/admin/upload`);
        await page.waitForLoadState('networkidle');

        // Deliberately distinct from the input's placeholder text so this test would
        // fail if the placeholder were ever accidentally submitted instead of the
        // real typed value.
        const realUrl = 'https://example.org/real-uploaded-photo.jpg';
        const [request] = await Promise.all([
            page.waitForRequest(req => (req.url().endsWith('/ws/uploadImage') || req.url().endsWith('/api/v2/uploads')) && req.method() === 'POST'),
            (async () => {
                await page.locator('[data-testid="single-url-input"]').fill(realUrl);
                await page.locator('button', {hasText: 'Upload'}).first().click();
            })()
        ]);

        await expect(page.locator('[data-testid="single-upload-result"]')).toContainText('img-new-001', {timeout: 5000});

        const postData = request.postData() ?? '';
        expect(postData).toContain(realUrl);
        expect(postData).not.toContain('https://example.org/image.jpg'); // the input's placeholder text
        expect(postData).toContain('name="imageUrl"');
        expect(postData).not.toContain('name="image"\r');
    });

    test('uploading a single file sends it under "image" with metadata JSON-encoded and tags repeated', async ({page}) => {
        test.skip(shouldSkip('upload-single-file'), 'Skipped via live-config.json skip list');
        await setupUploadMocks(page);

        await page.goto(`${BASE}/admin/upload`);
        await page.waitForLoadState('networkidle');

        await page.locator('[data-testid="single-file-input"]').setInputFiles({name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])});
        await page.locator('button', {hasText: 'Add metadata field'}).click();
        await page.locator('input[placeholder="Key"]').fill('scientificName');
        await page.locator('input[placeholder="Value"]').fill('Banksia serrata');
        await page.locator('input[placeholder="Botany, Botany/Leaf"]').fill('Botany, Botany/Leaf');

        const [request] = await Promise.all([
            page.waitForRequest(req => (req.url().endsWith('/ws/uploadImage') || req.url().endsWith('/api/v2/uploads')) && req.method() === 'POST'),
            page.locator('button', {hasText: 'Upload'}).first().click()
        ]);

        await expect(page.locator('[data-testid="single-upload-result"]')).toContainText('img-new-001', {timeout: 5000});

        const postData = request.postData() ?? '';
        expect(postData).toContain('name="image"');
        expect(postData).toContain('filename="photo.jpg"');
        expect(postData).not.toContain('name="imageUrl"');
        expect(postData).toContain('name="metadata"');
        expect(postData).toContain(JSON.stringify({scientificName: 'Banksia serrata'}));
        // Tags must be sent as repeated "tags" fields, one per value, not a single joined string.
        const tagsFieldCount = (postData.match(/name="tags"/g) ?? []).length;
        expect(tagsFieldCount).toBe(2);
        expect(postData).toContain('Botany/Leaf');
    });

    test('uploading a ZIP batch reports batch status and file records', async ({page}) => {
        test.skip(shouldSkip('upload-zip-batch'), 'Skipped via live-config.json skip list');
        await setupUploadMocks(page);

        await page.goto(`${BASE}/admin/upload`);
        await page.waitForLoadState('networkidle');
        await page.locator('#upload-tabs-tab-zip').click();

        await page.locator('[data-testid="zip-data-resource-input"]').fill('dr123');
        await page.locator('[data-testid="zip-file-input"]').setInputFiles({name: 'batch.zip', mimeType: 'application/zip', buffer: Buffer.from('fake zip content')});
        await page.locator('button', {hasText: 'Upload ZIP'}).click();

        await expect(page.locator('[data-testid="zip-upload-result"]')).toContainText('batch-001', {timeout: 5000});
        await expect(page.locator('[data-testid="zip-upload-result"]')).toContainText('records.avro');
    });

    test('scheduling a bulk URL upload shows the accepted response', async ({page}) => {
        test.skip(shouldSkip('upload-bulk-urls'), 'Skipped via live-config.json skip list');
        await setupUploadMocks(page);

        await page.goto(`${BASE}/admin/upload`);
        await page.waitForLoadState('networkidle');
        await page.locator('#upload-tabs-tab-bulk-urls').click();

        await page.locator('[data-testid="bulk-data-resource-input"]').fill('dr123');
        await page.locator('[data-testid="urls-textarea"]').fill('https://example.org/a.jpg\nhttps://example.org/b.jpg');
        await page.locator('button', {hasText: 'Schedule upload'}).click();

        await expect(page.locator('[data-testid="bulk-upload-result"]')).toContainText('success', {timeout: 5000});
    });

    test('local ingest lists inbox files and imports them', async ({page}) => {
        test.skip(shouldSkip('upload-local-ingest'), 'Skipped via live-config.json skip list');
        await setupUploadMocks(page);

        await page.goto(`${BASE}/admin/upload`);
        await page.waitForLoadState('networkidle');
        await page.locator('#upload-tabs-tab-local').click();

        await expect(page.locator('td', {hasText: 'dr123-batch.csv'}).first()).toBeVisible({timeout: 5000});

        page.once('dialog', dialog => dialog.accept());
        await page.locator('[data-testid="import-inbox"]').click();

        await expect(page.locator('[data-testid="inbox-import-message"]')).toContainText('batch-inbox-001', {timeout: 5000});
    });
});
