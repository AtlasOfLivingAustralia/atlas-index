import { test, expect } from '../fixtures';
import { setupMocks, loadResults, BASE_URL } from './helpers';
import { mockIndexFields } from '../mocks/biocacheMocks';
import { mockDataQualityProfiles } from '../mocks/apiMocks';

// ===========================================================================
// g_dataQualityProfiles (tests/resources/dataQualityProfiles.json) gives every
// category an EMPTY qualityFilters array -- deliberately, so the acceptance
// suite's per-category filter tables only ever render headers. That leaves
// dataQualityCategoryInfoModal.tsx's fieldName()/fieldDescription()/infoUrl()
// helpers, its 2 field/filter tables' row-rendering, and DataQualityInfoModal's
// own (separate) copy of the same qualityFilters.map()/infoUrl() logic entirely
// unexercised. This fixture clones the default profiles but gives
// "spatiallySuspect" 2 real filters -- one assertions-prefixed (hits infoUrl's
// first regex branch) and one plain field (hits its second, generic branch).
// ===========================================================================
const g_profilesWithFilters = [
    {
        id: 1,
        name: 'ALA General',
        shortName: 'ALA',
        description: 'The default ALA data quality profile. Excludes records that fail one or more general-purpose spatial and taxonomic quality checks.',
        contactName: 'ALA Support',
        contactEmail: 'support@ala.org.au',
        enabled: true,
        isDefault: true,
        displayOrder: 1,
        categories: [
            {
                id: 101,
                enabled: true,
                name: 'Exclude spatially suspect records',
                label: 'spatiallySuspect',
                description: 'Records with coordinates that are zero, default, or otherwise spatially invalid.',
                displayOrder: 1,
                inverseFilter: 'spatiallySuspect:true',
                qualityFilters: [
                    { filter: 'assertions:zeroCoordinates', description: 'Coordinates are exactly 0,0' },
                    { filter: 'decimalLatitude:0', description: 'Latitude is exactly zero' },
                ],
            },
            {
                id: 102, enabled: true, name: 'Exclude unidentified records', label: 'unidentified',
                description: 'Records that have not been identified to at least kingdom level.',
                displayOrder: 2, inverseFilter: 'taxonRank:kingdom', qualityFilters: [],
            },
            {
                id: 103, enabled: true, name: 'Exclude records with low quality identification', label: 'lowQualityIdentification',
                description: 'Records flagged with a low-confidence species identification.',
                displayOrder: 3, inverseFilter: 'identificationVerificationStatus:unverified', qualityFilters: [],
            },
        ],
    },
];

const g_fieldsWithDescriptions = [
    { name: 'assertions', info: 'Data quality assertions raised against this record', indexed: true, stored: true },
    { name: 'decimalLatitude', description: 'The geographic latitude at which the occurrence was recorded', indexed: true, stored: true },
];

async function expandDqBar(page: import('@playwright/test').Page) {
    await expect(page.locator('#dataQuality')).toBeVisible({ timeout: 15000 });
    if (await page.locator('#dataQuality .bi-caret-right-fill').count() > 0) {
        await page.locator('#dataQuality b.dqLabel').click();
    }
}

