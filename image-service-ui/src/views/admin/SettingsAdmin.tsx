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
import type {Setting} from '../../api/types.ts';

/** Repository settings key/value admin: GET /api/v2/admin/settings, PUT .../settings/{name}. */
export default function SettingsAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_IMAGES_API_URL;
    const [settings, setSettings] = useState<Setting[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Settings', href: '/admin/settings'}
        ]);
    }, []);

    function load(signal?: AbortSignal) {
        setLoading(true);
        adminApi
            .getSettings(apiUrl, signal)
            .then(resp => {
                setSettings(resp.results);
                setError(null);
            })
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setError(err?.message ?? 'Failed to load settings');
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl]);

    async function save(name: string) {
        try {
            await adminApi.updateSetting(apiUrl, name, editValue);
            setEditingName(null);
            load();
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Save failed');
        }
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-settings">
                <h2>Settings</h2>
                {error && <div className="alert alert-danger">{error}</div>}
                {loading && <div className="d-flex mt-4"><div className="spinner-border ms-auto me-auto"/></div>}

                {!loading && (
                    <table className="table table-sm table-striped">
                        <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Value</th>
                            <th>Description</th>
                            <th/>
                        </tr>
                        </thead>
                        <tbody>
                        {settings.map(s => (
                            <tr key={s.name}>
                                <td>{s.name}</td>
                                <td>{s.type}</td>
                                <td>
                                    {editingName === s.name ? (
                                        <input className="form-control form-control-sm" value={editValue} onChange={e => setEditValue(e.target.value)}/>
                                    ) : (
                                        <code>{s.value}</code>
                                    )}
                                </td>
                                <td>{s.description}</td>
                                <td>
                                    {editingName === s.name ? (
                                        <>
                                            <button className="btn btn-link btn-sm" onClick={() => save(s.name)}>Save</button>
                                            <button className="btn btn-link btn-sm" onClick={() => setEditingName(null)}>Cancel</button>
                                        </>
                                    ) : (
                                        <button className="btn btn-link btn-sm" onClick={() => {
                                            setEditingName(s.name);
                                            setEditValue(s.value);
                                        }}>Edit</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
