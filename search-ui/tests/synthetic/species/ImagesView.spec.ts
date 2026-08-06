import { test, expect } from '../../fixtures';
import { shouldSkip } from '../../mocks/liveConfig';
import { setupSpeciesPageMocks, load, speciesUrl, SPECIES_BIRD_FULL } from './helpers';

// ---------------------------------------------------------------------------
// imagesView.tsx — branches not covered by acceptance.spec.ts's
// "Species page - Media (Images/gallery) tab" describe block.
//
// 1. A broken image (onError) is removed from the grid rather than showing a broken-image icon
// 2. Opening the modal on a sound tile shows the audio player (not the image viewer)
// 3. Opening the modal on a video tile shows the video player (not the image viewer)
// 4. Navigating to the second-last image via "Next" triggers the next-page fetch
// ---------------------------------------------------------------------------

test.describe('ImagesView.tsx', () => {
    test('a broken image is removed from the grid on error', async ({ page }) => {
        test.skip(shouldSkip('imagesview-broken-image'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        // Force exactly one thumbnail request to fail — the component removes
        // that item from `items` entirely (no persistent broken-image placeholder).
        await page.context().route('**/images*.ala.org.au/image/proxyImageThumbnail*imageId=gallery-img-001', (route) => route.abort('failed'));

        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=media'));
        await expect(page.locator('img[src*="gallery-img-002"]')).toBeVisible();
        await expect(page.locator('img[src*="gallery-img-001"]')).toHaveCount(0, { timeout: 3000 });
    });

    test('opening the modal on a sound tile shows the audio player', async ({ page }) => {
        test.skip(shouldSkip('imagesview-modal-sound'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=media'));

        await page.locator('button', { hasText: 'Sound file' }).click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();
        await expect(page.locator('audio')).toBeVisible();
    });

    test('opening the modal on a video tile shows the video player', async ({ page }) => {
        test.skip(shouldSkip('imagesview-modal-video'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=media'));

        await page.locator('button', { hasText: 'Video file' }).click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();
        await expect(page.locator('video')).toBeVisible();
    });

    test('navigating "Next" near the end of the loaded page triggers the next-page fetch', async ({ page }) => {
        test.skip(shouldSkip('imagesview-modal-next-page-fetch'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=media'));

        // Open the modal on the second-to-last image of page 1 (12 items, 0-indexed
        // 10 is items.length-2) so clicking "Next" once more crosses the page boundary.
        // Simpler: open on the very first image and click "Next" repeatedly until
        // page-2-only content (gallery-img-010) becomes reachable via the modal.
        await page.locator('img[src*="gallery-img-001"]').click();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        const nextButton = page.getByRole('button', { name: 'Next image' });
        for (let i = 0; i < 11; i++) {
            if (await nextButton.isDisabled()) break;
            await nextButton.click();
        }

        // The gallery grid behind the modal now includes page-2 images
        await expect(page.locator('img[src*="gallery-img-010"]')).toHaveCount(1, { timeout: 3000 });
    });
});
