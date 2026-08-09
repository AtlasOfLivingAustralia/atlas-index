import { test, expect } from './fixtures';
import { shouldSkip, getBaseUrl } from './mocks/liveConfig';
import {
    SESSION_ANONYMOUS,
    SESSION_USER,
    SESSION_ADMIN,
    setupHomeMocks,
    setupAtlasAdminMocks,
    setupDataQualityMocks,
    setupTasksMocks,
    setupDoiMocks,
    setupBiocacheMocks,
    setupBannerMocks,
    setupScaffoldMocks,
    setupAuditMocks,
    setupSwaggerMocks,
    mockSession,
} from './mocks/apiMocks';
import { logMissingMocks } from './mocks/logMissingMocks';
import { staticServerMocks } from './mocks/staticServerMocks';

const BASE = getBaseUrl();

// ===========================================================================
// Authentication / authorisation gating
// ===========================================================================

test.describe('Admin access control', () => {

    test('shows "Admin login required" when the user is not logged in', async ({ page }) => {
        test.skip(shouldSkip('auth-not-logged-in'), 'Skipped via live-config.json skip list');
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_ANONYMOUS);

        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Admin login required')).toBeVisible();
        // Menu / admin routes must not be rendered
        expect(await page.locator('a.menu-link').count()).toBe(0);
    });

    test('shows "Insufficient permissions" when logged in without ROLE_ADMIN', async ({ page }) => {
        test.skip(shouldSkip('auth-insufficient-permissions'), 'Skipped via live-config.json skip list');
        const seenUrls = new Set<URL>();
        await logMissingMocks(page, seenUrls);
        await staticServerMocks(page, seenUrls);
        await mockSession(page, seenUrls, SESSION_USER);

        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Insufficient permissions.')).toBeVisible();
        expect(await page.locator('a.menu-link').count()).toBe(0);
    });

    test('renders the admin Home page for a user with ROLE_ADMIN', async ({ page }) => {
        test.skip(shouldSkip('auth-admin-ok'), 'Skipped via live-config.json skip list');
        await setupHomeMocks(page, SESSION_ADMIN);

        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=Welcome to the admin interface')).toBeVisible();
        await expect(page.locator('a.menu-link', { hasText: 'Home' })).toBeVisible();
    });
});

// ===========================================================================
// Home page
// ===========================================================================

test.describe('Home page', () => {

    test('displays stats from /admin/info', async ({ page }) => {
        test.skip(shouldSkip('home-stats'), 'Skipped via live-config.json skip list');
        await setupHomeMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('h4', { hasText: 'Elasticsearch' })).toBeVisible();
        await expect(page.locator('code', { hasText: 'TAXON' })).toBeVisible();
        await expect(page.locator('text=Queue Depth')).toBeVisible();
        await expect(page.locator('code strong', { hasText: 'banner' })).toBeVisible();
    });

    test('"Begin test" button triggers /admin/test and shows the result', async ({ page }) => {
        test.skip(shouldSkip('home-test-connectivity'), 'Skipped via live-config.json skip list');
        await setupHomeMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('button', { hasText: 'Begin test' }).click();
        await expect(page.locator('pre', { hasText: 'elasticsearch' })).toBeVisible({ timeout: 5000 });
    });

    test('build-info meta tag is present with expected fields', async ({ page }) => {
        test.skip(shouldSkip('build-info'), 'Skipped via live-config.json skip list');
        await setupHomeMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        const jsonContent = await page.locator('meta[name="buildInfo"]').first().getAttribute('content');
        const buildInfo = JSON.parse(jsonContent || '{}');
        expect(buildInfo).toHaveProperty('commit');
        expect(buildInfo).toHaveProperty('branch');
        expect(buildInfo).toHaveProperty('buildDate');
    });
});

// ===========================================================================
// Menu navigation smoke tests — one per admin route.
//
// Each route is mocked just enough for the page to render without any
// unmocked network requests (logMissingMocks would throw otherwise), and a
// route-specific assertion confirms real fixture data was rendered.
// ===========================================================================

