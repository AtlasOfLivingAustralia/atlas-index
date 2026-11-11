/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Regression tests for the exact `/api/v2` request shapes centralized in
 * `endpoints.ts` — URL paths, HTTP methods, and (for multipart endpoints)
 * the precise FormData field names/encoding. These exist specifically to
 * catch endpoint-path typos/regressions that a component-level test can
 * silently swallow (e.g. `AdvancedCriteria` only surfaces a `criteriaApi`
 * failure when its collapsible panel happens to be open, so a wrong URL
 * there previously went unnoticed by every other test in the suite).
 */

import {criteriaApi, imageApi, searchApi, uploadApi} from './endpoints';

describe('searchApi normalization', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    function mockFetchOnce(body: unknown) {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({'content-type': 'application/json'}),
            json: async () => body
        });
        global.fetch = fetchMock as unknown as typeof fetch;
        return fetchMock;
    }

    it('normalizes raw backend search results with imageIdentifier and missing thumbnailUrl', async () => {
        mockFetchOnce({
            images: [
                {
                    imageIdentifier: '001b9a4d-656c-4857-8b11-a55608ec329b',
                    format: 'image/jpeg',
                    originalFilename: 'https://example.org/photo.jpg',
                    dateUploaded: 1787010624905,
                    creator: 'not_supplied',
                    recognisedLicence: 'unrecognised_licence'
                }
            ],
            totalCount: 1,
            pageSize: 50,
            startIndex: 0
        });

        const result = await searchApi.search('http://api.test', {});
        expect(result.results).toHaveLength(1);
        const item = result.results[0];
        expect(item.imageId).toBe('001b9a4d-656c-4857-8b11-a55608ec329b');
        expect(item.thumbnailUrl).toBe('http://api.test/image/001b9a4d-656c-4857-8b11-a55608ec329b/thumbnail');
        expect(item.imageUrl).toBe('http://api.test/image/001b9a4d-656c-4857-8b11-a55608ec329b/original');
        expect(item.title).toBe('https://example.org/photo.jpg');
        expect(item.isImage).toBe(true);
        expect(item.isAudio).toBe(false);
        expect(item.isDocument).toBe(false);
        expect(item.rightsHolder).toBe('not_supplied');
        expect(item.licence).toBe('unrecognised_licence');
    });

    it('normalizes audio and document items based on fileType and mimeType', async () => {
        mockFetchOnce({
            results: [
                {
                    imageIdentifier: 'audio-1',
                    fileType: 'audio',
                    mimeType: 'audio/mpeg'
                },
                {
                    imageId: 'doc-1',
                    mimeType: 'application/pdf',
                    thumbnails: ['http://api.test/custom-thumb.png'],
                    originalUrl: 'http://api.test/custom-orig.pdf'
                }
            ],
            totalRecords: 2
        });

        const result = await searchApi.search('http://api.test', {});
        expect(result.results[0].isAudio).toBe(true);
        expect(result.results[0].isImage).toBe(false);
        expect(result.results[0].isDocument).toBe(false);

        expect(result.results[1].isDocument).toBe(true);
        expect(result.results[1].thumbnailUrl).toBe('http://api.test/custom-thumb.png');
        expect(result.results[1].imageUrl).toBe('http://api.test/custom-orig.pdf');
    });
});

