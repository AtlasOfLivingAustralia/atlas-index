/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import {Form, Tab, Tabs} from 'react-bootstrap';
import Menu from '../../components/menu.tsx';
import {adminApi, uploadApi} from '../../api/endpoints.ts';
import {ApiError} from '../../api/client.ts';
import type {BatchZipUploadResult, ImportFieldDefinition, InboxResponse, UploadResult} from '../../api/types.ts';

interface MetadataPair {
    key: string;
    value: string;
}

function MetadataEditor({pairs, onChange}: { pairs: MetadataPair[]; onChange: (pairs: MetadataPair[]) => void }) {
    return (
        <div className="mb-2">
            <Form.Label>Metadata (optional)</Form.Label>
            {pairs.map((pair, i) => (
                <div key={i} className="d-flex gap-2 mb-1">
                    <Form.Control size="sm" placeholder="Key" value={pair.key} onChange={e => onChange(pairs.map((p, j) => (j === i ? {...p, key: e.target.value} : p)))}/>
                    <Form.Control size="sm" placeholder="Value" value={pair.value} onChange={e => onChange(pairs.map((p, j) => (j === i ? {...p, value: e.target.value} : p)))}/>
                    <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => onChange(pairs.filter((_, j) => j !== i))}>Remove</button>
                </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onChange([...pairs, {key: '', value: ''}])}>Add metadata field</button>
        </div>
    );
}

function pairsToRecord(pairs: MetadataPair[]): Record<string, string> | undefined {
    const entries = pairs.filter(p => p.key).map(p => [p.key, p.value] as const);
    return entries.length ? Object.fromEntries(entries) : undefined;
}

/**
 * Upload workflows against the confirmed contract:
 *  - Single item: POST /api/v2/uploads, multipart file field `image` OR
 *    form field `imageUrl`; optional JSON-encoded `metadata` string and
 *    repeatable `tags` (tag path strings).
 *  - ZIP batch: POST /api/v2/uploads/batches, multipart file field
 *    `archive` (root-level .avro files, no manifest) + form field
 *    `dataResourceUid`.
 *  - Bulk URLs: POST /api/v2/uploads/bulk-urls (unchanged from prior pass).
 *  - Local ingest: GET /api/v2/admin/inbox (lists inbox files + configured
 *    import field definitions) + POST /api/v2/admin/inbox/import (no body,
 *    imports everything currently in the inbox — never accepts a caller
 *    userId). Import field definitions themselves are managed via
 *    GET/POST/DELETE /api/v2/admin/import-fields.
 */
export default function Upload({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_API_URL;

    // Single item
    const [singleFile, setSingleFile] = useState<File | null>(null);
    const [singleUrl, setSingleUrl] = useState('');
    const [singleMetadata, setSingleMetadata] = useState<MetadataPair[]>([]);
    const [singleTags, setSingleTags] = useState('');
    const [singleResult, setSingleResult] = useState<UploadResult | null>(null);

    // ZIP batch
    const [zipFile, setZipFile] = useState<File | null>(null);
    const [zipDataResourceUid, setZipDataResourceUid] = useState('');
    const [zipResult, setZipResult] = useState<BatchZipUploadResult | null>(null);

    // Bulk URLs
    const [bulkUrls, setBulkUrls] = useState('');
    const [bulkDataResourceUid, setBulkDataResourceUid] = useState('');
    const [bulkResult, setBulkResult] = useState<unknown>(null);

    // Local ingest / inbox
    const [inbox, setInbox] = useState<InboxResponse | null>(null);
    const [inboxError, setInboxError] = useState<string | null>(null);
    const [inboxLoading, setInboxLoading] = useState(false);
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldType, setNewFieldType] = useState('string');
    const [newFieldValue, setNewFieldValue] = useState('');

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Upload', href: '/admin/upload'}
        ]);
    }, []);

    function loadInbox() {
        setInboxLoading(true);
        adminApi
            .inbox(apiUrl)
            .then(resp => {
                setInbox(resp);
                setInboxError(null);
            })
            .catch((err: ApiError) => setInboxError(err?.message ?? 'Failed to load inbox'))
            .finally(() => setInboxLoading(false));
    }

    async function importInbox() {
        if (!window.confirm('Import everything currently in the inbox?')) return;
        setBusy(true);
        setImportMessage(null);
        try {
            const resp = await adminApi.importInbox(apiUrl);
            setImportMessage(`${resp.message} (batch ${resp.importBatchId})`);
            loadInbox();
        } catch (err) {
            setInboxError((err as ApiError)?.message ?? 'Import failed');
        } finally {
            setBusy(false);
        }
    }

    async function saveImportField() {
        if (!newFieldName || !newFieldType) return;
        setBusy(true);
        try {
            const field: ImportFieldDefinition = {name: newFieldName, type: newFieldType, value: newFieldValue || undefined};
            await adminApi.saveImportField(apiUrl, field);
            setNewFieldName('');
            setNewFieldValue('');
            loadInbox();
        } catch (err) {
            setInboxError((err as ApiError)?.message ?? 'Failed to save import field');
        } finally {
            setBusy(false);
        }
    }

    async function deleteImportField(id: string | number | undefined) {
        if (id === undefined) return;
        if (!window.confirm('Delete this import field definition?')) return;
        setBusy(true);
        try {
            await adminApi.deleteImportField(apiUrl, id);
            loadInbox();
        } catch (err) {
            setInboxError((err as ApiError)?.message ?? 'Failed to delete import field');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-upload">
                <h2>Upload images</h2>

                {error && <div className="alert alert-danger">{error}</div>}

                <Tabs id="upload-tabs" defaultActiveKey="single" className="mb-3" onSelect={key => {
                    if (key === 'local') loadInbox();
                }}>
                    <Tab eventKey="single" title="Single item">
                        <p className="text-muted">Provide either a file or a remote image URL, not both.</p>
                        {singleResult && (
                            <div className="alert alert-info" data-testid="single-upload-result">
                                {singleResult.alreadyStored ? 'Already stored — ' : 'Uploaded — '}image ID <code>{singleResult.imageId}</code>
                            </div>
                        )}
                        <Form
                            onSubmit={e => {
                                e.preventDefault();
                                const metadata = pairsToRecord(singleMetadata);
                                const tags = singleTags ? singleTags.split(',').map(t => t.trim()).filter(Boolean) : undefined;
                                setBusy(true);
                                setError(null);
                                setSingleResult(null);
                                const action = singleFile
                                    ? uploadApi.uploadFile(apiUrl, singleFile, metadata, tags)
                                    : uploadApi.uploadFromUrl(apiUrl, singleUrl, metadata, tags);
                                action
                                    .then(setSingleResult)
                                    .catch((err: ApiError) => setError(err?.message ?? 'Upload failed'))
                                    .finally(() => setBusy(false));
                            }}
                        >
                            <Form.Group className="mb-2">
                                <Form.Control
                                    type="file"
                                    disabled={!!singleUrl}
                                    onChange={e => setSingleFile((e.target as HTMLInputElement).files?.[0] ?? null)}
                                    data-testid="single-file-input"
                                />
                            </Form.Group>
                            <div className="text-muted small mb-2">— or —</div>
                            <Form.Group className="mb-2">
                                <Form.Control
                                    type="url"
                                    placeholder="https://example.org/image.jpg"
                                    disabled={!!singleFile}
                                    value={singleUrl}
                                    onChange={e => setSingleUrl(e.target.value)}
                                    data-testid="single-url-input"
                                />
                            </Form.Group>
                            <MetadataEditor pairs={singleMetadata} onChange={setSingleMetadata}/>
                            <Form.Group className="mb-3">
                                <Form.Label>Tags (comma-separated paths, optional)</Form.Label>
                                <Form.Control value={singleTags} onChange={e => setSingleTags(e.target.value)} placeholder="Botany, Botany/Leaf"/>
                            </Form.Group>
                            <button className="btn btn-primary" disabled={busy || (!singleFile && !singleUrl)}>Upload</button>
                        </Form>
                    </Tab>

                    <Tab eventKey="zip" title="ZIP batch">
                        <p className="text-muted">Upload a ZIP archive containing root-level .avro files (no manifest) for a data resource.</p>
                        {zipResult && (
                            <div className="alert alert-info" data-testid="zip-upload-result">
                                Batch <code>{zipResult.batchId}</code> — {zipResult.status}
                                <ul className="mb-0 mt-1">
                                    {zipResult.files.map((f, i) => (
                                        <li key={i}>{f.file}: {f.status}{f.recordCount !== undefined ? ` (${f.recordCount} records)` : ''}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <Form
                            onSubmit={e => {
                                e.preventDefault();
                                if (!zipFile || !zipDataResourceUid) return;
                                setBusy(true);
                                setError(null);
                                setZipResult(null);
                                uploadApi
                                    .uploadBatchZip(apiUrl, zipFile, zipDataResourceUid)
                                    .then(setZipResult)
                                    .catch((err: ApiError) => setError(err?.message ?? 'Upload failed'))
                                    .finally(() => setBusy(false));
                            }}
                        >
                            <Form.Group className="mb-2">
                                <Form.Label>Data resource UID</Form.Label>
                                <Form.Control value={zipDataResourceUid} onChange={e => setZipDataResourceUid(e.target.value)} placeholder="dr123" data-testid="zip-data-resource-input"/>
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Control type="file" accept=".zip" onChange={e => setZipFile((e.target as HTMLInputElement).files?.[0] ?? null)} data-testid="zip-file-input"/>
                            </Form.Group>
                            <button className="btn btn-primary" disabled={busy || !zipFile || !zipDataResourceUid}>Upload ZIP</button>
                        </Form>
                    </Tab>

                    <Tab eventKey="bulk-urls" title="Bulk URLs">
                        {bulkResult !== null && <pre className="border p-2" data-testid="bulk-upload-result">{JSON.stringify(bulkResult, null, 2)}</pre>}
                        <Form
                            onSubmit={e => {
                                e.preventDefault();
                                const list = bulkUrls.split('\n').map(u => u.trim()).filter(Boolean);
                                if (list.length === 0 || !bulkDataResourceUid) return;
                                setBusy(true);
                                setError(null);
                                setBulkResult(null);
                                uploadApi
                                    .uploadBulkUrls(apiUrl, list, bulkDataResourceUid)
                                    .then(setBulkResult)
                                    .catch((err: ApiError) => setError(err?.message ?? 'Upload failed'))
                                    .finally(() => setBusy(false));
                            }}
                        >
                            <Form.Group className="mb-2">
                                <Form.Label>Data resource UID</Form.Label>
                                <Form.Control value={bulkDataResourceUid} onChange={e => setBulkDataResourceUid(e.target.value)} placeholder="dr123" data-testid="bulk-data-resource-input"/>
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>One URL per line</Form.Label>
                                <Form.Control as="textarea" rows={6} value={bulkUrls} onChange={e => setBulkUrls(e.target.value)} data-testid="urls-textarea"/>
                            </Form.Group>
                            <button className="btn btn-primary" disabled={busy || !bulkUrls.trim() || !bulkDataResourceUid}>Schedule upload</button>
                        </Form>
                    </Tab>

                    <Tab eventKey="local" title="Local ingest">
                        <p className="text-muted">Imports files already present on the server's inbox directory.</p>
                        {inboxError && <div className="alert alert-danger">{inboxError}</div>}
                        {importMessage && <div className="alert alert-info" data-testid="inbox-import-message">{importMessage}</div>}
                        {inboxLoading && <div className="d-flex mt-3"><div className="spinner-border ms-auto me-auto"/></div>}

                        {!inboxLoading && inbox && (
                            <>
                                <table className="table table-sm table-striped mb-2">
                                    <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Path</th>
                                        <th>Size</th>
                                        <th>Last modified</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {inbox.results.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="text-muted">Inbox is empty.</td>
                                        </tr>
                                    )}
                                    {inbox.results.map(f => (
                                        <tr key={f.path}>
                                            <td>{f.name}</td>
                                            <td><code>{f.path}</code></td>
                                            <td>{(f.sizeInBytes / 1024).toFixed(1)} KB</td>
                                            <td>{new Date(f.lastModified).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                <button className="btn btn-primary mb-4" disabled={busy || inbox.results.length === 0} onClick={importInbox} data-testid="import-inbox">
                                    Import inbox
                                </button>

                                <h6>Import field definitions</h6>
                                <table className="table table-sm table-striped mb-2">
                                    <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Value</th>
                                        <th/>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {inbox.fieldDefinitions.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="text-muted">No import field definitions configured.</td>
                                        </tr>
                                    )}
                                    {inbox.fieldDefinitions.map((f, i) => (
                                        <tr key={f.id ?? i}>
                                            <td>{f.name}</td>
                                            <td>{f.type}</td>
                                            <td>{f.value}</td>
                                            <td>
                                                <button className="btn btn-link btn-sm text-danger" disabled={busy} onClick={() => deleteImportField(f.id)}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                <div className="d-flex gap-2" style={{maxWidth: 600}}>
                                    <input className="form-control" placeholder="Name" value={newFieldName} onChange={e => setNewFieldName(e.target.value)}/>
                                    <input className="form-control" placeholder="Type" value={newFieldType} onChange={e => setNewFieldType(e.target.value)}/>
                                    <input className="form-control" placeholder="Value" value={newFieldValue} onChange={e => setNewFieldValue(e.target.value)}/>
                                    <button className="btn btn-outline-primary" disabled={busy || !newFieldName} onClick={saveImportField}>Add</button>
                                </div>
                            </>
                        )}
                    </Tab>
                </Tabs>
            </div>
        </div>
    );
}
