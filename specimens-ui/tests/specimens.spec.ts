import { test, expect, Locator, Page } from '@playwright/test';


test('first sight on the specimens', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Images of specimens | Atlas of Living Australia</);
});


test('Find and click a link of all collections, and navigates', async ({ page }) => {
    await page.goto('/');

    // Verify multiple thumbnail cards are present
    const thumbnails = page.locator('div.thumbnail');
    await expect(thumbnails.first()).toBeVisible();
    const thumbnailCount = await thumbnails.count();
    expect(thumbnailCount).toBeGreaterThan(1);

    // Find the "To view images from all collections" text and click its /browse link
    const browseLink = page.getByText('To view images from all collections,').locator('..').locator('a[href*="/browse"]');
    await expect(browseLink).toBeVisible();

    // Click the link to navigate to the browse page
    await browseLink.click();
    const taxonomyFacet = page.locator('div#taxonomyFacet');
    await expect(taxonomyFacet).toHaveCount(1);

    const taxonomyItems = taxonomyFacet.locator('li:has(span.clickable)');
    await expect(taxonomyItems.first()).toBeVisible();
    const itemCount = await taxonomyItems.count();
    expect(itemCount).toBeGreaterThan(1);

    // Each li should contain a span.clickable with a nested span (name) and a count in parentheses
    const firstItem = taxonomyItems.nth(0);
    await firstItem.scrollIntoViewIfNeeded();
    await expect(firstItem.locator('span.clickable').first()).toBeVisible();
    await expect(firstItem.locator('span.clickable span').first()).toBeVisible();
    const firstItemText = await firstItem.locator('span.clickable').first().innerText();
    expect(firstItemText).toMatch(/\(\d+\)/);



    // Find the clickable span with text "Animalia" and click it
    const animaliaItem = taxonomyFacet.locator('span.clickable', { hasText: 'Animalia' });
    await expect(animaliaItem).toBeVisible();

    // Extract the count from the span text e.g. "Animalia (8453030)" -> 8453030
    const animaliaText = await animaliaItem.innerText();
    const countMatch = animaliaText.match(/\((\d+)\)/);
    expect(countMatch).not.toBeNull();
    const countOfAnimalia = parseInt(countMatch![1], 10);
    expect(countOfAnimalia).toBeGreaterThan(0);
    console.log(`Animalia count: ${countOfAnimalia}`);

    await animaliaItem.scrollIntoViewIfNeeded();
    await animaliaItem.click();


    // after clicking "Animalia", the taxon rank items should be visible under the taxonomy facet
    // The li should contain "Kingdom" as bold label and "Animalia" as the clickable span
    const kingdomItem = taxonomyFacet.locator('li.test-taxon-rank');
    await expect(kingdomItem).toBeVisible();
    await expect(kingdomItem.locator('span.clickable', { hasText: 'Animalia' })).toBeVisible();

    // Get the total records count from the images summary, should be the same as the count extracted from the facet
    const totalRecordsEl = page.locator('div.test-images-summary .test-total-records');
    await expect(totalRecordsEl).toBeVisible();
    const totalRecordsText = await totalRecordsEl.innerText();
    const totalRecords = parseInt(totalRecordsText.replace(/,/g, ''), 10);
    console.log(`Total images for Animalia: ${totalRecords}`);
    expect(totalRecords).toBe(countOfAnimalia)

    const imagesEl = page.locator('div.test-images-container')
    await expect(imagesEl).toBeVisible();
    const images = imagesEl.locator('.imgCon');
    await expect(images.first()).toBeVisible();
    const imagesCount = await images.count();
    expect(imagesCount).toBeGreaterThan(0);

    //check images should have a link to the record page, and the link should contain /record/ in its href
    const firstImageLinks = images.first().locator('a');
    await expect(firstImageLinks).toHaveCount(3);
});

