import { Locator, TestInfo } from '@playwright/test';
import { test, expect } from './fixtures';
import { apiMocks } from './mocks/apiServiceMocks';
import { imageMocks } from './mocks/imageServiceMocks';
import { logMissingMocks } from './mocks/logMissingMocks';
import { staticServerMocks } from './mocks/staticServerMocks';
import { isLiveMode, getBaseUrl, getCollectionName, getUrlWaitPattern, shouldSkip, getFilterLabel } from './mocks/liveConfig';

// Extend TestInfo to include the seenUrls property
interface ExtendedTestInfo extends TestInfo {
    seenUrls: Set<URL>;
}

test.beforeEach(async ({ page }, testInfo) => {
    const seenUrls = new Set<URL>();
    if (!isLiveMode()) {
        await logMissingMocks(page, seenUrls); // must be first otherwise it will intercept all requests
        await staticServerMocks(page, seenUrls);
        await imageMocks(page, seenUrls);
        await apiMocks(page, seenUrls);
    }
    (testInfo as ExtendedTestInfo).seenUrls = seenUrls;
});

test('Find and click a link of all collections, and navigates', async ({ page }) => {
    test.skip(shouldSkip('all-collections-browse'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl());
    await page.waitForLoadState('networkidle');

    // Verify multiple thumbnail cards are present
    const thumbnails = page.locator('div.thumbnail');
    await expect(thumbnails.first()).toBeVisible();
    const thumbnailCount = await thumbnails.count();
    expect(thumbnailCount, 'home.thumbnailCount').toBeGreaterThan(1);

    // Find the "To view images from all collections" text and click its /browse link
    const browseLink = page.getByText('To view images from all collections,').locator('..').locator('a[href*="/browse"]');
    await expect(browseLink).toBeVisible();

    // Click the link to navigate to the browse page and wait for the browse URL to be loaded
    await Promise.all([page.waitForURL(/\/browse/), browseLink.click()]);
    const taxonomyFacet = page.locator('div#taxonomyFacet');
    await expect(taxonomyFacet).toHaveCount(1);

    const taxonomyItems = taxonomyFacet.locator('li:has(span.clickable)');
    await expect(taxonomyItems.first()).toBeVisible();
    const itemCount = await taxonomyItems.count();
    expect(itemCount, 'browse.taxonItemCount').toBeGreaterThan(1);

    // Each li should contain a span.clickable with a nested span (name) and a count in parentheses
    const firstItem = taxonomyItems.nth(0);
    await firstItem.scrollIntoViewIfNeeded();
    await expect(firstItem.locator('span.clickable').first()).toBeVisible();
    await expect(firstItem.locator('span.clickable span').first()).toBeVisible();
    const firstItemText = await firstItem.locator('span.clickable').first().innerText();
    expect(firstItemText, 'browse.firstItemFormat').toMatch(/\(\d+\)/);

    // Find the clickable span with text "Animalia" and click it
    const animaliaItem = taxonomyFacet.locator('span.clickable', { hasText: 'Animalia' });
    await expect(animaliaItem).toBeVisible();

    // Extract the count from the span text e.g. "Animalia (8453030)" -> 8453030
    const animaliaText = await animaliaItem.innerText();
    const countMatch = animaliaText.match(/\((\d+)\)/);
    expect(countMatch).not.toBeNull();
    const countOfAnimalia = parseInt(countMatch![1], 10);
    expect(countOfAnimalia, 'browse.animaliaCount').toBeGreaterThan(0);

    await animaliaItem.scrollIntoViewIfNeeded();

    await animaliaItem.click();

    // after clicking "Animalia", the taxon rank items should be visible under the taxonomy facet
    // The li should contain "Kingdom" as bold label and "Animalia" as the clickable span
    // Wait for this element - it only appears after the API fetch triggered by the kingdom filter completes
    const kingdomItem = taxonomyFacet.locator('li.taxon-rank');
    await expect(kingdomItem).toBeVisible();
    await expect(kingdomItem.locator('span', { hasText: 'Animalia' })).toBeVisible();

    // Get the total records count from the images summary, should be the same as the count extracted from the facet
    const totalRecordsEl = page.locator('div.images-summary .total-records');
    await expect(totalRecordsEl).toBeVisible();
    const totalRecordsText = await totalRecordsEl.innerText();
    const totalRecords = parseInt(totalRecordsText.replace(/,/g, ''), 10);
    expect(totalRecords, 'browse.totalRecordsVsAnimalia').toBe(countOfAnimalia);

    const imagesEl = page.locator('div.images-container');
    await expect(imagesEl).toBeVisible();
    const images = imagesEl.locator('.imgCon');
    await expect(images.first()).toBeVisible();
    const imagesCount = await images.count();
    expect(imagesCount, 'browse.imageCount').toBeGreaterThan(0);

    //check images should have a link to the record page, and the link should contain /record/ in its href
    const firstImageLinks = images.first().locator('a');
    await expect(firstImageLinks, 'browse.imageLinksPerCard').toHaveCount(3);
});

test('find South Australian Museum Terrestrial Invertebrate Collection thumbnail and navigate to its page', async ({ page }) => {
    test.skip(shouldSkip('collection-browse'), 'Skipped via live-config.json skip list');

    await page.goto(getBaseUrl());
    await page.waitForLoadState('networkidle');

    const targetName = getCollectionName();

    // Find the link with the specific text inside a .thumbnail
    const nameLink = page.locator('.thumbnail h2 a', { hasText: targetName });
    await expect(nameLink).toBeVisible();

    // Click the link to navigate to the browse page.
    // waitForURL matches the initial navigation; auto-drill may then update
    // the URL further (mock mode) or keep it the same (live mode with query params).
    await Promise.all([
        page.waitForURL(getUrlWaitPattern()),
        nameLink.click()
    ]);

    // Verify the page header span matches the specimen name.
    // In live mode the header may show the collectionUid rather than the full
    // name — override 'collection-browse.headerText' in live-config.json if needed.
    const headerSpan = page.locator('div.page-header h2 span');
    await expect(headerSpan).toBeVisible();
    const headerText = await headerSpan.innerText();
    expect(headerText, 'collection-browse.headerText').toBe(targetName);

    const taxonomyFacet = page.locator('div#taxonomyFacet');
    await expect(taxonomyFacet).toHaveCount(1);

    // Wait for the page to fully settle after auto-drill completes.
    // Auto-drill fires repeatedly while a rank has only one value, resetting and
    // refetching each time. The settled state is when span.clickable items are
    // present (more than one value at the current rank — auto-drill stopped)
    // AND images-summary is visible (loadStatus === 'done').
    const clickableItems = taxonomyFacet.locator('span.clickable');
    await expect(async () => {
        await expect(page.locator('div.images-summary')).toBeVisible();
        await expect(clickableItems.first()).toBeVisible();
    }).toPass({ timeout: 45000 });

    // Count how many taxonomy ranks have already been auto-drilled into.
    const autodrillRanks = taxonomyFacet.locator('li.taxon-rank');
    const autodrillRankCount = await autodrillRanks.count();
    expect(autodrillRankCount, 'collection-browse.autodrillRankCount').toBe(3);

    // Verify there are clickable taxonomy items at the current rank.
    const clickableCount = await clickableItems.count();
    expect(clickableCount, 'collection-browse.orderCount').toBeGreaterThan(0);

    // Verify every clickable item has a count in parentheses and sum them.
    let totalCount = 0;
    for (let i = 0; i < clickableCount; i++) {
        const text = await clickableItems.nth(i).innerText();
        const countMatch = text.match(/\((\d+)\)/);
        if (countMatch) {
            const count = parseInt(countMatch![1], 10);
            expect(count, 'collection-browse.eachOrderCount').toBeGreaterThan(0);
            totalCount += count;
        }
    }

    // Get the total records count from the images summary, should equal the sum of
    // all clickable facet counts at the current taxonomy level.
    const totalRecordsEl = page.locator('div.images-summary .total-records');
    await expect(totalRecordsEl).toBeVisible();
    const totalRecordsText = await totalRecordsEl.innerText();
    const totalRecords = parseInt(totalRecordsText.replace(/,/g, ''), 10);
    expect(totalRecords, 'collection-browse.totalRecordsVsOrders').toBe(totalCount);

    const imagesEl = page.locator('div.images-container');
    await expect(imagesEl).toBeVisible();
    let images = imagesEl.locator('.imgCon');
    await expect(images.first()).toBeVisible();

    // Detect the page size from the number of images currently displayed, then
    // use that to decide whether a show-more button should be present.
    const displayedCount = await images.count();
    expect(displayedCount, 'collection-browse.imageCount').toBeGreaterThan(0);

    if (totalCount > displayedCount) {
        // There are more records than are currently shown — expect a show-more button.
        const showMoreButton = page.locator('.btn.show-more');
        const showMoreCount = await showMoreButton.count();
        expect(showMoreCount).toBeGreaterThan(0);
        if (showMoreCount > 0) {
            await expect(showMoreButton).toBeVisible();
            await showMoreButton.scrollIntoViewIfNeeded();
            await showMoreButton.click();
            // wait until more images are appended beyond the initial batch
            await expect(async () => {
                const count = await imagesEl.locator('.imgCon').count();
                expect(count).toBeGreaterThan(displayedCount);
            }).toPass();
        }
    }

    //check images should have a link to the record page, and the link should contain /record/ in its href
    const firstImageLinks = images.first().locator('a');
    await expect(firstImageLinks, 'collection-browse.imageLinksPerCard').toHaveCount(3);

    // Type status facet — assert and test a type status filter before drilling into taxonomy,
    // because clicking a taxonomy item resets and reloads facets.
    // The label to search for defaults to "HOLOTYPE" but can be overridden via
    // filterLabels.holotype in the live config when the collection has no holotypes.
    const typesFacet = page.locator('div.typeStatus-facet');
    await expect(typesFacet).toHaveCount(1);

    const clickableTypes = typesFacet.locator('span.clickable');
    await expect(clickableTypes.first()).toBeVisible();
    const typesCount = await clickableTypes.count();
    expect(typesCount, 'collection-browse.typeStatusCount').toBeGreaterThan(0);

    const holotypeLabel = getFilterLabel('holotype', 'HOLOTYPE');
    let foundHolotype = false;
    let holotypeCount = 0;
    let holotypeClickable: Locator | null = null;
    for (let i = 0; i < typesCount; i++) {
        const text = await clickableTypes.nth(i).innerText();
        if (text.includes(holotypeLabel)) {
            foundHolotype = true;
            const countMatch = text.match(/\((\d+)\)/);
            if (countMatch) {
                holotypeCount = parseInt(countMatch![1], 10);
                expect(holotypeCount, 'collection-browse.holotypeCount').toBeGreaterThan(0);
                holotypeClickable = clickableTypes.nth(i);
            }
            break;
        }
    }
    expect(foundHolotype, 'collection-browse.holotypeLabel').toBeTruthy();

    // Click the type status filter and verify the total records count is updated accordingly
    if (holotypeClickable) {
        await holotypeClickable.scrollIntoViewIfNeeded();
        await holotypeClickable.click();
        await page.waitForTimeout(1000); // wait a bit for the content to update

        const filteredTotalRecordsEl = page.locator('div.images-summary .total-records');
        await expect(filteredTotalRecordsEl).toBeVisible();
        const filteredTotalRecordsText = await filteredTotalRecordsEl.innerText();
        const filteredTotalRecords = parseInt(filteredTotalRecordsText.replace(/,/g, ''), 10);
        expect(filteredTotalRecords, 'collection-browse.filteredVsHolotype').toBeLessThanOrEqual(holotypeCount);
    }

    // Click the first clickable taxonomy item to drill one level deeper, then
    // verify the hierarchy gained exactly one new rank and images updated.
    const firstClickable = clickableItems.first();
    await firstClickable.scrollIntoViewIfNeeded();
    await firstClickable.click();

    // After drilling, there should be one more li.taxon-rank than before.
    await expect(async () => {
        const newRankCount = await autodrillRanks.count();
        expect(newRankCount).toBeGreaterThan(autodrillRankCount);
    }).toPass({ timeout: 15000 });

    // Images container must still be present after drilling.
    await expect(page.locator('div.images-summary')).toBeVisible();
    await expect(imagesEl).toBeVisible();
});
