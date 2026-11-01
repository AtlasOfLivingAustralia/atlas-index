import {Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {createCanvas} from 'canvas';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name: string): any {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../resources', name), 'utf-8'));
}

/** Generates a small placeholder PNG standing in for a real image-service thumbnail/tile/original. */
function generatePlaceholderImage(label: string, width = 256, height = 256): Buffer {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a7a6a';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, width / 2, height / 2);
    return canvas.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

// searchResultFixture/searchFacetsFixture are intentionally EMPTY by default (no results, no
// facets) so that any test which doesn't explicitly override the search response exercises the
// genuine empty-state UI. Tests that need to assert on rendered image cards/facets must supply
// their own explicit, test-local fixture (see e.g. the "renders search results" test in
// acceptance.spec.ts) rather than relying on a shared default containing sample images.
export const searchResultFixture = loadFixture('searchResult.json');
export const searchFacetsFixture = loadFixture('searchFacets.json');
// imageDetailFixture is a single neutral synthetic test image (img-test-1) used as the default
// body for any GET /api/v2/images/:imageId request; it contains no real/sample dataset content.
export const imageDetailFixture = loadFixture('imageDetail.json');
export const adminDashboardFixture = loadFixture('adminDashboard.json');
export const queuesDetailFixture = loadFixture('queuesDetail.json');
export const searchCriteriaFixture = loadFixture('searchCriteria.json');
export const batchUploadsFixture = loadFixture('batchUploads.json');
export const tagsTreeFixture = loadFixture('tagsTree.json');
export const settingsFixture = loadFixture('settings.json');
export const duplicatesFixture = loadFixture('duplicates.json');
export const licencesFixture = loadFixture('licences.json');
export const storageLocationsFixture = loadFixture('storageLocations.json');
export const inboxFixture = loadFixture('inbox.json');
export const swaggerSpecFixture = loadFixture('swaggerSpec.json');

// ---------------------------------------------------------------------------
// User session fixtures
//
// Shape matches the confirmed GET /api/v2/session contract:
// {authenticated,userId,userName,email,displayName,firstName,lastName,
//  roles,permissions:{isAdmin,isImageAdmin}}
// ---------------------------------------------------------------------------

export const SESSION_ANONYMOUS = {authenticated: false, roles: [], permissions: {isAdmin: false, isImageAdmin: false}};

export const SESSION_USER = {
    authenticated: true,
    userId: 'user-001',
    userName: 'jsmith',
    email: 'user@example.com',
    displayName: 'Jane Smith',
    firstName: 'Jane',
    lastName: 'Smith',
    roles: ['ROLE_USER'],
    permissions: {isAdmin: false, isImageAdmin: false}
};

export const SESSION_IMAGE_ADMIN = {
    authenticated: true,
    userId: 'image-admin-001',
    userName: 'iadmin',
    email: 'image-admin@example.com',
    displayName: 'Iris Admin',
    firstName: 'Iris',
    lastName: 'Admin',
    roles: ['ROLE_USER', 'ROLE_IMAGE_ADMIN'],
    permissions: {isAdmin: false, isImageAdmin: true}
};

export const SESSION_ADMIN = {
    authenticated: true,
    userId: 'admin-001',
    userName: 'admin',
    email: 'admin@example.com',
    displayName: 'Admin User',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['ROLE_USER', 'ROLE_ADMIN'],
    permissions: {isAdmin: true, isImageAdmin: false}
};

// ---------------------------------------------------------------------------
// Individual mock registration helpers
// ---------------------------------------------------------------------------

let activeFacetsFixture = searchFacetsFixture;

/** GET /api/v2/session or /session */
export async function mockSession(page: Page, seenUrls: Set<URL>, sessionData: object = SESSION_ANONYMOUS) {
    await page.route(/(http:\/\/localhost:8081\/api\/v2\/session|http:\/\/localhost:8081\/session)$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(sessionData)});
    });
}

