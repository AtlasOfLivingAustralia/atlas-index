import { Page } from '@playwright/test';
import { expect } from '../fixtures';
import { BASE_URL } from '../helpers';
import { g_indexFields } from '../mocks/biocacheMocks';
import { g_acaciaRecord } from '../mocks/recordMocks';

export {
    BASE_URL, setupMocks, load, loadResults, mockWmsTiles, mockImages,
    SESSION_ANONYMOUS, SESSION_USER, SESSION_ADMIN,
} from '../helpers';

/**
 * Navigate directly to a record-detail page and wait for it to render. A synthetic-
 * local duplicate of acceptance.spec.ts's own (non-exported) loadRecord() helper --
 * per the skill's convention, synthetic tests keep their own helpers.ts rather than
 * importing a spec file's internals.
 */
export async function loadRecord(page: Page, uuid: string) {
    await page.goto(`${BASE_URL}/occurrence/${uuid}`);
    await expect(page.getByText('Acacia dealbata').first()).toBeVisible({ timeout: 15000 });
}

/**
 * Builds a queryTitle HTML fragment containing a single lsid-classed span -- the
 * exact shape taxonDropdown.tsx's LSID_SPAN_RE looks for (a <span> whose class
 * attribute contains the word "lsid", with an id attribute holding the raw lsid).
 * Needed because neither the default acacia search fixture nor BiocacheSearchConfig
 * previously modelled `queryTitle` at all -- without one, LsidDropdown never mounts
 * (TaxonDropdown falls back to a plain, non-interactive dangerouslySetInnerHTML span)
 * and AlertModal throws a TypeError reading `results.queryTitle.length`.
 */
export function queryTitleWithLsid(lsid: string, displayName: string): string {
    return `<span class="lsid" id="${lsid}">${displayName}</span>`;
}

/**
 * A second, deliberately-different "related record" for flagIssueModal.tsx's
 * duplicate-record compare table -- g_acaciaRecord's raw/processed values are
 * identical to each other, so echoing it back as both "this record" and "the
 * related record" would render an uninteresting compare table with every row
 * matching. Only the 5 fields the compare table actually reads are populated.
 */
export const g_duplicateOfRecord = {
    processed: {
        uuid: 'bbbbbbbb-2222-3333-4444-555555555555',
        classification: { scientificName: 'Acacia melanoxylon' },
        location: { stateProvince: 'Victoria', decimalLongitude: 145.0, decimalLatitude: -37.8 },
        event: { eventDate: '2019-03-15' },
    },
    raw: {
        uuid: 'bbbbbbbb-2222-3333-4444-555555555555',
        classification: { scientificName: 'Acacia melanoxylon' },
        location: { stateProvince: 'Victoria', decimalLongitude: 145.0, decimalLatitude: -37.8 },
        event: { eventDate: '2019-03-15' },
    },
};

/** Default collection contacts fixture for contactCuratorModal.tsx's synthetic tests. */
export const g_collectionContacts = [
    {
        contact: { firstName: 'Jane', lastName: 'Curator', email: 'jane.curator@example.org', phone: '02 6246 5000' },
        primaryContact: true,
        role: 'Collection Manager',
        editor: true,
    },
    {
        contact: { firstName: 'Sam', lastName: 'Botanist', email: 'sam.botanist@example.org' },
        primaryContact: false,
        role: '',
    },
];

/**
 * g_indexFields (biocacheMocks.ts's default 13-row /index/fields fixture) is enough
 * for most of Fields.tsx's branches, but every row leaves jsonName/downloadName/
 * description/downloadDescription/infoUrl/multiValued/i18nValues/dataType unset --
 * so it can't exercise the badges, the Wiki link, or a meaningful free-text search
 * (all those fields are blank on every row). This one extra row adds all of them
 * at once, purpose-built for Fields.spec.ts's badges/wiki/free-text-search tests.
 */
type IndexField = {
    name: string;
    classs: string | null;
    dwcTerm?: string | null;
    indexed: boolean;
    stored: boolean;
    jsonName?: string;
    downloadName?: string;
    description?: string;
    downloadDescription?: string;
    dataType?: string;
    multiValued?: boolean;
    i18nValues?: boolean;
    infoUrl?: string;
};
export const g_indexFieldsWithBadges: IndexField[] = [
    ...g_indexFields,
    {
        name: 'specialField',
        jsonName: 'specialFieldJson',
        downloadName: 'Special Field Download',
        description: 'A field used to test badge rendering and free-text search coverage',
        downloadDescription: 'Special field download description',
        dataType: 'string',
        indexed: true,
        stored: true,
        multiValued: true,
        i18nValues: true,
        infoUrl: 'https://github.com/AtlasOfLivingAustralia/ala-dataquality/wiki/specialField',
        classs: 'Occurrence',
    },
];

/**
 * A clone of g_acaciaRecord with processed.occurrence.associatedOccurrences set --
 * duplication.tsx's getDuplicationDetails() gates its entire /duplicates/:uuid
 * fetch on this field being truthy, and the default fixture leaves it unset (so
 * Duplication renders null in every other synthetic/acceptance test).
 */
export const g_acaciaRecordWithDuplicates = JSON.parse(JSON.stringify(g_acaciaRecord));
g_acaciaRecordWithDuplicates.processed.occurrence.associatedOccurrences = 'true';

/**
 * A second record uuid representing the "Related record" duplicate.tsx's
 * getRepresentativeDrNames() batch-fetches via the singular /occurrence/:id
 * endpoint (recordMocks.ts's mockRelatedOccurrence), alongside the representative
 * record itself (g_acaciaRecord.processed.uuid).
 */
export const g_duplicateRecordUuid = 'cccccccc-3333-4444-5555-666666666666';

/**
 * /duplicates/:uuid response fixture -- populates every optional field on both the
 * "Representative Record" (top-level) and one "Related records" entry
 * (duplicates[0]) at once, plus a dupTypes pair exercising both the
 * dqCodes-recognised (numeric id "20", renders via intl as the literal
 * "duplication.20" id string since no en.json translation exists for it -- see
 * main.tsx's IntlProvider onError swallowing MISSING_TRANSLATION) and
 * dqCodes-unrecognised (falls back to the raw id string) branches of the
 * "Comments" field's nested ternary.
 *
 * `id` is deliberately set equal to `uuid` on both the top level and the
 * duplicates[0] entry: duplication.tsx's getRepresentativeDrNames() builds its
 * batch of /occurrence/:id fetches from `.id` (data.id / d.id), but the render
 * code below looks up representativeDrName BY `.uuid` -- a real mismatch in the
 * source (the two fields are never cross-referenced anywhere else in the file).
 * Setting them equal here is what makes the mocked round-trip land on the right
 * key; it is not working around a test-only concern.
 */
export const g_duplicateInfo = {
    duplicationStatus: 'R',
    id: g_acaciaRecord.processed.uuid,
    uuid: g_acaciaRecord.processed.uuid,
    druid: 'dr123',
    rawScientificName: 'Acacia dealbata',
    latLong: '-35.28,149.13',
    collector: 'Jane Botanist',
    year: '2020',
    month: '7',
    day: '20',
    duplicates: [
        {
            id: g_duplicateRecordUuid,
            uuid: g_duplicateRecordUuid,
            druid: 'dr999',
            rawScientificName: 'Acacia melanoxylon',
            latLong: '-37.8,145.0',
            collector: 'Sam Botanist',
            year: '2019',
            month: '3',
            day: '15',
            dupTypes: [{ id: '20' }, { id: 'customComment' }],
        },
    ],
};