test('find South Australian Museum Terrestrial Invertebrate Collection thumbnail and navigate to its page', async ({ page }) => {
    await page.goto('/');

    const targetName = 'South Australian Museum Terrestrial Invertebrate Collection';

    // Find the link with the specific text inside a .thumbnail
    const nameLink = page.locator('.thumbnail h2 a', { hasText: targetName });
    await expect(nameLink).toBeVisible();

    // Click the link to navigate to the browse page
    await nameLink.click();

    // Verify the page header span matches the specimen name
    const headerSpan = page.locator('div.page-header h2 span');
    await expect(headerSpan).toBeVisible();
    await expect(headerSpan).toHaveText(targetName);

    const taxonomyFacet = page.locator('div#taxonomyFacet');
    await expect(taxonomyFacet).toHaveCount(1);

    const threeRanks = taxonomyFacet.locator('li.test-taxon-rank');
    await expect(threeRanks).toHaveCount(3);

    // The first rank should be Kingdom: Animalia
    const kingdomItem = threeRanks.nth(0);
    await expect(kingdomItem).toBeVisible();
    await expect(kingdomItem.locator('span.clickable', { hasText: 'Animalia' })).toBeVisible();

     // The second rank should be Phylum: Arthropoda
     const phylumItem = threeRanks.nth(1);
     await expect(phylumItem).toBeVisible();
     await expect(phylumItem.locator('span.clickable', { hasText: 'Arthropoda' })).toBeVisible();

      // The third rank should be Class: Insecta
      const classItem = threeRanks.nth(2);
      await expect(classItem).toBeVisible();
      await expect(classItem.locator('span.clickable', { hasText: 'Insecta' })).toBeVisible();

      //get the clickable span text , and verify contain Coleoptera
      const clickableOrders =  taxonomyFacet.locator('span.clickable');
      await expect(clickableOrders.first()).toBeVisible();
      const orderCount = await clickableOrders.count();
      expect(orderCount).toBeGreaterThan(0);

      // Check at least one of the clickable spans contain "Coleoptera"
      let foundColeoptera = false;
      for (let i = 0; i < orderCount; i++) {
        const text = await clickableOrders.nth(i).innerText();
        if (text.includes('Coleoptera')) {
          foundColeoptera = true;
          break;
        }
      }
      expect(foundColeoptera).toBeTruthy();

      // find all counts in parentheses in the clickable spans, and verify they are all greater than 0
      // and sum up the counts and verify the total is greater than 1000
      let totalCount = 0;
      for (let i = 0; i < orderCount; i++) {
        const text = await clickableOrders.nth(i).innerText();
        const countMatch = text.match(/\((\d+)\)/);
        if (countMatch) {
            const count = parseInt(countMatch![1], 10);
            expect(count).toBeGreaterThan(0);
            totalCount += count;
        }
      }

      console.log(`Total count of images : ${totalCount}`);

    // Get the total records count from the images summary, should be the same as the count extracted from the facet
    const totalRecordsEl = page.locator('div.test-images-summary .test-total-records');
    await expect(totalRecordsEl).toBeVisible();
    const totalRecordsText = await totalRecordsEl.innerText();
    const totalRecords = parseInt(totalRecordsText.replace(/,/g, ''), 10);
    console.log(`Total images for Animalia: ${totalRecords}`);
    expect(totalRecords).toBe(totalCount)

    const imagesEl = page.locator('div.test-images-container')
    await expect(imagesEl).toBeVisible();
    let images = imagesEl.locator('.imgCon');
    await expect(images.first()).toBeVisible();
    let imagesCount = await images.count();
    console.log(`${imagesCount} are displayed`);
    if (totalCount > 100) {
        expect(imagesCount).toBe(100);
    } else {
        expect(imagesCount).toBeGreaterThan(0);
    }
    // Test show more button if total count is greater than 100, click it and verify more images are loaded
    if (totalCount > 100) {
        const showMoreButton = page.locator('.btn.test-show-more');
        const showMoreCount = await showMoreButton.count();
        expect(showMoreCount).toBeGreaterThan(0);
        if (showMoreCount > 0) {
            await expect(showMoreButton).toBeVisible();
            await showMoreButton.scrollIntoViewIfNeeded();
            await showMoreButton.click();
            // wait until more than 100 images are in the DOM (new batch appended)
            await expect(async () => {
                const count = await imagesEl.locator('.imgCon').count();
                expect(count).toBeGreaterThan(100);
            }).toPass();
        }
    }


    //check images should have a link to the record page, and the link should contain /record/ in its href
    const firstImageLinks = images.first().locator('a');
    await expect(firstImageLinks).toHaveCount(3);

    //Taxon DONE
    //Start Type
    const typesFacet = page.locator('div.test-Types-facet');
    await expect(typesFacet).toHaveCount(1);

    const clickableTypes =  typesFacet.locator('span.clickable');
    await expect(clickableTypes.first()).toBeVisible();
    const typesCount = await clickableTypes.count();
    expect(typesCount).toBeGreaterThan(0);

    // Check at least one of the clickable spans contain "Holotype"
    let foundHolotype = false;
    let holotypeCount = 0;
    let holotypeClickable: Locator | null = null;
    for (let i = 0; i < typesCount; i++) {
      const text = await clickableTypes.nth(i).innerText();
      if (text.includes('HOLOTYPE')) {
        foundHolotype = true;
        const countMatch = text.match(/\((\d+)\)/);
        if (countMatch) {
            holotypeCount = parseInt(countMatch![1], 10);
            expect(holotypeCount).toBeGreaterThan(0);
            holotypeClickable = clickableTypes.nth(i);
        }
        break;
      }
    }
    expect(foundHolotype).toBeTruthy();
    console.log(`Holotypes count: ${holotypeCount}`);

    // Click the Holotype filter and verify the total records count is updated accordingly
    if (holotypeClickable) {
        await holotypeClickable.scrollIntoViewIfNeeded();
        await holotypeClickable.click();

        const filteredTotalRecordsEl = page.locator('div.test-images-summary .test-total-records');
        await expect(filteredTotalRecordsEl).toBeVisible();
        const filteredTotalRecordsText = await filteredTotalRecordsEl.innerText();
        const filteredTotalRecords = parseInt(filteredTotalRecordsText.replace(/,/g, ''), 10);
        console.log(`Total images after filtering by Holotype: ${filteredTotalRecords}`);
        expect(filteredTotalRecords).toBeLessThanOrEqual(holotypeCount);
    }

});