/** Public search: GET /api/v2/images/search or /ws/search */
export async function mockSearch(page: Page, seenUrls: Set<URL>, result: object = searchResultFixture) {
    await page.route(/http:\/\/localhost:8081(\/api\/v2\/images\/search|\/ws\/search)(\?.*)?$/, route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const res: any = result;
        const images = res.images || res.results || [];
        const totalCount = res.totalImageCount ?? res.totalRecords ?? images.length;
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ...res,
                images,
                results: images,
                totalImageCount: totalCount,
                totalRecords: totalCount,
                facets: activeFacetsFixture,
                searchCriteria: [],
                criteriaDefinitions: searchCriteriaFixture.results || searchCriteriaFixture
            })
        });
    });
}

/** Facets: GET /api/v2/images/search/facet */
export async function mockSearchFacets(page: Page, seenUrls: Set<URL>, facets: object = searchFacetsFixture) {
    activeFacetsFixture = facets as any;
    await page.route(/http:\/\/localhost:8081\/api\/v2\/images\/search\/facet(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(facets)});
    });
}

/** Admin mutations for advanced-search field definitions. Public reads come from /ws/search. */
export async function mockSearchCriteria(page: Page, seenUrls: Set<URL>, defs: object = searchCriteriaFixture) {
    const url = 'http://localhost:8081/api/v2/admin/search-criteria';
    seenUrls.add(new URL(url));
    await page.route(/http:\/\/localhost:8081(\/api\/v2\/admin\/search-criteria|\/admin\/searchCriteriaListFragment)(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        if (route.request().method() === 'GET') {
            return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(defs)});
        }
        return route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
    });
}

/** Image/media detail: GET /api/v2/images/:imageId or /ws/image/:imageId */
export async function mockImageDetail(page: Page, seenUrls: Set<URL>, image: object = imageDetailFixture) {
    await page.route(/http:\/\/localhost:8081(\/api\/v2\/images\/[^/?]+|\/ws\/image\/[^/?]+)(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(image)});
    });
    await page.route(/http:\/\/localhost:8081\/ws\/getSubimageRectangles\/[^/?]+$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({success: true, subimages: []})});
    });
    // The detail view also reads the legacy metadata fragment to discover a
    // parent image when that relationship is absent from /ws/image. These
    // fixtures do not represent a sub-image, so an empty fragment is correct.
    await page.route(/http:\/\/localhost:8081\/image\/coreImageMetadataTableFragment\/[^/?]+$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({status: 200, contentType: 'text/html', body: ''});
    });
}

/** Admin dashboard */
export async function mockAdminDashboard(page: Page, seenUrls: Set<URL>, dashboard: object = adminDashboardFixture, queues: object = queuesDetailFixture) {
    const d: any = dashboard;
    const q: any = queues;
    const dashboardUrl = 'http://localhost:8081/api/v2/admin/dashboard';
    seenUrls.add(new URL(dashboardUrl));
    await page.route(dashboardUrl, route => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(dashboard)}));

    await page.route(/http:\/\/localhost:8081\/ws\/repositoryStatistics(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                imageCount: d.imageCount ?? 125430,
                deletedImageCount: d.deletedImageCount ?? 342,
                licenceCount: d.licenceCount ?? 8,
                licenceMappingCount: d.licenceMappingCount ?? 24
            })
        });
    });

    await page.route(/http:\/\/localhost:8081\/ws\/repositorySizeOnDisk(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                sizeInBytes: 987654321098,
                repoSizeOnDisk: d.repoSizeOnDisk ?? 987654321098
            })
        });
    });

    const queuesUrl = 'http://localhost:8081/api/v2/admin/queues';
    seenUrls.add(new URL(queuesUrl));
    await page.route(queuesUrl, route => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(queues)}));

    await page.route(/http:\/\/localhost:8081\/ws\/backgroundQueueStats(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ...q,
                queueLength: d.queues?.imageQueueLength ?? 12,
                tilingQueueLength: d.queues?.tilingQueueLength ?? 3,
                batchUploads: d.queues?.activeBatchUploads ?? 2
            })
        });
    });

    const clearUrl = 'http://localhost:8081/api/v2/admin/queues/clear';
    seenUrls.add(new URL(clearUrl));
    await page.route(/http:\/\/localhost:8081(\/api\/v2\/admin\/queues\/clear|\/admin\/clearQueues)(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
    });
}

