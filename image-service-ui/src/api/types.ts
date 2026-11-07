/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Domain types shared by the image-service-ui frontend, matching the
 * **confirmed** image-service `/api/v2` contract (auth/session,
 * search/facet/download, image detail/metadata/tags/calibration/admin
 * actions, uploads, and the full `/api/v2/admin/*` group). Keep this file
 * centralized so a contract correction only needs to change one place.
 *
 * A few DTOs below have fields the backend confirmed exist but did not
 * fully enumerate (e.g. the shape of each entry in
 * `BatchUploadsResponse.uploads`, or `IndexSearchResult.images`/`facets`).
 * Those are marked with a comment and kept loosely typed (optional fields
 * plus an index signature, or `unknown`) so the UI can render defensively
 * without fabricating fields that were never specified.
 */

export interface FacetValue {
    value: string;
    label?: string;
    count: number;
}

export interface Facet {
    name: string;
    label: string;
    values: FacetValue[];
}

export interface SearchCriterion {
    id: string;
    field: string;
    label: string;
    operator: string;
    value: string;
}

export interface ImageSummary {
    imageId: string;
    originalFilename?: string;
    title?: string;
    mimeType?: string;
    thumbnailUrl: string;
    tileUrl?: string;
    imageUrl?: string;
    width?: number;
    height?: number;
    tileZoomLevels?: number;
    dateUploaded?: string;
    dataResourceUid?: string;
    isImage: boolean;
    isAudio: boolean;
    isDocument: boolean;
    rightsHolder?: string;
    licence?: string;
}

/** GET /api/v2/images/search — facets are fetched separately via GET /api/v2/images/search/facet. */
export interface SearchResult {
    results: ImageSummary[];
    totalRecords: number;
    pageSize: number;
    startIndex: number;
    sort?: string;
    sortDirection?: 'asc' | 'desc';
}

export interface MetadataEntry {
    key: string;
    value: string;
}

/**
 * A tag reference: `{id, path}`. Tag ids are numeric per the confirmed
 * admin tag contract (`PUT /tags/{id}` accepts `move:{newParentId:number|null}`),
 * so `id` is typed as `number` here — used both for tags attached to an
 * image (`ImageDetail.tags`) and for entries in the flat admin tag list
 * (`GET /api/v2/admin/tags/tree`).
 */
export interface TagRef {
    id: number;
    path: string;
}

export interface SubimageRect {
    imageId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    thumbnailUrl: string;
}

export interface ImageDetail extends ImageSummary {
    parentImageId?: string | null;
    parentImageTitle?: string;
    parentImageThumbnailUrl?: string;
    subimages: SubimageRect[];
    tags: TagRef[];
    coreMetadata: MetadataEntry[];
    systemMetadata: MetadataEntry[];
    embeddedMetadata: MetadataEntry[];
    userMetadata: MetadataEntry[];
    dataResourceMetadata: MetadataEntry[];
    metadataUrl: string;
    originalUrl: string;
    calibratedPixelsPerMm?: number;
    isCalibrated: boolean;
    /** Admin-only field backing the PATCH .../harvestable action. */
    harvestable?: boolean;
    deleted: boolean;
}

export interface AuditEntry {
    date: string;
    user?: string;
    event: string;
    details?: string;
}

// ---------------------------------------------------------------------------
// Uploads — POST /api/v2/uploads, /api/v2/uploads/batches, /api/v2/uploads/bulk-urls
// ---------------------------------------------------------------------------

/** Response from POST /api/v2/uploads (single file or imageUrl). */
export interface UploadResult {
    success: boolean;
    imageId: string;
    alreadyStored: boolean;
}

export interface BatchZipUploadFile {
    status: string;
    file: string;
    recordCount?: number;
}

/** Response from POST /api/v2/uploads/batches (multipart `archive` + `dataResourceUid`). */
export interface BatchZipUploadResult {
    batchId: string;
    dataResourceUid: string;
    file: string;
    dateCreated: string;
    status: string;
    files: BatchZipUploadFile[];
}

// ---------------------------------------------------------------------------
// Admin: dashboard + queues — GET /api/v2/admin/dashboard, /queues
// ---------------------------------------------------------------------------

export interface AdminDashboardQueues {
    imageQueueLength: number;
    tilingQueueLength: number;
    activeBatchUploads: number;
}

export interface AdminDashboard {
    imageCount: number;
    deletedImageCount: number;
    licenceCount: number;
    licenceMappingCount: number;
    repoSizeOnDisk: number;
    queues: AdminDashboardQueues;
}

// ---------------------------------------------------------------------------
// Admin: batch-uploads / batch-files monitor — GET/POST /api/v2/admin/batch-uploads,
// PUT .../batch-uploads/processing, DELETE .../batch-files/queue,
// POST .../batch-files/{fileId}/reload, DELETE .../batch-files/{fileId}
// ---------------------------------------------------------------------------

/**
 * One entry in `BatchUploadsResponse.uploads`. Only `fileId` and `status` are
 * confirmed to exist (they're what `batch-files/{fileId}` actions operate
 * on); other display fields are optional/inferred and the UI falls back to
 * showing raw JSON for anything unrecognized.
 */
