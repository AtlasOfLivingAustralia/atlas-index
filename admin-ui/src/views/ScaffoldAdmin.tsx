/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import Menu from '../components/menu.tsx';
import {Breadcrumb, useUser} from '@ala/common-ui';

// ---- types ------------------------------------------------------------------

interface FieldDef {
    name: string;
    type: 'int' | 'string' | 'boolean';
    required: boolean;
    primaryKey: boolean;
    readOnly: boolean;
}

interface Schema {
    table: string;
    label: string;
    fields: FieldDef[];
}

interface TableOption {
    table: string;
    label: string;
}

interface PageResult {
    schema: Schema;
    content: Record<string, any>[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

// ---- helpers ----------------------------------------------------------------

const PAGE_SIZE = 50;

function emptyRow(schema: Schema): Record<string, any> {
    const row: Record<string, any> = {};
    for (const f of schema.fields) {
        row[f.name] = f.type === 'boolean' ? false : f.type === 'int' ? '' : '';
    }
    return row;
}

function FieldInput({field, value, onChange}: {
    field: FieldDef;
    value: any;
    onChange: (v: any) => void;
}) {
    if (field.type === 'boolean') {
        return (
            <input
                type="checkbox"
                className="form-check-input"
                checked={!!value}
                disabled={field.readOnly}
                onChange={e => onChange(e.target.checked)}
            />
        );
    }
    return (
        <input
            type={field.type === 'int' ? 'number' : 'text'}
            className="form-control form-control-sm"
            value={value ?? ''}
            readOnly={field.readOnly}
            onChange={e => onChange(field.type === 'int' ? (e.target.value === '' ? null : parseInt(e.target.value)) : e.target.value)}
        />
    );
}

// ---- component --------------------------------------------------------------

function ScaffoldAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const {userInfo} = useUser();

    const [tables, setTables] = useState<TableOption[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');

    const [pageResult, setPageResult] = useState<PageResult | null>(null);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // editing state
    const [editRow, setEditRow] = useState<Record<string, any> | null>(null);
    const [editIsNew, setEditIsNew] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // delete confirm
    const [deleteId, setDeleteId] = useState<number | null>(null);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Admin', href: '/'},
            {title: 'Reference Tables', href: '/scaffold'},
        ]);
        fetchTables();
    }, []);

    useEffect(() => {
        if (selectedTable) fetchPage(0);
    }, [selectedTable]);

    function fetchTables() {
        fetch(import.meta.env.VITE_APP_BIE_URL + '/admin/scaffold', {headers: {Authorization: 'Bearer ' + userInfo?.accessToken}})
            .then(r => r.json())
            .then((data: TableOption[]) => {
                setTables(data);
            })
            .catch(e => setError('Failed to load tables: ' + e.message));
    }

    function fetchPage(p: number) {
        if (!selectedTable) return;
        setLoading(true);
        setError(null);
        fetch(`${import.meta.env.VITE_APP_BIE_URL}/admin/scaffold?table=${encodeURIComponent(selectedTable)}&page=${p}&size=${PAGE_SIZE}`, {
            headers: {Authorization: 'Bearer ' + userInfo?.accessToken},
        })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then((data: PageResult) => {
                setPageResult(data);
                setPage(p);
            })
            .catch(e => setError('Failed to load data: ' + e.message))
            .finally(() => setLoading(false));
    }

    function startAdd() {
        if (!pageResult) return;
        setEditRow(emptyRow(pageResult.schema));
        setEditIsNew(true);
        setSaveError(null);
    }

    function startEdit(row: Record<string, any>) {
        setEditRow({...row});
        setEditIsNew(false);
        setSaveError(null);
    }

    function cancelEdit() {
        setEditRow(null);
        setSaveError(null);
    }

    function saveEdit() {
        if (!editRow || !selectedTable) return;
        setSaving(true);
        setSaveError(null);
        fetch(`${import.meta.env.VITE_APP_BIE_URL}/admin/scaffold?table=${encodeURIComponent(selectedTable)}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + userInfo?.accessToken},
            body: JSON.stringify(editRow),
        })
            .then(r => {
                if (!r.ok) return r.json().then(e => Promise.reject(e.error ?? 'Save failed'));
                return r.json();
            })
            .then(() => {
                setEditRow(null);
                fetchPage(page);
            })
            .catch(e => setSaveError(String(e)))
            .finally(() => setSaving(false));
    }

    function confirmDelete(id: number) {
        setDeleteId(id);
    }

    function doDelete() {
        if (deleteId === null || !selectedTable) return;
        fetch(`${import.meta.env.VITE_APP_BIE_URL}/admin/scaffold?table=${encodeURIComponent(selectedTable)}&id=${deleteId}`, {
            method: 'DELETE',
            headers: {Authorization: 'Bearer ' + userInfo?.accessToken},
        })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                setDeleteId(null);
                fetchPage(page);
            })
            .catch(e => setError('Delete failed: ' + e.message));
    }

    const schema = pageResult?.schema;

    return (
        <div className="d-flex flex-row">
            <Menu/>

            <div className="flex-grow-1 p-3">
                <h4 className="mb-3">Reference Tables</h4>
                <p>
                    A small number of tables can be managed here for reference data used by applications. Select a
                    table to view, edit, or add rows.
                </p>
                <p>
                    <strong>Warning:</strong> Be careful when editing these tables, as they may be used by various parts
                    of the application and incorrect changes could cause issues.
                </p>
                <p>
                    <strong>Note:</strong> Caches are not automatically cleared when changes are made here, so you may need to manually clear
                    caches or restart applications to see changes take effect in some cases.
                </p>

                {/* Table selector */}
                <div className="d-flex flex-wrap gap-2 mb-3 align-items-end">
                    <div>
                        <label className="form-label small mb-1">Table</label>
                        <select
                            className="form-select form-select-sm"
                            value={selectedTable}
                            onChange={e => { setSelectedTable(e.target.value); setPage(0); setPageResult(null); }}>
                            <option value="" disabled>— select a table —</option>
                            {tables.map(t => (
                                <option key={t.table} value={t.table}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <button className="btn btn-primary btn-sm" onClick={startAdd} disabled={!schema}>
                            <i className="bi bi-plus-lg me-1"/>Add Row
                        </button>
                    </div>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                {/* Results table */}
                {schema && (
                    <>
                        <div className="table-responsive">
                            <table className="table table-bordered table-sm table-hover align-middle">
                                <thead className="table-light">
                                <tr>
                                    {schema.fields.map(f => (
                                        <th key={f.name}>{f.name}{f.primaryKey ? ' 🔑' : ''}</th>
                                    ))}
                                    <th style={{width: '120px'}}>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {loading && (
                                    <tr><td colSpan={schema.fields.length + 1} className="text-center text-muted">Loading…</td></tr>
                                )}
                                {!loading && pageResult?.content.length === 0 && (
                                    <tr><td colSpan={schema.fields.length + 1} className="text-center text-muted">No rows.</td></tr>
                                )}
                                {!loading && pageResult?.content.map((row, i) => (
                                    <tr key={i}>
                                        {schema.fields.map(f => (
                                            <td key={f.name}>
                                                {f.type === 'boolean'
                                                    ? <span className={`badge ${row[f.name] ? 'bg-success' : 'bg-secondary'}`}>{row[f.name] ? 'true' : 'false'}</span>
                                                    : String(row[f.name] ?? '')}
                                            </td>
                                        ))}
                                        <td>
                                            <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => startEdit(row)}>
                                                <i className="bi bi-pencil"/>
                                            </button>
                                            <button className="btn btn-outline-danger btn-sm" onClick={() => confirmDelete(row['id'])}>
                                                <i className="bi bi-trash"/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pageResult && pageResult.totalPages > 1 && (
                            <nav>
                                <ul className="pagination pagination-sm">
                                    <li className={`page-item ${page === 0 ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => fetchPage(page - 1)}>«</button>
                                    </li>
                                    {Array.from({length: pageResult.totalPages}, (_, i) => (
                                        <li key={i} className={`page-item ${i === page ? 'active' : ''}`}>
                                            <button className="page-link" onClick={() => fetchPage(i)}>{i + 1}</button>
                                        </li>
                                    ))}
                                    <li className={`page-item ${page >= pageResult.totalPages - 1 ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => fetchPage(page + 1)}>»</button>
                                    </li>
                                </ul>
                            </nav>
                        )}
                        <div className="text-muted small mb-3">
                            {pageResult?.totalElements ?? 0} rows total
                        </div>
                    </>
                )}

                {/* Edit / Add modal */}
                {editRow && schema && (
                    <div className="modal d-block" tabIndex={-1} style={{background: 'rgba(0,0,0,0.4)'}}>
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">{editIsNew ? 'Add Row' : 'Edit Row'} — {schema.label}</h5>
                                    <button className="btn-close" onClick={cancelEdit}/>
                                </div>
                                <div className="modal-body">
                                    {saveError && <div className="alert alert-danger">{saveError}</div>}
                                    {schema.fields.map(f => (
                                        <div className="mb-3" key={f.name}>
                                            <label className="form-label fw-semibold">
                                                {f.name}
                                                {f.primaryKey && <span className="text-muted ms-1 small">(PK)</span>}
                                                {f.required && <span className="text-danger ms-1">*</span>}
                                            </label>
                                            <FieldInput
                                                field={f}
                                                value={editRow[f.name]}
                                                onChange={v => setEditRow(prev => ({...prev!, [f.name]: v}))}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
                                    <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete confirm modal */}
                {deleteId !== null && (
                    <div className="modal d-block" tabIndex={-1} style={{background: 'rgba(0,0,0,0.4)'}}>
                        <div className="modal-dialog modal-sm">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Confirm Delete</h5>
                                    <button className="btn-close" onClick={() => setDeleteId(null)}/>
                                </div>
                                <div className="modal-body">
                                    Delete row with id <strong>{deleteId}</strong>?
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
                                    <button className="btn btn-danger" onClick={doDelete}>Delete</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ScaffoldAdmin;



