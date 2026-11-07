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

/**
 * Usage analytics: GET /api/v2/admin/analytics and GET
 * /api/v2/admin/analytics/dataResource/{uid}. Neither response shape was
 * fully enumerated by the backend, so both are rendered as raw JSON rather
 * than guessing at specific fields.
 */
export default function AnalyticsAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_API_URL;
    const [overall, setOverall] = useState<unknown>(null);
    const [dataResourceUid, setDataResourceUid] = useState('');
    const [dataResourceResult, setDataResourceResult] = useState<unknown>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Analytics', href: '/admin/analytics'}
        ]);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        adminApi
            .analytics(apiUrl, controller.signal)
            .then(result => {
                setOverall(result);
                setError(null);
            })
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setError(err?.message ?? 'Failed to load analytics');
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [apiUrl]);

    function lookupDataResource() {
        if (!dataResourceUid) return;
        setBusy(true);
        adminApi
            .analyticsForDataResource(apiUrl, dataResourceUid)
            .then(setDataResourceResult)
            .catch((err: ApiError) => setError(err?.message ?? 'Failed to load data resource analytics'))
            .finally(() => setBusy(false));
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-analytics">
                <h2>Analytics</h2>
                {error && <div className="alert alert-danger">{error}</div>}
                {loading && <div className="d-flex mt-4"><div className="spinner-border ms-auto me-auto"/></div>}

                {!loading && (
                    <>
                        <h5>Overall</h5>
                        <pre className="border p-2 mb-4" data-testid="analytics-overall">{JSON.stringify(overall, null, 2)}</pre>

                        <h5>By data resource</h5>
                        <div className="d-flex gap-2 mb-2" style={{maxWidth: 400}}>
                            <input className="form-control" placeholder="Data resource UID" value={dataResourceUid} onChange={e => setDataResourceUid(e.target.value)}/>
                            <button className="btn btn-outline-secondary" disabled={busy || !dataResourceUid} onClick={lookupDataResource}>Look up</button>
                        </div>
                        {dataResourceResult !== null && (
                            <pre className="border p-2" data-testid="analytics-data-resource">{JSON.stringify(dataResourceResult, null, 2)}</pre>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
