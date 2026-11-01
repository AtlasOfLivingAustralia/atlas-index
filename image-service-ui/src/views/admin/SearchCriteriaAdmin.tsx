/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import {Form} from 'react-bootstrap';
import Menu from '../../components/menu.tsx';
import {criteriaApi} from '../../api/endpoints.ts';
import {ApiError} from '../../api/client.ts';
import type {SearchCriteriaDefinition} from '../../api/types.ts';

const VALUE_TYPES = ['string', 'number', 'date', 'boolean'];

/**
 * CRUD admin for advanced-search field definitions: GET/POST
 * /api/v2/admin/search-criteria, PUT/DELETE .../{id}. Deleting a definition
 * that is currently referenced by a saved search returns 409, surfaced here
 * distinctly rather than as a generic failure.
 */
export default function SearchCriteriaAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_API_URL;
    const [definitions, setDefinitions] = useState<SearchCriteriaDefinition[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Partial<SearchCriteriaDefinition> | null>(null);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Search criteria', href: '/admin/search-criteria'}
        ]);
    }, []);

    function load(signal?: AbortSignal) {
        setLoading(true);
        criteriaApi
            .list(apiUrl, signal)
            .then(resp => {
                setDefinitions(resp.results);
                setError(null);
            })
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setError(err?.message ?? 'Failed to load search criteria definitions');
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl]);

    async function save() {
        if (!editing?.name || !editing?.fieldName || !editing?.type || !editing?.valueType) return;
        try {
            if (editing.id !== undefined) {
                await criteriaApi.update(apiUrl, editing.id, editing);
            } else {
                await criteriaApi.create(apiUrl, {
                    name: editing.name,
                    fieldName: editing.fieldName,
                    type: editing.type,
                    valueType: editing.valueType,
                    description: editing.description,
                    units: editing.units
                });
            }
            setEditing(null);
            load();
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Save failed');
        }
    }

    async function remove(id: string | number) {
        if (!window.confirm('Delete this search criteria definition?')) return;
        try {
            await criteriaApi.remove(apiUrl, id);
            load();
        } catch (err) {
            const apiErr = err as ApiError;
            if (apiErr?.status === 409) {
                setError('This search criteria definition is currently in use and cannot be deleted.');
            } else {
                setError(apiErr?.message ?? 'Delete failed');
            }
        }
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-search-criteria">
                <h2>Search criteria definitions</h2>
                <p className="text-muted">These fields power the "Advanced search" panel on the public search page.</p>

                {error && <div className="alert alert-danger" data-testid="search-criteria-error">{error}</div>}
                {loading && <div className="d-flex mt-4"><div className="spinner-border ms-auto me-auto"/></div>}

                {!loading && (
                    <>
                        <table className="table table-sm table-striped">
                            <thead>
                            <tr>
                                <th>Name</th>
                                <th>Field</th>
                                <th>Type</th>
                                <th>Value type</th>
                                <th>Units</th>
                                <th>Description</th>
                                <th/>
                            </tr>
                            </thead>
                            <tbody>
                            {definitions.map(d => (
                                <tr key={d.id}>
                                    <td>{d.name}</td>
                                    <td><code>{d.fieldName}</code></td>
                                    <td>{d.type}</td>
                                    <td>{d.valueType}</td>
                                    <td>{d.units}</td>
                                    <td>{d.description}</td>
                                    <td>
                                        <button className="btn btn-link btn-sm" onClick={() => setEditing(d)}>Edit</button>
                                        <button className="btn btn-link btn-sm text-danger" onClick={() => remove(d.id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        <button className="btn btn-primary btn-sm" onClick={() => setEditing({name: '', fieldName: '', type: 'criteria', valueType: VALUE_TYPES[0]})}>Add definition</button>
                    </>
                )}

                {editing && (
                    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75" style={{zIndex: 1050}}>
                        <div className="card p-4" style={{maxWidth: 500, width: '100%'}}>
                            <h4>{editing.id !== undefined ? 'Edit' : 'New'} search criteria definition</h4>
                            <Form.Group className="mb-2">
                                <Form.Label>Name</Form.Label>
                                <Form.Control value={editing.name ?? ''} onChange={e => setEditing({...editing, name: e.target.value})}/>
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Field name</Form.Label>
                                <Form.Control value={editing.fieldName ?? ''} onChange={e => setEditing({...editing, fieldName: e.target.value})}/>
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Type</Form.Label>
                                <Form.Control value={editing.type ?? ''} onChange={e => setEditing({...editing, type: e.target.value})}/>
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Value type</Form.Label>
                                <Form.Select value={editing.valueType ?? VALUE_TYPES[0]} onChange={e => setEditing({...editing, valueType: e.target.value})}>
                                    {VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Units</Form.Label>
                                <Form.Control value={editing.units ?? ''} onChange={e => setEditing({...editing, units: e.target.value})}/>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Description</Form.Label>
                                <Form.Control as="textarea" rows={2} value={editing.description ?? ''} onChange={e => setEditing({...editing, description: e.target.value})}/>
                            </Form.Group>
                            <div>
                                <button className="btn btn-primary" onClick={save}>Save</button>
                                <button className="btn btn-default ms-2" onClick={() => setEditing(null)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