test.describe('DataQualityInfoModal', () => {
    test('shows profile details and category tables for the active profile; Close does not navigate', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);
        await expect(page).toHaveURL(/qualityProfile=ALA/);

        await page.locator('.DQProfileDetailsLink').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('Data quality profile description');
        await expect(modal).toContainText('ALA General');
        await expect(modal).toContainText('The default ALA data quality profile');
        await expect(modal).toContainText('ALA Support');
        await expect(modal.locator('a[href^="mailto:"]')).toContainText('support@ala.org.au');

        // 3 category blocks for ALA -- every category's qualityFilters is [] in the
        // fixture, so each per-category filter table renders zero data rows (only
        // headers), but the name/description themselves always render.
        await expect(modal).toContainText('Exclude spatially suspect records');
        await expect(modal).toContainText('Records with coordinates that are zero, default, or otherwise spatially invalid.');
        await expect(modal).toContainText('Exclude unidentified records');
        await expect(modal).toContainText('Exclude records with low quality identification');

        await expect(modal.getByRole('link', { name: 'Learn More' })).toHaveAttribute('href', /support\.ala\.org\.au/);

        const urlBefore = page.url();
        // getByRole('button', {name: 'Close'}) is ambiguous here: Modal.Header's
        // closeButton X-icon ALSO has accessible name "Close" (react-bootstrap's
        // CloseButton default aria-label), in addition to the footer's own text
        // "Close" button -- scope to the footer, which has exactly one button.
        await modal.locator('.modal-footer button').click();
        await expect(modal).not.toBeVisible();
        // Purely a read-only display modal -- Close never triggers addParams()/reload.
        expect(page.url()).toBe(urlBefore);
    });

    test('shows blank profile details once the active profile is switched to "disable" (no dq entry matches)', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);

        await page.locator('#dataQualitySelect select').selectOption('disable');
        // profile==='disable' takes the disableAllQualityFilters=true branch, not
        // qualityProfile=disable -- see OccurrenceList.tsx's updateDataQualityInfo().
        await expect(page).toHaveURL(/disableAllQualityFilters=true/);

        await page.locator('.DQProfileDetailsLink').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('Data quality profile description');
        // data stays undefined ('disable' matches no dq.shortName) -- every profile
        // cell renders blank and data?.categories short-circuits, so zero category
        // blocks render at all.
        await expect(modal).not.toContainText('ALA General');
        await expect(modal).not.toContainText('Exclude spatially suspect records');
    });
});

test.describe('DataQualityCategoryInfoModal', () => {
    test('a not-yet-disabled category shows a loading spinner then an excluded count with a "View excluded records" link', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls);
        await loadResults(page);
        await expandDqBar(page);

        const row = page.locator('.dqFilter', { hasText: 'Exclude spatially suspect records' });
        await row.locator('.bi-info-circle').click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal.locator('#excluded')).toContainText('records are excluded by this category');
        // The mock's "no pageSize param at all" branch always answers with
        // unfilteredTotalRecords (824877), regardless of which category's fq is used.
        await expect(modal.locator('#excluded')).toContainText('824877');
        await expect(modal.getByText('View excluded records')).toBeVisible();
        // "Expand and edit filters" is also offered since !expanded && count>0.
        await expect(modal.getByText('Expand and edit filters')).toBeVisible();
    });

    test('clicking "View excluded records" navigates with disableAllQualityFilters + the category\'s inverse filter', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls);
        await loadResults(page);
        await expandDqBar(page);

        await page.locator('.dqFilter', { hasText: 'Exclude spatially suspect records' }).locator('.bi-info-circle').click();
        const modal = page.getByRole('dialog');
        await expect(modal.getByText('View excluded records')).toBeVisible({ timeout: 10000 });
        await modal.getByText('View excluded records').click();

        await expect(page).toHaveURL(/disableAllQualityFilters=true/);
        // dataQualityCategoryInfoModal.tsx's showOnly() builds this param via plain
        // string concat ("fq=" + category.inverseFilter) through addParams() ->
        // window.location.replace() -- the colon is never passed through
        // encodeURIComponent/URLSearchParams, so it stays literal, not %3A.
        await expect(page).toHaveURL(/fq=spatiallySuspect:true/);
    });

    test('clicking "Expand and edit filters" navigates with disableQualityFilter for that category', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls);
        await loadResults(page);
        await expandDqBar(page);

        await page.locator('.dqFilter', { hasText: 'Exclude unidentified records' }).locator('.bi-info-circle').click();
        const modal = page.getByRole('dialog');
        await expect(modal.getByText('Expand and edit filters')).toBeVisible({ timeout: 10000 });
        await modal.getByText('Expand and edit filters').click();

        await expect(page).toHaveURL(/disableQualityFilter=unidentified/);
        await expect(page).toHaveURL(/qualityProfile=ALA/);
    });

    test('a category already in disableQualityFilter shows a fixed 0 count with neither action link, and Close does not navigate', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockIndexFields(page, seenUrls);
        // Navigate directly with the category already disabled, rather than reaching
        // this state via 2 sequential UI actions (which would themselves be separate
        // full-page reloads) -- exercises the modal's `isExpanded` branch directly.
        await page.goto(`${BASE_URL}/occurrences/search?q=taxa:"acacia"&qualityProfile=ALA&disableQualityFilter=spatiallySuspect`);
        await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 15000 });
        await expandDqBar(page);

        const row = page.locator('.dqFilter', { hasText: 'Exclude spatially suspect records' });
        // Already-disabled categories render the plain (unchecked) square icon, not
        // the DataQualityExcluded sub-component -- but the info-circle trigger is
        // unconditional either way.
        await expect(row.locator('.bi-square')).toBeVisible();
        await row.locator('.bi-info-circle').click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal.locator('#excluded')).toContainText('0');
        await expect(modal.getByText('View excluded records')).not.toBeVisible();
        await expect(modal.getByText('Expand and edit filters')).not.toBeVisible();

        const urlBefore = page.url();
        // See the earlier "Close does not navigate" test's comment -- getByRole('button',
        // {name:'Close'}) is ambiguous between the Modal.Header X-icon and the footer's
        // own text button; scope to the footer.
        await modal.locator('.modal-footer button').click();
        await expect(modal).not.toBeVisible();
        expect(page.url()).toBe(urlBefore);
    });
});

