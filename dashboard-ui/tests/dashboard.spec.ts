import { test, expect,Locator, Page } from '@playwright/test';
// @ts-ignore
import fs from 'fs';
import AdmZip from 'adm-zip';

//22 widgets for now
const expectedWidgets = JSON.parse(fs.readFileSync('tests/resources/expectedWidgets.json', 'utf-8'));

test('first sight on the board', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);
  // Find widgets
  const panels = page.locator('div.dashboardPanel.card');
  await expect(panels).toHaveCount(expectedWidgets.length);

  const headers = page.locator('div.dashboardPanelHeader.card-header h1.dashboardH1');
  for (let i = 0; i < expectedWidgets.length; i++) {
    const headerText = await headers.nth(i).innerText();
    const regex = new RegExp(expectedWidgets[i].titlePattern);
    expect(headerText).toMatch(regex);
  }

  const count = await panels.count();
  for(let i=0; i < count; i++) {
    const panel = panels.nth(i);
    const header = panel.locator('div.dashboardPanelHeader.card-header h1.dashboardH1');
    const headerTitle = await header.innerText();

    //Find the matched widget defined in target JSON file
    const widget = expectedWidgets.find(it => headerTitle.match(it.title))
    if (!widget) {
      console.error(headerTitle + " is not found!")
    }
    expect(widget).toBeDefined();
    if (widget) {
      if (widget.content) {
        //e.g Occurrence Records
        const panelBody = panel.locator('div.dashboardPanelBody.card-body');
        const allText = await panelBody.innerText();
        expect(allText.trim().replace(/[\n\t]/g, ' ')).toBe(widget.content);
      }
      if (widget.table) {
        //e.g. Datasets, Basis Of Record
        let rows = panel.locator('table.dashboardTable tbody tr');
        let count = await rows.count();
        if (count == 0) {
            //e.g Occurrence Tree
            rows = panel.locator('table.dashboardTree tbody tr');
            count = await rows.count();
        }

        const srcValuesInTable: string[] = [];

        for (let i = 0; i < count; i++) {
            const cells = rows.nth(i).locator('td');
            // Grab all cell texts in one shot
            const cellTexts = await cells.allInnerTexts();
            const rowText = cellTexts.map(t => t.trim()).join(' ');

            // Only push if not empty after trimming
            if (rowText.trim().length > 0) {
                srcValuesInTable.push(rowText.trim());
            }
        }

        for (const expected of widget.table) {
          // Find a matching row in multiArray
          const match = srcValuesInTable.find(
             it => it === expected
          );

          // Assert that the row exists
          if (!match) {
            // Log out what was expected vs what was found
            console.error(`Expected: ${expected}`);
            console.error('Source table values:', srcValuesInTable);
          }
          expect(match).toBeDefined();
        }
      }
    }
  }
});

test('datasets', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panel = await findPanelByHeaderRegex(page, /\d{1,3}(,\d{3})* Datasets/);
    expect(panel).toBeDefined();
    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const link = panelBody.locator('a.dashboardLargeLink');

    const href = await link.getAttribute('href');
    const text = await link.innerText();

    expect(href).toMatch(/^https?:\/\/collections(?:\.test)?\.ala\.org\.au\/ws\/dataResource\/.*$/);
    expect(text).toBe('Zosteria fulvipubescens');
});

//Clickable tables and select
test('basis of record, Most Recorded Species, Type Specimens etc', async ({ page }) => {
    test.setTimeout(60000);
    const widgetsWithExtra = expectedWidgets.filter(w => w.select || w.expectedUrl);

    await page.goto('/');
    await expect(page).toHaveTitle(/Dashboard \| Atlas of Living Australia/);

    for (const { title, expectedUrl, select} of widgetsWithExtra) {
        //console.log(`Testing widget: ${title}`);
        const regexTitle = new RegExp(title);
        const panel = await findPanelByHeaderRegex(page, regexTitle);
        expect(panel, `Panel not found: ${regexTitle}`).toBeDefined();

        if(expectedUrl) {
            const regexUrl = new RegExp(expectedUrl);
            await testDashboardPanelNavigation(
                page,
                panel,
                regexUrl
            );
            //console.log(` - Table click passed`);
        }

        if (select) {
            const selectOptions = select.selectOptions;
            const expectedSelectedValuesInTable = select.expectedSelectedValuesInTable
            await testSelect(page,panel,selectOptions, expectedSelectedValuesInTable)
            //console.log(` - Selection passed`);
        }
        //console.log(`✔ All passed`);
    }
});

