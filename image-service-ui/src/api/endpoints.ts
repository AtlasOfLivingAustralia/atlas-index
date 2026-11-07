/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Centralized endpoint definitions for the image-service backend APIs,
 * using existing production endpoints (/ws/*, /image/*, /session, /admin/*, /storageLocation/*)
 * in au.org.ala.images.WebServiceController, ImageController, SearchController,
 * AdminController, StorageLocationController and BatchController.
 *
 * Every function takes `apiUrl` explicitly (the caller passes
 * `import.meta.env.VITE_APP_API_URL`) so this module stays environment-free
 * and easy to unit test.
 */

import {apiDelete, apiGet, apiPost, apiPostForm, apiPut, buildUrl, usesDevelopmentProxy} from './client';
import type {
    AdminDashboard,
    AuditEntry,
    BatchUploadsResponse,
    BatchZipUploadResult,
    CacheClearTarget,
    DuplicatesResponse,
    Facet,
    FailedUploadsResponse,
    ImageDetail,
    ImageSummary,
    ImportFieldDefinition,
    ImportFieldsListResponse,
    InboxImportResponse,
    InboxResponse,
    LicencesResponse,
    MetadataEntry,
    SearchCriteriaDefinition,
    SearchCriteriaListResponse,
    SearchCriterion,
    SearchResult,
    Setting,
    SettingsListResponse,
    StorageLocation,
    StorageMigrationRequest,
    SubimageRect,
    TagCreateResponse,
    TagListResponse,
    TagRef,
    UploadResult
} from './types';
import type {IndexSearchResult} from './types';

export interface SearchParams {
    q?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
    sortDirection?: 'asc' | 'desc';
    criteria?: SearchCriterion[];
    facetFilters?: Record<string, string[]>;
    signal?: AbortSignal;
}

function criteriaToQuery(criteria?: SearchCriterion[]): string[] | undefined {
    if (!criteria || criteria.length === 0) return undefined;
    return criteria.map(c => `${c.field}${c.operator}${c.value}`);
}

function facetFiltersToQuery(filters?: Record<string, string[]>): string[] | undefined {
    if (!filters) return undefined;
    const entries: string[] = [];
    for (const [name, values] of Object.entries(filters)) {
        for (const v of values) entries.push(`${name}:${v}`);
    }
    return entries.length ? entries : undefined;
}

function combinedFilterQueries(params: SearchParams): string[] | undefined {
    const c = criteriaToQuery(params.criteria) || [];
    const f = facetFiltersToQuery(params.facetFilters) || [];
    const combined = [...c, ...f];
    return combined.length > 0 ? combined : undefined;
}

export function normalizeImageSummary(item: any, apiUrl: string): ImageSummary {
    const imageId = item.imageId || item.imageIdentifier || '';
    const originalFilename = item.originalFilename || item.originalFileName;
    const title = item.title || originalFilename || imageId;
    const mimeType = item.mimeType || item.format;
    const thumbnailUrl =
        item.thumbnailUrl ||
        (item.thumbnails && item.thumbnails[0]) ||
        (imageId ? `${apiUrl}/image/${encodeURIComponent(imageId)}/thumbnail` : '');
    const imageUrl =
        item.imageUrl ||
        item.originalUrl ||
        (imageId ? `${apiUrl}/image/${encodeURIComponent(imageId)}/original` : '');
    const isImage =
        item.isImage ??
        (item.fileType === 'image' ||
            !mimeType ||
            (typeof mimeType === 'string' && mimeType.startsWith('image/')) ||
            (typeof item.format === 'string' && item.format.startsWith('image/')));
    const isAudio =
        item.isAudio ??
        (item.fileType === 'audio' ||
            (typeof mimeType === 'string' && mimeType.startsWith('audio/')) ||
            (typeof item.format === 'string' && item.format.startsWith('audio/')));
    const isDocument =
        item.isDocument ??
        (item.fileType === 'document' ||
            (typeof mimeType === 'string' && mimeType.startsWith('application/pdf')) ||
            (typeof item.format === 'string' && item.format.startsWith('application/pdf')));

    return {
        imageId,
        originalFilename,
        title,
        mimeType: typeof mimeType === 'string' ? mimeType : undefined,
        thumbnailUrl,
        tileUrl: item.tileUrl || item.tileUrlPattern,
        imageUrl,
        width: typeof item.width === 'number' ? item.width : undefined,
        height: typeof item.height === 'number' ? item.height : undefined,
        tileZoomLevels: typeof item.tileZoomLevels === 'number' ? item.tileZoomLevels : (typeof item.zoomLevels === 'number' ? item.zoomLevels : undefined),
        dateUploaded: item.dateUploaded !== undefined && item.dateUploaded !== null ? String(item.dateUploaded) : undefined,
        dataResourceUid: item.dataResourceUid,
        isImage: Boolean(isImage),
        isAudio: Boolean(isAudio),
        isDocument: Boolean(isDocument),
        rightsHolder: item.rightsHolder || item.creator,
        licence:
            (typeof item.licence === 'string' && item.licence) ||
            (typeof item.recognisedLicence === 'string' && item.recognisedLicence) ||
            item.recognisedLicence?.acronym ||
            item.recognisedLicence?.name ||
            (typeof item.license === 'string' && item.license) ||
            item.license?.acronym ||
            item.license?.name ||
            ''
    };
}

function filterMetadataBySource(
    explicitGroup: MetadataEntry[] | undefined,
    allMetadata: any[] | undefined,
    sourceName: string
): MetadataEntry[] {
    if (explicitGroup && Array.isArray(explicitGroup)) {
        return explicitGroup.map(m => ({
            key: m.key || (m as any).name || '',
            value: m.value !== undefined && m.value !== null ? String(m.value) : ''
        }));
    }
    if (!allMetadata || !Array.isArray(allMetadata)) return [];
    return allMetadata
        .filter(m => {
            const src = m.source?.name || m.source;
            return typeof src === 'string' && src.toLowerCase() === sourceName.toLowerCase();
        })
        .map(m => ({
            key: m.key || m.name || '',
            value: m.value !== undefined && m.value !== null ? String(m.value) : ''
        }));
}

function normalizeTags(rawTags: any): TagRef[] {
    if (!rawTags || !Array.isArray(rawTags)) return [];
    return rawTags.map((t, idx) => {
        if (typeof t === 'string') {
            return {id: idx + 1, path: t};
        }
        const tagObj = t.tag || t;
        const id = typeof tagObj.id === 'number' ? tagObj.id : Number(tagObj.id) || idx + 1;
        const path = tagObj.path || tagObj.name || String(tagObj);
        return {id, path};
    });
}

function normalizeSubimages(rawSubimages: any, apiUrl: string): SubimageRect[] {
    if (!rawSubimages || !Array.isArray(rawSubimages)) return [];
    return rawSubimages.map(si => {
        const id = si.imageId || si.imageIdentifier || '';
        const thumbnailUrl =
            si.thumbnailUrl ||
            (si.thumbnails && si.thumbnails[0]) ||
            (id ? `${apiUrl}/image/${encodeURIComponent(id)}/thumbnail` : '');
        return {
            imageId: id,
            x: Number(si.x ?? 0),
            y: Number(si.y ?? 0),
            width: Number(si.width ?? 0),
            height: Number(si.height ?? 0),
            thumbnailUrl
        };
    });
}

function backendAssetUrl(apiUrl: string, assetUrl: string | undefined): string | undefined {
    if (!assetUrl) return undefined;
    const localBackend = /^https?:\/\/(localhost|127\.0\.0\.1):8080\/?$/i.test(apiUrl);

    if (localBackend) {
        if (assetUrl.startsWith('/image-service/')) return assetUrl;
        // Images do not need CORS headers, but routing them through Vite keeps
        // local development reliable and also fixes root-relative URLs found
        // in the legacy metadata HTML fragment.
        try {
            const parsed = new URL(assetUrl, apiUrl);
            if (/^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname) && parsed.port === '8080') {
                return `/image-service${parsed.pathname}${parsed.search}`;
            }
        } catch {
            // Fall through to the relative-path handling below.
        }
        if (assetUrl.startsWith('/')) return `/image-service${assetUrl}`;
    }

    if (assetUrl.startsWith('/')) return `${apiUrl.replace(/\/$/, '')}${assetUrl}`;
    return assetUrl;
}

