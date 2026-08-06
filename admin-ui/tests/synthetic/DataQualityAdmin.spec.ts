import { test, expect } from '../fixtures';
import { setupMocks, mockHomeInfo, goHome, clickMenu, API } from './helpers';

const profile = {
    id: 1,
    name: 'ALA Default',
    shortName: 'ala-default',
    description: 'desc',
    contactName: 'Admin',
    contactEmail: 'admin@example.com',
    enabled: true,
    isDefault: false,
    displayOrder: 0,
    dateCreated: '2024-01-01T00:00:00Z',
    lastUpdated: '2024-01-02T00:00:00Z',
    categories: [],
};

/** A second profile used for shortName-uniqueness checks. */
const otherProfile = {
    id: 2,
    name: 'Other Profile',
    shortName: 'other-profile',
    description: '',
    contactName: 'Admin',
    contactEmail: 'admin@example.com',
    enabled: true,
    isDefault: false,
    displayOrder: 1,
    dateCreated: '2024-01-01T00:00:00Z',
    lastUpdated: '2024-01-02T00:00:00Z',
    categories: [],
};

/** A profile with a pre-populated category and filter — avoids repetitive
 *  "Add category" / "Add filter" clicks for tests that only need to exercise
 *  the edit/delete/toggle behaviour of existing items. */
const profileWithCategory = {
    id: 3,
    name: 'Populated Profile',
    shortName: 'populated-profile',
    description: 'has a category',
    contactName: 'Admin',
    contactEmail: 'admin@example.com',
    enabled: true,
    isDefault: false,
    displayOrder: 0,
    dateCreated: '2024-01-01T00:00:00Z',
    lastUpdated: '2024-01-02T00:00:00Z',
    categories: [
        {
            id: 100,
            enabled: true,
            name: 'Existing Category',
            label: 'existing-category',
            description: 'a category description',
            displayOrder: 0,
            inverseFilter: 'manual override',
            qualityFilters: [
                {
                    id: 200,
                    enabled: true,
                    filter: 'basisOfRecord:PreservedSpecimen',
                    inverseFilter: '',
                    description: 'basis filter',
                    displayOrder: 0,
                },
            ],
        },
    ],
};

/** A variant of profileWithCategory with a second filter in the same
 *  category — used solely to verify the Summary list joins multiple
 *  filters with " AND ". Kept separate from profileWithCategory so other
 *  tests that assume a single filter row are unaffected. */
const profileWithMultipleFilters = {
    ...profileWithCategory,
    id: 5,
    shortName: 'multi-filter-profile',
    categories: [
        {
            ...profileWithCategory.categories[0],
            qualityFilters: [
                ...profileWithCategory.categories[0].qualityFilters,
                {
                    id: 201,
                    enabled: true,
                    filter: 'taxonRank:species',
                    inverseFilter: '',
                    description: 'rank filter',
                    displayOrder: 1,
                },
            ],
        },
    ],
};

/** A profile whose only filter contains parentheses — exercises the
 *  "may cause issues with inverse filtering" warning branch. */
const profileWithParenFilter = {
    ...profileWithCategory,
    id: 4,
    shortName: 'paren-profile',
    categories: [
        {
            id: 101,
            enabled: true,
            name: 'Paren Category',
            label: 'paren-category',
            description: '',
            displayOrder: 0,
            inverseFilter: '',
            qualityFilters: [
                {
                    id: 201,
                    enabled: true,
                    filter: '(taxonRank:species OR taxonRank:subspecies)',
                    inverseFilter: '',
                    description: '',
                    displayOrder: 0,
                },
            ],
        },
    ],
};

async function gotoDq(page: any, profiles: any[], extra?: (page: any, seenUrls: Set<URL>) => Promise<void>) {
    await setupMocks(page, async (page, seenUrls) => {
        await mockHomeInfo(page, seenUrls);
        await page.route(`${API}/admin/dq`, (route: any) => {
            seenUrls.add(new URL(route.request().url()));
            if (route.request().method() === 'GET') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profiles) });
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });
        if (extra) await extra(page, seenUrls);
    });
    await goHome(page);
    await clickMenu(page, 'Data Quality');
}

/** Navigate straight to the Edit Profile tab for the row matching `name`. */
async function editProfile(page: any, name: string) {
    await page.locator('tbody tr', { hasText: name }).locator('button', { hasText: 'Edit' }).click();
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 5000 });
}

/** Expand the (first, and in these fixtures only) category's collapsible body. */
async function expandCategory(page: any) {
    await page.locator('td[style*="background-color"] div[style*="cursor: pointer"]').first().click();
    await expect(page.locator('h4', { hasText: 'Filters' })).toBeVisible();
}

