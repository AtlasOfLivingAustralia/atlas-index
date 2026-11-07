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
import type {CacheClearTarget} from '../../api/types.ts';

interface ToolAction {
    key: string;
    label: string;
    description: string;
    run: (apiUrl: string) => Promise<void>;
    confirm?: string;
}

/**
 * Repository maintenance jobs/cache-clearing against the confirmed
 * `/api/v2/admin/index/*`, `/api/v2/admin/jobs/*` and
 * `/api/v2/admin/cache/{target}` endpoints.
 */
const ACTIONS: ToolAction[] = [
    {
        key: 'reindex',
        label: 'Reindex images',
        description: 'Rebuilds the search index from the image repository.',
        run: adminApi.reindex,
        confirm: 'Rebuild the entire search index? This may take a while.'
    },
    {
        key: 'reinitialise-index',
        label: 'Reinitialise index',
        description: 'Recreates the search index from scratch.',
        run: adminApi.reinitialiseIndex,
        confirm: 'Reinitialise the entire search index? This is a destructive operation and may take a while.'
    },
    {
        key: 'clear-queues',
        label: 'Clear background queues',
        description: 'Clears pending background processing queues (thumbnail/tile generation, etc).',
        run: adminApi.clearQueues,
        confirm: 'Clear all pending background queue jobs?'
    },
    {
        key: 'purge-deleted',
        label: 'Purge deleted images',
        description: 'Permanently removes images already marked as deleted.',
        run: adminApi.purgeDeleted,
        confirm: 'Permanently purge all deleted images? This cannot be undone.'
    },
    {
        key: 'rematch-licenses',
        label: 'Rematch licences',
        description: 'Re-runs licence matching against the current licence/mapping configuration.',
        run: adminApi.rematchLicenses
    },
    {
        key: 'check-failed-uploads',
        label: 'Check failed uploads',
        description: 'Re-checks previously failed uploads to see if they can now be retried.',
        run: adminApi.checkFailedUploads
    }
];

const CACHE_TARGETS: CacheClearTarget[] = ['thumbnails', 'tiles', 'hibernate', 'collectory', 's3-client'];

export default function Tools({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_API_URL;
    const [running, setRunning] = useState<string | null>(null);
    const [results, setResults] = useState<Record<string, string>>({});

    const [regexPattern, setRegexPattern] = useState('');
    const [maxResults, setMaxResults] = useState(50);
    const [failedUploads, setFailedUploads] = useState<Record<string, unknown>[] | null>(null);
    const [failedUploadsError, setFailedUploadsError] = useState<string | null>(null);
    const [failedUploadsBusy, setFailedUploadsBusy] = useState(false);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Tools', href: '/admin/tools'}
        ]);
    }, []);

    async function runAction(action: ToolAction) {
        if (action.confirm && !window.confirm(action.confirm)) return;
        setRunning(action.key);
        setResults(prev => ({...prev, [action.key]: ''}));
        try {
            await action.run(apiUrl);
            setResults(prev => ({...prev, [action.key]: 'Completed successfully.'}));
        } catch (err) {
            setResults(prev => ({...prev, [action.key]: `Failed: ${(err as ApiError)?.message ?? 'unknown error'}`}));
        } finally {
            setRunning(null);
        }
    }

    async function runCacheClear(target: CacheClearTarget) {
        setRunning(`cache-${target}`);
        setResults(prev => ({...prev, [`cache-${target}`]: ''}));
        try {
            await adminApi.clearCache(apiUrl, target);
            setResults(prev => ({...prev, [`cache-${target}`]: 'Cleared.'}));
        } catch (err) {
            setResults(prev => ({...prev, [`cache-${target}`]: `Failed: ${(err as ApiError)?.message ?? 'unknown error'}`}));
        } finally {
            setRunning(null);
        }
    }

    function loadFailedUploads() {
        setFailedUploadsBusy(true);
        adminApi
            .failedUploads(apiUrl, regexPattern || undefined, maxResults)
            .then(resp => {
                setFailedUploads(resp.results);
                setFailedUploadsError(null);
            })
            .catch((err: ApiError) => setFailedUploadsError(err?.message ?? 'Failed to load failed uploads'))
            .finally(() => setFailedUploadsBusy(false));
    }

    async function clearFailedUploads() {
        if (!window.confirm('Clear failed upload records matching this pattern?')) return;
        setFailedUploadsBusy(true);
        try {
            await adminApi.clearFailedUploads(apiUrl, regexPattern || undefined);
            loadFailedUploads();
        } catch (err) {
            setFailedUploadsError((err as ApiError)?.message ?? 'Failed to clear failed uploads');
        } finally {
            setFailedUploadsBusy(false);
        }
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-tools">
                <h2>Repository tools</h2>
                <div className="d-flex flex-column gap-3 mb-4" style={{maxWidth: 700}}>
                    {ACTIONS.map(action => (
                        <div key={action.key} className="card p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="fw-bold">{action.label}</div>
                                    <div className="text-muted small">{action.description}</div>
                                </div>
                                <button className="btn btn-outline-primary" disabled={running === action.key} onClick={() => runAction(action)} data-testid={`tool-${action.key}`}>
                                    {running === action.key ? 'Running…' : 'Run'}
                                </button>
                            </div>
                            {results[action.key] && <div className="mt-2 small">{results[action.key]}</div>}
                        </div>
                    ))}
                </div>

                <h5>Clear cache</h5>
                <div className="d-flex flex-wrap gap-2 mb-4">
                    {CACHE_TARGETS.map(target => (
                        <div key={target} className="d-flex align-items-center gap-2">
                            <button className="btn btn-outline-secondary btn-sm" disabled={running === `cache-${target}`} onClick={() => runCacheClear(target)} data-testid={`cache-${target}`}>
                                {running === `cache-${target}` ? 'Clearing…' : `Clear ${target}`}
                            </button>
                            {results[`cache-${target}`] && <span className="small text-muted">{results[`cache-${target}`]}</span>}
                        </div>
                    ))}
                </div>

                <h5>Failed uploads</h5>
                <div className="d-flex gap-2 mb-2" style={{maxWidth: 600}}>
                    <input className="form-control" placeholder="Regex pattern (optional)" value={regexPattern} onChange={e => setRegexPattern(e.target.value)}/>
                    <input className="form-control" type="number" style={{maxWidth: 120}} value={maxResults} onChange={e => setMaxResults(parseInt(e.target.value) || 50)}/>
                    <button className="btn btn-outline-secondary" disabled={failedUploadsBusy} onClick={loadFailedUploads}>Search</button>
                    <button className="btn btn-outline-danger" disabled={failedUploadsBusy} onClick={clearFailedUploads}>Clear matching</button>
                </div>
                {failedUploadsError && <div className="alert alert-danger">{failedUploadsError}</div>}
                {failedUploads !== null && (
                    <pre className="border p-2" data-testid="failed-uploads-result">{JSON.stringify(failedUploads, null, 2)}</pre>
                )}
            </div>
        </div>
    );
}
