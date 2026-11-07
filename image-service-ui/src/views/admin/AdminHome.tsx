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
import type {AdminDashboard} from '../../api/types.ts';

function bytesToHuman(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

/** GET /api/v2/admin/dashboard + GET /api/v2/admin/queues. */
export default function AdminHome({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_API_URL;
    const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
    const [queues, setQueues] = useState<unknown>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [clearingQueues, setClearingQueues] = useState(false);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'}
        ]);
    }, []);

    function load(signal?: AbortSignal) {
        setLoading(true);
        Promise.all([adminApi.dashboard(apiUrl, signal), adminApi.queues(apiUrl, signal)])
            .then(([d, q]) => {
                setDashboard(d);
                setQueues(q);
                setError(null);
            })
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setError(err?.message ?? 'Failed to load dashboard stats');
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl]);

    async function clearQueues() {
        if (!window.confirm('Clear all pending background queues?')) return;
        setClearingQueues(true);
        try {
            await adminApi.clearQueues(apiUrl);
            load();
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Failed to clear queues');
        } finally {
            setClearingQueues(false);
        }
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-dashboard">
                <h2>Dashboard</h2>
                {error && <div className="alert alert-danger" data-testid="dashboard-error">{error}</div>}
                {loading && <div className="d-flex mt-4"><div className="spinner-border ms-auto me-auto"/></div>}

                {!loading && dashboard && (
                    <div className="row mb-4">
                        <div className="col-md-3">
                            <div className="card p-3">
                                <div className="text-muted">Images</div>
                                <div className="fs-3">{dashboard.imageCount.toLocaleString()}</div>
                                <div className="text-muted small">{dashboard.deletedImageCount.toLocaleString()} deleted</div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card p-3">
                                <div className="text-muted">Licences</div>
                                <div className="fs-3">{dashboard.licenceCount.toLocaleString()}</div>
                                <div className="text-muted small">{dashboard.licenceMappingCount.toLocaleString()} mappings</div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card p-3">
                                <div className="text-muted">Storage used</div>
                                <div className="fs-3">{bytesToHuman(dashboard.repoSizeOnDisk)}</div>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && dashboard && (
                    <>
                        <h5>Queues</h5>
                        <table className="table table-sm table-bordered mb-2" style={{maxWidth: 500}}>
                            <tbody>
                            <tr>
                                <td>Image processing queue</td>
                                <td>{dashboard.queues.imageQueueLength.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td>Tiling queue</td>
                                <td>{dashboard.queues.tilingQueueLength.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td>Active batch uploads</td>
                                <td>{dashboard.queues.activeBatchUploads.toLocaleString()}</td>
                            </tr>
                            </tbody>
                        </table>
                        <button className="btn btn-outline-secondary btn-sm mb-4" disabled={clearingQueues} onClick={clearQueues} data-testid="clear-queues">
                            {clearingQueues ? 'Clearing…' : 'Clear queues'}
                        </button>
                    </>
                )}

                {!loading && queues !== null && (
                    <>
                        <h5>Detailed queue data</h5>
                        {/* GET /api/v2/admin/queues response shape was not fully enumerated by the backend — rendered as-is. */}
                        <pre className="border p-2" data-testid="queues-raw">{JSON.stringify(queues, null, 2)}</pre>
                    </>
                )}
            </div>
        </div>
    );
}