test.describe('DataQualityFiltersModal', () => {
    test('unchecking one category and clicking Apply navigates with disableQualityFilter for just that category', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);
        await expandDqBar(page);

        await page.locator('.ms-2.no-wrap.dqLabel', { hasText: 'Select filters' }).click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('Filter selection');

        const row = modal.locator('tbody tr', { hasText: 'Exclude unidentified records' });
        await expect(row.locator('input[type=checkbox]')).toBeChecked();
        await row.locator('input[type=checkbox]').uncheck();

        await modal.getByRole('button', { name: 'Apply' }).click();
        await expect(page).toHaveURL(/disableQualityFilter=unidentified/);
        // The other 2 categories were left selected -- must NOT appear as disabled.
        await expect(page).not.toHaveURL(/disableQualityFilter=spatiallySuspect/);
        await expect(page).not.toHaveURL(/disableQualityFilter=lowQualityIdentification/);
    });

    test('the header "select all" checkbox deselects and reselects every category row', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);
        await expandDqBar(page);

        await page.locator('.ms-2.no-wrap.dqLabel', { hasText: 'Select filters' }).click();
        const modal = page.getByRole('dialog');
        const headerCheckbox = modal.locator('thead input[type=checkbox]');
        // All 3 selected by default -- header starts checked.
        await expect(headerCheckbox).toBeChecked();

        await headerCheckbox.uncheck();
        for (const name of ['Exclude spatially suspect records', 'Exclude unidentified records', 'Exclude records with low quality identification']) {
            await expect(modal.locator('tbody tr', { hasText: name }).locator('input[type=checkbox]')).not.toBeChecked();
        }

        await headerCheckbox.check();
        for (const name of ['Exclude spatially suspect records', 'Exclude unidentified records', 'Exclude records with low quality identification']) {
            await expect(modal.locator('tbody tr', { hasText: name }).locator('input[type=checkbox]')).toBeChecked();
        }

        // Fully re-selected -- Apply should not disable anything.
        await modal.getByRole('button', { name: 'Apply' }).click();
        await expect(page).not.toHaveURL(/disableQualityFilter=/);
    });

    test('"Expand and edit filters" marks a category Expanded; Apply then disables it via disableQualityFilter', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);
        await expandDqBar(page);

        await page.locator('.ms-2.no-wrap.dqLabel', { hasText: 'Select filters' }).click();
        const modal = page.getByRole('dialog');
        const row = modal.locator('tbody tr', { hasText: 'Exclude spatially suspect records' });

        await row.getByText('Expand and edit filters').click();
        await expect(row.locator('input[type=checkbox]')).not.toBeChecked();
        await expect(row.getByText('Expanded', { exact: true })).toBeVisible();

        await modal.getByRole('button', { name: 'Apply' }).click();
        await expect(page).toHaveURL(/disableQualityFilter=spatiallySuspect/);
    });

    test('Cancel closes the modal without navigating', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);
        await expandDqBar(page);

        await page.locator('.ms-2.no-wrap.dqLabel', { hasText: 'Select filters' }).click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await modal.locator('tbody tr').first().locator('input[type=checkbox]').uncheck();

        const urlBefore = page.url();
        await modal.getByRole('button', { name: 'Cancel' }).click();
        await expect(modal).not.toBeVisible();
        expect(page.url()).toBe(urlBefore);
    });
});