function parentFromMetadataFragment(fragment: unknown, apiUrl: string): {imageId: string; thumbnailUrl?: string} | null {
    if (typeof fragment !== 'string') return null;
    const parentSection = fragment.match(/<h5[^>]*>\s*Parent image\s*<\/h5>[\s\S]*?<img[^>]*>/i)?.[0];
    if (!parentSection) return null;
    const imageTag = parentSection.match(/<img[^>]*>/i)?.[0] || '';
    const thumbnailUrl = imageTag.match(/\bsrc=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, '&');
    const legacyDataId = fragment.match(/<td[^>]*data-image-id=["']([^"']+)["'][^>]*>[\s\S]*?<h5[^>]*>\s*Parent image\s*<\/h5>/i)?.[1];
    const detailsLinkId = parentSection.match(/\bhref=["'][^"']*\/image\/details\?[^"']*\bid=([^&"']+)/i)?.[1];
    const thumbnailId = thumbnailUrl?.match(/\/image\/([^/?#]+)\/thumbnail(?:[?#]|$)/i)?.[1];
    const altId = imageTag.match(/\balt=["']([^"']+)["']/i)?.[1];
    const imageId = [legacyDataId, detailsLinkId, thumbnailId, altId]
        .find(Boolean);
    if (!imageId) return null;
    return {
        imageId: decodeURIComponent(imageId),
        thumbnailUrl: backendAssetUrl(apiUrl, thumbnailUrl)
    };
}

export function normalizeFacets(rawFacets: any): Facet[] {
    if (!rawFacets) return [];
    if (Array.isArray(rawFacets)) {
        return rawFacets.map(f => ({
            name: f.name || f.fieldName || '',
            label: f.label || f.name || f.fieldName || '',
            values: Array.isArray(f.values)
                ? f.values.map((v: any) => ({
                      value: String(v.value ?? v.name ?? v.key ?? ''),
                      count: Number(v.count ?? v.doc_count ?? 0)
                  }))
                : []
        }));
    }
    if (typeof rawFacets === 'object') {
        return Object.entries(rawFacets).map(([name, agg]: [string, any]) => {
            let values: { value: string; count: number }[] = [];
            if (Array.isArray(agg?.buckets)) {
                values = agg.buckets.map((b: any) => ({
                    value: String(b.key ?? b.value ?? ''),
                    count: Number(b.doc_count ?? b.count ?? 0)
                }));
            } else if (Array.isArray(agg?.values)) {
                values = agg.values.map((v: any) => ({
                    value: String(v.value ?? v.key ?? ''),
                    count: Number(v.count ?? v.doc_count ?? 0)
                }));
            } else if (agg && typeof agg === 'object') {
                // Legacy Map<String, Integer> format: {"key1": count1, "key2": count2}
                values = Object.entries(agg).map(([val, cnt]) => ({
                    value: val,
                    count: typeof cnt === 'number' ? cnt : Number(cnt) || 0
                }));
            }
            return {
                name,
                label: name,
                values
            };
        });
    }
    return [];
}

export function normalizeImageDetail(data: any, apiUrl: string, requestedImageId?: string): ImageDetail {
    const core = data?.core || data || {};
    const imageId = core.imageId || core.imageIdentifier || data?.imageId || data?.imageIdentifier || requestedImageId || '';

    const summary = normalizeImageSummary({...data, ...core, imageId}, apiUrl);

    const metadata = Array.isArray(data?.metadata) ? data.metadata : (Array.isArray(core?.metadata) ? core.metadata : []);

    const toEntry = (key: string, value: unknown): MetadataEntry | null => {
        if (value === undefined || value === null || value === '') return null;
        if (typeof value === 'object') {
            const label = (value as any).name || (value as any).acronym || JSON.stringify(value);
            return {key, value: String(label)};
        }
        return {key, value: String(value)};
    };
    const entries = (items: Array<MetadataEntry | null>) => items.filter((item): item is MetadataEntry => item !== null);
    const mergeEntries = (...groups: MetadataEntry[][]) => {
        const seen = new Set<string>();
        return groups.flat().filter(item => {
            const normalizedKey = item.key.toLowerCase();
            if (seen.has(normalizedKey)) return false;
            seen.add(normalizedKey);
            return true;
        });
    };

    const backendCoreMetadata = filterMetadataBySource(data?.coreMetadata || core?.coreMetadata, metadata, 'Core');
    const coreMetadata = mergeEntries(entries([
        toEntry('Data resource', core.dataResourceUid ?? data?.dataResourceUid),
        toEntry('Image identifier', imageId),
        toEntry('Occurrence ID', core.occurrenceID ?? core.occurrenceId ?? data?.occurrenceID ?? data?.occurrenceId),
        toEntry('Original filename', core.originalFilename ?? core.originalFileName ?? data?.originalFilename ?? data?.originalFileName),
        toEntry('Title', core.title ?? data?.title),
        toEntry('Creator', core.creator ?? data?.creator),
        toEntry('Created', core.created ?? data?.created),
        toEntry('Description', core.description ?? data?.description),
        toEntry('Publisher', core.publisher ?? data?.publisher),
        toEntry('Contributor', core.contributor ?? data?.contributor),
        toEntry('References', core.references ?? data?.references),
        toEntry('Audience', core.audience ?? data?.audience),
        toEntry('Source', core.source ?? data?.source),
        toEntry('Date uploaded', core.dateUploaded ?? data?.dateUploaded),
        toEntry('Date taken', core.dateTaken ?? data?.dateTaken),
        toEntry('Rights', core.rights ?? data?.rights),
        toEntry('Rights holder', core.rightsHolder ?? data?.rightsHolder),
        toEntry('Licence', core.recognisedLicence ?? data?.recognisedLicence ?? core.license ?? data?.license)
    ]), backendCoreMetadata);

    const backendSystemMetadata = mergeEntries(
        filterMetadataBySource(data?.systemMetadata || core?.systemMetadata, metadata, 'System'),
        filterMetadataBySource(undefined, metadata, 'SystemDefined')
    );
    const systemMetadata = mergeEntries(entries([
        toEntry('Dimensions', (core.width ?? data?.width) && (core.height ?? data?.height) ? `${core.width ?? data?.width} × ${core.height ?? data?.height} px` : null),
        toEntry('File size', core.sizeInBytes ?? data?.sizeInBytes ?? core.fileSize ?? data?.fileSize),
        toEntry('MIME type', core.mimeType ?? data?.mimeType),
        toEntry('Type', core.type ?? data?.type),
        toEntry('Image URL', core.imageUrl ?? data?.imageUrl),
        toEntry('MD5 hash', core.contentMD5Hash ?? data?.contentMD5Hash),
        toEntry('SHA1 hash', core.contentSHA1Hash ?? data?.contentSHA1Hash),
        toEntry('Tile zoom levels', core.tileZoomLevels ?? data?.tileZoomLevels)
    ]), backendSystemMetadata);
    const embeddedMetadata = filterMetadataBySource(data?.embeddedMetadata || core?.embeddedMetadata, metadata, 'Embedded');
    const userMetadata = mergeEntries(
        filterMetadataBySource(data?.userMetadata || core?.userMetadata, metadata, 'User'),
        filterMetadataBySource(undefined, metadata, 'UserDefined')
    );
    const dataResourceMetadata = mergeEntries(
        filterMetadataBySource(data?.dataResourceMetadata || core?.dataResourceMetadata, metadata, 'DataResource'),
        entries([
            toEntry('Data resource UID', core.dataResourceUid ?? data?.dataResourceUid),
            toEntry('Data resource name', core.dataResourceName ?? data?.dataResourceName),
            toEntry('Data provider UID', core.dataProviderUid ?? data?.dataProviderUid),
            toEntry('Data provider name', core.dataProviderName ?? data?.dataProviderName),
            toEntry('Institution', core.institutionName ?? data?.institutionName),
            toEntry('Collection', core.collectionName ?? data?.collectionName)
        ])
    );

    const tags = normalizeTags(data?.tags || core?.tags);
    const subimages = normalizeSubimages(data?.subimages || core?.subimages, apiUrl);

    const thumbnailUrl =
        data?.thumbnailUrl ||
        core?.thumbnailUrl ||
        (data?.thumbnails && data.thumbnails[0]) ||
        (core?.thumbnails && core.thumbnails[0]) ||
        (imageId ? `${apiUrl}/image/${encodeURIComponent(imageId)}/thumbnail` : '');

    const originalUrl =
        data?.originalUrl ||
        core?.originalUrl ||
        (imageId ? `${apiUrl}/image/${encodeURIComponent(imageId)}/original` : '');

    const metadataUrl =
        data?.metadataUrl ||
        core?.metadataUrl ||
        (imageId ? `${apiUrl}/ws/image/${encodeURIComponent(imageId)}?includeTags=true&includeMetadata=true` : '');

    const calibratedPixelsPerMm =
        core.calibratedPixelsPerMm ?? data?.calibratedPixelsPerMm ?? core.pixelsPerMm ?? data?.pixelsPerMm ?? (core.mmPerPixel ? (1 / core.mmPerPixel) : undefined);
    const isCalibrated =
        core.isCalibrated ?? data?.isCalibrated ?? (typeof calibratedPixelsPerMm === 'number' && calibratedPixelsPerMm > 0);
    const parentImage = core.parentImage || data?.parentImage || core.parent || data?.parent;
    const parentImageId =
        core.parentImageId ||
        data?.parentImageId ||
        parentImage?.imageId ||
        parentImage?.imageIdentifier ||
        (typeof parentImage === 'string' ? parentImage : null);
    const parentImageTitle = parentImage?.title || parentImage?.originalFilename || parentImage?.originalFileName || parentImageId || undefined;

    return {
        ...summary,
        imageId,
        title: core.title || data?.title || summary.title,
        originalFilename:
            core.originalFilename ||
            core.originalFileName ||
            data?.originalFilename ||
            data?.originalFileName ||
            summary.originalFilename,
        thumbnailUrl,
        originalUrl,
        metadataUrl,
        parentImageId,
        parentImageTitle,
        parentImageThumbnailUrl:
            backendAssetUrl(apiUrl, core.parentImageThumbnailUrl || data?.parentImageThumbnailUrl) ||
            (parentImageId
                ? backendAssetUrl(apiUrl, `/image/${encodeURIComponent(parentImageId)}/thumbnail`)
                : undefined),
        subimages,
        tags,
        coreMetadata,
        systemMetadata,
        embeddedMetadata,
        userMetadata,
        dataResourceMetadata,
        calibratedPixelsPerMm: typeof calibratedPixelsPerMm === 'number' ? calibratedPixelsPerMm : undefined,
        isCalibrated: Boolean(isCalibrated),
        harvestable: core.harvestable ?? data?.harvestable,
        deleted: Boolean(core.deleted ?? data?.deleted ?? false)
    };
}

export const searchApi = {
    async search(apiUrl: string, params: SearchParams): Promise<SearchResult> {
        const queryParams = {
            q: params.q,
            max: params.pageSize ?? 24,
            offset: params.page ? params.page * (params.pageSize ?? 24) : 0,
            sort: params.sort,
            order: params.sortDirection,
            fq: combinedFilterQueries(params)
        };
        const raw = await apiGet<any>(apiUrl, '/ws/search', queryParams, params.signal);
        const rawResults: any[] = raw?.images || raw?.results || [];
        const results: ImageSummary[] = rawResults.map(item => normalizeImageSummary(item, apiUrl));
        return {
            results,
            totalRecords: raw?.totalImageCount ?? raw?.totalRecords ?? raw?.totalCount ?? results.length,
            pageSize: raw?.pageSize ?? params.pageSize ?? 24,
            startIndex: raw?.startIndex ?? ((params.page ?? 0) * (params.pageSize ?? 24)),
            sort: raw?.sort,
            sortDirection: raw?.order ?? raw?.sortDirection
        };
    },

    async facets(apiUrl: string, params: SearchParams): Promise<Facet[]> {
        const queryParams = {
            q: params.q,
            max: 0,
            fq: combinedFilterQueries(params)
        };
        const raw = await apiGet<any>(apiUrl, '/ws/search', queryParams, params.signal);
        return normalizeFacets(raw?.facets);
    },

    /** Authenticated ZIP download of the current result set — browser navigation, session cookie carries auth. */
    downloadUrl(apiUrl: string, params: SearchParams): string {
        return buildUrl(apiUrl, '/search/download', {
            q: params.q,
            fq: combinedFilterQueries(params)
        });
    }
};

export const imageApi = {
    async getDetail(apiUrl: string, imageId: string, signal?: AbortSignal): Promise<ImageDetail> {
        const proxyMetadataFragment = usesDevelopmentProxy(apiUrl);
        const metadataFragmentBaseUrl = proxyMetadataFragment ? '' : apiUrl;
        const metadataFragmentPath = `${proxyMetadataFragment ? '/image-service' : ''}/image/coreImageMetadataTableFragment/${encodeURIComponent(imageId)}`;
        const [data, subimagesData, metadataFragment] = await Promise.all([
            apiGet<any>(apiUrl, `/ws/image/${encodeURIComponent(imageId)}`, {includeTags: true, includeMetadata: true}, signal),
            apiGet<any>(apiUrl, `/ws/getSubimageRectangles/${encodeURIComponent(imageId)}`, undefined, signal).catch(() => null),
            apiGet<string>(metadataFragmentBaseUrl, metadataFragmentPath, undefined, signal).catch(() => null)
        ]);
        const existingParent = parentFromMetadataFragment(metadataFragment, apiUrl);
        const combined = {
            ...data,
            parentImageId: data?.parentImageId || existingParent?.imageId,
            parentImageThumbnailUrl:
                backendAssetUrl(apiUrl, data?.parentImageThumbnailUrl) || existingParent?.thumbnailUrl,
            subimages: subimagesData?.subimages || data?.subimages || []
        };
        return normalizeImageDetail(combined, apiUrl, imageId);
    },

    metadataJsonUrl(apiUrl: string, imageId: string): string {
        return buildUrl(apiUrl, `/ws/image/${encodeURIComponent(imageId)}`, {includeTags: true, includeMetadata: true});
    },

    /** Upserts user metadata entries. */
    async updateMetadata(apiUrl: string, imageId: string, entries: Record<string, string>): Promise<ImageDetail> {
        await apiPost<any>(apiUrl, `/ws/bulkAddUserMetadataToImage/${encodeURIComponent(imageId)}`, entries);
        return imageApi.getDetail(apiUrl, imageId);
    },

    /** Removes a single metadata entry by key. */
    async removeMetadataKey(apiUrl: string, imageId: string, key: string): Promise<ImageDetail> {
        await apiPost<any>(apiUrl, `/ws/removeUserMetadataFromImage/${encodeURIComponent(imageId)}`, undefined, undefined, {key});
        return imageApi.getDetail(apiUrl, imageId);
    },

    /** Attaches an existing tag (by numeric id) to the image. */
    async attachTag(apiUrl: string, imageId: string, tagId: number): Promise<ImageDetail> {
        await apiPut<any>(apiUrl, `/ws/tag/${tagId}/image/${encodeURIComponent(imageId)}`);
        return imageApi.getDetail(apiUrl, imageId);
    },

    async detachTag(apiUrl: string, imageId: string, tagId: number): Promise<ImageDetail> {
        await apiDelete<any>(apiUrl, `/ws/tag/${tagId}/image/${encodeURIComponent(imageId)}`);
        return imageApi.getDetail(apiUrl, imageId);
    },

    async calibrate(apiUrl: string, imageId: string, pixelsPerMm: number): Promise<ImageDetail> {
        await apiPost<any>(apiUrl, '/ws/calibrateImageScale', undefined, undefined, {
            imageId,
            pixelLength: pixelsPerMm,
            actualLength: 1,
            units: 'mm'
        });
        return imageApi.getDetail(apiUrl, imageId);
    },

    async resetCalibration(apiUrl: string, imageId: string): Promise<ImageDetail> {
        await apiPost<any>(apiUrl, '/ws/resetImageCalibration', undefined, undefined, {imageId});
        return imageApi.getDetail(apiUrl, imageId);
    },

    async createSubimage(apiUrl: string, imageId: string, rect: { x: number; y: number; width: number; height: number }, description = ''): Promise<ImageDetail> {
        await apiPost<any>(apiUrl, `/ws/subimage/${encodeURIComponent(imageId)}`, undefined, undefined, {...rect, description});
        return imageApi.getDetail(apiUrl, imageId);
    },

    /** Admin: regenerates derivatives (thumbnails/tiles/artifacts) for this image. */
    regenerateDerivatives(apiUrl: string, imageId: string): Promise<void> {
        return apiPost<void>(apiUrl, `/ws/scheduleArtifactGenerationWS/${encodeURIComponent(imageId)}`);
    },

    /** Admin: clears and reschedules tile generation for this image. */
    resetTiles(apiUrl: string, imageId: string): Promise<void> {
        return apiPost<void>(apiUrl, '/ws/scheduleTileGenerationWS', undefined, undefined, {id: imageId});
    },

    /** Admin: sets whether this image is harvestable (exposed to downstream harvesters). */
    async setHarvestable(apiUrl: string, imageId: string, harvestable: boolean): Promise<ImageDetail> {
        await apiPost<any>(apiUrl, '/ws/setHarvestable', undefined, undefined, {imageId, value: String(harvestable)});
        return imageApi.getDetail(apiUrl, imageId);
    },

    /** Owner or admin only — enforced server-side. */
    deleteImage(apiUrl: string, imageId: string): Promise<void> {
        return apiDelete<void>(apiUrl, `/ws/image/${encodeURIComponent(imageId)}`);
    },

    auditTrail(apiUrl: string, imageId: string): Promise<AuditEntry[]> {
        return apiGet<AuditEntry[]>(apiUrl, '/image/auditTrailFragment', {id: imageId}).catch(() => []);
    }
};

export const uploadApi = {
    /**
     * Single-item upload: POST /ws/uploadImage, multipart file field `image`.
     * `metadata` (if provided) is JSON-encoded to a string field; `tags` (if
     * provided) is sent as repeated `tags` form fields (tag path strings).
     */
    uploadFile(apiUrl: string, file: File, metadata?: Record<string, string>, tags?: string[]): Promise<UploadResult> {
        const form = new FormData();
        form.append('image', file);
        if (metadata) form.append('metadata', JSON.stringify(metadata));
        if (tags) for (const tag of tags) form.append('tags', tag);
        return apiPostForm<UploadResult>(apiUrl, '/ws/uploadImage', form);
    },

    /**
     * Single-item upload by remote URL: same endpoint as `uploadFile`, using
     * the `imageUrl` form field.
     */
    uploadFromUrl(apiUrl: string, imageUrl: string, metadata?: Record<string, string>, tags?: string[]): Promise<UploadResult> {
        const form = new FormData();
        form.append('imageUrl', imageUrl);
        if (metadata) form.append('metadata', JSON.stringify(metadata));
        if (tags) for (const tag of tags) form.append('tags', tag);
        return apiPostForm<UploadResult>(apiUrl, '/ws/uploadImage', form);
    },

    /** Bulk URL upload. */
    uploadBulkUrls(apiUrl: string, urls: string[], dataResourceUid: string): Promise<unknown> {
        const images = urls.map(sourceUrl => ({sourceUrl, dataResourceUid}));
        return apiPost<unknown>(apiUrl, '/ws/uploadImagesFromUrls', {images});
    },

    /** ZIP batch upload: multipart file field `archive` + query param `dataResourceUid`. */
    uploadBatchZip(apiUrl: string, archiveFile: File, dataResourceUid: string): Promise<BatchZipUploadResult> {
        const form = new FormData();
        form.append('archive', archiveFile);
        return apiPostForm<BatchZipUploadResult>(apiUrl, '/ws/batch/upload', form, undefined, {dataResourceUid});
    }
};

export const adminApi = {
    async dashboard(apiUrl: string, signal?: AbortSignal): Promise<AdminDashboard> {
        const [stats, size, queues] = await Promise.all([
            apiGet<any>(apiUrl, '/ws/repositoryStatistics', undefined, signal).catch(() => ({})),
            apiGet<any>(apiUrl, '/ws/repositorySizeOnDisk', undefined, signal).catch(() => ({})),
            apiGet<any>(apiUrl, '/ws/backgroundQueueStats', undefined, signal).catch(() => ({}))
        ]);
        return {
            imageCount: stats.imageCount ?? 0,
            deletedImageCount: stats.deletedImageCount ?? 0,
            licenceCount: stats.licenceCount ?? 0,
            licenceMappingCount: stats.licenceMappingCount ?? 0,
            repoSizeOnDisk: typeof size.repoSizeOnDisk === 'number' ? size.repoSizeOnDisk : 0,
            queues: {
                imageQueueLength: queues.queueLength ?? 0,
                tilingQueueLength: queues.tilingQueueLength ?? 0,
                activeBatchUploads: queues.batchUploads ?? 0
            }
        };
    },

    queues(apiUrl: string, signal?: AbortSignal): Promise<unknown> {
        return apiGet<unknown>(apiUrl, '/ws/backgroundQueueStats', undefined, signal);
    },

    clearQueues(apiUrl: string): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/clearQueues');
    },

    batchUploads(apiUrl: string, hideEmpty?: boolean, signal?: AbortSignal): Promise<BatchUploadsResponse> {
        return apiGet<BatchUploadsResponse>(apiUrl, '/admin/batchUploads', {hideEmpty}, signal);
    },

    clearBatchUploads(apiUrl: string): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/clearUploads');
    },

    setBatchProcessingEnabled(apiUrl: string, enabled: boolean): Promise<void> {
        return apiPost<void>(apiUrl, enabled ? '/admin/enableBatchProcessing' : '/admin/disableBatchProcessing');
    },

    clearBatchFileQueue(apiUrl: string): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/clearFileQueue');
    },

    reloadBatchFile(apiUrl: string, fileId: string): Promise<void> {
        return apiPost<void>(apiUrl, `/admin/batchReloadFile?fileId=${encodeURIComponent(fileId)}`);
    },

    deleteBatchFile(apiUrl: string, fileId: string): Promise<void> {
        return apiPost<void>(apiUrl, `/admin/batchFileDeleteFromQueue?fileId=${encodeURIComponent(fileId)}`);
    },

    getSettings(apiUrl: string, signal?: AbortSignal): Promise<SettingsListResponse> {
        return apiGet<SettingsListResponse>(apiUrl, '/admin/settings', undefined, signal);
    },

    updateSetting(apiUrl: string, name: string, value: string): Promise<Setting> {
        return apiPost<Setting>(apiUrl, '/admin/setSettingValue', undefined, undefined, {name, value});
    },

    async duplicates(apiUrl: string, max?: number, offset?: number, signal?: AbortSignal): Promise<DuplicatesResponse> {
        const raw = await apiGet<any>(apiUrl, '/admin/duplicates', {max, offset}, signal);
        const results = (raw?.results || []).map((entry: any) => ({
            ...entry,
            image: normalizeImageSummary(entry.image || {}, apiUrl)
        }));
        return {
            results,
            totalCount: raw?.totalCount ?? results.length
        };
    },

    failedUploads(apiUrl: string, regexPattern?: string, maxResults?: number, signal?: AbortSignal): Promise<FailedUploadsResponse> {
        return apiGet<FailedUploadsResponse>(apiUrl, '/admin/clearFailedUploads', {preview: true, regexPattern, maxResults}, signal);
    },

    clearFailedUploads(apiUrl: string, regexPattern?: string): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/doClearFailedUploads', undefined, undefined, {regexPattern});
    },

    analytics(apiUrl: string, signal?: AbortSignal): Promise<unknown> {
        return apiGet<unknown>(apiUrl, '/ws/analytics', undefined, signal);
    },

    analyticsForDataResource(apiUrl: string, dataResourceUid: string, signal?: AbortSignal): Promise<unknown> {
        return apiGet<unknown>(apiUrl, `/ws/analytics/${encodeURIComponent(dataResourceUid)}`, undefined, signal);
    },

    indexSearch(apiUrl: string, query: object, signal?: AbortSignal): Promise<IndexSearchResult> {
        return apiPost<IndexSearchResult>(apiUrl, '/admin/indexSearch', undefined, signal, {q: JSON.stringify(query)});
    },

    reindex(apiUrl: string): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/reindexImages');
    },

    reinitialiseIndex(apiUrl: string): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/reinitialiseImageIndex');
    },

    purgeDeleted(apiUrl: string): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/scheduleDeletedImagesPurge');
    },

    rematchLicenses(apiUrl: string): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/rematchLicenses');
    },

    checkFailedUploads(apiUrl: string): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/runCheckFailedUploadsJob');
    },

    clearCache(apiUrl: string, target: CacheClearTarget): Promise<void> {
        const endpointMap: Record<CacheClearTarget, string> = {
            thumbnails: '/admin/clearThumbnailLookupCache',
            tiles: '/admin/clearTileLookupCache',
            hibernate: '/admin/clearHibernateCache',
            collectory: '/admin/clearCollectoryCache',
            's3-client': '/admin/clearS3Cache'
        };
        return apiPost<void>(apiUrl, endpointMap[target] || '/admin/clearThumbnailLookupCache');
    },

    listImportFields(apiUrl: string, signal?: AbortSignal): Promise<ImportFieldsListResponse> {
        return apiGet<ImportFieldsListResponse>(apiUrl, '/admin/fieldDefinitionsFragment', undefined, signal);
    },

    saveImportField(apiUrl: string, field: ImportFieldDefinition): Promise<ImportFieldDefinition> {
        return apiPost<ImportFieldDefinition>(apiUrl, '/admin/saveFieldDefinition', undefined, undefined, {name: field.name, type: field.type, value: field.value});
    },

    deleteImportField(apiUrl: string, id: string | number): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/deleteFieldDefinition', undefined, undefined, {id});
    },

    inbox(apiUrl: string, signal?: AbortSignal): Promise<InboxResponse> {
        return apiGet<InboxResponse>(apiUrl, '/admin/inboxFileListFragment', undefined, signal);
    },

    importInbox(apiUrl: string): Promise<InboxImportResponse> {
        return apiPost<InboxImportResponse>(apiUrl, '/ws/scheduleInboxPollWS');
    }
};