//Charts
test('collections -> chart', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

      const panel = await findPanelByHeaderRegex(page, /\d{1,3}(,\d{3})* Collections/);
      expect(panel).toBeDefined();
      const panelBody = panel.locator('div.dashboardPanelBody.card-body');
      const canvas = panelBody.locator('canvas[role="img"]');
      await expect(canvas).toHaveCount(1);
      await canvas.scrollIntoViewIfNeeded();
      const bbox = await canvas.boundingBox();
      expect(bbox).toBeTruthy();
      // Not sure why canvas.click() does not work here
      // Approximate "center of top-left quarter"
      const quarterX = bbox.x + bbox.width / 4;
      const quarterY = bbox.y + bbox.height / 4;


      // Wait for popup triggered by canvas click
      const [collectionsPage] = await Promise.all([
        page.waitForEvent('popup'),
        (async () => {
          // Move and click at that point
          await page.mouse.move(quarterX, quarterY);
          await page.waitForTimeout(1000); // wait for stability
          await page.mouse.click(quarterX, quarterY);
        })(),
      ]);

      await collectionsPage.waitForLoadState();
      const popupUrl = collectionsPage.url();
      expect(popupUrl).toMatch(/^https?:\/\/collections(?:\.test)?\.ala\.org\.au\/\?start=.*$/)
});

test('Records by State and Territory -> chart', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panel = await findPanelByHeaderRegex(page, /Records by State and Territory/);
    expect(panel).toBeDefined();
    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const canvas = panelBody.locator('canvas[role="img"]');
    await expect(canvas).toHaveCount(1);
    await canvas.scrollIntoViewIfNeeded();
    const bbox = await canvas.boundingBox();
    expect(bbox).toBeTruthy();
    // Not sure why canvas.click() does not work here
    // Approximate "center of top-left quarter"
    const quarterX = bbox.x + bbox.width / 4;
    const quarterY = bbox.y + bbox.height / 4;


    // Wait for popup triggered by canvas click
    const [collectionsPage] = await Promise.all([
        page.waitForEvent('popup'),
        (async () => {
            // Move and click at that point
            await page.mouse.move(quarterX, quarterY);
            await page.waitForTimeout(1000); // wait for stability
            await page.mouse.click(quarterX, quarterY);
        })(),
    ]);

    await collectionsPage.waitForLoadState();
    const popupUrl = collectionsPage.url();
    expect(popupUrl).toMatch(/^https?:\/\/biocache(?:\.test)?\.ala\.org\.au\/occurrences\/search\?q=stateProvince:.*$/)
    await collectionsPage.goBack();
    await collectionsPage.waitForLoadState();
});

test('Records and Species by Decade -> chart', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);

    const panel = await findPanelByHeaderRegex(page, /Records and Species by Decade/);
    expect(panel).toBeDefined();
    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const canvas = panelBody.locator('canvas[role="img"]');
    await expect(canvas).toHaveCount(1);
    await canvas.scrollIntoViewIfNeeded();
    const bbox = await canvas.boundingBox();
    expect(bbox).toBeTruthy();
    // Not sure why canvas.click() does not work here
    // Approximate "half below and a little bit left"
    const halfBelowX = bbox.x + bbox.width / 2 - 20; // center minus 20px to the left
    const halfBelowY = bbox.y + bbox.height / 2;     // halfway down vertically

    // Wait for popup triggered by canvas click
    const [biocachePage] = await Promise.all([
        page.waitForEvent('popup'),
        (async () => {
            // Move and click at that point
            await page.mouse.move(halfBelowX, halfBelowY);
            await page.waitForTimeout(1000); // wait for stability
            await page.mouse.click(halfBelowX, halfBelowY);
        })(),
    ]);

    await biocachePage.waitForLoadState();
    const popupUrl = biocachePage.url();
    expect(popupUrl).toMatch(/^https?:\/\/biocache(?:\.test)?\.ala\.org\.au\/occurrences\/search\?q=decade:.*$/)
});

