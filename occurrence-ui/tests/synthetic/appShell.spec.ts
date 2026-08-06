import { test, expect } from '../fixtures';
import { setupMocks, load, loadRecord, BASE_URL, SESSION_USER } from './helpers';
import { mockLogoutRedirect } from '../mocks/apiMocks';
import { setupRecordMocks, g_acaciaRecord } from '../mocks/recordMocks';

// ===========================================================================
// Synthetic coverage: src/App.tsx's 404 route + Login/Logout header buttons
// (never exercised anywhere else -- every existing test navigates straight to
// a known route and no test ever clicks the header's own Login/Logout link),
// plus src/components/rolloverTooltip.tsx (53 lines, 26.66% stmt coverage).
// ===========================================================================

test.describe('App — 404 route', () => {
    test('an unmatched route renders the NotFound page with updated breadcrumbs', async ({ page }) => {
        await setupMocks(page);
        await page.goto(`${BASE_URL}/this-route-does-not-exist`);

        await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
        await expect(page.getByText('The page you are looking for does not exist.')).toBeVisible();
        await expect(page.getByText('Not Found', { exact: true })).toBeVisible(); // breadcrumb trail
    });
});

test.describe('App — header Login / Logout', () => {
    test('clicking Login (anonymous session) starts the real login redirect', async ({ page }) => {
        await setupMocks(page); // SESSION_ANONYMOUS by default
        await load(page);

        // header.tsx's setupHtml() strips the `href` attribute off every .loginBtn/
        // .logoutBtn anchor (so clicking calls loginFn/logoutFn instead of following
        // a real link) -- an <a> with no href has no implicit ARIA "link" role, so
        // getByRole('link', ...) can never match it. banner.mustache also renders a
        // 2nd, icon-only, always-CSS-hidden mobile copy with no text at all -- filter
        // by visible text instead of relying on role or a single .first().
        await page.locator('a.loginBtn', { hasText: 'Login' }).first().click();
        await expect(page).toHaveURL(/localhost:8081\/login\?path=/);
    });

    test('clicking Logout (authenticated session) starts the real logout redirect', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await mockLogoutRedirect(page, seenUrls);
        await load(page);

        await page.locator('a.logoutBtn', { hasText: 'Logout' }).first().click();
        await expect(page).toHaveURL(/localhost:8081\/logout\?path=/);
    });
});

test.describe('RolloverTooltip', () => {
    test('hovering an icon with a `text` prop and no hideDelay shows then immediately hides the popover', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls);
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        // recordSidebar.tsx's 5 DQ-test icons all use RolloverTooltip with a plain
        // `text` prop and NO hideDelay -- handleMouseLeave's immediate (non-setTimeout)
        // setShow(false) branch. FontAwesomeIconLite (common-ui) never forwards its
        // `title` prop to the rendered <svg> at all (confirmed by reading its source --
        // a dead prop), so the icons must be located by DOM position instead: the
        // failed/warning/passed/missing/unchecked icons are the 1st-5th <svg>
        // children (in that order) of the "#dataQualityInfo" link.
        const dqLink = page.locator('a[href="#dataQualityInfo"]');
        const passedIcon = dqLink.locator('svg').nth(2);
        await expect(passedIcon).toBeVisible();
        await passedIcon.hover();
        await expect(page.getByRole('tooltip').getByText('passed', { exact: true })).toBeVisible({ timeout: 5000 });

        await page.mouse.move(0, 0); // move away -- no hideDelay, hides right away
        await expect(page.getByRole('tooltip')).toHaveCount(0);
    });

    test('hovering an icon with `html` + hideDelay renders the HTML body and stays open briefly after the mouse leaves', async ({ page }) => {
        await setupMocks(page, { session: SESSION_USER }); // Download.tsx redirects anonymous users to login
        await page.goto(`${BASE_URL}/download/options1?searchParams=${encodeURIComponent('?q=' + encodeURIComponent('taxa:"acacia"'))}`);
        await page.locator('.option-btn').nth(0).click(); // records
        await page.locator('#downloadFormat-dwc').check();

        // Download.tsx's dwc-format tooltip: helpicon.dwc has real translated HTML
        // (an <a> link), unlike helpicon.csv/tsv which are plain text.
        const dwcLabel = page.locator('label', { has: page.locator('#downloadFormat-dwc') });
        const helpIcon = dwcLabel.locator('svg').last();
        await helpIcon.hover();

        const tooltip = page.getByRole('tooltip');
        await expect(tooltip.locator('a', { hasText: 'Darwin Core documentation' })).toBeVisible({ timeout: 5000 });

        await page.mouse.move(0, 0);
        // hideDelay=1000 -- still visible immediately after leaving...
        await expect(tooltip).toBeVisible();
        // ...but gone once the delay elapses.
        await expect(tooltip).toHaveCount(0, { timeout: 3000 });
    });
});