/**
 * Batch upload queue monitor mock: GET/POST /api/v2/admin/batch-uploads,
 * PUT .../processing, DELETE .../batch-files/queue, POST/DELETE
 * .../batch-files/{fileId}. Tracks state in-memory so destructive actions
 * (reload/delete/clear/toggle) observably affect subsequent GETs, letting
 * tests assert real before/after behaviour rather than just "no error".
 */
export async function mockBatchUploads(page: Page, seenUrls: Set<URL>, initial: any = batchUploadsFixture) {
    let state = JSON.parse(JSON.stringify(initial));

    await page.route(/http:\/\/localhost:8081(\/api\/v2\/admin\/batch-uploads|\/admin\/batchUploads|\/admin\/failedUploadsFragment)(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        if (route.request().method() === 'POST') {
            state = {...state, uploads: [], active: 0, queued: 0};
            return route.fulfill({status: 204, body: ''});
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ...state,
                failedUploadList: state.uploads
            })
        });
    });

    await page.route(/http:\/\/localhost:8081\/ws\/backgroundQueueStats(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                batchUploads: state.active ?? 0,
                queueLength: state.queued ?? 0
            })
        });
    });

    const processingUrl = 'http://localhost:8081/api/v2/admin/batch-uploads/processing';
    seenUrls.add(new URL(processingUrl));
    await page.route(processingUrl, async route => {
        const body = route.request().postDataJSON();
        state = {...state, batchServiceProcessingEnabled: body.enabled};
        route.fulfill({status: 204, body: ''});
    });

    await page.route(/http:\/\/localhost:8081\/admin\/(enableBatchProcessing|disableBatchProcessing)$/, route => {
        seenUrls.add(new URL(route.request().url()));
        state = {...state, batchServiceProcessingEnabled: route.request().url().includes('enable')};
        route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
    });

    await page.route(/http:\/\/localhost:8081\/admin\/clearUploads$/, route => {
        seenUrls.add(new URL(route.request().url()));
        state = {...state, uploads: [], active: 0, queued: 0};
        route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
    });

    await page.route(/http:\/\/localhost:8081\/admin\/clearFileQueue$/, route => {
        seenUrls.add(new URL(route.request().url()));
        state = {...state, uploads: state.uploads.filter((u: any) => u.status !== 'QUEUED'), queued: 0};
        route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
    });

    await page.route(/http:\/\/localhost:8081\/admin\/(batchReloadFile|requeueUpload)(\?.*)?$/, route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const fileId = url.searchParams.get('fileId') || url.searchParams.get('id');
        state = {...state, uploads: state.uploads.map((u: any) => (u.fileId === fileId ? {...u, status: 'QUEUED', errorMessage: undefined} : u))};
        route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
    });

    await page.route(/http:\/\/localhost:8081\/admin\/(batchFileDeleteFromQueue|deleteUpload)(\?.*)?$/, route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const fileId = url.searchParams.get('fileId') || url.searchParams.get('id');
        state = {...state, uploads: state.uploads.filter((u: any) => u.fileId !== fileId)};
        route.fulfill({status: 200, contentType: 'application/json', body: '{}'});
    });

    await page.route(/http:\/\/localhost:8081\/api\/v2\/admin\/batch-files\/[^/?]+(\/reload)?$/, route => {
        const url = route.request().url();
        seenUrls.add(new URL(url));
        const fileId = url.split('/batch-files/')[1].replace('/reload', '');
        if (url.endsWith('/reload')) {
            state = {...state, uploads: state.uploads.map((u: any) => (u.fileId === fileId ? {...u, status: 'QUEUED', errorMessage: undefined} : u))};
        } else {
            state = {...state, uploads: state.uploads.filter((u: any) => u.fileId !== fileId)};
        }
        route.fulfill({status: 204, body: ''});
    });

    const queueUrl = 'http://localhost:8081/api/v2/admin/batch-files/queue';
    seenUrls.add(new URL(queueUrl));
    await page.route(queueUrl, route => {
        state = {...state, uploads: state.uploads.filter((u: any) => u.status !== 'QUEUED'), queued: 0};
        route.fulfill({status: 204, body: ''});
    });
}

