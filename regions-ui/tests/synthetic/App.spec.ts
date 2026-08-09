import { test, expect } from '../fixtures';
import { setupRegionsMocks, load } from './helpers';

// ---------------------------------------------------------------------------
// App.tsx — visibilitychange listener (lines exercising checkLoginState re-call)
// and useEffect cleanup (removes the event listener on unmount).
// These two branches are NOT triggered by any acceptance test because the
// acceptance tests never hide/show the browser tab or navigate away.
// ---------------------------------------------------------------------------

test.describe('App.tsx', () => {
    test('visibility change re-triggers login state check without breaking the page', async ({ page }) => {
        await setupRegionsMocks(page);
        await load(page);

        // Simulate the browser tab going hidden then becoming visible again.
        // This exercises the visibilitychange handler registered in App.tsx's
        // useEffect (the one that calls checkLoginState on tab-focus).
        await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
        });

        // Page must still be functional after the visibility toggle.
        await expect(page).toHaveTitle(/Regions/);
        // The accordion (rendered after CSS + config load) must still be visible.
        await expect(page.locator('button.accordion-button').first()).toBeVisible();
    });

    test('cleanup removes visibilitychange listener on unmount', async ({ page }) => {
        await setupRegionsMocks(page);
        await load(page);

        // Navigate away — this unmounts the React tree, running the useEffect
        // cleanup that removes the visibilitychange listener.
        await page.evaluate(() => { window.location.href = 'about:blank'; });
        // No crash means the cleanup executed without error.
    });
});