test.describe('DataQualitySettingsModal (branches beyond the existing logged-in Save/persist acceptance test)', () => {
    test('switching the local profile select updates the category list to match, rendered checked by default', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);

        await page.locator('#usersettings').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        // ALA's 3 categories render by default, and (dataQualitySettingsModal.tsx's
        // updateLocalCategories() matching `selectedCategories.includes(cat.label)`
        // against dataQualityInfo.selectedFilters, which is populated with cat.label
        // values by every other part of the app) all 3 are checked, since no
        // disableQualityFilter param is present in the URL for any of them.
        for (const name of ['Exclude spatially suspect records', 'Exclude unidentified records', 'Exclude records with low quality identification']) {
            const row = modal.locator('.row', { hasText: name });
            await expect(row).toBeVisible();
            await expect(row.locator('input[type=checkbox]')).toBeChecked();
        }

        await modal.locator('#dataQualitySelect select').selectOption('ENVIRO');
        await expect(modal.locator('.row', { hasText: 'Exclude old records' })).toBeVisible();
        await expect(modal.locator('.row', { hasText: 'Exclude spatially suspect records' })).toHaveCount(0);

        // 'disable' matches no dq.shortName at all -- category list becomes empty.
        await modal.locator('#dataQualitySelect select').selectOption('disable');
        await expect(modal.locator('.row', { hasText: 'Exclude old records' })).toHaveCount(0);
    });

    test('Save while anonymous persists expand/profile/disabled state to localStorage instead of POSTing', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);

        await page.locator('#usersettings').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        await modal.locator('#dataQualitySelect select').selectOption('ENVIRO');
        await modal.locator('#showSelect select').selectOption('expanded');

        let postFired = false;
        page.on('request', req => {
            if (req.url().includes('/v2/user/property') && req.method() === 'POST') postFired = true;
        });

        await modal.getByRole('button', { name: 'Save' }).click();
        await expect(modal).not.toBeVisible();

        expect(postFired, 'anonymous Save must never POST').toBe(false);

        const dqExpanded = await page.evaluate(() => localStorage.getItem('ala-hub.dqExpanded'));
        expect(dqExpanded).toBe('true');

        const dqUserProfile = await page.evaluate(() => localStorage.getItem('ala-hub.dqUserProfile'));
        expect(dqUserProfile).toBeTruthy();
        const parsed = JSON.parse(dqUserProfile as string);
        expect(parsed.dataProfile).toBe('ENVIRO');
        expect(parsed.disableAll).toBe(false);
        expect(parsed.expand).toBe('expanded');
    });

    test('Cancel does not write any localStorage preference', async ({ page }) => {
        await setupMocks(page);
        await loadResults(page);

        await page.evaluate(() => localStorage.removeItem('ala-hub.dqUserProfile'));

        await page.locator('#usersettings').click();
        const modal = page.getByRole('dialog');
        await modal.locator('#dataQualitySelect select').selectOption('disable');
        await modal.getByRole('button', { name: 'Cancel' }).click();
        await expect(modal).not.toBeVisible();

        const dqUserProfile = await page.evaluate(() => localStorage.getItem('ala-hub.dqUserProfile'));
        expect(dqUserProfile).toBeNull();
    });
});

