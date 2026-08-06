import { test, expect } from '../../fixtures';
import { shouldSkip } from '../../mocks/liveConfig';
import { setupSpeciesPageMocks, load, speciesUrl, SPECIES_BIRD_FULL } from './helpers';

// ---------------------------------------------------------------------------
// classificationView.tsx — branches not covered by acceptance.spec.ts's
// "Species page - Classification tab" describe block.
//
// 1. Children fetch error -> FlaggedAlert error message
// ---------------------------------------------------------------------------

test.describe('ClassificationView.tsx', () => {
    test('a children-fetch error shows the FlaggedAlert error message', async ({ page }) => {
        test.skip(shouldSkip('classification-fetch-error'), 'Skipped via live-config.json skip list');
        await setupSpeciesPageMocks(page);
        await page.context().route('http://localhost:8081/v2/search**', async (route) => {
            const url = new URL(route.request().url());
            const fqs = url.searchParams.getAll('fq');
            if (fqs.some((f) => f.startsWith('parentGuid:'))) {
                return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ status: 500, error: 'Internal error fetching children' }) });
            }
            return route.fallback();
        });

        await load(page, speciesUrl(SPECIES_BIRD_FULL.guid, 'tab=classification'));

        await expect(page.locator('text=Error loading child taxa.')).toBeVisible();
        await expect(page.locator('code', { hasText: 'Internal error fetching children' })).toBeVisible();
    });
});
