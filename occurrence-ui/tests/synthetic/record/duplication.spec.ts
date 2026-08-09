import { test, expect } from '../../fixtures';
import { setupMocks, loadRecord, g_acaciaRecordWithDuplicates, g_duplicateInfo, g_duplicateRecordUuid } from '../helpers';
import { setupRecordMocks, mockRelatedOccurrence, mockDuplicates, g_acaciaRecord } from '../../mocks/recordMocks';

// ===========================================================================
// Synthetic coverage: src/components/occurrence/duplication.tsx (148 lines),
// ~0% real-logic coverage -- rendered on every record-detail page load (195
// times across the existing suite per lcov data) but every single existing
// test's fixture leaves processed.occurrence.associatedOccurrences unset, so
// getDuplicationDetails() always returns before ever fetching /duplicates/:uuid
// and the component renders null every time.
// ===========================================================================

test.describe('Duplication ("Inferred associated occurrence details" section)', () => {
    test('renders nothing under the default fixture (documents why this is 0%-covered today)', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await setupRecordMocks(page, seenUrls);
        await loadRecord(page, g_acaciaRecord.raw.uuid);

        await expect(page.locator('#inferredOccurrenceDetails')).toHaveCount(0);
    });

    test('with associatedOccurrences set, shows the Representative Record and Related records tables with every optional field, including both the recognised and unrecognised duplication-comment codes', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await setupRecordMocks(page, seenUrls, { record: g_acaciaRecordWithDuplicates });
        await mockDuplicates(page, seenUrls, { [g_duplicateInfo.id]: g_duplicateInfo });
        await mockRelatedOccurrence(page, seenUrls, {
            [g_duplicateInfo.id]: { processed: { uuid: g_duplicateInfo.uuid, attribution: { dataResourceName: 'Herbarium A' } } },
            [g_duplicateRecordUuid]: { processed: { uuid: g_duplicateRecordUuid, attribution: { dataResourceName: 'Herbarium B' } } },
        });
        await loadRecord(page, g_acaciaRecordWithDuplicates.raw.uuid);

        const section = page.locator('#inferredOccurrenceDetails');
        await expect(section).toBeVisible();
        // duplication.tsx uses the custom `useIntl` wrapper (util/useIntl.ts), which
        // always passes `ignoreTag: true` to formatMessage(). That's what lets the
        // en.json p01/p02 strings embed literal <em> tags (rendered via
        // dangerouslySetInnerHTML) without formatjs treating them as rich-text tags
        // requiring a `values={{em:...}}` mapping -- so no FORMAT_ERROR occurs and
        // the full en.json translation (not the short JSX defaultMessage) is shown.
        await expect(section).toContainText('This record has been identified as the representative occurrence in a group of associated occurrences. This mean other records have been detected that seem to relate to this record and this particular record has the most detailed information on the occurrence.');

        await expect(section).toContainText('Representative Record');
        await expect(section).toContainText('Related records');

        const table = section.locator('table.duplicationTable');
        await expect(table).toBeVisible();

        // Representative Record row values (top-level g_duplicateInfo fields).
        await expect(table).toContainText(g_duplicateInfo.uuid);
        await expect(table).toContainText('Herbarium A');
        await expect(table).toContainText('Acacia dealbata');
        await expect(table).toContainText('-35.28,149.13');
        await expect(table).toContainText('Jane Botanist');

        // Related record row values (duplicates[0]).
        await expect(table).toContainText(g_duplicateRecordUuid);
        await expect(table).toContainText('Herbarium B');
        await expect(table).toContainText('Acacia melanoxylon');
        await expect(table).toContainText('Sam Botanist');
        // Comments: dqCodes['20'] exists (renders as the literal untranslated
        // "duplication.20" id string, per main.tsx's IntlProvider swallowing
        // MISSING_TRANSLATION), 'customComment' does not exist in dqCodes.json so
        // it falls back to the raw id itself -- both joined with ", " on one row.
        await expect(table).toContainText('duplication.20, customComment');

        // Record UUID rows link to the record-detail page for that uuid.
        await expect(table.locator(`a[href="/occurrence/${g_duplicateRecordUuid}"]`)).toHaveCount(1);
        await expect(table.locator(`a[href="/occurrence/${g_duplicateInfo.uuid}"]`)).toHaveCount(1);
    });

    test('shows only the intro paragraph, no table, when duplicates is an empty array; a non-"R" status renders the alternate p02 text', async ({ page }) => {
        const seenUrls = await setupMocks(page);
        await setupRecordMocks(page, seenUrls, { record: g_acaciaRecordWithDuplicates });
        await mockDuplicates(page, seenUrls, {
            [g_duplicateInfo.id]: { ...g_duplicateInfo, duplicationStatus: 'D', duplicates: [] },
        });
        // getRepresentativeDrNames() still fires for the representative record's own
        // id even when duplicates is empty (it always includes data.id up front).
        await mockRelatedOccurrence(page, seenUrls, {
            [g_duplicateInfo.id]: { processed: { uuid: g_duplicateInfo.uuid, attribution: { dataResourceName: 'Herbarium A' } } },
        });
        await loadRecord(page, g_acaciaRecordWithDuplicates.raw.uuid);

        const section = page.locator('#inferredOccurrenceDetails');
        await expect(section).toBeVisible();
        // duplicationStatus !== 'R' -> the p02 branch. Same ignoreTag behaviour as
        // p01 above -- shows the full en.json translation, including the "another
        // record has been detected..." second sentence, not the short JSX
        // defaultMessage.
        await expect(section).toContainText('This record is associated with the representative record. This mean another record has been detected to be similar to this record, and that the other record (the representative record) has the most detailed information for the occurrence.');
        await expect(section.locator('table.duplicationTable')).toHaveCount(0);
    });
});
