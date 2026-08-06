import { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures';
import { setupMocks, loadResults, mockImages } from './helpers';

// ===========================================================================
// Synthetic coverage: src/components/list/recordImages.tsx (231 lines, 44.82%
// stmt coverage). acceptance.spec.ts's "Record images tab" test is a pure
// structural smoke test (thumbnail gallery renders) -- the entire lightbox
// modal (open/close/Prev/Next/Download/onError fallback), the "Show more
// images" button, and the near-the-end pagination preload had never been
// exercised.
// ===========================================================================

function buildImage(idx: number) {
    return {
        uuid: `img-rec-${idx}`,
        thumbnailUrl: `https://images.test.ala.org.au/image/proxyImageThumbnail?imageId=img-${idx}`,
        largeImageUrl: `https://images.test.ala.org.au/image/proxyImage?imageId=img-${idx}`,
        image: `img-${idx}`,
        imageUrl: `https://images.test.ala.org.au/image/proxyImage?imageId=img-${idx}`,
        raw_scientificName: 'Acacia dealbata',
        typeStatus: idx === 0 ? 'Holotype' : undefined,
        eventDate: idx === 0 ? new Date('2020-07-20').getTime() : undefined,
        collector: idx === 0 ? 'Jane Botanist' : undefined,
        institutionName: 'CSIRO',
    };
}

/**
 * Registers a 2-page /occurrences/search mock: `first` images on page 0 (start=0),
 * `second` on page 1 (start=pageSize). Shares the same path as mockBiocacheSearch's
 * generic dispatcher (registered by setupMocks()) -- matched here by the distinctive
 * `fq=multimedia:Image` query param recordImages.tsx always appends, falling back to
 * whatever route was registered before this one for any other request shape.
 */
async function mockPaginatedImages(page: Page, seenUrls: Set<URL>, first: any[], second: any[]) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/occurrences/search**';
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/search'));
    await page.context().route(pattern, async (route: Route) => {
        const url = new URL(route.request().url());
        if (!url.searchParams.getAll('fq').includes('multimedia:Image')) {
            return route.fallback();
        }
        seenUrls.add(url);
        const start = parseInt(url.searchParams.get('start') || '0', 10);
        const occurrences = start === 0 ? first : (start === first.length ? second : []);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ occurrences, totalRecords: first.length + second.length }) });
    });
}

async function openRecordImagesTab(page: Page) {
    await loadResults(page);
    await page.getByRole('tab', { name: 'Record images' }).click();
    await expect(page.getByText('Images from occurrence records')).toBeVisible();
}

