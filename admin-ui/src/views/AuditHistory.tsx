/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import Menu from '../components/menu.tsx';
import {Breadcrumb, useUser} from '@ala/common-ui';
import {parseAsString, useQueryState} from 'nuqs';

// ---- types ------------------------------------------------------------------

interface AuditEntry {
    id: number;
    entityTable: string;
    entityId: string;
    entityName: string | null;
    createdAt: string;
    actor: string | null;
    action: string;
    diff: string | null;
}

interface Page<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;      // current page (0-based)
    size: number;
}

const TABLE_OPTIONS = [
    {value: '', label: 'All'},
    {value: 'config', label: 'Dynamic Config'},
    {value: 'banner', label: 'Banner Messages'},
    {value: 'dq', label: 'Data Quality'},
];

const ACTION_CLASS: Record<string, string> = {
    UPDATE: 'badge bg-primary',
    DELETE: 'badge bg-danger',
    CREATE: 'badge bg-success',
};

// ---- component --------------------------------------------------------------

function AuditHistory({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const {userInfo} = useUser();

    const [results, setResults] = useState<Page<AuditEntry> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // filters — bound to query params via nuqs (committed on search/clear/select change)
    const [entityTable, setEntityTable] = useQueryState('entityTable', parseAsString.withDefault(''));
    const [entityId, setEntityId] = useQueryState('entityId', parseAsString.withDefault(''));
    const [entityName, setEntityName] = useQueryState('entityName', parseAsString.withDefault(''));
    const [author, setAuthor] = useQueryState('author', parseAsString.withDefault(''));
    const [action, setAction] = useQueryState('action', parseAsString.withDefault(''));

    // local draft state for text inputs — committed to nuqs only on submit/clear
    const [draftEntityId, setDraftEntityId] = useState(entityId);
    const [draftEntityName, setDraftEntityName] = useState(entityName);
    const [draftAuthor, setDraftAuthor] = useState(author);

    const [page, setPage] = useState(0);
    const pageSize = 20;

    // diff modal
    const [diffEntry, setDiffEntry] = useState<AuditEntry | null>(null);

    // page open: fetch once using whatever query params are in the URL
    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Admin', href: '/'},
            {title: 'Audit History', href: '/audit'},
        ]);
        fetchAudit(0, {entityTable, entityId, entityName, author, action});
    }, []);

    function fetchAudit(requestedPage: number, filters?: {
        entityTable?: string, entityId?: string, entityName?: string, author?: string, action?: string
    }) {
        const f = {
            entityTable: filters?.entityTable ?? entityTable,
            entityId: filters?.entityId ?? entityId,
            entityName: filters?.entityName ?? entityName,
            author: filters?.author ?? author,
            action: filters?.action ?? action,
        };

        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (f.entityTable) params.set('entityTable', f.entityTable);
        if (f.entityId.trim()) params.set('entityId', f.entityId.trim());
        if (f.entityName.trim()) params.set('entityName', f.entityName.trim());
        if (f.author.trim()) params.set('author', f.author.trim());
        if (f.action) params.set('action', f.action);
        params.set('page', String(requestedPage));
        params.set('pageSize', String(pageSize));

        fetch(`${import.meta.env.VITE_APP_BIE_URL}/admin/audit?${params}`, {
            headers: {Authorization: 'Bearer ' + userInfo?.accessToken},
        })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then((data: Page<AuditEntry>) => {
                setResults(data);
                setPage(requestedPage);
            })
            .catch(e => setError('Failed to load audit history: ' + e.message))
            .finally(() => setLoading(false));
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        const filters = {entityTable, entityId: draftEntityId, entityName: draftEntityName, author: draftAuthor, action};
        setEntityId(draftEntityId || null);
        setEntityName(draftEntityName || null);
        setAuthor(draftAuthor || null);
        fetchAudit(0, filters);
    }

    function clearFilters() {
        setDraftEntityId('');
        setDraftEntityName('');
        setDraftAuthor('');
        setEntityTable(null);
        setEntityId(null);
        setEntityName(null);
        setAuthor(null);
        setAction(null);
        fetchAudit(0, {entityTable: '', entityId: '', entityName: '', author: '', action: ''});
    }

    function formatDiff(diffJson: string | null): React.ReactNode {
        if (!diffJson) return <span className="text-muted fst-italic">—</span>;
        try {
            const obj = JSON.parse(diffJson);

            function renderValue(v: any): React.ReactNode {
                if (v === null || v === undefined) {
                    return <span className="text-muted fst-italic">null</span>;
                }
                if (typeof v === 'object') {
                    return JSON.stringify(v, null, 2);
                }
                return String(v);
            }

            return (
                <table className="table table-sm table-bordered mb-0 small">
                    <thead><tr><th>Field</th><th>From</th><th>To</th></tr></thead>
                    <tbody>
                    {Object.entries(obj).map(([field, change]: [string, any]) => (
                        <tr key={field}>
                            <td className="font-monospace">{field}</td>
                            {change !== null && typeof change === 'object' && ('from' in change || 'to' in change) ? (
                                <>
                                    <td className="text-danger font-monospace"
                                        style={{maxWidth: '300px', wordBreak: 'break-all', whiteSpace: 'pre-wrap'}}>
                                        {renderValue(change.from)}
                                    </td>
                                    <td className="text-success font-monospace"
                                        style={{maxWidth: '300px', wordBreak: 'break-all', whiteSpace: 'pre-wrap'}}>
                                        {renderValue(change.to)}
                                    </td>
                                </>
                            ) : (
                                <td colSpan={2} className="font-monospace"
                                    style={{maxWidth: '600px', wordBreak: 'break-all', whiteSpace: 'pre-wrap'}}>
                                    {renderValue(change)}
                                </td>
                            )}
                        </tr>
                    ))}
                    </tbody>
                </table>
            );
        } catch {
            return <pre className="small mb-0">{diffJson}</pre>;
        }
    }

    const totalPages = results?.totalPages ?? 0;

    return (
        <div className="d-flex flex-row">
            <Menu/>

            <div className="flex-grow-1 p-3">
                <h4 className="mb-3">Audit History</h4>

                {/* Filter bar */}
                <form className="d-flex flex-wrap gap-2 mb-3 align-items-end" onSubmit={handleSearch}>
                    <div>
                        <label className="form-label small mb-1">Table</label>
                        <select className="form-select form-select-sm"
                                value={entityTable}
                                onChange={e => { setEntityTable(e.target.value); fetchAudit(0, {entityTable: e.target.value}); }}>
                            {TABLE_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label small mb-1">Entity ID</label>
                        <input className="form-control form-control-sm" placeholder="exact match"
                               value={draftEntityId} onChange={e => setDraftEntityId(e.target.value)}/>
                    </div>
                    <div>
                        <label className="form-label small mb-1">Entity name</label>
                        <input className="form-control form-control-sm" placeholder="partial match"
                               value={draftEntityName} onChange={e => setDraftEntityName(e.target.value)}/>
                    </div>
                    <div>
                        <label className="form-label small mb-1">Author</label>
                        <input className="form-control form-control-sm" placeholder="partial match"
                               value={draftAuthor} onChange={e => setDraftAuthor(e.target.value)}/>
                    </div>
                    <div>
                        <label className="form-label small mb-1">Action</label>
                        <select className="form-select form-select-sm"
                                value={action}
                                onChange={e => { setAction(e.target.value); fetchAudit(0, {action: e.target.value}); }}>
                            <option value={''}>All</option>
                            <option value={'CREATE'}>CREATE</option>
                            <option value={'DELETE'}>DELETE</option>
                            <option value={'UPDATE'}>UPDATE</option>
                        </select>
                    </div>
                    <div className="d-flex gap-1 align-items-end">
                        <button type="submit" className="btn btn-primary btn-sm">Search</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear</button>
                    </div>
                    {results && (
                        <div className="ms-auto align-self-end">
                            <small className="text-muted">{results.totalElements.toLocaleString()} record{results.totalElements !== 1 ? 's' : ''}</small>
                        </div>
                    )}
                </form>

                {error && <div className="alert alert-danger">{error}</div>}
                {loading && <div className="text-muted">Loading…</div>}

                {!loading && results && (
                    <>
                        <table className="table table-sm table-bordered table-hover">
                            <thead className="table-light">
                            <tr>
                                <th style={{width: '170px'}}>Date / Time</th>
                                <th style={{width: '90px'}}>Table</th>
                                <th>Entity</th>
                                <th style={{width: '80px'}}>Action</th>
                                <th>Actor</th>
                                <th style={{width: '100px'}}>Details</th>
                            </tr>
                            </thead>
                            <tbody>
                            {results.content.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center text-muted fst-italic">No records found</td>
                                </tr>
                            )}
                            {results.content.map(entry => (
                                <tr key={entry.id}>
                                    <td className="font-monospace small text-nowrap">
                                        {new Date(entry.createdAt).toLocaleString()}
                                    </td>
                                    <td>
                                        <span className="badge bg-secondary" style={{cursor: 'pointer'}}
                                              onClick={() => { setEntityTable(entry.entityTable); fetchAudit(0, {entityTable: entry.entityTable}); }}>
                                            {entry.entityTable}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="fw-semibold" style={{cursor: 'pointer'}}
                                              onClick={() => { setDraftEntityId(String(entry.entityId)); setEntityId(String(entry.entityId)); fetchAudit(0, {entityId: String(entry.entityId)}); }}>
                                            {entry.entityName || entry.entityId}
                                        </span>
                                        {entry.entityName && entry.entityName !== entry.entityId && (
                                            <small className="text-muted ms-2 font-monospace">({entry.entityId})</small>
                                        )}
                                    </td>
                                    <td>
                                        <span className={ACTION_CLASS[entry.action] ?? 'badge bg-secondary'}
                                              style={{cursor: 'pointer'}}
                                              onClick={() => { setAction(entry.action); fetchAudit(0, {action: entry.action}); }}>
                                            {entry.action}
                                        </span>
                                    </td>
                                    <td className="small">
                                        {entry.actor
                                            ? <span style={{cursor: 'pointer'}} onClick={() => { setDraftAuthor(entry.actor!); setAuthor(entry.actor!); fetchAudit(0, {author: entry.actor!}); }}>{entry.actor}</span>
                                            : <span className="text-muted">—</span>}
                                    </td>
                                    <td>
                                        {entry.diff ? (
                                            <button className="btn btn-link btn-sm p-0"
                                                    onClick={() => setDiffEntry(entry)}>
                                                View diff
                                            </button>
                                        ) : (
                                            <span className="text-muted small">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <nav>
                                <ul className="pagination pagination-sm">
                                    <li className={`page-item${page === 0 ? ' disabled' : ''}`}>
                                        <button className="page-link" onClick={() => fetchAudit(page - 1)}>‹</button>
                                    </li>
                                    {Array.from({length: totalPages}, (_, i) => i)
                                        .filter(i => Math.abs(i - page) <= 2)
                                        .map(i => (
                                            <li key={i} className={`page-item${i === page ? ' active' : ''}`}>
                                                <button className="page-link" onClick={() => fetchAudit(i)}>{i + 1}</button>
                                            </li>
                                        ))}
                                    <li className={`page-item${page >= totalPages - 1 ? ' disabled' : ''}`}>
                                        <button className="page-link" onClick={() => fetchAudit(page + 1)}>›</button>
                                    </li>
                                </ul>
                            </nav>
                        )}
                    </>
                )}
            </div>

            {/* Diff modal */}
            {diffEntry && (
                <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                     style={{background: 'rgba(0,0,0,0.6)', zIndex: 1050}}
                     onClick={() => setDiffEntry(null)}>
                    <div className="card p-4 shadow-lg" style={{maxWidth: '700px', width: '100%', maxHeight: '80vh', overflowY: 'auto'}}
                         onClick={e => e.stopPropagation()}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <h5 className="mb-0">Change details</h5>
                                <small className="text-muted">
                                    {diffEntry.entityTable} / {diffEntry.entityName || diffEntry.entityId}
                                    &nbsp;·&nbsp;{new Date(diffEntry.createdAt).toLocaleString()}
                                    &nbsp;·&nbsp;{diffEntry.actor}
                                </small>
                            </div>
                            <button className="btn-close" onClick={() => setDiffEntry(null)}/>
                        </div>
                        {formatDiff(diffEntry.diff)}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AuditHistory;

