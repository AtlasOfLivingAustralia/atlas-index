/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import Menu from '../../components/menu.tsx';
import {adminApi} from '../../api/endpoints.ts';
import {ApiError} from '../../api/client.ts';
import type {BatchUploadFile, BatchUploadsResponse} from '../../api/types.ts';

function FileRow({file, busy, onReload, onDelete}: { file: BatchUploadFile; busy: boolean; onReload: () => void; onDelete: () => void }) {
    return (
        <tr>
            <td>{file.fileId}</td>
            <td>{file.fileName ?? '—'}</td>
            <td>{file.dataResourceUid ?? '—'}</td>
            <td>{file.status ?? '—'}</td>
            <td>{file.sizeInBytes !== undefined ? `${(file.sizeInBytes / 1024).toFixed(1)} KB` : '—'}</td>
            <td>{file.dateAdded ? new Date(file.dateAdded).toLocaleString() : '—'}</td>
            <td className="text-danger small">{file.errorMessage ?? ''}</td>
            <td className="d-flex gap-1">
                <button className="btn btn-link btn-sm" disabled={busy} onClick={onReload} data-testid={`reload-${file.fileId}`}>Reload</button>
                <button className="btn btn-link btn-sm text-danger" disabled={busy} onClick={onDelete} data-testid={`delete-${file.fileId}`}>Delete</button>
            </td>
        </tr>
    );
}

/**
 * Batch upload queue monitor/control (see AdminController#batchUploads /
 * #batchUpload / #batchReloadFile / #batchFileDeleteFromQueue /
 * #clearFileQueue / #clearUploads / #enableBatchProcessing /
 * #disableBatchProcessing in the legacy app — this is the confirmed
 * `/api/v2/admin/batch-uploads` + `/batch-files/*` equivalent). Distinct
 * from the single-item/ZIP/bulk-URL upload endpoints under
 * `/api/v2/uploads` (see the Upload page) — this page tracks files already
 * queued for background processing into images.
 */
export default function BatchStatus({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_API_URL;
    const [data, setData] = useState<BatchUploadsResponse | null>(null);
    const [hideEmpty, setHideEmpty] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Batch status', href: '/admin/batches'}
        ]);
    }, []);

    function load(signal?: AbortSignal) {
        setLoading(true);
        adminApi
            .batchUploads(apiUrl, hideEmpty, signal)
            .then(resp => {
                setData(resp);
                setError(null);
            })
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setError(err?.message ?? 'Failed to load batch uploads');
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl, hideEmpty]);

    async function run(action: () => Promise<void>) {
        setBusy(true);
        setError(null);
        try {
            await action();
            load();
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Action failed');
        } finally {
            setBusy(false);
        }
    }

    async function toggleProcessing(enabled: boolean) {
        setError(null);
        // Optimistic update: a controlled checkbox re-asserts its `checked` prop
        // on every render, so if we waited for the network response before
        // updating `data`, the checkbox would visibly snap back to its old
        // value for the duration of the request. Roll back on failure instead.
        setData(prev => (prev ? {...prev, batchServiceProcessingEnabled: enabled} : prev));
        try {
            await adminApi.setBatchProcessingEnabled(apiUrl, enabled);
        } catch (err) {
            setData(prev => (prev ? {...prev, batchServiceProcessingEnabled: !enabled} : prev));
            setError((err as ApiError)?.message ?? 'Failed to update batch processing state');
        }
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-batch-status">
                <h2>Batch upload queue</h2>

                {error && <div className="alert alert-danger">{error}</div>}
                {loading && <div className="d-flex mt-4"><div className="spinner-border ms-auto me-auto"/></div>}

                {!loading && data && (
                    <>
                        <div className="d-flex gap-4 align-items-center mb-3">
                            <div>Active: <strong>{data.active}</strong></div>
                            <div>Queued: <strong>{data.queued}</strong></div>
                            <label className="d-flex align-items-center gap-2">
                                <input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)}/>
                                Hide empty
                            </label>
                            <label className="d-flex align-items-center gap-2 ms-auto">
                                <input
                                    type="checkbox"
                                    checked={data.batchServiceProcessingEnabled}
                                    onChange={e => toggleProcessing(e.target.checked)}
                                    data-testid="toggle-processing"
                                />
                                Batch processing enabled
                            </label>
                        </div>

                        <div className="d-flex gap-2 mb-3">
                            <button
                                className="btn btn-outline-danger btn-sm"
                                disabled={busy}
                                onClick={() => {
                                    if (window.confirm('Clear all batch uploads?')) run(() => adminApi.clearBatchUploads(apiUrl));
                                }}
                                data-testid="clear-uploads"
                            >
                                Clear all uploads
                            </button>
                            <button
                                className="btn btn-outline-danger btn-sm"
                                disabled={busy}
                                onClick={() => {
                                    if (window.confirm('Clear the file processing queue?')) run(() => adminApi.clearBatchFileQueue(apiUrl));
                                }}
                                data-testid="clear-file-queue"
                            >
                                Clear file queue
                            </button>
                        </div>

                        <table className="table table-sm table-striped">
                            <thead>
                            <tr>
                                <th>File ID</th>
                                <th>File name</th>
                                <th>Data resource</th>
                                <th>Status</th>
                                <th>Size</th>
                                <th>Added</th>
                                <th>Error</th>
                                <th/>
                            </tr>
                            </thead>
                            <tbody>
                            {data.uploads.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="text-muted">No batch upload files found.</td>
                                </tr>
                            )}
                            {data.uploads.map(file => (
                                <FileRow
                                    key={file.fileId}
                                    file={file}
                                    busy={busy}
                                    onReload={() => run(() => adminApi.reloadBatchFile(apiUrl, file.fileId))}
                                    onDelete={() => {
                                        if (window.confirm(`Delete file "${file.fileName ?? file.fileId}" from the queue?`)) {
                                            run(() => adminApi.deleteBatchFile(apiUrl, file.fileId));
                                        }
                                    }}
                                />
                            ))}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        </div>
    );
}
