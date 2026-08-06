import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { mockImages } from './imageMocks';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(relativePath: string): any {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources', relativePath), 'utf-8'));
}

export const g_acaciaRecord = loadFixture('occurrence-record-acacia.json');

/** Empty-but-valid CompareResult -- recordCore.tsx's useEffect blocks entirely until this is set. */
export const g_emptyCompareRecord = {
    Attribution: [], Classification: [], Event: [], Identification: [], Location: [], Occurrence: [],
};

/** Mock GET VITE_APP_BIOCACHE_URL/occurrences/:uuid?im=true (the main record fetch). */
export async function mockRecordDetail(page: Page, seenUrls: Set<URL>, record: any = g_acaciaRecord) {
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/'));
    // [^/?]+ (not just [^/]+) is required -- "?" is not a "/", so a plain [^/]+ would
    // greedily consume "im=true" too and then fail to find the mandatory "?im=true"
    // suffix, silently never matching any request at all.
    await page.context().route(/https:\/\/biocache-ws\.ala\.org\.au\/ws\/occurrences\/[^/?]+\?im=true/, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record) });
    });
}

/** Mock GET .../occurrences/compare/:uuid. */
export async function mockCompareRecord(page: Page, seenUrls: Set<URL>, compareRecord: any = g_emptyCompareRecord) {
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/compare/'));
    await page.context().route(/https:\/\/biocache-ws\.ala\.org\.au\/ws\/occurrences\/compare\/.+/, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(compareRecord) });
    });
}

/**
 * Mock GET the SINGULAR .../occurrence/:id (flagIssueModal.tsx's debounced
 * duplicate-record-id lookup, `fetchData()`'s 500ms-debounced fetch) -- distinct
 * from mockRecordDetail's plural `/occurrences/:uuid?im=true`. The negative
 * lookahead excludes `/occurrence/search` in case that path is ever registered
 * against this same base path in future.
 * `byUuid` keys are matched against the raw path segment (not URL-decoded uuid
 * casing games); an id with no matching entry fulfills 404, which the modal
 * treats identically to any other lookup failure (relatedRecordState='notfound').
 */
export async function mockRelatedOccurrence(page: Page, seenUrls: Set<URL>, byUuid: Record<string, any>) {
    const base = 'https://biocache-ws.ala.org.au/ws/occurrence/';
    seenUrls.add(new URL(base));
    await page.context().route(/https:\/\/biocache-ws\.ala\.org\.au\/ws\/occurrence\/(?!search)([^/?]+)$/, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        const id = decodeURIComponent(route.request().url().split('/occurrence/')[1]);
        const rec = byUuid[id];
        if (!rec) {
            return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({}) });
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rec) });
    });
}

/**
 * Stateful mock for the user-assertions lifecycle: GET .../occurrences/:uuid/assertions
 * (list), POST .../occurrences/assertions/add (create/edit), POST
 * .../occurrences/assertions/delete (remove) -- all share the same in-memory array so a
 * test can add/delete via the real UI flow and see the change reflected after the app's
 * own `window.location.reload()`. Returns the live array for direct inspection/seeding.
 */
export function createAssertionsStore(initial: any[] = []) {
    return { assertions: [...initial] };
}

