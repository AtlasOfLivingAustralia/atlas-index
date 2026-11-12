/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import Menu from '../../components/menu.tsx';
import {licenceApi} from '../../api/endpoints.ts';
import {ApiError} from '../../api/client.ts';
import type {LicenceMapping, LicencesResponse} from '../../api/types.ts';

/**
 * Licences + source-value-to-licence mapping admin: GET/PUT
 * /api/v2/admin/licences, a full upsert of `{licences, licenceMappings}`.
 * The licence catalog itself (name/url/imageUrl) is shown read-only;
 * mappings (which source rights string maps to which licence acronym) are
 * editable, and every save PUTs the full document back (licences included
 * unchanged) since there is no per-field update endpoint.
 */
export default function LicencesAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_IMAGES_API_URL;
    const [data, setData] = useState<LicencesResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newSourceValue, setNewSourceValue] = useState('');
    const [newAcronym, setNewAcronym] = useState('');

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Licences', href: '/admin/licences'}
        ]);
    }, []);

    function load(signal?: AbortSignal) {
        setLoading(true);
        licenceApi
            .get(apiUrl, signal)
            .then(resp => {
                setData(resp);
                setError(null);
            })
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setError(err?.message ?? 'Failed to load licences');
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl]);

    async function saveMappings(mappings: LicenceMapping[]) {
        if (!data) return;
        setSaving(true);
        try {
            const updated = await licenceApi.update(apiUrl, {licences: data.licences, licenceMappings: mappings});
            setData(updated);
            setError(null);
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Failed to update mappings');
        } finally {
            setSaving(false);
        }
    }

    function updateMappingAcronym(value: string, acronym: string) {
        if (!data) return;
        saveMappings(data.licenceMappings.map(m => (m.value === value ? {...m, acronym} : m)));
    }

    function removeMapping(value: string) {
        if (!data) return;
        saveMappings(data.licenceMappings.filter(m => m.value !== value));
    }

    function addMapping() {
        if (!data || !newSourceValue || !newAcronym) return;
        saveMappings([...data.licenceMappings, {value: newSourceValue, acronym: newAcronym}]);
        setNewSourceValue('');
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-licences">
                <h2>Licences</h2>
                {error && <div className="alert alert-danger">{error}</div>}
                {loading && <div className="d-flex mt-4"><div className="spinner-border ms-auto me-auto"/></div>}

                {!loading && data && (
                    <>
                        <table className="table table-sm table-striped mb-4">
                            <thead>
                            <tr>
                                <th>Acronym</th>
                                <th>Name</th>
                                <th>URL</th>
                                <th>Badge</th>
                            </tr>
                            </thead>
                            <tbody>
                            {data.licences.map(l => (
                                <tr key={l.acronym}>
                                    <td>{l.acronym}</td>
                                    <td>{l.name}</td>
                                    <td>{l.url && <a href={l.url} target="_blank" rel="noreferrer">{l.url}</a>}</td>
                                    <td>{l.imageUrl && <img src={l.imageUrl} alt={l.acronym} style={{height: 24}}/>}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>

                        <h5>Source value mappings</h5>
                        <table className="table table-sm table-striped">
                            <thead>
                            <tr>
                                <th>Source rights value</th>
                                <th>Mapped licence</th>
                                <th/>
                            </tr>
                            </thead>
                            <tbody>
                            {data.licenceMappings.map(m => (
                                <tr key={m.value}>
                                    <td>{m.value}</td>
                                    <td>
                                        <select className="form-select form-select-sm w-auto" value={m.acronym} disabled={saving} onChange={e => updateMappingAcronym(m.value, e.target.value)}>
                                            {data.licences.map(l => <option key={l.acronym} value={l.acronym}>{l.acronym}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <button className="btn btn-link btn-sm text-danger" disabled={saving} onClick={() => removeMapping(m.value)}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>

                        <h6 className="mt-3">Add mapping</h6>
                        <div className="d-flex gap-2" style={{maxWidth: 500}}>
                            <input className="form-control" placeholder="Source rights value" value={newSourceValue} onChange={e => setNewSourceValue(e.target.value)}/>
                            <select className="form-select w-auto" value={newAcronym} onChange={e => setNewAcronym(e.target.value)}>
                                <option value="">Licence…</option>
                                {data.licences.map(l => <option key={l.acronym} value={l.acronym}>{l.acronym}</option>)}
                            </select>
                            <button className="btn btn-primary" disabled={saving || !newSourceValue || !newAcronym} onClick={addMapping}>Add</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