export interface BatchUploadFile {
    fileId: string;
    fileName?: string;
    dataResourceUid?: string;
    status?: string;
    sizeInBytes?: number;
    dateAdded?: string;
    errorMessage?: string;
    [key: string]: unknown;
}

export interface BatchUploadsResponse {
    uploads: BatchUploadFile[];
    active: number;
    queued: number;
    batchServiceProcessingEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Admin: search-criteria — GET/POST /api/v2/admin/search-criteria, PUT/DELETE .../{id}
// ---------------------------------------------------------------------------

export interface SearchCriteriaDefinition {
    id: string | number;
    type: string;
    valueType: string;
    name: string;
    description?: string;
    fieldName: string;
    units?: string;
}

export interface SearchCriteriaListResponse {
    results: SearchCriteriaDefinition[];
}

// ---------------------------------------------------------------------------
// Admin: settings — GET /api/v2/admin/settings, PUT .../settings/{name}
// ---------------------------------------------------------------------------

export interface Setting {
    id: string | number;
    name: string;
    description?: string;
    value: string;
    type: string;
}

export interface SettingsListResponse {
    results: Setting[];
}

// ---------------------------------------------------------------------------
// Admin: duplicates — GET /api/v2/admin/duplicates?max=&offset=
// ---------------------------------------------------------------------------

export interface DuplicateEntry {
    /** Shape not fully enumerated by the backend; treated as an ImageSummary-like reference. */
    image: ImageSummary;
    hash: string;
    count: number;
}

export interface DuplicatesResponse {
    results: DuplicateEntry[];
    totalCount: number;
}

// ---------------------------------------------------------------------------
// Admin: licences — GET/PUT /api/v2/admin/licences (full upsert body)
// ---------------------------------------------------------------------------

export interface Licence {
    acronym: string;
    name: string;
    url?: string;
    imageUrl?: string;
}

/** `acronym` is the target licence's acronym; `value` is the raw/source rights string mapped to it. */
export interface LicenceMapping {
    acronym: string;
    value: string;
}

export interface LicencesResponse {
    licences: Licence[];
    licenceMappings: LicenceMapping[];
}

// ---------------------------------------------------------------------------
// Admin: storage locations — GET/POST /api/v2/admin/storage-locations,
// GET/PUT .../{id}, POST .../{id}/default, POST .../storage-locations/migrate
// ---------------------------------------------------------------------------

/**
 * Redacted DTO — secrets (API keys, passwords) are never returned by the
 * backend; only `hasSecretKeyConfigured`/`hasPasswordConfigured` booleans
 * indicate whether one is set. Additional backend-defined config fields
 * (host, bucket, path, etc.) are not fully enumerated, so they pass through
 * via the index signature and are rendered generically where needed.
 */
export interface StorageLocation {
    id: string | number;
    name: string;
    type: string;
    isDefault?: boolean;
    hasSecretKeyConfigured?: boolean;
    hasPasswordConfigured?: boolean;
    [key: string]: unknown;
}

export interface StorageMigrationRequest {
    source: string;
    destination: string;
    deleteSource: boolean;
}

// ---------------------------------------------------------------------------
// Admin: tags — GET /api/v2/admin/tags/tree?q= (flat list), POST /tags/import,
// POST /tags, PUT /tags/{id}, DELETE /tags/{id}
// ---------------------------------------------------------------------------

export interface TagListResponse {
    results: TagRef[];
}

export interface TagCreateResponse {
    success: boolean;
    tag: TagRef;
}

// ---------------------------------------------------------------------------
// Admin: import fields + inbox — GET/POST/DELETE /api/v2/admin/import-fields,
// GET /api/v2/admin/inbox, POST /api/v2/admin/inbox/import
// ---------------------------------------------------------------------------

export interface ImportFieldDefinition {
    id?: string | number;
    name: string;
    type: string;
    value?: string;
}

/** Response wrapping for GET /import-fields was not explicitly given; inferred consistent with other list endpoints ({results:[...]}). */
export interface ImportFieldsListResponse {
    results: ImportFieldDefinition[];
}

export interface InboxFile {
    name: string;
    path: string;
    sizeInBytes: number;
    lastModified: string;
}

export interface InboxResponse {
    results: InboxFile[];
    fieldDefinitions: ImportFieldDefinition[];
}

export interface InboxImportResponse {
    success: boolean;
    importBatchId: string;
    message: string;
}

// ---------------------------------------------------------------------------
// Admin: failed uploads — GET/DELETE /api/v2/admin/failed-uploads?regexPattern=&maxResults=
// ---------------------------------------------------------------------------

/** Exact entry fields were not specified; rendered generically (raw JSON) in the UI. */
export interface FailedUploadsResponse {
    results: Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Admin: index search — POST /api/v2/admin/index/search
// ---------------------------------------------------------------------------

/** `images`/`facets` shapes were not enumerated by the backend; rendered as raw JSON. */
export interface IndexSearchResult {
    images: unknown;
    totalCount: number;
    facets: unknown;
}

// ---------------------------------------------------------------------------
// Admin: cache clearing — POST /api/v2/admin/cache/{target}
// ---------------------------------------------------------------------------

export type CacheClearTarget = 'thumbnails' | 'tiles' | 'hibernate' | 'collectory' | 's3-client';