export async function mockAssertions(page: Page, seenUrls: Set<URL>, store: { assertions: any[] }) {
    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/'));
    await page.context().route(/https:\/\/biocache-ws\.ala\.org\.au\/ws\/occurrences\/[^/]+\/assertions$/, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(store.assertions) });
    });

    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/assertions/add'));
    await page.context().route('https://biocache-ws.ala.org.au/ws/occurrences/assertions/add', async (route) => {
        seenUrls.add(new URL(route.request().url()));
        const body = new URLSearchParams(route.request().postData() || '');
        const updateId = body.get('updateId');
        const uuid = updateId || `assertion-${Date.now()}`;
        const newAssertion = {
            uuid,
            code: Number(body.get('code')),
            comment: body.get('comment') || '',
            userId: body.get('userId') || '',
            userDisplayName: body.get('userDisplayName') || '',
            created: new Date().toISOString(),
            referenceRowKey: body.get('recordUuid') || '',
            relatedRecordId: body.get('relatedRecordId') || '',
            relatedRecordReason: body.get('relatedRecordReason') || '',
            // qaStatus/relatedUuid are additive fields, only ever sent by
            // verifyRecordModal.tsx's handleConfirm() (code=50000, userAssertionStatus,
            // and -- when verifying a specific assertion -- assertionUuid). Never sent
            // by flagIssueModal.tsx, so this is a no-op for every existing new-issue/
            // edit-issue test. Storing `assertionUuid` as `relatedUuid` lets
            // Occurrence.tsx's own real (unmocked) lookup20020Assertions() client-side
            // logic nest this entry into the original assertion's `.verified[]` array
            // on the next GET, exactly like the real backend -- no mock-side nesting
            // logic needed, see synthetic verifyRecordModal.spec.ts.
            qaStatus: body.get('userAssertionStatus') || '',
            ...(body.get('assertionUuid') ? { relatedUuid: body.get('assertionUuid') } : {}),
        };
        if (updateId) {
            const idx = store.assertions.findIndex(a => a.uuid === updateId);
            if (idx >= 0) store.assertions[idx] = newAssertion;
            else store.assertions.push(newAssertion);
        } else {
            store.assertions.push(newAssertion);
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    seenUrls.add(new URL('https://biocache-ws.ala.org.au/ws/occurrences/assertions/delete'));
    await page.context().route('https://biocache-ws.ala.org.au/ws/occurrences/assertions/delete', async (route) => {
        seenUrls.add(new URL(route.request().url()));
        const body = new URLSearchParams(route.request().postData() || '');
        const assertionUuid = body.get('assertionUuid');
        store.assertions = store.assertions.filter(a => a.uuid !== assertionUuid);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
}

/** Default assertion-type codes (all < 50000, per flagIssueModal.tsx's userCodes filter). */
export const g_assertionCodes = [
    { code: 30000, name: 'userDuplicateRecord' },
    { code: 30001, name: 'userIncorrectLocation' },
    { code: 30002, name: 'userIncorrectIdentification' },
];

/** Mock GET .../assertions/user/codes (flagIssueModal.tsx's issue-type dropdown). */
export async function mockAssertionCodes(page: Page, seenUrls: Set<URL>, codes: any[] = g_assertionCodes) {
    const pattern = 'https://biocache-ws.ala.org.au/ws/assertions/user/codes';
    seenUrls.add(new URL(pattern));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(codes) });
    });
}

/** Mock GET VITE_APP_SPATIAL_SERVICE_URL/fields/search (environmentalSampleInfo.tsx). */
export async function mockSpatialFieldsSearch(page: Page, seenUrls: Set<URL>, fields: any[] = [
    { id: 'cl1048', name: 'IBRA Region', layer: { environmentalvalueunits: '', name: 'cl1048', classification1: 'Administrative' } },
    { id: 'el882', name: 'Annual Mean Temperature', layer: { environmentalvalueunits: '\u00b0C', name: 'el882', classification1: 'Climate' } },
]) {
    const pattern = 'https://spatial.test.ala.org.au/ws/fields/search';
    seenUrls.add(new URL(pattern));
    await page.context().route(pattern, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fields) });
    });
}

/** Mock GET VITE_APP_SPATIAL_SERVICE_URL/layer/:id (outlierFeedback.tsx, one call per outlier layer). */
export async function mockSpatialLayer(page: Page, seenUrls: Set<URL>, metadataById: Record<string, any> = {}) {
    seenUrls.add(new URL('https://spatial.test.ala.org.au/ws/layer/'));
    await page.context().route(/https:\/\/spatial\.test\.ala\.org\.au\/ws\/layer\/(.+)/, async (route) => {
        const url = route.request().url();
        seenUrls.add(new URL(url));
        const id = url.split('/layer/')[1];
        const metadata = metadataById[id] ?? { name: `layer-${id}`, displayname: `Layer ${id}`, source: 'ALA', notes: 'Mock layer', description: 'Mock layer description', scale: '1:100,000' };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(metadata) });
    });
}

/** Mock the ALA collectory lookups fired from Occurrence.tsx's fetchCollectionInfo/fetchDataResourceInfo. */
export async function mockCollectory(page: Page, seenUrls: Set<URL>) {
    const base = 'https://collections.test.ala.org.au';
    seenUrls.add(new URL(base));
    await page.context().route(base + '/**', async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
}

/**
 * Override just the collection-level contacts endpoint with a real (non-empty)
 * contacts array -- mockCollectory above always fulfills every collectory path
 * (including this one) with a bare `{}`, which is why contactCuratorModal.tsx's
 * trigger button (`contacts && contacts.length > 0` in recordSidebar.tsx) never
 * appears under the default setupRecordMocks() setup. Must be registered AFTER
 * setupRecordMocks()/mockCollectory() so it takes priority (Playwright resolves
 * routes in reverse-registration order). Only ONE of fetchCollectionInfo/
 * fetchDataResourceInfo ever fires per record (Occurrence.tsx's `if
 * (processed.attribution.collectionUid) {...} else if (raw.attribution.
 * dataResourceUid) {...}` is a real if/else-if, not two independent calls) --
 * g_acaciaRecord has collectionUid='co1' set, so only the collection path fires.
 */
export async function mockCollectionContacts(page: Page, seenUrls: Set<URL>, contacts: any[], collectionUid: string = 'co1') {
    const url = `https://collections.test.ala.org.au/ws/collection/${collectionUid}/contact.json`;
    seenUrls.add(new URL(url));
    await page.context().route(url + '**', async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(contacts) });
    });
}