test.describe('Non-empty qualityFilters (fieldName/fieldDescription/infoUrl branches)', () => {
    test('DataQualityInfoModal\'s per-category filter table renders both filters with working info links', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        // Registered after setupMocks() so it wins (Playwright resolves routes in
        // reverse-registration order) -- overrides the default empty-qualityFilters fixture.
        await mockDataQualityProfiles(page, seenUrls, g_profilesWithFilters);
        await loadResults(page);

        await page.locator('.DQProfileDetailsLink').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        const filterTable = modal.locator('table').nth(1); // 2nd table: the first category's own filter-table
        await expect(filterTable).toContainText('Coordinates are exactly 0,0');
        await expect(filterTable).toContainText('assertions:zeroCoordinates');
        await expect(filterTable).toContainText('Latitude is exactly zero');
        await expect(filterTable).toContainText('decimalLatitude:0');
        // infoUrl()'s 2 branches -- assertions-prefixed vs generic-field regex --
        // both produce a working "Link" for this category (2 rows -> 2 links).
        await expect(filterTable.getByRole('link', { name: 'Link' })).toHaveCount(2);
        await expect(filterTable.getByRole('link', { name: 'Link' }).first()).toHaveAttribute('href', /VITE_APP_DQ_WIKI_URL|wiki|assertions|zeroCoordinates/i);
    });

    test('DataQualityCategoryInfoModal renders the field table (fieldName/fieldDescription) and both filter-table Link buttons', async ({ page }) => {
        const seenUrls = await setupMocks(page, { biocache: { totalRecords: 500, unfilteredTotalRecords: 600 } });
        await mockDataQualityProfiles(page, seenUrls, g_profilesWithFilters);
        await mockIndexFields(page, seenUrls, g_fieldsWithDescriptions);
        await loadResults(page);
        await expandDqBar(page);

        await page.locator('.dqFilter', { hasText: 'Exclude spatially suspect records' }).locator('.bi-info-circle').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        // catFilter: the 2 filters AND'd together into a single displayed string.
        await expect(modal.locator('#filter-value')).toContainText('assertions:zeroCoordinates AND decimalLatitude:0');

        // Field table: fieldName() dedupes+sorts ["assertions", "decimalLatitude"];
        // fieldDescription() reads indexedFields[name].info / .description. The
        // header row is a plain <tr> inside <tbody> (no <thead>), so this table has
        // 3 tbody rows total (1 header + 2 data rows), not 2.
        const fieldTable = modal.locator('table').first();
        await expect(fieldTable).toContainText('assertions');
        await expect(fieldTable).toContainText('Data quality assertions raised against this record');
        await expect(fieldTable).toContainText('decimalLatitude');
        await expect(fieldTable).toContainText('The geographic latitude at which the occurrence was recorded');
        await expect(fieldTable.locator('tbody tr')).toHaveCount(3);

        // The 2nd table (filter values) also renders both filters with a Link each.
        const filterTable = modal.locator('table').nth(1);
        await expect(filterTable.getByRole('link', { name: 'Link' })).toHaveCount(2);

        // Still exercises the existing count>0 actions with this richer fixture.
        await expect(modal.getByText('View excluded records')).toBeVisible({ timeout: 10000 });
        await expect(modal.getByText('Expand and edit filters')).toBeVisible();
    });
});

test.describe('DataQualityFiltersModal — isExpanded() with a category already disabled via URL', () => {
    test('isExpanded() decodes percent-encoded fq terms so an already-disabled category with its filters present in the URL is correctly shown as "Expanded"', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await mockDataQualityProfiles(page, seenUrls, g_profilesWithFilters);
        // Navigate directly with BOTH disableQualityFilter=spatiallySuspect AND the
        // category's own 2 quality-filter fq terms already present -- this is
        // exactly the URL shape "Expand and edit filters" itself produces.
        await page.goto(
            `${BASE_URL}/occurrences/search?q=${encodeURIComponent('taxa:"acacia"')}` +
            `&qualityProfile=ALA&disableQualityFilter=spatiallySuspect` +
            `&fq=${encodeURIComponent('assertions:zeroCoordinates')}` +
            `&fq=${encodeURIComponent('decimalLatitude:0')}`
        );
        await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 15000 });
        await expandDqBar(page);

        await page.locator('.ms-2.no-wrap.dqLabel', { hasText: 'Select filters' }).click();
        const modal = page.getByRole('dialog');
        const row = modal.locator('tbody tr', { hasText: 'Exclude spatially suspect records' });

        // isExpanded() now decodes each "fq=" term (reversing the percent-encoding
        // applied by `new URLSearchParams(...).toString()`, e.g. ":" -> "%3A")
        // before comparing against the raw quality filter strings. Since the URL
        // already contains disableQualityFilter=spatiallySuspect plus both of the
        // category's fq terms, the category is correctly detected as expanded:
        // unchecked (not selected) and showing "Expanded", not the
        // "Expand and edit filters" action.
        await expect(row.locator('input[type=checkbox]')).not.toBeChecked();
        await expect(row.getByText('Expanded', { exact: true })).toBeVisible();
        await expect(row.getByText('Expand and edit filters')).toHaveCount(0);
    });
});
