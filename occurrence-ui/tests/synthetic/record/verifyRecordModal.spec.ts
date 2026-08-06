import { test, expect } from '../../fixtures';
import { setupMocks, loadRecord, SESSION_USER, SESSION_ADMIN } from '../helpers';
import { setupRecordMocks, createAssertionsStore, g_acaciaRecord } from '../../mocks/recordMocks';

// ===========================================================================
// Synthetic coverage: src/components/occurrence/verifyRecordModal.tsx (158
// lines), 0% coverage per PLAYWRIGHT_TEST.md §5.3.2. Much simpler API surface
// than flagIssueModal.tsx (one fetch, no debounce, no multi-branch validation).
// Both triggers require isCollectionAdmin() -- satisfied here via SESSION_ADMIN
// (roles: ['ROLE_USER','ROLE_ADMIN'] matches VITE_APP_ROLE_ADMIN directly), the
// first test in the suite to actually use that session constant.
// ===========================================================================

const UNVERIFIED_ASSERTION = {
    uuid: 'a1', code: 30001, comment: 'Location seems off',
    userId: 'someone-else', userDisplayName: 'Someone Else', created: '2024-01-01T00:00:00Z',
    referenceRowKey: g_acaciaRecord.raw.uuid, relatedRecordId: '', relatedRecordReason: '',
};