/** Settings admin: GET /api/v2/admin/settings, PUT .../settings/{name}. */
export async function mockSettings(page: Page, seenUrls: Set<URL>, initial: any = settingsFixture) {
    let state = JSON.parse(JSON.stringify(initial));
    await page.route(/http:\/\/localhost:8081\/api\/v2\/admin\/settings(\/[^/?]+)?$/, async route => {
        const url = route.request().url();
        seenUrls.add(new URL(url));
        if (route.request().method() === 'PUT') {
            const name = decodeURIComponent(url.split('/settings/')[1]);
            const body = route.request().postDataJSON();
            state = {results: state.results.map((s: any) => (s.name === name ? {...s, value: body.value} : s))};
            const updated = state.results.find((s: any) => s.name === name);
            return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(updated)});
        }
        return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(state)});
    });
}

/** Duplicates admin: GET /api/v2/admin/duplicates?max=&offset= */
export async function mockDuplicates(page: Page, seenUrls: Set<URL>, data: object = duplicatesFixture) {
    await page.route(/http:\/\/localhost:8081\/api\/v2\/admin\/duplicates(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(data)});
    });
}

/** Licences admin: GET/PUT /api/v2/admin/licences (full upsert). */
export async function mockLicences(page: Page, seenUrls: Set<URL>, initial: any = licencesFixture) {
    let state = JSON.parse(JSON.stringify(initial));
    const url = 'http://localhost:8081/api/v2/admin/licences';
    seenUrls.add(new URL(url));
    await page.route(url, route => {
        if (route.request().method() === 'PUT') {
            state = route.request().postDataJSON();
            return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(state)});
        }
        return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(state)});
    });
}

/** Storage locations admin: GET/POST /api/v2/admin/storage-locations, POST .../{id}/default, POST .../storage-locations/migrate. */
export async function mockStorageLocations(page: Page, seenUrls: Set<URL>, initial: any[] = storageLocationsFixture) {
    let state = JSON.parse(JSON.stringify(initial));

    await page.route('http://localhost:8081/api/v2/admin/storage-locations', route => {
        seenUrls.add(new URL(route.request().url()));
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON();
            const created = {id: state.length + 1, isDefault: false, hasSecretKeyConfigured: false, hasPasswordConfigured: false, ...body};
            state = [...state, created];
            return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(created)});
        }
        return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(state)});
    });

    await page.route(/http:\/\/localhost:8081\/api\/v2\/admin\/storage-locations\/\d+\/default$/, route => {
        const url = route.request().url();
        seenUrls.add(new URL(url));
        const id = Number(url.split('/storage-locations/')[1].split('/')[0]);
        state = state.map((l: any) => ({...l, isDefault: l.id === id}));
        route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(state.find((l: any) => l.id === id))});
    });

    const migrateUrl = 'http://localhost:8081/api/v2/admin/storage-locations/migrate';
    seenUrls.add(new URL(migrateUrl));
    await page.route(migrateUrl, route => route.fulfill({status: 202, body: ''}));
}

/**
 * Tags admin: GET /api/v2/admin/tags/tree?q=, POST /tags (idempotent
 * create), PUT /tags/{id} (rename/move), DELETE /tags/{id}, POST
 * /tags/import (multipart `tagfile`).
 */