test.describe('RecordImages — lightbox', () => {
    test('opening a thumbnail shows the lightbox; Prev is disabled at the start, Next navigates and is disabled at the end', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockImages(page, seenUrls);
        // Only 3 images total (well under pageSize=20), so noMoreImages is true
        // straight after the first (only) page loads -- no preload to worry about here.
        await mockPaginatedImages(page, seenUrls, [buildImage(0), buildImage(1), buildImage(2)], []);
        await openRecordImagesTab(page);

        await expect(page.locator('#container .imgCon')).toHaveCount(3);
        await page.locator('#container .imgCon').first().click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Acacia dealbata (1)');
        await expect(dialog).toContainText('Holotype');
        await expect(dialog).toContainText('Jane Botanist');
        await expect(dialog).toContainText('CSIRO');

        const prevBtn = page.getByRole('button', { name: 'Previous image' });
        const nextBtn = page.getByRole('button', { name: 'Next image' });
        await expect(prevBtn).toBeDisabled();
        await expect(nextBtn).toBeEnabled();

        await nextBtn.click();
        await expect(dialog).toContainText('(2)');
        await expect(prevBtn).toBeEnabled();

        await nextBtn.click();
        await expect(dialog).toContainText('(3)');
        await expect(nextBtn).toBeDisabled(); // last image, and noMoreImages is true

        await prevBtn.click();
        await expect(dialog).toContainText('(2)');
    });

    test('the Close button and the backdrop both dismiss the lightbox; clicking inside the dialog does not', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockImages(page, seenUrls);
        await mockPaginatedImages(page, seenUrls, [buildImage(0)], []);
        await openRecordImagesTab(page);

        await page.locator('#container .imgCon').first().click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: 'Close' }).click();
        await expect(dialog).toHaveCount(0);

        // Re-open, then dismiss via the backdrop (the dialog root itself, outside .dialogContent).
        await page.locator('#container .imgCon').first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByRole('dialog').click({ position: { x: 5, y: 5 } });
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('a broken thumbnail/large-image URL falls back to the local missing-image asset', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        // No mockImages() registered -- every images.test.ala.org.au request 404s,
        // triggering each <img>'s onError handler.
        await page.context().route('https://images.test.ala.org.au/**', route => route.fulfill({ status: 404, body: '' }));
        seenUrls.add(new URL('https://images.test.ala.org.au/'));
        await mockPaginatedImages(page, seenUrls, [buildImage(0)], []);
        await openRecordImagesTab(page);

        // Vite inlines this small local PNG as a base64 data: URI at build time, so
        // asserting a literal "missing-image" substring in src would never match --
        // assert on what it does NOT look like instead (the original broken proxy URL).
        const thumb = page.locator('#container .imgCon img').first();
        await expect(thumb).not.toHaveAttribute('src', /images\.test\.ala\.org\.au/, { timeout: 10000 });
        await expect(thumb).toHaveAttribute('src', /^data:image\//);

        await page.locator('#container .imgCon').first().click();
        const largeImage = page.getByRole('dialog').locator('img').last();
        await expect(largeImage).not.toHaveAttribute('src', /images\.test\.ala\.org\.au/, { timeout: 10000 });
        await expect(largeImage).toHaveAttribute('src', /^data:image\//);
    });

    test('the Download button fetches the original image and saves it with a name-derived filename', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockImages(page, seenUrls);
        await mockPaginatedImages(page, seenUrls, [buildImage(0)], []);
        await openRecordImagesTab(page);

        await page.locator('#container .imgCon').first().click();
        const dialog = page.getByRole('dialog');

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            dialog.getByRole('button', { name: 'Download' }).click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/^Acacia dealbata\.\w+$/);
    });
});

test.describe('RecordImages — pagination', () => {
    test('"Show more images" button loads the next page on the first click', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockImages(page, seenUrls);
        // Exactly pageSize (20) images on page 0 keeps noMoreImages false, so the
        // "Show more images" button renders.
        const firstPage = Array.from({ length: 20 }, (_, i) => buildImage(i));
        const secondPage = [buildImage(20), buildImage(21)]; // < pageSize -- sets noMoreImages true once reached.
        await mockPaginatedImages(page, seenUrls, firstPage, secondPage);
        await openRecordImagesTab(page);

        await expect(page.locator('#container .imgCon')).toHaveCount(20);
        const showMore = page.getByRole('button', { name: 'Show more images' });
        await expect(showMore).toBeVisible();

        // Fixed: the button's onClick now computes `nextPage = page + 1` before
        // calling both setPage(nextPage) and loadImages(nextPage), so the first
        // click correctly requests page 1 (start=20), appending 2 rows (22 total)
        // rather than duplicating page 0.
        await showMore.click();
        await expect(page.locator('#container .imgCon')).toHaveCount(22, { timeout: 10000 });
        // secondPage has only 2 rows (< pageSize) -- exhausted now, button disappears.
        await expect(showMore).toHaveCount(0);
    });

    test('opening the second-to-last thumbnail on a full page preloads the next page via handleOpenModal', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockImages(page, seenUrls);
        const firstPage = Array.from({ length: 20 }, (_, i) => buildImage(i));
        const secondPage = [buildImage(20), buildImage(21)];
        await mockPaginatedImages(page, seenUrls, firstPage, secondPage);
        await openRecordImagesTab(page);

        // Index 18 is images.length(20) - 2 -- handleOpenModal's own preload branch,
        // independent of ever clicking "Show more images" or the lightbox's Next button.
        await page.locator('#container .imgCon').nth(18).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText('(19)');

        const nextBtn = page.getByRole('button', { name: 'Next image' });
        await nextBtn.click(); // -> 20th (idx 19, last of first page)
        await expect(dialog).toContainText('(20)');
        // The preload triggered by opening idx 18 should have already resolved by now.
        await expect(async () => {
            await nextBtn.click();
            await expect(dialog).toContainText('(21)', { timeout: 2000 });
        }).toPass({ timeout: 10000 });
    });
});