export const tagApi = {
    async tree(apiUrl: string, q?: string, signal?: AbortSignal): Promise<TagListResponse> {
        const raw = await apiGet<any>(apiUrl, '/ws/tags', {q}, signal);
        const flatten = (nodes: any[]): TagRef[] => {
            if (!Array.isArray(nodes)) return [];
            const result: TagRef[] = [];
            for (const n of nodes) {
                if (n.tagId) {
                    result.push({id: n.tagId, path: n.text || n.name});
                }
                if (n.children && n.children.length > 0) {
                    result.push(...flatten(n.children));
                }
            }
            return result;
        };
        const tags = Array.isArray(raw) ? (raw[0]?.tagId !== undefined || raw[0]?.children ? flatten(raw) : raw) : [];
        return {results: tags};
    },

    async create(apiUrl: string, path: string, parentId?: number | null): Promise<TagCreateResponse> {
        const res = await apiPut<any>(apiUrl, '/ws/tag', undefined, undefined, {tagPath: path, parentTagId: parentId ?? undefined});
        const id = res?.tagId ?? res?.id ?? (res?.tag?.id) ?? 0;
        return {success: true, tag: {id, path}};
    },

    async rename(apiUrl: string, id: number, newName: string): Promise<TagRefUpdateResult> {
        await apiPut<any>(apiUrl, `/ws/tag/${id}/rename`, undefined, undefined, {name: newName});
        return {tag: {id, path: newName}};
    },

    async move(apiUrl: string, id: number, newParentId: number | null): Promise<TagRefUpdateResult> {
        await apiPut<any>(apiUrl, '/ws/tag/move', undefined, undefined, {targetTagId: id, newParentTagId: newParentId ?? 0});
        return {tag: {id, path: ''}};
    },

    remove(apiUrl: string, id: number): Promise<void> {
        return apiDelete<void>(apiUrl, `/ws/tag/${id}`);
    },

    importFile(apiUrl: string, file: File): Promise<TagListResponse> {
        const form = new FormData();
        form.append('tagfile', file);
        return apiPostForm<any>(apiUrl, '/admin/uploadTagsFile', form).then(() => tagApi.tree(apiUrl));
    }
};

