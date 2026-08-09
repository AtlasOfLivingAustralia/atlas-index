import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { setupMocks, loadResults, mockWmsTiles } from './helpers';
import { mockWmsImageDownload } from '../mocks/biocacheMocks';
import { mockCreateAlert } from '../mocks/apiMocks';
import { queryTitleWithLsid } from './helpers';

// ===========================================================================
// Synthetic coverage: results-page modals/dropdowns reached only from
// mapView.tsx / recordsView.tsx / resultsReturned.tsx, all at or near 0%
// coverage per PLAYWRIGHT_TEST.md §5 -- none of these are touched by any
// acceptance.spec.ts test.
// ===========================================================================

async function openMapTab(page: Page, seenUrls: Set<URL>) {
    // MapView mounts Leaflet's WMS heatmap layer (ogc/wms/reflect) immediately once
    // the Map tab is first selected -- unmocked, this throws via logMissingMocks
    // before the tab's own content (e.g. the "Download map" trigger) is ever reachable.
    await mockWmsTiles(page, seenUrls);
    await page.getByRole('tab', { name: 'Map' }).click();
    await expect(page.locator('.leaflet-container').first()).toBeVisible();
}

test.describe('DownloadMapModal', () => {
    test('the "Download map" trigger only appears once the Map tab has been selected', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await loadResults(page);

        // MapView is wrapped in <LazyLoad active={tab==='map'}> -- its children (and
        // therefore this trigger) don't exist in the DOM at all until the Map tab has
        // been activated at least once.
        await expect(page.getByText('Download map', { exact: true })).toHaveCount(0);

        await openMapTab(page, seenUrls);
        // The trigger is an <a> with no href (only onClick) -- no implicit link role,
        // so it must be located by text, not getByRole('link', ...).
        await expect(page.getByText('Download map', { exact: true })).toBeVisible();
    });

    test('opens with the documented defaults; Close dismisses without opening a popup', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await loadResults(page);
        await openMapTab(page, seenUrls);

        await page.getByText('Download map', { exact: true }).click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('Download map as image file');
        await expect(modal.locator('#dm-format')).toHaveValue('jpg');
        await expect(modal.locator('#dm-dpi')).toHaveValue('300');
        await expect(modal.locator('#dm-baseLayer')).toHaveValue('baseMap.world');

        let popupOpened = false;
        page.on('popup', () => { popupOpened = true; });
        // getByRole('button', {name:'Close'}) is ambiguous: Modal.Header's closeButton
        // X-icon also has accessible name "Close" -- the footer has its OWN 2 buttons
        // (Close + Download map), so scope by class to the outline (Close) one.
        await modal.locator('.modal-footer button.btn-outline-dark').click();
        await expect(modal).not.toBeVisible();
        expect(popupOpened).toBe(false);
    });

    test('Download opens a popup URL with the expected extents/format/dpi and baseMap param (default "baseMap." option)', async ({ page, browserName }) => {
        // Unlike a routed <a target="_blank"> click (§3.12's WebKit gotcha), this is a
        // window.open()-triggered attachment response -- confirmed directly (instrumented
        // page.on('download')/('popup')) that WebKit fires NEITHER a 'download' event NOR
        // ever navigates the opened window to a real URL for this case either (it just
        // stays a permanently-blank page) -- so there is no way to recover the request URL
        // on WebKit at all here, not even via the popup. Chromium and Firefox both fire a
        // real 'download' event with the full URL.
        test.skip(browserName === 'webkit', 'WebKit fires neither a download event nor a popup navigation for a window.open()-triggered attachment response');

        const seenUrls = await setupMocks(page);
        await mockWmsImageDownload(page, seenUrls);
        await loadResults(page);
        await openMapTab(page, seenUrls);

        await page.getByText('Download map', { exact: true }).click();
        const modal = page.getByRole('dialog');
        await modal.locator('#dm-dpi').selectOption('600');
        await modal.locator('#dm-fileName').fill('MyDownloadedMap');

        // download()'s window.open(url, '_blank') response carries
        // Content-Disposition: attachment -- Chromium/Firefox convert this into a
        // genuine 'download' event rather than ever navigating the new window to a
        // real URL (that window's own 'popup' event fires with an empty/invalid url --
        // new URL(popup.url()) throws -- so the real request URL must be read from the
        // download event instead, not the popup).
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            modal.getByRole('button', { name: 'Download map' }).click(),
        ]);
        const popupUrl = new URL(download.url());
        expect(popupUrl.pathname).toContain('/webportal/wms/image');
        expect(popupUrl.searchParams.get('dpi')).toBe('600');
        expect(popupUrl.searchParams.get('format')).toBe('jpg');
        expect(popupUrl.searchParams.get('fileName')).toBe('MyDownloadedMap.jpg');
        // Default BASE_LAYER_OPTIONS[0] is "baseMap.world" -- the 'baseMap.' branch
        // strips the prefix into `baseMap`, leaving `baseLayer` empty.
        expect(popupUrl.searchParams.get('baseMap')).toBe('world');
        expect(popupUrl.searchParams.get('baseLayer')).toBe('');
        expect(popupUrl.searchParams.get('extents')?.split(',').length).toBe(4);
    });

    test('selecting the "States & territories" option sets an unstripped baseLayer param (case-mismatched prefix check)', async ({ page, browserName }) => {
        test.skip(browserName === 'webkit', 'WebKit fires neither a download event nor a popup navigation for a window.open()-triggered attachment response');

        const seenUrls = await setupMocks(page);
        await mockWmsImageDownload(page, seenUrls);
        await loadResults(page);
        await openMapTab(page, seenUrls);

        await page.getByText('Download map', { exact: true }).click();
        const modal = page.getByRole('dialog');
        await modal.locator('#dm-baseLayer').selectOption({ label: 'States & territories' });

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            modal.getByRole('button', { name: 'Download map' }).click(),
        ]);
        const popupUrl = new URL(download.url());
        expect(popupUrl.searchParams.get('baseMap')).toBe('');
        // Real (buggy) behaviour: download()'s else-branch only strips a lowercase
        // 'baselayer.' prefix (`baseLayer.startsWith('baselayer.')`), but the actual
        // configured value is 'baseLayer.aus1' (capital L, per VITE_MAP_DOWNLOAD_BASE_LAYERS
        // and this file's own top-of-file doc comment convention) -- the case mismatch
        // means the prefix is never stripped for a correctly-cased config value, so the
        // FULL 'baseLayer.aus1' string is sent, not just 'aus1'. Worth flagging upstream.
        expect(popupUrl.searchParams.get('baseLayer')).toBe('baseLayer.aus1');
    });
});