test.describe('VerifyRecordModal', () => {
    test('a non-admin user sees no verify/edit-verification controls on someone else\'s unverified assertion', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([UNVERIFIED_ASSERTION]) });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await expect(page.locator('#userAnnotationsDiv')).toContainText('Location seems off');
        // Unlike flagIssueModal's edit gate, verifyAnnotationButton has NO ownership
        // check at all -- isCollectionAdmin() alone gates it, so a plain (non-admin)
        // logged-in user never sees it regardless of who flagged the issue.
        await expect(page.locator('.verifyAnnotationButton')).toHaveCount(0);
        await expect(page.locator('.editVerificationButton')).toHaveCount(0);
    });

    test('an admin sees the Verify trigger; it opens with the documented defaults and no close-icon', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_ADMIN });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([UNVERIFIED_ASSERTION]) });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        const trigger = page.locator('.verifyAnnotationButton');
        await expect(trigger).toBeVisible();
        await trigger.click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('Confirmation');
        // g_acaciaRecord's systemAssertions.warning=[{name:'decimalLatLongCalculatedFromEastingNorthing'}]
        // is translated via translate(intl, name, undefined) -- NO 'assertions.'
        // prefix is applied here (unlike everywhere else that names are shown), so
        // even though "assertions.decimalLatLongCalculatedFromEastingNorthing" IS
        // translated in en.json, this bare (unprefixed) lookup misses it and falls
        // back to the raw literal name.
        await expect(modal).toContainText('decimalLatLongCalculatedFromEastingNorthing');
        // backdrop='static' keyboard={false} and Modal.Header has NO closeButton prop
        // at all (unlike every other modal in this suite) -- only the explicit
        // Confirm/Cancel buttons can dismiss it.
        await expect(modal.locator('.btn-close')).toHaveCount(0);
        await expect(modal.locator('#userAssertionStatusSelection')).toHaveValue('50001');
        await expect(modal.locator('#verifyComment')).toHaveValue('');
        await expect(modal.locator('.confirmVerify')).toBeVisible();
        await expect(modal.locator('.cancelVerify')).toBeVisible();
    });

    test('confirming with an empty comment shows a native alert and does not submit', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_ADMIN });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([UNVERIFIED_ASSERTION]) });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('.verifyAnnotationButton').click();
        const modal = page.getByRole('dialog');

        let dialogMessage = '';
        page.once('dialog', d => { dialogMessage = d.message(); d.accept(); });

        let postFired = false;
        page.on('request', req => {
            if (req.url().includes('/occurrences/assertions/add')) postFired = true;
        });

        await modal.locator('.confirmVerify').click();
        // show.verifyrecord.comment.mandatory is confirmed absent from en.json --
        // the JSX defaultMessage renders verbatim.
        await expect.poll(() => dialogMessage).toBe('Please add a comment');
        expect(postFired).toBe(false);
        await expect(modal).toBeVisible();
    });

    test('confirming with a comment POSTs code=50000 with the chosen status and assertionUuid; the verification appears nested under the original issue after the reload', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_ADMIN });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([UNVERIFIED_ASSERTION]) });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('.verifyAnnotationButton').click();
        const modal = page.getByRole('dialog');
        await modal.locator('#userAssertionStatusSelection').selectOption('50002');
        await modal.locator('#verifyComment').fill('Confirmed correct by curator');

        const [request] = await Promise.all([
            page.waitForRequest(req => req.url().includes('/occurrences/assertions/add') && req.method() === 'POST'),
            modal.locator('.confirmVerify').click(),
        ]);
        const body = new URLSearchParams(request.postData() || '');
        expect(body.get('code')).toBe('50000');
        expect(body.get('userAssertionStatus')).toBe('50002');
        expect(body.get('assertionUuid')).toBe('a1');
        expect(body.get('comment')).toBe('Confirmed correct by curator');

        // onVerified() calls window.location.reload() synchronously in the .then() --
        // same "no time to click Close" timing as flagIssueModal's edit-mode success;
        // don't script a .closeVerify click. Thanks to mockAssertions()'s additive
        // qaStatus/relatedUuid storage (see recordMocks.ts), Occurrence.tsx's own real
        // (unmocked) lookup20020Assertions() client-side nesting logic then renders
        // this new code=50000 entry inside the original assertion's own <table
        // class="verifications">, keyed purely by relatedUuid === the original
        // assertion's uuid -- no mock-side nesting needed.
        await expect(page.locator('table.verifications')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('table.verifications td.comment')).toHaveText('Confirmed correct by curator');
        await expect(page.locator('table.verifications td.qaStatus')).toHaveText('Record has been verified by data custodian as being correct');
        // The now-verified assertion no longer offers a Verify trigger of its own.
        await expect(page.locator('.verifyAnnotationButton')).toHaveCount(0);
    });

    test('editing an existing verification opens pre-filled with its status/comment', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_ADMIN });
        const store = createAssertionsStore([
            UNVERIFIED_ASSERTION,
            {
                uuid: 'v1', code: 50000, comment: 'Looks fine to me', userId: SESSION_ADMIN.userId,
                userDisplayName: 'Admin User', created: '2024-02-01T00:00:00Z',
                referenceRowKey: g_acaciaRecord.raw.uuid, relatedRecordId: '', relatedRecordReason: '',
                qaStatus: '50002', relatedUuid: 'a1',
            },
        ]);
        await setupRecordMocks(page, seenUrls, { assertionsStore: store });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        // Already-verified -- the plain Verify trigger no longer renders, only Edit.
        await expect(page.locator('.verifyAnnotationButton')).toHaveCount(0);
        await page.locator('.editVerificationButton').click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        await expect(modal.locator('#userAssertionStatusSelection')).toHaveValue('50002');
        await expect(modal.locator('#verifyComment')).toHaveValue('Looks fine to me');
    });

    test('Cancel closes the modal without any POST firing', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_ADMIN });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([UNVERIFIED_ASSERTION]) });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('.verifyAnnotationButton').click();
        const modal = page.getByRole('dialog');
        await modal.locator('#verifyComment').fill('Should never be submitted');

        let postFired = false;
        page.on('request', req => {
            if (req.url().includes('/occurrences/assertions/add')) postFired = true;
        });

        const urlBefore = page.url();
        await modal.locator('.cancelVerify').click();
        await expect(modal).not.toBeVisible();
        expect(postFired).toBe(false);
        expect(page.url()).toBe(urlBefore);
    });
});