export type TagRefUpdateResult = { id: number; path: string } | { tag: { id: number; path: string } };

export const criteriaApi = {
    async list(apiUrl: string, signal?: AbortSignal): Promise<SearchCriteriaListResponse> {
        const raw = await apiGet<any>(apiUrl, '/ws/search', {max: 0}, signal);
        const criteria = (raw?.criteriaDefinitions || []).map((c: any) => ({
            id: c.id ?? c.name,
            name: c.name,
            fieldName: c.fieldName || c.name,
            type: c.type || 'criteria',
            valueType: c.valueType || 'string',
            description: c.description,
            units: c.units
        }));
        return {results: criteria};
    },

    create(apiUrl: string, def: Omit<SearchCriteriaDefinition, 'id'>): Promise<SearchCriteriaDefinition> {
        return apiPost<any>(apiUrl, '/admin/saveSearchCriteriaDefinition', undefined, undefined, def);
    },

    update(apiUrl: string, id: string | number, def: Partial<SearchCriteriaDefinition>): Promise<SearchCriteriaDefinition> {
        return apiPost<any>(apiUrl, '/admin/saveSearchCriteriaDefinition', undefined, undefined, {searchCriteriaDefinitionId: id, ...def});
    },

    remove(apiUrl: string, id: string | number): Promise<void> {
        return apiPost<void>(apiUrl, '/admin/deleteSearchCriteriaDefinition', undefined, undefined, {searchCriteriaDefinitionId: id});
    }
};