test.describe('Menu navigation', () => {

    test('Search Index (Atlas Admin) page loads with dynamic config from fixtures', async ({ page }) => {
        test.skip(shouldSkip('menu-search-index'), 'Skipped via live-config.json skip list');
        await setupAtlasAdminMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('a.menu-link', { hasText: 'Search Index' }).click();
        await expect(page).toHaveURL(/\/search/);
        await page.locator('button[role="tab"]', { hasText: 'Dynamic Config' }).click();
        await expect(page.locator('text=task.schedule')).toBeVisible({ timeout: 5000 });
    });

    test('Data Quality page loads the fixture profile', async ({ page }) => {
        test.skip(shouldSkip('menu-data-quality'), 'Skipped via live-config.json skip list');
        await setupDataQualityMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('a.menu-link', { hasText: 'Data Quality' }).click();
        await expect(page).toHaveURL(/\/dq/);
        await expect(page.locator('text=ALA Default')).toBeVisible({ timeout: 5000 });
    });

    test('Tasks page loads the fixture task list', async ({ page }) => {
        test.skip(shouldSkip('menu-tasks'), 'Skipped via live-config.json skip list');
        await setupTasksMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('a.menu-link', { hasText: 'Tasks' }).click();
        await expect(page).toHaveURL(/\/tasks/);
        const listTab = page.locator('button[role="tab"]', { hasText: 'List of requests' });
        await expect(listTab).toBeVisible({ timeout: 5000 });
        await listTab.click();
        await expect(page.locator('text=task-001').first()).toBeVisible({ timeout: 5000 });
    });

    test('DOIs page loads the fixture DOI list', async ({ page }) => {
        test.skip(shouldSkip('menu-dois'), 'Skipped via live-config.json skip list');
        await setupDoiMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('a.menu-link', { hasText: 'DOIs' }).click();
        await expect(page).toHaveURL(/\/doi/);
        await expect(page.locator('text=10.1234/ala-000001')).toBeVisible({ timeout: 5000 });
    });

    test('Biocache page loads the fixture active downloads', async ({ page }) => {
        test.skip(shouldSkip('menu-biocache'), 'Skipped via live-config.json skip list');
        await setupBiocacheMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('a.menu-link', { hasText: 'Biocache' }).click();
        await expect(page).toHaveURL(/\/biocache/);
        await expect(page.locator('text=user@example.com')).toBeVisible({ timeout: 5000 });
    });

    test('Banner Messages page loads the fixture banner data', async ({ page }) => {
        test.skip(shouldSkip('menu-banners'), 'Skipped via live-config.json skip list');
        await setupBannerMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('a.menu-link', { hasText: 'Banner Messages' }).click();
        await expect(page).toHaveURL(/\/banners/);
        await expect(page.locator('text=admin console').first()).toBeVisible({ timeout: 5000 });
    });

    test('Reference Tables (Scaffold) page loads the fixture table list', async ({ page }) => {
        test.skip(shouldSkip('menu-scaffold'), 'Skipped via live-config.json skip list');
        await setupScaffoldMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('a.menu-link', { hasText: 'Reference Tables' }).click();
        await expect(page).toHaveURL(/\/scaffold/);
        await expect(page.locator('select option', { hasText: 'Banner Messages' })).toHaveCount(1, { timeout: 5000 });
    });

    test('Audit History page loads the fixture audit entries', async ({ page }) => {
        test.skip(shouldSkip('menu-audit'), 'Skipped via live-config.json skip list');
        await setupAuditMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('a.menu-link', { hasText: 'Audit History' }).click();
        await expect(page).toHaveURL(/\/audit/);
        await expect(page.locator('text=admin@example.com').first()).toBeVisible({ timeout: 5000 });
    });

    test('Swagger page loads the mocked OpenAPI spec', async ({ page }) => {
        test.skip(shouldSkip('menu-swagger'), 'Skipped via live-config.json skip list');
        await setupSwaggerMocks(page);
        await page.goto(BASE);
        await page.waitForLoadState('networkidle');

        await page.locator('a.menu-link', { hasText: 'Swagger' }).click();
        await expect(page).toHaveURL(/\/swagger/);
        await expect(page.locator('text=Mock Service API')).toBeVisible({ timeout: 5000 });
    });
});
