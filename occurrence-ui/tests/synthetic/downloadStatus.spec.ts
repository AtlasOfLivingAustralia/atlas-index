import { test, expect } from '../fixtures';
import { setupMocks, BASE_URL, SESSION_USER } from './helpers';
import { mockIndexFields, mockOfflineDownload, mockDownloadStatusPolling, g_indexFields } from '../mocks/biocacheMocks';

// ===========================================================================
// Synthetic coverage: src/views/DownloadStatus.tsx (398 lines, 68.58% stmt
// coverage) + src/views/CustomDownload.tsx's custom-class-resolution branches
// (`resolveGroupKey`/the classes loop in DownloadStatus.tsx's startDownloadRecords()).
// acceptance.spec.ts's Downloads phase only ever exercises the "happy path" for
// each of the 3 download types, going through the real UI wizard with
// state.fromNavigate set -- never: the direct-load guard branches (no
// searchParams/no filename/loaded outside the wizard), the field-guide
// no-species-found and fetch-failure branches, the records-custom flow's
// non-DwC-class groups (conservationStatus/otherTraits/environmentalLayers/
// contextualLayers/selectedLayers/qualityAssertions/miscellaneousFields/a
// dr-prefixed group), or the SKIPPED/CANCELLED/generic-error/fetch-failure
// branches of the status-polling loop.
// ===========================================================================

const SEARCH_PARAMS = `?q=${encodeURIComponent('taxa:"acacia"')}`;

test.describe('DownloadStatus — direct-load guard branches', () => {
    test('missing searchParams shows its own specific error', async ({ page }) => {
        await setupMocks(page, { session: SESSION_USER });
        await page.goto(`${BASE_URL}/download/confirm?filename=test&downloadType=records&downloadReason=1`);

        await expect(page.getByText('ERROR: No search parameters provided for download.')).toBeVisible();
    });

    test('missing filename shows its own specific error', async ({ page }) => {
        await setupMocks(page, { session: SESSION_USER });
        await page.goto(`${BASE_URL}/download/confirm?searchParams=${encodeURIComponent(SEARCH_PARAMS)}&downloadType=records&downloadReason=1`);

        await expect(page.getByText('ERROR: No filename provided for download.')).toBeVisible();
    });

    test('loading the confirm page directly (not via the wizard\'s navigate) shows the "already run" message instead of starting a new download', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await mockIndexFields(page, seenUrls);
        await page.goto(
            `${BASE_URL}/download/confirm?searchParams=${encodeURIComponent(SEARCH_PARAMS)}` +
            `&filename=test&downloadType=records&downloadReason=1`
        );

        await expect(page.getByText('Your download has completed')).toBeVisible();
        await expect(page.getByText('The download has already been run. Click the button below to start over.')).toBeVisible();
    });
});

test.describe('DownloadStatus — field guide edge cases', () => {
    // A direct page.goto() to /download/confirm never sets location.state.fromNavigate,
    // so DownloadStatus.tsx would just show the "already run" message (see the guard
    // branch tests above) without ever calling startDownloadFieldguide() at all --
    // going through the real wizard (Download.tsx's onNext()) is required to reach it.
    async function startFieldGuide(page: import('@playwright/test').Page) {
        await page.goto(`${BASE_URL}/download/options1?searchParams=${encodeURIComponent(SEARCH_PARAMS)}`);
        await page.locator('.option-btn').nth(2).click(); // fieldguide
        await page.locator('#downloadReason').selectOption('1');
        await page.locator('button.option-btn.mt-4').click();
        await expect(page).toHaveURL(/\/download\/confirm\?/);
    }

    test('no species found for the current search shows the "no species" error without ever polling', async ({ page }) => {
        await setupMocks(page, {
            session: SESSION_USER,
            biocache: { facetResponses: { species_guid: [] } },
        });
        await startFieldGuide(page);

        await expect(page.getByText('No species found for the field guide')).toBeVisible({ timeout: 10000 });
    });

    test('the species-list fetch itself failing shows a generic error', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await page.context().route(
            (url) => url.hostname === 'biocache-ws.ala.org.au' && url.pathname === '/ws/occurrences/search' && url.searchParams.get('facets') === 'species_guid',
            route => route.abort()
        );
        seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/search'));
        await startFieldGuide(page);

        await expect(page.locator('#queueStatus')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#queueStatus')).not.toBeEmpty();
    });

    test('the PDF-generation POST failing shows a generic error', async ({ page }) => {
        const seenUrls = await setupMocks(page, {
            session: SESSION_USER,
            biocache: {
                facetResponses: {
                    species_guid: [{ label: 'https://id.biodiversity.org.au/node/apni/2895958', count: 100, fq: 'species_guid:"x"', i18nCode: '' }],
                },
            },
        });
        // A real network-level failure is required to reach the .catch() -- this
        // fetch chain never checks response.ok either, so an HTTP 500 with a valid
        // (even empty) JSON body would silently flow through the success branch.
        await page.context().route('http://localhost:8081/v2/download/fieldguide**', route => route.abort());
        seenUrls.add(new URL('http://localhost:8081/v2/download/fieldguide'));
        await startFieldGuide(page);

        await expect(page.locator('#queueStatus')).toBeVisible({ timeout: 10000 });
    });
});

