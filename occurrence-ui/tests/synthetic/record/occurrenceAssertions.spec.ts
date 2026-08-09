import { test, expect } from '../../fixtures';
import { setupMocks, loadRecord, SESSION_USER, SESSION_ADMIN } from '../helpers';
import { setupRecordMocks, createAssertionsStore, g_acaciaRecord } from '../../mocks/recordMocks';

// ===========================================================================
// Synthetic coverage: src/components/occurrence/occurrenceAssertions.tsx.
// acceptance.spec.ts's "record-flag-issue-delete" test already covers
// deleteAssertion()'s "confirm accepted" happy path (on a plain, unverified
// issue) -- these tests target the branches it doesn't: cancelling the confirm
// dialog, deleteVerification() (a wholly separate function/button from
// deleteAssertion(), gated on isCollectionAdmin() rather than ownership), and
// deleteItem()'s shared .catch() (a failed delete request).
// ===========================================================================

const OWN_ISSUE = {
    uuid: 'assertion-cancel-001', code: 30001, comment: 'Location seems off',
    userId: SESSION_USER.userId, userDisplayName: 'Jane Smith', created: '2024-01-01T00:00:00Z',
    referenceRowKey: g_acaciaRecord.raw.uuid, relatedRecordId: '', relatedRecordReason: '',
};

// Occurrence.tsx's own (unmocked) lookup20020Assertions() client-side logic builds
// the nested `assertion.verified[]` array itself, from the FLAT list the assertions
// endpoint returns -- it matches every code===50000 entry's `relatedUuid` against
// each other assertion's own `uuid`. A `verified` field on the fixture itself is
// never read; two separate flat store entries (mirroring verifyRecordModal.spec.ts's
// "editing an existing verification" test) are required to produce a nested row.
const ORIGINAL_ISSUE = {
    uuid: 'assertion-with-verification', code: 30001, comment: 'Location seems off',
    userId: SESSION_ADMIN.userId, userDisplayName: 'Admin User', created: '2024-01-01T00:00:00Z',
    referenceRowKey: g_acaciaRecord.raw.uuid, relatedRecordId: '', relatedRecordReason: '',
};
const NESTED_VERIFICATION = {
    uuid: 'verification-001', code: 50000, comment: 'Confirmed correct by curator',
    userId: SESSION_ADMIN.userId, userDisplayName: 'Admin User', created: '2024-02-01T00:00:00Z',
    referenceRowKey: g_acaciaRecord.raw.uuid, relatedRecordId: '', relatedRecordReason: '',
    qaStatus: '50002', relatedUuid: 'assertion-with-verification',
};

test.describe('OccurrenceAssertions — delete branches', () => {
    test('declining the confirm dialog leaves the annotation in place and never POSTs', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([OWN_ISSUE]) });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await expect(page.locator('#userAnnotationsDiv')).toContainText('Location seems off');

        let dialogMessage = '';
        page.once('dialog', d => { dialogMessage = d.message(); d.dismiss(); });
        let deleteFired = false;
        page.on('request', req => {
            if (req.url().includes('/occurrences/assertions/delete')) deleteFired = true;
        });

        await page.locator('.deleteAnnotationButton').click();
        // show.deleteannotation.confirm is confirmed absent from en.json.
        await expect.poll(() => dialogMessage).toBe('Are you sure you want to delete this flagged issue?');
        expect(deleteFired).toBe(false);
        await expect(page.locator('#userAnnotationsDiv')).toContainText('Location seems off');
    });

    test('an admin can delete a nested verification (deleteVerification(), distinct from deleteAssertion())', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_ADMIN });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([ORIGINAL_ISSUE, NESTED_VERIFICATION]) });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await expect(page.locator('table.verifications')).toBeVisible();
        await expect(page.locator('table.verifications td.comment')).toHaveText('Confirmed correct by curator');

        page.once('dialog', d => d.accept());
        await page.locator('.deleteVerificationButton').click();

        // deleteVerification() -> deleteItem() reloads unconditionally on success.
        await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('table.verifications')).toHaveCount(0);
        // The parent issue itself is untouched -- only its nested verification is gone.
        await expect(page.locator('#userAnnotationsDiv')).toContainText('Location seems off');
    });

    test('declining the confirm dialog on a verification leaves it in place', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_ADMIN });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([ORIGINAL_ISSUE, NESTED_VERIFICATION]) });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        let dialogMessage = '';
        page.once('dialog', d => { dialogMessage = d.message(); d.dismiss(); });
        await page.locator('.deleteVerificationButton').click();

        // show.deleteverification.confirm is confirmed absent from en.json.
        await expect.poll(() => dialogMessage).toBe('Are you sure you want to delete this verification?');
        await expect(page.locator('table.verifications')).toBeVisible();
    });

    test('a failed delete request shows an alert built from deleteItem()\'s shared .catch()', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_ADMIN });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([ORIGINAL_ISSUE, NESTED_VERIFICATION]) });
        // Registered after setupRecordMocks() so it wins.
        await page.context().route('https://biocache-ws.ala.org.au/ws/occurrences/assertions/delete', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({}) })
        );
        seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/assertions/delete'));
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        let alertMessage: string | null = null;
        // Distinguishing by dialog TYPE (confirm vs alert) rather than arrival
        // order avoids a Chromium-specific hang seen with an order-based approach
        // (a page.once() "confirm" handler + a separate page.waitForEvent('dialog')
        // for the "alert" raced unpredictably and occasionally left the click action
        // waiting indefinitely for a dialog resolution that never completed in time).
        page.on('dialog', async d => {
            if (d.type() === 'confirm') {
                await d.accept();
            } else {
                alertMessage = d.message();
                await d.accept();
            }
        });
        await page.locator('.deleteVerificationButton').click();

        // show.verifyrecord.error is confirmed absent from en.json -- JSX default
        // "Error deleting verification: " + the thrown Error's own message.
        await expect.poll(() => alertMessage, { timeout: 10000 }).toBe('Error deleting verification: submit failed: 500');

        // The request failed -- the verification is still there, page not reloaded.
        await expect(page.locator('table.verifications')).toBeVisible();
    });
});