export const licenceApi = {
    async get(apiUrl: string, signal?: AbortSignal): Promise<LicencesResponse> {
        const [licences, licenceMappings] = await Promise.all([
            apiGet<any[]>(apiUrl, '/ws/licence', undefined, signal).catch(() => []),
            apiGet<any[]>(apiUrl, '/ws/licenceMapping', undefined, signal).catch(() => [])
        ]);
        return {
            licences: licences.map(l => ({
                id: l.id,
                acronym: l.acronym,
                name: l.name,
                url: l.url,
                imageUrl: l.imageUrl
            })),
            licenceMappings: licenceMappings.map(m => ({
                id: m.id,
                value: m.value,
                acronym: m.license?.acronym || m.licenceAcronym || m.acronym || ''
            }))
        };
    },

    async update(apiUrl: string, body: LicencesResponse): Promise<LicencesResponse> {
        const licensesCSV = body.licences.map(l => `${l.acronym},${l.name},${l.url || ''},${l.imageUrl || ''}`).join('\n');
        const licenceMappingCSV = body.licenceMappings.map(m => `${m.acronym},${m.value}`).join('\n');
        await apiPost<any>(apiUrl, '/admin/updateStoredLicences', undefined, undefined, {licenses: licensesCSV, licenseMapping: licenceMappingCSV});
        return licenceApi.get(apiUrl);
    }
};