test.describe('DataQualityAdmin.tsx — synthetic', () => {

    test('401 response shows "Unauthorized" error', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/admin/dq`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 401, body: '' });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Data Quality');
        await expect(page.locator('text=Unauthorized. Please log in.')).toBeVisible({ timeout: 5000 });
    });

    test('500 response shows a server error message and Close reloads', async ({ page }) => {
        let calls = 0;
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/admin/dq`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                calls++;
                route.fulfill({ status: calls === 1 ? 500 : 200, contentType: 'application/json', body: calls === 1 ? '' : JSON.stringify([profile]) });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Data Quality');
        await expect(page.locator('text=Request failed, server error')).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Close' }).click();
        await expect(page.locator('td', { hasText: 'ALA Default' })).toBeVisible({ timeout: 5000 });
    });

    test('an unexpected response status shows a generic error message', async ({ page }) => {
        await setupMocks(page, async (page, seenUrls) => {
            await mockHomeInfo(page, seenUrls);
            await page.route(`${API}/admin/dq`, (route) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 418, body: '' });
            });
        });
        await goHome(page);
        await clickMenu(page, 'Data Quality');
        await expect(page.locator('text=Unexpected status: 418')).toBeVisible({ timeout: 5000 });
    });

    test('Add profile navigates to the Edit Profile tab with a blank profile', async ({ page }) => {
        await gotoDq(page, [profile]);
        await expect(page.locator('td', { hasText: 'ALA Default' })).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Add profile' }).click();
        await expect(page.locator('input[value="new-profile"]')).toBeVisible({ timeout: 5000 });
    });

    test('Edit opens the profile editor pre-filled, and editing the name enables Save', async ({ page }) => {
        await gotoDq(page, [profile]);
        await expect(page.locator('td', { hasText: 'ALA Default' })).toBeVisible({ timeout: 5000 });

        await editProfile(page, 'ALA Default');
        await expect(page.locator('textarea').first()).toHaveValue('ALA Default');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeDisabled();

        await page.locator('textarea').first().fill('ALA Default Updated');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('Add category button adds a new category to the summary list', async ({ page }) => {
        await gotoDq(page, [profile]);
        await editProfile(page, 'ALA Default');

        await page.locator('button', { hasText: 'Add category' }).click();
        await expect(page.locator('text=new-category')).toBeVisible();
    });

    test('expanding a category and adding a filter renders the filter row, and deleting the category removes it', async ({ page }) => {
        await gotoDq(page, [profile]);
        await editProfile(page, 'ALA Default');

        await page.locator('button', { hasText: 'Add category' }).click();
        await expect(page.locator('text=new-category')).toBeVisible();

        // Expand the category (click the collapse caret in its header row).
        await expandCategory(page);

        await page.locator('button', { hasText: 'Add filter' }).click();
        await expect(page.locator('textarea').filter({ hasText: 'enter a new filter' })).toBeVisible();

        // Two "Delete" (btn-danger) buttons now exist: the category's own and
        // the filter row's. The category delete button is the one in the
        // header row (identified by its "ms-auto" placement alongside the
        // label/name/display-order inputs) — select it by position (first).
        await page.locator('#data-quality-tabs-tabpane-profile button.btn-danger').first().click();
        await expect(page.locator('text=new-category')).toBeHidden();
    });

    test('toggling the enabled checkbox saves the profile', async ({ page }) => {
        let savedBody: any = null;
        await gotoDq(page, [profile], async (page, seenUrls) => {
            await page.route(`${API}/admin/dq`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                if (route.request().method() === 'POST') {
                    savedBody = JSON.parse(route.request().postData() ?? '{}');
                    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
                }
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([profile]) });
            });
        });
        await expect(page.locator('td', { hasText: 'ALA Default' })).toBeVisible({ timeout: 5000 });

        await page.locator('input[type="checkbox"]').first().click();
        await page.waitForTimeout(300);
        expect(savedBody?.enabled).toBe(false);
    });

    test('Delete profile: confirm sends a DELETE request', async ({ page }) => {
        let deleteCalled = false;
        await gotoDq(page, [profile], async (page, seenUrls) => {
            await page.route(`${API}/admin/dq?id=1`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                deleteCalled = true;
                route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            });
        });
        page.on('dialog', async (dialog) => { await dialog.accept(); });
        await expect(page.locator('td', { hasText: 'ALA Default' })).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Delete' }).click();
        await page.waitForTimeout(300);
        expect(deleteCalled).toBe(true);
    });

    test('Delete profile: dismiss does not send a DELETE request', async ({ page }) => {
        let deleteCalled = false;
        await gotoDq(page, [profile], async (page, _) => {
            await page.route(`${API}/admin/dq?id=1`, (route: any) => {
                deleteCalled = true;
                route.fulfill({ status: 200, body: '' });
            });
        });
        page.on('dialog', async (dialog) => { await dialog.dismiss(); });
        await expect(page.locator('td', { hasText: 'ALA Default' })).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Delete' }).click();
        await page.waitForTimeout(300);
        expect(deleteCalled).toBe(false);
    });

    test('Delete profile: 500 response shows a server error', async ({ page }) => {
        await gotoDq(page, [profile], async (page, seenUrls) => {
            await page.route(`${API}/admin/dq?id=1`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 500, body: '' });
            });
        });
        page.on('dialog', async (dialog) => { await dialog.accept(); });
        await expect(page.locator('td', { hasText: 'ALA Default' })).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Delete' }).click();
        await expect(page.locator('text=Request failed, server error.')).toBeVisible({ timeout: 5000 });
    });

    test('Delete profile: 202 response shows an "accepted" message', async ({ page }) => {
        await gotoDq(page, [profile], async (page, seenUrls) => {
            await page.route(`${API}/admin/dq?id=1`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 202, body: '' });
            });
        });
        page.on('dialog', async (dialog) => { await dialog.accept(); });
        await expect(page.locator('td', { hasText: 'ALA Default' })).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Delete' }).click();
        await expect(page.locator('text=Request accepted but not yet processed.')).toBeVisible({ timeout: 5000 });
    });

    test('"Default" button sets isDefault and saves', async ({ page }) => {
        let savedBody: any = null;
        await gotoDq(page, [profile], async (page, seenUrls) => {
            await page.route(`${API}/admin/dq`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                if (route.request().method() === 'POST') {
                    savedBody = JSON.parse(route.request().postData() ?? '{}');
                    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
                }
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([profile]) });
            });
        });
        await expect(page.locator('td', { hasText: 'ALA Default' })).toBeVisible({ timeout: 5000 });

        await page.locator('button', { hasText: 'Default' }).click();
        await page.waitForTimeout(300);
        expect(savedBody?.isDefault).toBe(true);
    });

    test('saving with a duplicate shortName shows a validation error', async ({ page }) => {
        await gotoDq(page, [profile, otherProfile]);
        await editProfile(page, 'ALA Default');

        // Change the shortName to collide with the other profile, then dirty
        // the form (editing shortName alone does mark it dirty) and save.
        await page.locator('#data-quality-tabs-tabpane-profile input[type="text"]').first().fill('other-profile');
        await page.locator('button', { hasText: 'Save Changes' }).click();

        await expect(page.locator('text=Profile with short name "other-profile" already exists.')).toBeVisible({ timeout: 5000 });
    });

    test('saving a profile with a 202 response shows an "accepted" message', async ({ page }) => {
        await gotoDq(page, [profile], async (page, seenUrls) => {
            await page.route(`${API}/admin/dq`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                if (route.request().method() === 'POST') {
                    return route.fulfill({ status: 202, body: '' });
                }
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([profile]) });
            });
        });
        await editProfile(page, 'ALA Default');
        await page.locator('textarea').first().fill('ALA Default Updated');
        await page.locator('button', { hasText: 'Save Changes' }).click();

        await expect(page.locator('text=Request accepted but not yet processed.')).toBeVisible({ timeout: 5000 });
    });

    test('saving a new category substitutes a real backend id (0) for the temporary client-side id', async ({ page }) => {
        let savedBody: any = null;
        await gotoDq(page, [profile], async (page, seenUrls) => {
            await page.route(`${API}/admin/dq`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                if (route.request().method() === 'POST') {
                    savedBody = JSON.parse(route.request().postData() ?? '{}');
                    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
                }
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([profile]) });
            });
        });
        await editProfile(page, 'ALA Default');
        await page.locator('button', { hasText: 'Add category' }).click();
        await expect(page.locator('text=new-category')).toBeVisible();

        // Note: adding a category alone does not (yet) enable "Save Changes" —
        // the profile round-trips through the parent's updateProfile() state,
        // which resets the local "dirty" flag. A subsequent direct edit (e.g.
        // renaming the category) re-dirties the form so it can be saved.
        await page.locator('td[style*="background-color"] input[type="text"]').first().fill('renamed-category');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();

        await page.locator('button', { hasText: 'Save Changes' }).click();
        await page.waitForTimeout(300);

        expect(savedBody?.categories).toHaveLength(1);
        // Date.now()-based ids are always > 1_000_000 — save() rewrites them to 0.
        expect(savedBody.categories[0].id).toBe(0);
    });

    test('Download triggers a file download named after the shortName', async ({ page }) => {
        await gotoDq(page, [profile]);
        await editProfile(page, 'ALA Default');

        // Download is triggered on the "List" tab; switch back to it first.
        await page.locator('button[role="tab"]', { hasText: 'List' }).click();
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('button', { hasText: 'Download' }).click(),
        ]);
        expect(download.suggestedFilename()).toBe('ala-default.json');
    });

    test('Import a profile: uploading a JSON file posts it (stripped of id) to save the new profile', async ({ page }) => {
        let savedBody: any = null;
        await gotoDq(page, [profile], async (page, seenUrls) => {
            await page.route(`${API}/admin/dq`, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                if (route.request().method() === 'POST') {
                    savedBody = JSON.parse(route.request().postData() ?? '{}');
                    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
                }
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([profile]) });
            });
        });
        await expect(page.locator('td', { hasText: 'ALA Default' })).toBeVisible({ timeout: 5000 });

        const importedProfile = { id: 999, shortName: 'imported-profile', name: 'Imported', categories: [] };
        await page.locator('input[type="file"]').setInputFiles({
            name: 'imported-profile.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(importedProfile)),
        });
        await page.waitForTimeout(300);

        expect(savedBody?.shortName).toBe('imported-profile');
        expect(savedBody?.id).toBeUndefined();
    });
});

