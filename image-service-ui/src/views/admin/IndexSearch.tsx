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
import type {IndexSearchResult} from '../../api/types.ts';

const DEFAULT_QUERY = '{\n  "query": {\n    "match_all": {}\n  }\n}';

/** POST /api/v2/admin/index/search — raw Elasticsearch query JSON, response {images,totalCount,facets}. */
export default function IndexSearch({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_API_URL;
    const [queryText, setQueryText] = useState(DEFAULT_QUERY);
    const [parseError, setParseError] = useState<string | null>(null);
    const [result, setResult] = useState<IndexSearchResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Raw index search', href: '/admin/index-search'}
        ]);
    }, []);

    function run() {
        let parsed: object;
        try {
            parsed = JSON.parse(queryText);
        } catch {
            setParseError('Query must be valid JSON.');
            return;
        }
        setParseError(null);
        setBusy(true);
        setError(null);
        setResult(null);
        adminApi
            .indexSearch(apiUrl, parsed)
            .then(setResult)
            .catch((err: ApiError) => setError(err?.message ?? 'Search failed'))
            .finally(() => setBusy(false));
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-index-search">
                <h2>Raw index search</h2>
                <p className="text-muted">Runs a raw Elasticsearch query (JSON body) directly against the image index.</p>

                <textarea
                    className="form-control font-monospace mb-2"
                    rows={8}
                    value={queryText}
                    onChange={e => setQueryText(e.target.value)}
                    data-testid="index-search-query"
                />
                {parseError && <div className="alert alert-warning py-1 px-2">{parseError}</div>}
                <button className="btn btn-primary mb-3" onClick={run} disabled={busy || !queryText.trim()}>Run query</button>

                {error && <div className="alert alert-danger">{error}</div>}
                {result !== null && (
                    <>
                        <div className="mb-2" data-testid="index-search-total">Total: {result.totalCount.toLocaleString()}</div>
                        {/* images/facets shapes were not fully enumerated by the backend — rendered as raw JSON. */}
                        <h6>Images</h6>
                        <pre className="border p-2 mb-3" data-testid="index-search-images">{JSON.stringify(result.images, null, 2)}</pre>
                        <h6>Facets</h6>
                        <pre className="border p-2" data-testid="index-search-facets">{JSON.stringify(result.facets, null, 2)}</pre>
                    </>
                )}
            </div>
        </div>
    );
}
