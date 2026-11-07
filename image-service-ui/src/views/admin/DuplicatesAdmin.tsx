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
import type {DuplicateEntry} from '../../api/types.ts';

const PAGE_SIZE = 20;

/** GET /api/v2/admin/duplicates?max=&offset= — one row per duplicate hash, with a representative image and a count. */
export default function DuplicatesAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_API_URL;
    const [entries, setEntries] = useState<DuplicateEntry[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [offset, setOffset] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Duplicates', href: '/admin/duplicates'}
        ]);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        adminApi
            .duplicates(apiUrl, PAGE_SIZE, offset, controller.signal)
            .then(resp => {
                setEntries(resp.results);
                setTotalCount(resp.totalCount);
                setError(null);
            })
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setError(err?.message ?? 'Failed to load duplicate images');
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [apiUrl, offset]);

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-duplicates">
                <h2>Duplicate images</h2>
                {error && <div className="alert alert-danger">{error}</div>}
                {loading && <div className="d-flex mt-4"><div className="spinner-border ms-auto me-auto"/></div>}

                {!loading && !error && entries.length === 0 && <div className="text-muted">No duplicate images found.</div>}

                {!loading && entries.length > 0 && (
                    <>
                        <table className="table table-sm table-striped">
                            <thead>
                            <tr>
                                <th>Image</th>
                                <th>Hash</th>
                                <th>Duplicate count</th>
                            </tr>
                            </thead>
                            <tbody>
                            {entries.map(entry => (
                                <tr key={entry.hash}>
                                    <td>
                                        <a href={`/image/${encodeURIComponent(entry.image.imageId)}`} className="d-flex align-items-center gap-2">
                                            <img src={entry.image.thumbnailUrl} alt={entry.image.imageId} style={{width: 48, height: 48, objectFit: 'cover'}}/>
                                            {entry.image.title ?? entry.image.originalFilename ?? entry.image.imageId}
                                        </a>
                                    </td>
                                    <td><code>{entry.hash}</code></td>
                                    <td>{entry.count}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        <div className="d-flex gap-2 align-items-center">
                            <button className="btn btn-outline-secondary btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</button>
                            <span className="text-muted small">{offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)} of {totalCount}</span>
                            <button className="btn btn-outline-secondary btn-sm" disabled={offset + PAGE_SIZE >= totalCount} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