export async function mockTags(page: Page, seenUrls: Set<URL>, initial: any[] = tagsTreeFixture.results) {
    let state: {id: number; path: string}[] = JSON.parse(JSON.stringify(initial));
    let nextId = Math.max(...state.map(t => t.id)) + 1;

    await page.route(/http:\/\/localhost:8081(\/api\/v2\/admin\/tags\/tree|\/ws\/tags)(\?.*)?$/, route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const q = url.searchParams.get('q');
        const filtered = q ? state.filter(t => t.path.toLowerCase().includes(q.toLowerCase())) : state;
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(filtered.map(t => ({tagId: t.id, text: t.path, id: t.id, path: t.path})))
        });
    });

    await page.route(/http:\/\/localhost:8081(\/api\/v2\/admin\/tags\/import|\/admin\/uploadTagsFile)$/, route => {
        seenUrls.add(new URL(route.request().url()));
        const created = {id: nextId++, path: 'Imported/Tag'};
        state = [...state, created];
        route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({results: state})});
    });

    await page.route(/http:\/\/localhost:8081(\/api\/v2\/admin\/tags|\/ws\/tag)(\?.*)?$/, route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const method = route.request().method();
        if (method === 'POST' || method === 'PUT') {
            const body = route.request().postDataJSON() || {};
            const path = url.searchParams.get('tagPath') || body.path || '';
            const existing = state.find(t => t.path === path);
            if (existing) {
                return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({success: true, tag: existing, tagId: existing.id})});
            }
            const created = {id: nextId++, path};
            state = [...state, created];
            return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({success: true, tag: created, tagId: created.id})});
        }
        return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({results: state})});
    });

    await page.route(/http:\/\/localhost:8081(\/api\/v2\/admin\/tags\/|\/ws\/tag\/)\d+$/, route => {
        const url = route.request().url();
        seenUrls.add(new URL(url));
        const id = Number(url.split(/\/tags\/|\/tag\//)[1]);
        if (route.request().method() === 'DELETE') {
            state = state.filter(t => t.id !== id);
            return route.fulfill({status: 204, body: ''});
        }
        const body = route.request().postDataJSON() || {};
        const tag = state.find(t => t.id === id);
        if (!tag) return route.fulfill({status: 404, contentType: 'application/json', body: JSON.stringify({error: {message: 'Not found', code: 'NOT_FOUND'}})});
        if (body.rename) {
            const parts = tag.path.split('/');
            parts[parts.length - 1] = body.rename;
            tag.path = parts.join('/');
        }
        route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(tag)});
    });
}

/** Inbox / local ingest: GET /api/v2/admin/inbox, POST /api/v2/admin/inbox/import. */
export async function mockInbox(page: Page, seenUrls: Set<URL>, data: object = inboxFixture) {
    const inbox = (data as any).files || (data as any).results || data;
    await page.route(/http:\/\/localhost:8081(\/api\/v2\/admin\/inbox|\/admin\/inboxFileListFragment)(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                results: inbox,
                files: inbox,
                fieldDefinitions: (data as any).fieldDefinitions || []
            })
        });
    });

    await page.route(/http:\/\/localhost:8081(\/api\/v2\/admin\/inbox\/import|\/ws\/scheduleInboxPollWS)$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({status: 202, contentType: 'application/json', body: JSON.stringify({success: true, importBatchId: 'batch-inbox-001', message: 'Import started'})});
    });

    const importFieldsUrl = 'http://localhost:8081/api/v2/admin/import-fields';
    seenUrls.add(new URL(importFieldsUrl));
    await page.route(importFieldsUrl, route => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({results: []})}));
}

/** Upload endpoints: POST /api/v2/uploads, /api/v2/uploads/batches, /api/v2/uploads/bulk-urls. */
export async function mockUploads(page: Page, seenUrls: Set<URL>) {
    await page.route(/http:\/\/localhost:8081(\/api\/v2\/uploads|\/ws\/uploadImage)$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({success: true, imageId: 'img-new-001', alreadyStored: false})});
    });

    await page.route(/http:\/\/localhost:8081(\/api\/v2\/uploads\/batches|\/ws\/batch\/upload)(\?.*)?$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                batchId: 'batch-001',
                dataResourceUid: 'dr123',
                file: 'upload.zip',
                dateCreated: '2024-03-01T10:00:00Z',
                status: 'PROCESSING',
                files: [{status: 'QUEUED', file: 'records.avro', recordCount: 42}]
            })
        });
    });

    await page.route(/http:\/\/localhost:8081(\/api\/v2\/uploads\/bulk-urls|\/ws\/uploadImagesFromUrls)$/, route => {
        seenUrls.add(new URL(route.request().url()));
        route.fulfill({status: 202, contentType: 'application/json', body: JSON.stringify({success: true})});
    });
}