test.describe('AlertModal', () => {
    test('the "Alerts" trigger is visible on the Records tab and opens the Email alerts dialog', async ({ page }) => {
        const seenUrls = await setupMocks(page, { biocache: { queryTitle: 'acacia' } });
        await mockCreateAlert(page, seenUrls);
        await loadResults(page);

        const trigger = page.getByRole('button', { name: 'Alerts' });
        await expect(trigger).toBeVisible();
        await trigger.click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('Email alerts');
        await expect(modal.getByText('Get email alerts for new', { exact: false }).first()).toBeVisible();

        const myAlertsLink = modal.getByRole('link', { name: 'View your current alerts' });
        await expect(myAlertsLink).toHaveAttribute('href', /alerts\.test\.ala\.org\.au\/notification\/myAlerts/);
    });

    test('"Get email alerts for new records" redirects to the mocked createBiocacheNewRecordsAlert URL with the query title', async ({ page }) => {
        const seenUrls = await setupMocks(page, { biocache: { queryTitle: 'acacia sightings' } });
        await mockCreateAlert(page, seenUrls);
        await loadResults(page);

        await page.getByRole('button', { name: 'Alerts' }).click();
        const modal = page.getByRole('dialog');
        await modal.getByText('Get email alerts for new', { exact: false }).first().click();

        await expect(page).toHaveURL(/alerts\.test\.ala\.org\.au\/ws\/createBiocacheNewRecordsAlert/);
        await expect(page).toHaveURL(/queryDisplayName=acacia%20sightings/);
    });

    test('a queryTitle of 250+ characters is truncated to 149 chars + "..." in the redirect', async ({ page }) => {
        const longTitle = 'a'.repeat(300);
        const seenUrls = await setupMocks(page, { biocache: { queryTitle: longTitle } });
        await mockCreateAlert(page, seenUrls);
        await loadResults(page);

        await page.getByRole('button', { name: 'Alerts' }).click();
        const modal = page.getByRole('dialog');
        await modal.getByText('Get email alerts for new', { exact: false }).first().click();

        const expected = encodeURIComponent(longTitle.substring(0, 149) + '...');
        await expect(page).toHaveURL(new RegExp(`queryDisplayName=${expected}`));
    });

    test('"Get email alerts for new annotations" redirects to the mocked createBiocacheNewAnnotationsAlert URL', async ({ page }) => {
        const seenUrls = await setupMocks(page, { biocache: { queryTitle: 'acacia' } });
        await mockCreateAlert(page, seenUrls);
        await loadResults(page);

        await page.getByRole('button', { name: 'Alerts' }).click();
        const modal = page.getByRole('dialog');
        await modal.getByText('Get email alerts for new annotations', { exact: false }).click();

        await expect(page).toHaveURL(/alerts\.test\.ala\.org\.au\/ws\/createBiocacheNewAnnotationsAlert/);
    });

    test('the footer Close button dismisses the modal via onClose without navigating', async ({ page }) => {
        const seenUrls = await setupMocks(page, { biocache: { queryTitle: 'acacia' } });
        await mockCreateAlert(page, seenUrls);
        await loadResults(page);

        await page.getByRole('button', { name: 'Alerts' }).click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        // getByRole('button', {name:'Close'}) is ambiguous here too (Modal.Header's
        // closeButton X-icon shares the same accessible name) -- scope to the footer,
        // which has exactly one button.
        const urlBefore = page.url();
        await modal.locator('.modal-footer button').click();
        await expect(modal).not.toBeVisible();
        expect(page.url()).toBe(urlBefore);
    });
});