export const storageApi = {
    async list(apiUrl: string, signal?: AbortSignal): Promise<StorageLocation[]> {
        const raw = await apiGet<any>(apiUrl, '/storageLocation/listFragment', undefined, signal).catch(() => []);
        return Array.isArray(raw?.storageLocationList) ? raw.storageLocationList : (Array.isArray(raw) ? raw : []);
    },

    get(apiUrl: string, id: string | number, signal?: AbortSignal): Promise<StorageLocation> {
        return apiGet<StorageLocation>(apiUrl, `/storageLocation/editFragment/${id}`, undefined, signal);
    },

    create(apiUrl: string, location: Partial<StorageLocation>): Promise<StorageLocation> {
        return apiPost<StorageLocation>(apiUrl, '/storageLocation/create', location);
    },

    update(apiUrl: string, id: string | number, location: Partial<StorageLocation>): Promise<StorageLocation> {
        return apiPost<StorageLocation>(apiUrl, `/storageLocation/update?id=${encodeURIComponent(String(id))}`, location);
    },

    setDefault(apiUrl: string, id: string | number): Promise<StorageLocation> {
        return apiPost<StorageLocation>(apiUrl, `/storageLocation/setDefault?id=${encodeURIComponent(String(id))}`);
    },

    migrate(apiUrl: string, req: StorageMigrationRequest): Promise<void> {
        return apiPost<void>(apiUrl, `/storageLocation/migrate?src=${encodeURIComponent(String(req.source))}&dst=${encodeURIComponent(String(req.destination))}&deleteSrc=${Boolean(req.deleteSource)}`);
    }
};