describe('imageApi detail normalization', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    function mockFetchOnce(body: unknown) {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({'content-type': 'application/json'}),
            json: async () => body
        });
        global.fetch = fetchMock as unknown as typeof fetch;
        return fetchMock;
    }

    it('normalizes nested backend image detail with metadata separation and tags', async () => {
        mockFetchOnce({
            core: {
                imageIdentifier: 'img-nest-1',
                title: 'Nested Test Image',
                width: 1024,
                height: 768,
                pixelsPerMm: 12.5
            },
            thumbnails: ['http://api.test/store/thumb.jpg'],
            metadata: [
                {key: 'scientificName', value: 'Test species', source: 'Core'},
                {key: 'fileSize', value: '1024', source: {name: 'System'}},
                {key: 'ISO', value: '400', source: 'Embedded'},
                {key: 'notes', value: 'field notes', source: 'User'},
                {key: 'dataResourceUid', value: 'dr1', source: 'DataResource'}
            ],
            tags: ['Botany', {id: 42, path: 'Botany/Flower'}]
        });

        const detail = await imageApi.getDetail('http://api.test', 'img-nest-1');
        expect(detail.imageId).toBe('img-nest-1');
        expect(detail.title).toBe('Nested Test Image');
        expect(detail.thumbnailUrl).toBe('http://api.test/store/thumb.jpg');
        expect(detail.originalUrl).toBe('http://api.test/image/img-nest-1/original');
        expect(detail.metadataUrl).toBe('http://api.test/ws/image/img-nest-1?includeTags=true&includeMetadata=true');
        expect(detail.isCalibrated).toBe(true);
        expect(detail.calibratedPixelsPerMm).toBe(12.5);

        expect(detail.coreMetadata).toEqual(expect.arrayContaining([{key: 'scientificName', value: 'Test species'}]));
        expect(detail.systemMetadata).toEqual(expect.arrayContaining([{key: 'fileSize', value: '1024'}]));
        expect(detail.embeddedMetadata).toEqual([{key: 'ISO', value: '400'}]);
        expect(detail.userMetadata).toEqual([{key: 'notes', value: 'field notes'}]);
        expect(detail.dataResourceMetadata).toEqual([{key: 'dataResourceUid', value: 'dr1'}]);

        expect(detail.tags).toEqual([
            {id: 1, path: 'Botany'},
            {id: 42, path: 'Botany/Flower'}
        ]);
    });

    it('maps the existing flat image-service response into the right-side information groups', async () => {
        mockFetchOnce({
            imageIdentifier: 'flat-1',
            originalFileName: 'flower.jpg',
            title: 'A flower',
            creator: 'Field observer',
            dataResourceUid: 'dr123',
            dataResourceName: 'Field images',
            width: 1600,
            height: 1200,
            sizeInBytes: 45678,
            mimeType: 'image/jpeg',
            contentMD5Hash: 'abc123',
            metadata: [
                {key: 'Camera model', value: 'Model X', source: 'Embedded'},
                {key: 'Internal status', value: 'ready', source: 'SystemDefined'},
                {key: 'Notes', value: 'important', source: 'UserDefined'}
            ]
        });

        const detail = await imageApi.getDetail('http://api.test', 'flat-1');
        expect(detail.coreMetadata).toEqual(expect.arrayContaining([
            {key: 'Image identifier', value: 'flat-1'},
            {key: 'Original filename', value: 'flower.jpg'},
            {key: 'Creator', value: 'Field observer'}
        ]));
        expect(detail.systemMetadata).toEqual(expect.arrayContaining([
            {key: 'Dimensions', value: '1600 × 1200 px'},
            {key: 'Internal status', value: 'ready'}
        ]));
        expect(detail.embeddedMetadata).toContainEqual({key: 'Camera model', value: 'Model X'});
        expect(detail.userMetadata).toContainEqual({key: 'Notes', value: 'important'});
        expect(detail.dataResourceMetadata).toContainEqual({key: 'Data resource name', value: 'Field images'});
    });

    it('routes a root-relative parent thumbnail through the local Vite proxy', async () => {
        global.fetch = jest.fn().mockImplementation(async (url: string) => {
            const isFragment = url.includes('coreImageMetadataTableFragment');
            return {
                ok: true,
                status: 200,
                headers: new Headers({'content-type': isFragment ? 'text/html' : 'application/json'}),
                json: async () => url.includes('getSubimageRectangles')
                    ? {subimages: []}
                    : {imageIdentifier: 'child-1'},
                text: async () => `
                    <td data-image-id="parent-1">
                        <h5>Parent image</h5>
                        <img src="/image/parent-1/thumbnail">
                    </td>`
            };
        }) as unknown as typeof fetch;

        const detail = await imageApi.getDetail('http://localhost:8080', 'child-1');

        expect(detail.parentImageId).toBe('parent-1');
        expect(detail.parentImageThumbnailUrl).toBe('/image-service/image/parent-1/thumbnail');
    });

    it('reads the parent link shape returned by the unchanged test image service', async () => {
        global.fetch = jest.fn().mockImplementation(async (url: string) => {
            const isFragment = url.includes('coreImageMetadataTableFragment');
            return {
                ok: true,
                status: 200,
                headers: new Headers({'content-type': isFragment ? 'text/html' : 'application/json'}),
                json: async () => url.includes('getSubimageRectangles')
                    ? {subimages: []}
                    : {imageIdentifier: 'child-remote'},
                text: async () => `
                    <h5>Parent image</h5>
                    <a href="/image/details?id=parent-remote">
                        <img src="/image/parent-remote/thumbnail" alt="parent-remote">
                    </a>`
            };
        }) as unknown as typeof fetch;

        const detail = await imageApi.getDetail('https://images.test.ala.org.au', 'child-remote');

        expect(detail.parentImageId).toBe('parent-remote');
        expect(detail.parentImageThumbnailUrl).toBe('https://images.test.ala.org.au/image/parent-remote/thumbnail');
    });
});