/** Swagger view: the single mocked spec source (see .env.playwright VITE_SWAGGER_SOURCES) */
export async function mockSwagger(page: Page, seenUrls: Set<URL>, spec: object = swaggerSpecFixture) {
    const url = 'http://localhost:8081/mock-openapi.json';
    seenUrls.add(new URL(url));
    await page.route(url, route => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(spec)}));
}

/**
 * Legacy image bytes routes preserved by the backend (thumbnails/tiles/original
 * downloads) — see ImageController#proxyImageThumbnail / #proxyImageTile /
 * #getOriginalFile. Every thumbnail/tile URL embedded in the search + detail
 * fixtures resolves under `http://localhost:8081/image/**`, so a single
 * catch-all placeholder image mock covers all of them.
 */
export async function mockImageBytes(page: Page, seenUrls: Set<URL>) {
    await page.route(/http:\/\/localhost:8081\/image\/(proxyImageThumbnail|proxyImageTile|proxyImage)(\?.*)?$/, route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const imageId = url.searchParams.get('imageId') ?? 'unknown';
        route.fulfill({status: 200, contentType: 'image/png', body: generatePlaceholderImage(imageId)});
    });
    await page.route(/http:\/\/localhost:8081\/image\/[^/?]+\/(thumbnail|original|large)(\?.*)?$/, route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        const match = url.pathname.match(/\/image\/([^/?]+)\/(thumbnail|original|large)/);
        const imageId = match ? match[1] : 'unknown';
        const type = match ? match[2] : 'thumbnail';
        const width = type === 'original' ? 800 : 256;
        const height = type === 'original' ? 600 : 256;
        route.fulfill({status: 200, contentType: 'image/png', body: generatePlaceholderImage(imageId, width, height)});
    });
    await page.route(/http:\/\/localhost:8081\/image\/[^/?]+\/tms\/\d+\/\d+\/\d+\.png(\?.*)?$/, route => {
        const url = new URL(route.request().url());
        seenUrls.add(url);
        route.fulfill({status: 200, contentType: 'image/png', body: generatePlaceholderImage('tile', 256, 256)});
    });
}

// ---------------------------------------------------------------------------
// Composite setup functions
// ---------------------------------------------------------------------------

async function baseSetup(page: Page, sessionData: object) {
    const seenUrls = new Set<URL>();
    const {logMissingMocks} = await import('./logMissingMocks');
    const {staticServerMocks} = await import('./staticServerMocks');
    await logMissingMocks(page, seenUrls); // lowest priority — catch-all
    await staticServerMocks(page, seenUrls);
    await mockImageBytes(page, seenUrls);
    await mockSession(page, seenUrls, sessionData);
    return seenUrls;
}

export async function setupSearchMocks(page: Page, sessionData: object = SESSION_ANONYMOUS) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockSearch(page, seenUrls);
    await mockSearchFacets(page, seenUrls);
    await mockSearchCriteria(page, seenUrls);
    return seenUrls;
}

export async function setupImageDetailMocks(page: Page, sessionData: object = SESSION_ANONYMOUS) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockImageDetail(page, seenUrls);
    return seenUrls;
}

export async function setupAdminDashboardMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockAdminDashboard(page, seenUrls);
    return seenUrls;
}

export async function setupBatchStatusMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockBatchUploads(page, seenUrls);
    return seenUrls;
}

export async function setupTagsMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockTags(page, seenUrls);
    return seenUrls;
}

export async function setupUploadMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockUploads(page, seenUrls);
    await mockInbox(page, seenUrls);
    return seenUrls;
}

export async function setupSettingsMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockSettings(page, seenUrls);
    return seenUrls;
}

export async function setupDuplicatesMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockDuplicates(page, seenUrls);
    return seenUrls;
}

export async function setupLicencesMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockLicences(page, seenUrls);
    return seenUrls;
}

export async function setupStorageLocationsMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockStorageLocations(page, seenUrls);
    return seenUrls;
}

export async function setupSwaggerMocks(page: Page, sessionData: object = SESSION_ADMIN) {
    const seenUrls = await baseSetup(page, sessionData);
    await mockSwagger(page, seenUrls);
    return seenUrls;
}
