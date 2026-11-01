/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import {Form} from 'react-bootstrap';
import Menu from '../../components/menu.tsx';
import {storageApi} from '../../api/endpoints.ts';
import {ApiError} from '../../api/client.ts';
import type {StorageLocation} from '../../api/types.ts';

/**
 * Storage location list/create/edit/set-default/migrate: GET/POST
 * /api/v2/admin/storage-locations, GET/PUT .../{id}, POST .../{id}/default,
 * POST .../storage-locations/migrate. Secrets (API keys/passwords) are
 * never returned by the backend — only `hasSecretKeyConfigured`/
 * `hasPasswordConfigured` booleans. The edit form only sends a new
 * secret/password value if the admin actually typed one; leaving those
 * fields blank omits them from the PUT body entirely so the server-held
 * value is preserved rather than being overwritten with an empty string.
 */
export default function StorageLocationsAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_API_URL;
    const [locations, setLocations] = useState<StorageLocation[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [name, setName] = useState('');
    const [type, setType] = useState('filesystem');

    const [editingId, setEditingId] = useState<string | number | null>(null);
    const [editName, setEditName] = useState('');
    const [editSecretKey, setEditSecretKey] = useState('');
    const [editPassword, setEditPassword] = useState('');

    const [migrateSource, setMigrateSource] = useState('');
    const [migrateDestination, setMigrateDestination] = useState('');
    const [migrateDeleteSource, setMigrateDeleteSource] = useState(false);
    const [migrating, setMigrating] = useState(false);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Storage locations', href: '/admin/storage-locations'}
        ]);
    }, []);

    function load(signal?: AbortSignal) {
        setLoading(true);
        storageApi
            .list(apiUrl, signal)
            .then(list => {
                setLocations(list);
                setError(null);
            })
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setError(err?.message ?? 'Failed to load storage locations');
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl]);

    async function create() {
        if (!name) return;
        try {
            await storageApi.create(apiUrl, {name, type});
            setName('');
            load();
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Create failed');
        }
    }

    async function saveEdit() {
        if (editingId === null) return;
        const update: Partial<StorageLocation> = {name: editName};
        // Only include secret/password fields if the admin actually typed a new value.
        if (editSecretKey) update.secretKey = editSecretKey;
        if (editPassword) update.password = editPassword;
        try {
            await storageApi.update(apiUrl, editingId, update);
            setEditingId(null);
            setEditSecretKey('');
            setEditPassword('');
            load();
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Update failed');
        }
    }

    async function setDefault(id: string | number) {
        try {
            await storageApi.setDefault(apiUrl, id);
            load();
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Failed to set default');
        }
    }

    async function migrate() {
        if (!migrateSource || !migrateDestination) return;
        if (!window.confirm('Migrate all images from the source location to the destination? This may take a long time.')) return;
        setMigrating(true);
        try {
            await storageApi.migrate(apiUrl, {source: migrateSource, destination: migrateDestination, deleteSource: migrateDeleteSource});
            load();
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Migration failed');
        } finally {
            setMigrating(false);
        }
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-storage-locations">
                <h2>Storage locations</h2>

                {error && <div className="alert alert-danger">{error}</div>}
                {loading && <div className="d-flex mt-4"><div className="spinner-border ms-auto me-auto"/></div>}

                {!loading && (
                    <>
                        <table className="table table-sm table-striped">
                            <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Credentials</th>
                                <th>Default</th>
                                <th/>
                            </tr>
                            </thead>
                            <tbody>
                            {locations.map(loc => (
                                <tr key={String(loc.id)}>
                                    <td>{loc.name}</td>
                                    <td>{loc.type}</td>
                                    <td>
                                        {loc.hasSecretKeyConfigured && <span className="badge bg-secondary me-1">secret key set</span>}
                                        {loc.hasPasswordConfigured && <span className="badge bg-secondary">password set</span>}
                                    </td>
                                    <td>{loc.isDefault ? <span className="badge bg-success">default</span> : (
                                        <button className="btn btn-link btn-sm" onClick={() => setDefault(loc.id)}>Set as default</button>
                                    )}</td>
                                    <td>
                                        <button className="btn btn-link btn-sm" onClick={() => {
                                            setEditingId(loc.id);
                                            setEditName(loc.name);
                                            setEditSecretKey('');
                                            setEditPassword('');
                                        }}>Edit</button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>

                        <h5>Add storage location</h5>
                        <div className="d-flex gap-2 mb-4" style={{maxWidth: 500}}>
                            <input className="form-control" placeholder="Name" value={name} onChange={e => setName(e.target.value)}/>
                            <input className="form-control" placeholder="Type (e.g. filesystem, s3)" value={type} onChange={e => setType(e.target.value)}/>
                            <button className="btn btn-primary" onClick={create} disabled={!name}>Add</button>
                        </div>

                        <h5>Migrate storage</h5>
                        <div className="d-flex gap-2 align-items-center" style={{maxWidth: 700}}>
                            <select className="form-select" value={migrateSource} onChange={e => setMigrateSource(e.target.value)}>
                                <option value="">Source…</option>
                                {locations.map(l => <option key={String(l.id)} value={String(l.id)}>{l.name}</option>)}
                            </select>
                            <select className="form-select" value={migrateDestination} onChange={e => setMigrateDestination(e.target.value)}>
                                <option value="">Destination…</option>
                                {locations.filter(l => String(l.id) !== migrateSource).map(l => <option key={String(l.id)} value={String(l.id)}>{l.name}</option>)}
                            </select>
                            <label className="d-flex align-items-center gap-1 text-nowrap">
                                <input type="checkbox" checked={migrateDeleteSource} onChange={e => setMigrateDeleteSource(e.target.checked)}/>
                                Delete source after migration
                            </label>
                            <button className="btn btn-outline-primary" disabled={migrating || !migrateSource || !migrateDestination} onClick={migrate}>
                                {migrating ? 'Migrating…' : 'Migrate'}
                            </button>
                        </div>
                    </>
                )}

                {editingId !== null && (
                    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75" style={{zIndex: 1050}}>
                        <div className="card p-4" style={{maxWidth: 500, width: '100%'}}>
                            <h4>Edit storage location</h4>
                            <Form.Group className="mb-2">
                                <Form.Label>Name</Form.Label>
                                <Form.Control value={editName} onChange={e => setEditName(e.target.value)}/>
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>New secret key (leave blank to keep current)</Form.Label>
                                <Form.Control type="password" value={editSecretKey} onChange={e => setEditSecretKey(e.target.value)}/>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>New password (leave blank to keep current)</Form.Label>
                                <Form.Control type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)}/>
                            </Form.Group>
                            <div>
                                <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                                <button className="btn btn-default ms-2" onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
