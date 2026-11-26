/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import Menu from '../../components/menu.tsx';
import {tagApi} from '../../api/endpoints.ts';
import {ApiError} from '../../api/client.ts';
import type {TagRef} from '../../api/types.ts';

function TagRow({tag, allTags, apiUrl, busy, setBusy, onChanged, onError}: {
    tag: TagRef;
    allTags: TagRef[];
    apiUrl: string;
    busy: boolean;
    setBusy: (b: boolean) => void;
    onChanged: () => void;
    onError: (msg: string) => void;
}) {
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState(tag.path.split('/').pop() ?? tag.path);
    const [moving, setMoving] = useState(false);
    const [moveTarget, setMoveTarget] = useState('');

    async function rename() {
        if (!name) {
            setRenaming(false);
            return;
        }
        setBusy(true);
        try {
            await tagApi.rename(apiUrl, tag.id, name);
            setRenaming(false);
            onChanged();
        } catch (err) {
            onError((err as ApiError)?.message ?? 'Rename failed');
        } finally {
            setBusy(false);
        }
    }

    async function move() {
        setBusy(true);
        try {
            const newParentId = moveTarget === '' ? null : Number(moveTarget);
            await tagApi.move(apiUrl, tag.id, newParentId);
            setMoving(false);
            onChanged();
        } catch (err) {
            onError((err as ApiError)?.message ?? 'Move failed');
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!window.confirm(`Delete tag "${tag.path}"?`)) return;
        setBusy(true);
        try {
            await tagApi.remove(apiUrl, tag.id);
            onChanged();
        } catch (err) {
            onError((err as ApiError)?.message ?? 'Delete failed');
        } finally {
            setBusy(false);
        }
    }

    return (
        <tr>
            <td>{tag.id}</td>
            <td>
                {renaming ? (
                    <input className="form-control form-control-sm w-auto d-inline-block" value={name} onChange={e => setName(e.target.value)}/>
                ) : (
                    tag.path
                )}
            </td>
            <td className="d-flex gap-1 flex-wrap">
                {renaming ? (
                    <>
                        <button className="btn btn-sm btn-link" disabled={busy} onClick={rename}>Save</button>
                        <button className="btn btn-sm btn-link" disabled={busy} onClick={() => setRenaming(false)}>Cancel</button>
                    </>
                ) : moving ? (
                    <>
                        <select className="form-select form-select-sm w-auto" value={moveTarget} onChange={e => setMoveTarget(e.target.value)}>
                            <option value="">(root)</option>
                            {allTags.filter(t => t.id !== tag.id).map(t => <option key={t.id} value={t.id}>{t.path}</option>)}
                        </select>
                        <button className="btn btn-sm btn-link" disabled={busy} onClick={move}>Save</button>
                        <button className="btn btn-sm btn-link" disabled={busy} onClick={() => setMoving(false)}>Cancel</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-sm btn-link" disabled={busy} onClick={() => setRenaming(true)}>Rename</button>
                        <button className="btn btn-sm btn-link" disabled={busy} onClick={() => setMoving(true)}>Move</button>
                        <button className="btn btn-sm btn-link text-danger" disabled={busy} onClick={remove}>Delete</button>
                    </>
                )}
            </td>
        </tr>
    );
}

/**
 * Flat tag list admin: GET /api/v2/admin/tags/tree?q= (filterable flat
 * list, not a nested tree), POST /tags/import (multipart `tagfile`), POST
 * /tags (idempotent create by path), PUT /tags/{id} ({rename} or
 * {move:{newParentId}}), DELETE /tags/{id}.
 */
export default function TagsAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void }) {
    const apiUrl = import.meta.env.VITE_APP_IMAGES_API_URL;
    const [tags, setTags] = useState<TagRef[]>([]);
    const [query, setQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [newPath, setNewPath] = useState('');
    const [newParentId, setNewParentId] = useState('');

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: 'Admin', href: '/admin'},
            {title: 'Tags', href: '/admin/tags'}
        ]);
    }, []);

    function load(signal?: AbortSignal) {
        setLoading(true);
        tagApi
            .tree(apiUrl, query || undefined, signal)
            .then(resp => {
                setTags(resp.results);
                setError(null);
            })
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setError(err?.message ?? 'Failed to load tags');
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl, query]);

    async function createTag() {
        if (!newPath) return;
        setBusy(true);
        try {
            const parentId = newParentId === '' ? undefined : Number(newParentId);
            await tagApi.create(apiUrl, newPath, parentId ?? null);
            setNewPath('');
            load();
        } catch (err) {
            setError((err as ApiError)?.message ?? 'Create failed');
        } finally {
            setBusy(false);
        }
    }

    function importFile(file: File) {
        setBusy(true);
        tagApi
            .importFile(apiUrl, file)
            .then(() => load())
            .catch(err => setError((err as ApiError)?.message ?? 'Import failed'))
            .finally(() => setBusy(false));
    }

    return (
        <div className="d-flex flex-row">
            <Menu/>
            <div className="flex-grow-1 p-3" data-testid="admin-tags">
                <h2>Tags</h2>

                <div className="d-flex gap-2 mb-3" style={{maxWidth: 400}}>
                    <input className="form-control" placeholder="Filter by path" value={query} onChange={e => setQuery(e.target.value)} data-testid="tag-filter"/>
                </div>

                <div className="mb-3">
                    <label className="form-label">Bulk import tags</label>
                    <input type="file" className="form-control w-auto" disabled={busy} onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) importFile(file);
                    }}/>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}
                {loading && <div className="d-flex mt-4"><div className="spinner-border ms-auto me-auto"/></div>}

                {!loading && (
                    <>
                        <table className="table table-sm table-striped">
                            <thead>
                            <tr>
                                <th>ID</th>
                                <th>Path</th>
                                <th/>
                            </tr>
                            </thead>
                            <tbody>
                            {tags.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="text-muted">No tags found.</td>
                                </tr>
                            )}
                            {tags.map(tag => (
                                <TagRow
                                    key={tag.id}
                                    tag={tag}
                                    allTags={tags}
                                    apiUrl={apiUrl}
                                    busy={busy}
                                    setBusy={setBusy}
                                    onChanged={() => load()}
                                    onError={setError}
                                />
                            ))}
                            </tbody>
                        </table>

                        <h6>Add tag</h6>
                        <div className="d-flex gap-2" style={{maxWidth: 600}}>
                            <input className="form-control" placeholder="Path (e.g. Botany/Leaf)" value={newPath} onChange={e => setNewPath(e.target.value)} data-testid="new-tag-path"/>
                            <select className="form-select w-auto" value={newParentId} onChange={e => setNewParentId(e.target.value)}>
                                <option value="">(root)</option>
                                {tags.map(t => <option key={t.id} value={t.id}>{t.path}</option>)}
                            </select>
                            <button className="btn btn-primary" disabled={busy || !newPath} onClick={createTag}>Add</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