test.describe('LsidDropdown (via resultsReturned.tsx / taxonDropdown.tsx)', () => {
    const LSID = 'urn:lsid:biodiversity.org.au:afd.taxon:bird-001';

    test('mounts only when queryTitle contains an lsid-classed span, and toggling shows a populated facet checklist', async ({ page }) => {
        await setupMocks(page, {
            biocache: {
                queryTitle: queryTitleWithLsid(LSID, 'Gymnorhina tibicen'),
                facetResponses: { raw_scientificName: [
                    { label: 'Gymnorhina tibicen', count: 4200, fq: 'raw_scientificName:"Gymnorhina tibicen"', i18nCode: '' },
                    { label: 'Gymnorhina tibicen tibicen', count: 900, fq: 'raw_scientificName:"Gymnorhina tibicen tibicen"', i18nCode: '' },
                ] },
            },
        });
        await loadResults(page);

        const nameLink = page.locator('#taxa_0');
        await expect(nameLink).toBeVisible();
        await expect(nameLink).toContainText('Gymnorhina tibicen');
        await expect(nameLink).toHaveAttribute('href', new RegExp(`bie\\.test\\.ala\\.org\\.au/species/${LSID}`));

        await page.locator('#resultsReturnedTemplate_0 button').click();
        // "Restrict results to the selected names" is only the button's `title`
        // (tooltip) attribute (list.resultsreturned.restrict.results) -- its actual
        // VISIBLE text is "Refine search" (list.resultsreturned.form.button01), so
        // getByText(...) for the tooltip copy never matches.
        await expect(page.locator('#rawTaxonSumbit_0')).toHaveAttribute('title', 'Restrict results to the selected names');
        await expect(page.locator('#rawTaxon_0_0')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Gymnorhina tibicen tibicen')).toBeVisible();
        await expect(page.getByText('(4200)')).toBeVisible();
    });

    test('checking a name enables Refine search and navigates to a filtered raw_scientificName query', async ({ page }) => {
        await setupMocks(page, {
            biocache: {
                queryTitle: queryTitleWithLsid(LSID, 'Gymnorhina tibicen'),
                facetResponses: { raw_scientificName: [
                    { label: 'Gymnorhina tibicen', count: 4200, fq: '', i18nCode: '' },
                ] },
            },
        });
        await loadResults(page);

        await page.locator('#resultsReturnedTemplate_0 button').click();
        const refineButton = page.locator('#rawTaxonSumbit_0');
        await expect(refineButton).toBeDisabled();

        await page.locator('#rawTaxon_0_0').check();
        await expect(refineButton).toBeEnabled();
        await refineButton.click();

        // lsidDropdown.tsx's handleRefine() builds this URL via a hardcoded template
        // literal (`raw_scientificName:%22${encodeURIComponent(label)}%22`), not
        // URLSearchParams -- the colon is never encoded, so it stays literal (:),
        // not %3A, on the immediate post-click navigation.
        await expect(page).toHaveURL(/occurrences\/search\?q=raw_scientificName:%22Gymnorhina/);
    });

    test('shows "[no records found]" when the facet response is empty for that lsid', async ({ page }) => {
        await setupMocks(page, {
            biocache: { queryTitle: queryTitleWithLsid(LSID, 'Gymnorhina tibicen') },
        });
        await loadResults(page);

        await page.locator('#resultsReturnedTemplate_0 button').click();
        await expect(page.getByText('[no records found]')).toBeVisible({ timeout: 10000 });
    });
});
