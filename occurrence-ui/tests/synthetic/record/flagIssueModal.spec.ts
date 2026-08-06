import { test, expect } from '../../fixtures';
import { setupMocks, loadRecord, SESSION_USER, g_duplicateOfRecord } from '../helpers';
import {
    setupRecordMocks, createAssertionsStore, mockAssertionCodes, mockRelatedOccurrence,
    g_acaciaRecord, g_assertionCodes,
} from '../../mocks/recordMocks';

// ===========================================================================
// Synthetic coverage: src/components/occurrence/flagIssueModal.tsx (430 lines),
// the single biggest 0%-coverage file in the app per PLAYWRIGHT_TEST.md §5.3.1.
// acceptance.spec.ts's "record-flag-issue-add" test already exercises the plain
// "New issue, non-duplicate code" happy path via #assertionButton (issue type
// index 1) -- these tests deliberately target the OTHER branches: anonymous,
// edit mode, the duplicate-record compare-table sub-flow, and the hardcoded
// '20020' self-duplicate guard (which is independent of the isDuplicate
// name-based check).
// ===========================================================================

test.describe('FlagIssueModal', () => {
    test('anonymous user sees a login prompt instead of the issue form; "Click here" starts the real login redirect', async ({ page }) => {
        const seenUrls = await setupMocks(page); // default session is SESSION_ANONYMOUS
        await setupRecordMocks(page, seenUrls);
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('#assertionButton').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        await expect(modal.getByText('Login please:')).toBeVisible();
        await expect(modal.locator('#issueForm')).toHaveCount(0);

        // handleLogin() (common-ui) does a real window.location.href navigation to
        // `${VITE_APP_API_URL}/login?path=<current url>` -- mockLoginRedirect (already
        // wired into setupMocks/mockCommonApis) intercepts exactly this.
        await modal.getByText('Click here').click();
        await expect(page).toHaveURL(/localhost:8081\/login\?path=/);
    });

    test('edit mode pre-fills and disables the issue-type select; a successful submit reloads automatically with no Close click needed', async ({ page }) => {
        const store = createAssertionsStore([{
            uuid: 'a1', code: 30001, comment: 'Original comment text',
            userId: SESSION_USER.userId, userDisplayName: 'Jane Smith', created: '2024-01-01T00:00:00Z',
            referenceRowKey: g_acaciaRecord.raw.uuid, relatedRecordId: '', relatedRecordReason: '',
        }]);
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls, { assertionsStore: store });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await expect(page.locator('#userAnnotationsDiv')).toContainText('Original comment text');
        await page.locator('.editAnnotationButton').click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        // Modal.Title's default `as` is a plain <div className="h4">, not a real
        // heading element -- no implicit ARIA heading role to locate by.
        await expect(modal).toContainText('Edit an issue');
        // isEditMode disables the select entirely (the user cannot change the issue
        // type of an existing annotation) and pre-selects the assertion's own code.
        await expect(modal.locator('#issue')).toBeDisabled();
        await expect(modal.locator('#issue')).toHaveValue('30001');
        await expect(modal.locator('#issueComment')).toHaveValue('Original comment text');

        await modal.locator('#issueComment').fill('Updated comment text');
        await modal.locator('#issueFormSubmit').click();

        // onSubmitted (edit mode's own callback, distinct from #assertionButton's
        // onClose) calls window.location.reload() synchronously right after a
        // successful POST -- there is no #close button to click in this flow, unlike
        // the "New" flow's own onSubmitted-less success state.
        await expect(page.locator('#userAnnotationsDiv')).toContainText('Updated comment text', { timeout: 10000 });
    });

    test('selecting a duplicate-record issue type reveals the related-record fields; an unmatched id errors, a matched id renders the compare table, and Submit stays disabled until every duplicate field is set', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([]) });
        await mockRelatedOccurrence(page, seenUrls, { [g_duplicateOfRecord.raw.uuid]: g_duplicateOfRecord });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('#assertionButton').click();
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        // g_assertionCodes[0] is {code:30000, name:'userDuplicateRecord'} -- selected by
        // default once the codes fetch resolves -- select explicitly anyway so this
        // test doesn't silently stop covering the duplicate branch if fixture order
        // ever changes.
        await expect(modal.locator('#issue')).toHaveValue('30000', { timeout: 10000 });
        await modal.locator('#issue').selectOption('30000');
        await expect(modal.locator('#relatedRecordId')).toBeVisible();
        await expect(modal.locator('#relatedRecordReason')).toBeVisible();

        const submitButton = modal.locator('#issueFormSubmit');
        await expect(submitButton).toBeDisabled();

        // Comment placeholder uses the SAME message id or label text ("Comment:"),
        // not the JSX-only fallback "Please add a comment here...".
        await expect(modal.locator('#issueComment')).toHaveAttribute('placeholder', 'Comment:');
        await modal.locator('#issueComment').fill('This is a duplicate of another record');
        await expect(submitButton).toBeDisabled(); // still missing the duplicate fields

        await modal.locator('#relatedRecordId').fill('no-such-record-uuid');
        await expect(modal.getByText("The record id can't be found.")).toBeVisible({ timeout: 10000 });
        await expect(submitButton).toBeDisabled();

        await modal.locator('#relatedRecordId').fill(g_duplicateOfRecord.raw.uuid);
        // The compare table renders both records' scientificName -- distinct values
        // (g_acaciaRecord="Acacia dealbata", g_duplicateOfRecord="Acacia melanoxylon")
        // confirm it is genuinely comparing the two, not echoing one record twice.
        await expect(modal.getByText('Acacia melanoxylon')).toBeVisible({ timeout: 10000 });
        await expect(modal.getByText('Acacia dealbata').first()).toBeVisible();
        await expect(submitButton).toBeDisabled(); // reason still not selected

        await modal.locator('#relatedRecordReason').selectOption('sameoccurrence');
        await expect(submitButton).toBeEnabled();
    });

    test('the hardcoded 20020 self-duplicate guard fires independently of the isDuplicate name check', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([]) });
        // Override so code 20020 (not the default fixture's 30000) is the
        // 'userDuplicateRecord'-named entry -- selectedCode==='20020' is a SEPARATE
        // hardcoded literal check inside handleSubmit, independent of isDuplicate.
        await mockAssertionCodes(page, seenUrls, [{ code: 20020, name: 'userDuplicateRecord' }, ...g_assertionCodes]);
        // Resolve the record's own uuid to itself -- isValid() only requires
        // `relatedRecord` to be truthy (any successful lookup), not that it differs
        // from the current record; the self-guard is enforced entirely inside
        // handleSubmit, not by isValid().
        await mockRelatedOccurrence(page, seenUrls, { [g_acaciaRecord.raw.uuid]: g_acaciaRecord });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('#assertionButton').click();
        const modal = page.getByRole('dialog');
        await modal.locator('#issue').selectOption('20020');
        await modal.locator('#relatedRecordId').fill(g_acaciaRecord.raw.uuid);
        await expect(modal.getByText('Acacia dealbata').nth(1)).toBeVisible({ timeout: 10000 }); // compare table's 2nd column resolved
        await modal.locator('#relatedRecordReason').selectOption('sameoccurrence');
        await modal.locator('#issueComment').fill('Trying to self-duplicate');

        const submitButton = modal.locator('#issueFormSubmit');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        // Untranslated (confirmed absent from en.json) JSX defaultMessage text.
        await expect(modal.getByText("You can't mark a record as a duplicate of itself.")).toBeVisible({ timeout: 10000 });
        // The guard returns before ever POSTing -- the modal stays open, not reloaded.
        await expect(modal).toBeVisible();
    });

    test('the assertions-list GET failing before the POST shows the same generic flag-fail error', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([]) });
        // Registered after setupRecordMocks() so it wins -- handleSubmit()'s first
        // step (fetching the existing assertions list to guard against re-flagging an
        // already-verified type) fails before ever reaching the POST itself.
        await page.context().route(/https:\/\/biocache-ws\.ala\.org\.au\/ws\/occurrences\/[^/]+\/assertions$/, route => route.abort());
        seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/'));
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('#assertionButton').click();
        const modal = page.getByRole('dialog');
        await modal.locator('#issue').selectOption('30001'); // a non-duplicate code -- skips the related-record fields entirely
        await modal.locator('#issueComment').fill('Testing the assertions-list fetch failure');
        await modal.locator('#issueFormSubmit').click();

        await expect(modal.getByText('There was a problem flagging the issue. Please try again later.')).toBeVisible({ timeout: 10000 });
        await expect(modal).toBeVisible(); // stays open -- not reloaded, no success state
    });

    test('the assertion POST itself failing (after a successful assertions-list GET) shows the same generic flag-fail error', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([]) });
        await page.context().route('https://biocache-ws.ala.org.au/ws/occurrences/assertions/add', route => route.abort());
        seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/assertions/add'));
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('#assertionButton').click();
        const modal = page.getByRole('dialog');
        await modal.locator('#issue').selectOption('30001');
        await modal.locator('#issueComment').fill('Testing the POST failure');
        await modal.locator('#issueFormSubmit').click();

        await expect(modal.getByText('There was a problem flagging the issue. Please try again later.')).toBeVisible({ timeout: 10000 });
        await expect(modal).toBeVisible();
    });

    test('unchecking "notify me" before a successful submit calls unsubscribeMyAnnotation instead of subscribeMyAnnotation', async ({ page }) => {
        const seenUrls = await setupMocks(page, { session: SESSION_USER });
        await setupRecordMocks(page, seenUrls, { assertionsStore: createAssertionsStore([]) });
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await page.locator('#assertionButton').click();
        const modal = page.getByRole('dialog');
        await expect(modal.locator('#notifyChangeCheckbox')).toBeChecked(); // defaults to true
        await modal.locator('#notifyChangeCheckbox').uncheck();
        await modal.locator('#issue').selectOption('30001');
        await modal.locator('#issueComment').fill('Please do not notify me about this one');

        const [request] = await Promise.all([
            page.waitForRequest(req => req.url().includes('/unsubscribeMyAnnotation'), { timeout: 10000 }),
            modal.locator('#issueFormSubmit').click(),
        ]);
        expect(request.url()).toContain('/unsubscribeMyAnnotation');
        await expect(modal.locator('#submitSuccess')).toContainText('Thanks for flagging the problem!', { timeout: 10000 });
    });
});