test.describe('QualityProfileItem.tsx — synthetic (profile-level fields)', () => {

    test('editing the Short Name field marks the profile dirty', async ({ page }) => {
        await gotoDq(page, [profile]);
        await editProfile(page, 'ALA Default');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeDisabled();

        await page.locator('#data-quality-tabs-tabpane-profile input[type="text"]').first().fill('ala-default-2');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('editing the Description field marks the profile dirty', async ({ page }) => {
        await gotoDq(page, [profile]);
        await editProfile(page, 'ALA Default');

        await page.locator('textarea').nth(1).fill('an updated description');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('editing Contact Name and Contact Email marks the profile dirty', async ({ page }) => {
        await gotoDq(page, [profile]);
        await editProfile(page, 'ALA Default');

        // Scoped text inputs in the profile pane, in field order: shortName(0),
        // contactName(1), contactEmail(2).
        const profileTextInputs = page.locator('#data-quality-tabs-tabpane-profile input[type="text"]');
        await profileTextInputs.nth(1).fill('Someone Else');
        await profileTextInputs.nth(2).fill('someone@example.com');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('editing Display Order marks the profile dirty', async ({ page }) => {
        await gotoDq(page, [profile]);
        await editProfile(page, 'ALA Default');

        await page.locator('input[type="number"]').first().fill('5');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('the Summary list shows the category label and its filters joined with AND', async ({ page }) => {
        await gotoDq(page, [profileWithMultipleFilters]);
        await editProfile(page, 'Populated Profile');

        const summaryItem = page.locator('li', { hasText: 'existing-category' });
        await expect(summaryItem).toBeVisible();
        await expect(summaryItem).toContainText('basisOfRecord:PreservedSpecimen AND taxonRank:species');
    });

    test('deleting a category removes it from both the categories list and the summary', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');
        await expect(page.locator('li', { hasText: 'existing-category' })).toBeVisible();

        await page.locator('#data-quality-tabs-tabpane-profile button.btn-danger').first().click();
        await expect(page.locator('li', { hasText: 'existing-category' })).toBeHidden();
        await expect(page.locator('text=existing-category')).toBeHidden();
    });

    test('"History" navigates to the Audit History page filtered by this profile', async ({ page }) => {
        await gotoDq(page, [profile], async (page, seenUrls) => {
            await page.route(/http:\/\/localhost:8081\/admin\/audit(\?.*)?$/, (route: any) => {
                seenUrls.add(new URL(route.request().url()));
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 20 }) });
            });
        });
        await editProfile(page, 'ALA Default');

        await page.locator('button', { hasText: 'History' }).click();
        await expect(page).toHaveURL(/\/audit\?entityTable=dq&entityId=1/);
    });

    test('"Last saved" shows "never" when lastUpdated is not set', async ({ page }) => {
        await gotoDq(page, [profile]);
        await page.locator('button', { hasText: 'Add profile' }).click();
        await expect(page.locator('text=Last saved never')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('QualityCategoryItem.tsx — synthetic', () => {

    test('the collapse caret toggles the description/inverse-filter/filters section', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');

        await expect(page.locator('h4', { hasText: 'Filters' })).toBeHidden();
        await expandCategory(page);
        await expect(page.locator('h4', { hasText: 'Filters' })).toBeVisible();

        await page.locator('td[style*="background-color"] div[style*="cursor: pointer"]').first().click();
        await expect(page.locator('h4', { hasText: 'Filters' })).toBeHidden();
    });

    test('toggling the category enabled checkbox marks the profile dirty', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');

        // First checkbox is the category-level enabled toggle (profile has no
        // top-level checkbox on this tab).
        await page.locator('#data-quality-tabs-tabpane-profile input[type="checkbox"]').first().click();
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('editing the category label and name updates the display', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');

        const categoryHeader = page.locator('td[style*="background-color"]');
        await categoryHeader.locator('input[type="text"]').first().fill('renamed-label');
        await categoryHeader.locator('input[type="text"]').nth(1).fill('Renamed Category Name');

        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
        await expect(page.locator('li', { hasText: 'renamed-label' })).toBeVisible();
    });

    test('editing the category display order marks the profile dirty', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');

        await page.locator('td[style*="background-color"] input[type="number"]').fill('9');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('editing the category description and inverse filter when expanded', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');
        await expandCategory(page);

        await page.locator('textarea').filter({ hasText: 'a category description' }).fill('updated category description');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('shows a warning when a filter in the category contains parentheses', async ({ page }) => {
        await gotoDq(page, [profileWithParenFilter]);
        await editProfile(page, 'Populated Profile');
        await expandCategory(page);

        await expect(page.locator('text=This category contains filters with parentheses')).toBeVisible();
    });

    test('no parentheses warning is shown when filters do not contain parentheses', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');
        await expandCategory(page);

        await expect(page.locator('text=This category contains filters with parentheses')).toBeHidden();
    });

    test('deleting the only filter in a category removes its row', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');
        await expandCategory(page);
        await expect(page.locator('textarea').filter({ hasText: 'basisOfRecord:PreservedSpecimen' })).toBeVisible();

        // The filter row's own Delete button (second btn-danger — the first
        // belongs to the category header).
        await page.locator('#data-quality-tabs-tabpane-profile button.btn-danger').nth(1).click();
        await expect(page.locator('textarea').filter({ hasText: 'basisOfRecord:PreservedSpecimen' })).toBeHidden();
    });
});

test.describe('QualityFilterItem.tsx — synthetic', () => {

    test('editing the filter expression marks the profile dirty and resets the category-level inverse filter', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');
        await expandCategory(page);

        // Category-level inverse filter starts pre-populated from the fixture.
        const categoryInverseFilter = page.locator('input[type="text"][value="manual override"]');
        await expect(categoryInverseFilter).toBeVisible();

        await page.locator('textarea').filter({ hasText: 'basisOfRecord:PreservedSpecimen' }).fill('basisOfRecord:HumanObservation');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();

        // setFilter() calls resetInverseFilter(), clearing the category's own override.
        await expect(page.locator('input[type="text"][value="manual override"]')).toBeHidden();
    });

    test('toggling the filter enabled checkbox resets the category-level inverse filter too', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');
        await expandCategory(page);

        await expect(page.locator('input[type="text"][value="manual override"]')).toBeVisible();

        // The filter row's own enabled checkbox is the second checkbox on the
        // (now expanded) pane — the first is the category-level checkbox.
        await page.locator('#data-quality-tabs-tabpane-profile input[type="checkbox"]').nth(1).click();

        await expect(page.locator('input[type="text"][value="manual override"]')).toBeHidden();
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('editing the filter description does not reset the inverse filter', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');
        await expandCategory(page);

        await page.locator('textarea').filter({ hasText: 'basis filter' }).fill('an updated description');

        await expect(page.locator('input[type="text"][value="manual override"]')).toBeVisible();
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('editing the filter display order marks the profile dirty', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');
        await expandCategory(page);

        await page.locator('table.table-borderless table input[type="number"]').fill('3');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('editing the filter\'s own inverse filter field marks the profile dirty', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');
        await expandCategory(page);

        // Within the nested Filters table: textarea 0 = filter expression,
        // 1 = the filter's own inverse filter, 2 = description.
        await page.locator('table.table-borderless table textarea').nth(1).fill('a manual inverse override for the filter itself');
        await expect(page.locator('button', { hasText: 'Save Changes' })).toBeEnabled();
    });

    test('newly added filters show "(new)" instead of an id', async ({ page }) => {
        await gotoDq(page, [profileWithCategory]);
        await editProfile(page, 'Populated Profile');
        await expandCategory(page);

        await page.locator('button', { hasText: 'Add filter' }).click();
        await expect(page.locator('text=(new)')).toBeVisible();
    });
});