test('CSV download', async ({ page }) => {
    const expectedCSVFiles = fs.readFileSync('tests/resources/expectedCSVFiles.csv', 'utf-8').trim()
        .split('\n');

    await page.goto('/');
    await expect(page).toHaveTitle(/Dashboard | Atlas of Living Australia/);
    const [ download ] = await Promise.all([
        page.waitForEvent('download'), // wait for download to start
        page.locator('a.btn', { hasText: 'Download as CSV' }).click()   // click the link that triggers download
    ]);

    const path = await download.path();
    expect(path).not.toBeNull();
    const zip = new AdmZip(path!);

    // List all files inside
    const entries = zip.getEntries().map(e => e.entryName);
    for (const file of expectedCSVFiles) {
        expect(entries).toContain(file);
    }

});


async function testSelect(page:Page, panel:Locator,expectedSelect : String[], expectedSelectedValueInTable : Record<string, string[]>) {
    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const select = panelBody.locator('div.dashboardSelectWrapper select')
    await select.scrollIntoViewIfNeeded()
    const options = select.locator('option')
    const optionTexts = await options.allTextContents();

    // Check each expected value is included
    for (const expected of expectedSelect) {
        expect(optionTexts).toContain(expected);
    }

    //Select the 2nd option
    await select.selectOption({ index: 1 });
    const selectedValue = await select.inputValue(); //value
    const selectedText = await select.locator('option:checked').textContent(); //text
    expect(selectedText).toBe(expectedSelect[1]);

    //Read and joined texts from td
    let rows = panel.locator('table.dashboardTable tbody tr');
    let count = await rows.count();
    const srcValuesInTable: string[] = [];

    for (let i = 0; i < count; i++) {
        const cells = rows.nth(i).locator('td');
        // Grab all cell texts in one shot
        const cellTexts = await cells.allInnerTexts();
        const rowText = cellTexts.map(t => t.trim()).join(' ');

        // Only push if not empty after trimming
        if (rowText.trim().length > 0) {
            srcValuesInTable.push(rowText.trim());
        }
    }

    const expected : String[] = expectedSelectedValueInTable[selectedText]
    for (const value of expected) {
        expect(srcValuesInTable).toContain(value);
    }
}


/**
 * Test navigation from a dashboard panel row.
 *
 * This helper function finds a dashboard panel by its header title regex,
 * verifies that it has rows, and then attempts to click the first row.
 * If the row is clickable (cursor style is "pointer"), it waits for the page
 * to navigate to the expected URL and asserts that the new URL matches.
 *
 * @param page - Playwright Page object (browser context for the test).
 * @param panel - Palywright selector - the panel of widget
 * @param expectedUrlRegex - Regular expression for the URL expected after clicking.
 *                           Example: ^https?:\/\/biocache(?:\.test)?\.ala\.org\.au\/occurrences\/search\?q=basisOfRecord:.*
**/
async function testDashboardPanelNavigation(
    page: Page,
    panel: Locator,
    expectedUrlRegex: RegExp
) {

    const panelBody = panel.locator('div.dashboardPanelBody.card-body');
    const rows = panelBody.locator('table.dashboardTable tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);

    await panel.scrollIntoViewIfNeeded();

    const row1 = rows.nth(0);
    await row1.scrollIntoViewIfNeeded();
    await row1.hover();

    const cursor = await row1.evaluate(el => getComputedStyle(el).cursor);

    if (cursor === 'pointer') {
        await Promise.all([
            page.waitForURL(expectedUrlRegex),
            row1.click(),
        ]);

        const newURL = page.url();
        expect(newURL).toMatch(expectedUrlRegex);
        await page.goBack();
        await page.waitForLoadState('networkidle');
    }
}

/**
 * Find a dashboard panel whose header text matches a regex pattern.
 *
 * @param page - Playwright Page object
 * @param pattern - Regex pattern to match against header text
 * @returns Locator for the matching panel, or undefined if not found
 */
async function findPanelByHeaderRegex(page: Page, pattern: RegExp): Promise<Locator | undefined> {
  const panels = page.locator('div.dashboardPanel.card');
  await expect(panels).toHaveCount(expectedWidgets.length);
  const count = await panels.count();

  for (let i = 0; i < count; i++) {
    const panel = panels.nth(i);
    const header = panel.locator('div.dashboardPanelHeader.card-header h1.dashboardH1');
    const headerTitle = await header.innerText();

    if (pattern.test(headerTitle)) {
      return panel;
    }
  }

  return undefined;
}