test.describe('DownloadStatus — status-polling branches', () => {
    async function startRecordsDownload(page: import('@playwright/test').Page, seenUrls: Set<URL>) {
        await mockIndexFields(page, seenUrls);
        await page.goto(
            `${BASE_URL}/download/options1?searchParams=${encodeURIComponent(SEARCH_PARAMS)}&targetUri=%2Foccurrences%2Fsearch`
        );
        await page.locator('.option-btn').nth(0).click(); // records
        await page.locator('#downloadFormat-dwc').check();
        await page.locator('#downloadReason').selectOption('1');
        await page.locator('button.option-btn.mt-4').click();
        await expect(page).toHaveURL(/\/download\/confirm\?/);
    }

    test('a SKIPPED status shows the skipped message', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const statusUrl = 'https://biocache-ws.ala.org.au/ws/occurrences/offline/status/mock-skip-001';
        await mockOfflineDownload(page, seenUrls, statusUrl);
        await mockDownloadStatusPolling(page, seenUrls, statusUrl, [{ status: 'skipped' }]);
        await startRecordsDownload(page, seenUrls);

        await expect(page.getByText('Your download is skipped')).toBeVisible({ timeout: 10000 });
    });

    test('a CANCELLED status shows the cancelled message', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const statusUrl = 'https://biocache-ws.ala.org.au/ws/occurrences/offline/status/mock-cancel-001';
        await mockOfflineDownload(page, seenUrls, statusUrl);
        await mockDownloadStatusPolling(page, seenUrls, statusUrl, [{ status: 'cancelled' }]);
        await startRecordsDownload(page, seenUrls);

        await expect(page.getByText('Your download is cancelled')).toBeVisible({ timeout: 10000 });
    });

    test('an unrecognised status builds an error from the status code and message', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const statusUrl = 'https://biocache-ws.ala.org.au/ws/occurrences/offline/status/mock-error-001';
        await mockOfflineDownload(page, seenUrls, statusUrl);
        await mockDownloadStatusPolling(page, seenUrls, statusUrl, [{ status: 'ABEND', message: 'disk quota exceeded' }]);
        await startRecordsDownload(page, seenUrls);

        await expect(page.getByText('Your download failed')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('status:')).toBeVisible();
        await expect(page.getByText('ABEND')).toBeVisible();
        await expect(page.getByText('disk quota exceeded')).toBeVisible();
    });

    test('the status-polling fetch itself failing shows a "checking status" error', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        const statusUrl = 'https://biocache-ws.ala.org.au/ws/occurrences/offline/status/mock-fail-001';
        await mockOfflineDownload(page, seenUrls, statusUrl);
        await page.context().route(statusUrl, route => route.abort());
        seenUrls.add(new URL(statusUrl));
        await startRecordsDownload(page, seenUrls);

        await expect(page.getByText(/Error checking download status/)).toBeVisible({ timeout: 10000 });
    });
});

test.describe('DownloadStatus — records/custom class resolution (via CustomDownload.tsx)', () => {
    test('selecting every non-DwC-class group resolves qa/extra/fields params for each of its distinct branches', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await mockIndexFields(page, seenUrls, g_indexFields); // has el882/cl1048 rows for the regex-matched groups
        const statusUrl = 'https://biocache-ws.ala.org.au/ws/occurrences/offline/status/mock-custom-adv-001';
        await mockOfflineDownload(page, seenUrls, statusUrl);
        await mockDownloadStatusPolling(page, seenUrls, statusUrl, [{ status: 'finished', downloadUrl: 'https://biocache-ws.ala.org.au/ws/biocache-download/mock-custom-adv-001.zip' }]);

        // DISCOVERED BUG (found writing this test): Download.tsx's onNext() has a
        // misplaced closing paren -- `navigate('...' + '&downloadReason=' +
        // encodeURIComponent(downloadReason))` closes the navigate() CALL itself
        // right there, so the following `+ (layers ? ...) + (customHeader ? ...) +
        // (layersServiceUrl ? ...)` is dead, unused code. `layers`/`customHeader`/
        // `layersServiceUrl` are therefore NEVER forwarded from Download.tsx to
        // CustomDownload.tsx via the real wizard -- "Selected layers" can never
        // actually appear through normal UI navigation. Reaching CustomDownload.tsx
        // directly (which has no such bug in its OWN onNext()) is the only way to
        // exercise includeSelectedLayersOption at all.
        await page.goto(
            `${BASE_URL}/download/options2?searchParams=${encodeURIComponent(SEARCH_PARAMS)}` +
            `&filename=custom-adv&downloadType=records&downloadReason=1&layers=el882`
        );
        await expect(page.locator('.list-group-item').first()).toBeVisible({ timeout: 10000 });

        for (const label of ['Conservation status', 'Other traits', 'Environmental layers', 'Contextual layers', 'Selected layers', 'Quality assertions', 'Miscellaneous fields', 'WildNet Taxon ID']) {
            await page.getByText(label, { exact: true }).click();
        }
        await page.locator('button.btn-primary').first().click();
        await expect(page).toHaveURL(/\/download\/confirm\?/);

        const request = await page.waitForRequest(req =>
            req.url().includes('/ws/occurrences/offline/download') && req.url().includes('taxa'),
            { timeout: 10000 }
        );
        const url = decodeURIComponent(request.url());
        // qualityAssertions -> qaOverride='includeall'.
        expect(url).toContain('qa=includeall');
        // miscellaneousFields -> includeMisc=true appended to extra.
        expect(url).toContain('includeMisc=true');
        // dr15515 (matches /^dr\d+/) -> pushed into the extra list.
        expect(url).toContain('dr15515');
        // layers=el882 (from CustomDownload's own `layers` passthrough) appended to extra.
        expect(url).toContain('el882');
        // conservationStatus/otherTraits (downloadConfig.json's configFields) and the
        // environmentalLayers/contextualLayers regex matches (el882/cl1048 from
        // g_indexFields) all flow into the `fields` param.
        expect(url).toContain('countryConservation');
        expect(url).toContain('speciesGroup');

        await expect(page.getByRole('link', { name: /download.*now/i })).toHaveAttribute('href', /mock-custom-adv-001\.zip/, { timeout: 10000 });
    });
});