/**
 * Mock one or more "referenced publication" metadata fetches (referencedPublications.tsx's
 * fetchPublicationInfo(), which -- unlike every other record-detail fetch -- calls
 * fetch(item.identifier, {headers: {Accept: 'application/vnd.schemaorg.ld+json'}}) directly
 * against each referencedPublications[] entry's own arbitrary external `identifier` URL,
 * not a fixed ALA hostname. `byUrl` keys must exactly match the `identifier` values used
 * in the record fixture passed to mockRecordDetail/setupRecordMocks.
 */
export async function mockPublicationMetadata(page: Page, seenUrls: Set<URL>, byUrl: Record<string, any>) {
    for (const [url, data] of Object.entries(byUrl)) {
        seenUrls.add(new URL(url));
        await page.context().route(url, async (route) => {
            seenUrls.add(new URL(route.request().url()));
            await route.fulfill({ status: 200, contentType: 'application/vnd.schemaorg.ld+json', body: JSON.stringify(data) });
        });
    }
}

/**
 * Mock the "my annotation" alert subscribe/unsubscribe POST fired by flagIssueModal.tsx
 * after a successful add (only when VITE_ALERTS_MY_ANNOTATION_ENABLED === 'true', which
 * .env.playwright sets).
 */
export async function mockAlertsSubscription(page: Page, seenUrls: Set<URL>) {
    seenUrls.add(new URL('https://alerts.test.ala.org.au/api/alerts/user/'));
    await page.context().route(/https:\/\/alerts\.test\.ala\.org\.au\/api\/alerts\/user\/.+/, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
}

/**
 * Mock GET .../duplicates/:uuid (duplication.tsx's Duplication component, rendered
 * on the record-detail page). Only fires at all when the record's
 * processed.occurrence.associatedOccurrences is truthy -- the default
 * g_acaciaRecord fixture does not set it, so this is opt-in per test via a cloned
 * record override (see synthetic duplication.spec.ts). `byUuid` keys are matched
 * against the raw uuid path segment, same convention as mockRelatedOccurrence.
 */
export async function mockDuplicates(page: Page, seenUrls: Set<URL>, byUuid: Record<string, any>) {
    const base = 'https://biocache-ws.ala.org.au/ws/duplicates/';
    seenUrls.add(new URL(base));
    await page.context().route(/https:\/\/biocache-ws\.ala\.org\.au\/ws\/duplicates\/([^/?]+)$/, async (route) => {
        seenUrls.add(new URL(route.request().url()));
        const id = decodeURIComponent(route.request().url().split('/duplicates/')[1]);
        const data = byUuid[id];
        if (!data) {
            return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({}) });
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
}

/**
 * Composite: everything needed for Occurrence.tsx + all its child components to render
 * without logMissingMocks throwing. Skips events GraphQL (VITE_APP_EVENTS_GRAPHQL_URL,
 * a different host -- see mockEventsGraphql) since most record fixtures don't set
 * raw.event.eventID, which is required to trigger that fetch at all.
 */
export async function setupRecordMocks(page: Page, seenUrls: Set<URL>, options: {
    record?: any;
    compareRecord?: any;
    assertionsStore?: { assertions: any[] };
} = {}) {
    await mockRecordDetail(page, seenUrls, options.record ?? g_acaciaRecord);
    await mockCompareRecord(page, seenUrls, options.compareRecord ?? g_emptyCompareRecord);
    await mockAssertions(page, seenUrls, options.assertionsStore ?? createAssertionsStore());
    await mockAssertionCodes(page, seenUrls);
    await mockSpatialFieldsSearch(page, seenUrls);
    await mockCollectory(page, seenUrls);
    await mockAlertsSubscription(page, seenUrls);
    // g_acaciaRecord (the default fixture) includes an images[] entry -- mock the image
    // service unconditionally so any test using it doesn't need to remember to as well.
    await mockImages(page, seenUrls);
}