describe('criteriaApi', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    function mockFetchOnce(body: unknown, ok = true, status = 200) {
        const fetchMock = jest.fn().mockResolvedValue({
            ok,
            status,
            headers: new Headers({'content-type': 'application/json'}),
            json: async () => body
        });
        global.fetch = fetchMock as unknown as typeof fetch;
        return fetchMock;
    }

    it('list() loads definitions from the legacy admin source that actually exposes them', async () => {
        const fetchMock = mockFetchOnce({criteriaDefinitions: []});

        await criteriaApi.list('http://api.test');

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('http://api.test/admin/searchCriteria');
        expect(options.method).toBe('GET');
    });

    it('list() normalizes structured criteria definitions when available', async () => {
        mockFetchOnce({criteriaDefinitions: [{id: 1, name: 'Scientific name', fieldName: 'scientificName', type: 'ImageProperty', valueType: 'String', description: 'Taxon name'}]});

        await expect(criteriaApi.list('http://api.test')).resolves.toEqual({results: [{
            id: 1,
            name: 'Scientific name',
            fieldName: 'scientificName',
            type: 'ImageProperty',
            valueType: 'String',
            description: 'Taxon name',
            units: undefined
        }]});
    });

    it('create/update/remove target admin endpoints', async () => {
        const fetchMock = mockFetchOnce({});
        await criteriaApi.create('http://api.test', {name: 'x', fieldName: 'x', type: 'criteria', valueType: 'string'});
        expect(fetchMock.mock.calls[0][0]).toContain('/admin/saveSearchCriteriaDefinition');

        fetchMock.mockClear();
        await criteriaApi.update('http://api.test', 'crit-1', {name: 'y'});
        expect(fetchMock.mock.calls[0][0]).toContain('/admin/saveSearchCriteriaDefinition');

        fetchMock.mockClear();
        await criteriaApi.remove('http://api.test', 'crit-1');
        expect(fetchMock.mock.calls[0][0]).toContain('/admin/deleteSearchCriteriaDefinition');
    });
});

describe('uploadApi', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    function mockFetchOnce() {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({'content-type': 'application/json'}),
            json: async () => ({success: true, imageId: 'img-1', alreadyStored: false})
        });
        global.fetch = fetchMock as unknown as typeof fetch;
        return fetchMock;
    }

    it('uploadFile() posts to /ws/uploadImage with the file under the "image" field and no manual Content-Type header', async () => {
        const fetchMock = mockFetchOnce();
        const file = new File(['fake-jpeg-bytes'], 'photo.jpg', {type: 'image/jpeg'});

        await uploadApi.uploadFile('http://api.test', file);

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('http://api.test/ws/uploadImage');
        expect(options.method).toBe('POST');
        // Content-Type must be left for the browser to set (with the multipart boundary) — setting it
        // manually breaks the boundary and silently corrupts the request body.
        expect(options.headers['Content-Type']).toBeUndefined();

        const body = options.body as FormData;
        expect(body.get('image')).toBe(file);
        expect(body.get('imageUrl')).toBeNull();
        expect(body.get('metadata')).toBeNull();
        expect(body.getAll('tags')).toEqual([]);
    });

    it('uploadFile() omits the metadata field entirely when no metadata is provided', async () => {
        const fetchMock = mockFetchOnce();
        const file = new File(['x'], 'photo.jpg', {type: 'image/jpeg'});

        await uploadApi.uploadFile('http://api.test', file, undefined, undefined);

        const body = fetchMock.mock.calls[0][1].body as FormData;
        expect(body.has('metadata')).toBe(false);
    });

    it('uploadFile() JSON-encodes metadata into a single "metadata" field when populated', async () => {
        const fetchMock = mockFetchOnce();
        const file = new File(['x'], 'photo.jpg', {type: 'image/jpeg'});

        await uploadApi.uploadFile('http://api.test', file, {scientificName: 'Banksia serrata'});

        const body = fetchMock.mock.calls[0][1].body as FormData;
        expect(body.get('metadata')).toBe(JSON.stringify({scientificName: 'Banksia serrata'}));
    });

    it('uploadFile() sends each tag as a repeated "tags" field, not a single joined value', async () => {
        const fetchMock = mockFetchOnce();
        const file = new File(['x'], 'photo.jpg', {type: 'image/jpeg'});

        await uploadApi.uploadFile('http://api.test', file, undefined, ['Botany', 'Botany/Leaf']);

        const body = fetchMock.mock.calls[0][1].body as FormData;
        expect(body.getAll('tags')).toEqual(['Botany', 'Botany/Leaf']);
    });

    it('uploadFromUrl() posts the URL under "imageUrl" and never under "image" or as a literal placeholder string', async () => {
        const fetchMock = mockFetchOnce();

        await uploadApi.uploadFromUrl('http://api.test', 'https://example.org/real-image.jpg');

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('http://api.test/ws/uploadImage');
        const body = options.body as FormData;
        expect(body.get('imageUrl')).toBe('https://example.org/real-image.jpg');
        expect(body.get('image')).toBeNull();
        // Never send the input's placeholder text ("https://example.org/image.jpg") as if it were a real value.
        expect(body.get('imageUrl')).not.toBe('https://example.org/image.jpg');
    });

    it('uploadBatchZip() posts the archive under "archive" (not "zip") alongside dataResourceUid', async () => {
        const fetchMock = mockFetchOnce();
        const archive = new File(['zip-bytes'], 'batch.zip', {type: 'application/zip'});

        await uploadApi.uploadBatchZip('http://api.test', archive, 'dr123');

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('http://api.test/ws/batch/upload?dataResourceUid=dr123');
        const body = options.body as FormData;
        expect(body.get('archive')).toBe(archive);
        expect(body.get('zip')).toBeNull();
    });
});
